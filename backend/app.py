from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, List

from flask import Flask, jsonify, request
from flask_cors import CORS

from processing import apply_filters, to_frontend_payload
from store import DatasetStore

ROOT_DIR = Path(__file__).resolve().parents[1]
LABELS_DIR = Path(__file__).resolve().parent / "labels"
LABELS_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
CORS(app)
store = DatasetStore(ROOT_DIR)
POI_MEMORY: Dict[str, List[Dict[str, Any]]] = {}


def _payload_filters(body: Dict[str, Any]) -> List[str]:
    filters = body.get("filters") or []
    if isinstance(filters, str):
        return [filters]
    if isinstance(filters, list):
        return [str(x) for x in filters]
    raise ValueError("filters must be a string or list")


def _metadata(gps_track) -> Dict[str, Any]:
    start = gps_track.iloc[0]
    end = gps_track.iloc[-1]
    return {
        "depth_range_m": [0, 4],
        "recording_start": str(start["timestamp"]),
        "recording_end": str(end["timestamp"]),
        "total_distance_miles": float(end["distance_miles"] - start["distance_miles"]),
        "total_distance_km": float((end["distance_miles"] - start["distance_miles"]) * 1.60934),
        "sample_rate": "not_set",
        "antenna_frequency": "not_set",
    }


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/gpr/dates")
def dates():
    return jsonify({"dates": store.get_available_dates()})


@app.get("/api/gpr/bounds")
def bounds():
    date = request.args.get("date")
    if not date:
        return jsonify({"detail": "date is required"}), 400
    try:
        dataset = store.load_date(str(date))
        gps = dataset.gps_track
        payload = {
            "min_lat": float(gps["lat"].min()),
            "max_lat": float(gps["lat"].max()),
            "min_lon": float(gps["lon"].min()),
            "max_lon": float(gps["lon"].max()),
            "min_mileage": float(gps["distance_miles"].min()),
            "max_mileage": float(gps["distance_miles"].max()),
        }
        return jsonify(payload)
    except Exception as exc:
        return jsonify({"detail": str(exc)}), 400


@app.get("/api/gpr/slice")
def slice_compat():
    date = request.args.get("date")
    if not date:
        return jsonify({"detail": "date is required"}), 400

    try:
        dataset = store.load_date(str(date))
        gpr_subset, gps_subset = store.slice_by_latlng(
            dataset,
            float(request.args.get("start_lat")),
            float(request.args.get("start_lon")),
            float(request.args.get("end_lat")),
            float(request.args.get("end_lon")),
        )
        filters = request.args.get("filters")
        parsed_filters = [x.strip() for x in filters.split(",")] if filters else ["raw"]
        gpr_subset = apply_filters(gpr_subset, parsed_filters)
        payload = to_frontend_payload(str(date), gpr_subset, gps_subset, _metadata(gps_subset))
        return jsonify(payload)
    except Exception as exc:
        return jsonify({"detail": str(exc)}), 400


@app.post("/api/gpr/query-latlng")
def query_latlng():
    body = request.get_json(silent=True) or {}
    date = body.get("date")
    start = body.get("startpoint") or {}
    end = body.get("endpoint") or {}

    if not date:
        return jsonify({"detail": "date is required"}), 400

    try:
        dataset = store.load_date(str(date))
        gpr_subset, gps_subset = store.slice_by_latlng(
            dataset,
            float(start.get("lat")),
            float(start.get("lng")),
            float(end.get("lat")),
            float(end.get("lng")),
        )
        gpr_subset = apply_filters(gpr_subset, _payload_filters(body))
        payload = to_frontend_payload(str(date), gpr_subset, gps_subset, _metadata(gps_subset))
        return jsonify(payload)
    except NotImplementedError as exc:
        return jsonify({"detail": str(exc)}), 422
    except Exception as exc:
        return jsonify({"detail": str(exc)}), 400


@app.post("/api/gpr/query-mileage")
def query_mileage():
    body = request.get_json(silent=True) or {}
    date = body.get("date")

    if not date:
        return jsonify({"detail": "date is required"}), 400

    try:
        dataset = store.load_date(str(date))
        gpr_subset, gps_subset = store.slice_by_mileage(
            dataset,
            float(body.get("start_mileage")),
            float(body.get("end_mileage")),
        )
        gpr_subset = apply_filters(gpr_subset, _payload_filters(body))
        payload = to_frontend_payload(str(date), gpr_subset, gps_subset, _metadata(gps_subset))
        return jsonify(payload)
    except NotImplementedError as exc:
        return jsonify({"detail": str(exc)}), 422
    except Exception as exc:
        return jsonify({"detail": str(exc)}), 400


@app.get("/api/gps/track")
def gps_track():
    date = request.args.get("date")
    if not date:
        return jsonify({"detail": "date is required"}), 400

    try:
        dataset = store.load_date(str(date))
        return jsonify({"points": dataset.gps_track.to_dict(orient="records")})
    except Exception as exc:
        return jsonify({"detail": str(exc)}), 400


@app.post("/api/poi")
def create_poi():
    body = request.get_json(silent=True) or {}
    date = str(body.get("date") or "unknown")
    labels_file = LABELS_DIR / f"{date}_labels.csv"

    row = {
        "id": body.get("id", ""),
        "type": body.get("type", "other"),
        "label": body.get("label", ""),
        "slice_x": body.get("slice_x", ""),
        "slice_y": body.get("slice_y", ""),
        "lat": body.get("lat", ""),
        "lon": body.get("lon", ""),
        "mile_marker": body.get("mile_marker", ""),
        "notes": body.get("notes", ""),
    }

    write_header = not labels_file.exists()
    with labels_file.open("a", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=list(row.keys()))
        if write_header:
            writer.writeheader()
        writer.writerow(row)

    POI_MEMORY.setdefault(date, []).append(row)

    return jsonify({"saved": True, "file": str(labels_file.name), "poi": row})


@app.post("/api/poi/")
def create_poi_slash():
    return create_poi()


@app.get("/api/poi/")
def get_pois():
    date = request.args.get("date", "unknown")
    return jsonify({"items": POI_MEMORY.get(date, [])})


@app.delete("/api/poi/<poi_id>")
def delete_poi(poi_id: str):
    deleted = False
    for date, items in POI_MEMORY.items():
        before = len(items)
        POI_MEMORY[date] = [p for p in items if str(p.get("id")) != poi_id]
        if len(POI_MEMORY[date]) != before:
            deleted = True
    return jsonify({"deleted": deleted, "id": poi_id})


@app.post("/api/poi/export")
def export_pois():
    body = request.get_json(silent=True) or {}
    date = str(body.get("date") or "unknown")
    pois = body.get("pois") or []
    labels_file = LABELS_DIR / f"{date}_labels.csv"

    columns = [
        "id",
        "type",
        "label",
        "slice_x",
        "slice_y",
        "lat",
        "lon",
        "mile_marker",
        "notes",
    ]
    with labels_file.open("w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=columns)
        writer.writeheader()
        for poi in pois:
            writer.writerow({k: poi.get(k, "") for k in columns})

    return jsonify({"saved": True, "file": str(labels_file.name), "count": len(pois)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
