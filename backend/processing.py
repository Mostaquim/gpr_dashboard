from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from scipy import interpolate


def fix_rounding_error(arr: np.ndarray) -> np.ndarray:
    arr = np.array(arr, dtype=float)
    n = len(arr)
    if n == 0:
        return arr

    change_points = np.flatnonzero(np.diff(arr)) + 1
    change_points = np.concatenate(([0], change_points, [n]))

    result = np.zeros_like(arr)
    for i in range(len(change_points) - 1):
        start, end = change_points[i], change_points[i + 1]
        y0 = arr[start]
        y1 = arr[end] if end < n else y0
        result[start:end] = np.linspace(y0, y1, end - start, endpoint=False)

    return result


def smooth_gps_points(
    gpr_signal: np.ndarray,
    mile_min: float,
    mile_max: float,
    res: int,
    mileage: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    mileage_smooth = np.linspace(mile_min, mile_max, res)
    signal_interped: List[np.ndarray] = []

    # Notebook data has 200 depth channels in columns.
    for i in range(gpr_signal.shape[1]):
        y = gpr_signal[:, i]
        f = interpolate.interp1d(
            mileage,
            y,
            bounds_error=False,
            fill_value=0.0,
            assume_sorted=False,
        )
        y_interped = f(mileage_smooth)
        signal_interped.append(y_interped)

    return np.array(signal_interped), mileage_smooth


def dewow(data: np.ndarray, window: int) -> np.ndarray:
    data = np.asarray(data, dtype=float)
    totsamps = data.shape[0]
    if totsamps == 0:
        return data

    if window >= totsamps:
        return data - np.mean(data, axis=0, keepdims=True)

    newdata = np.zeros_like(data)
    halfwid = int(np.ceil(window / 2.0))

    avgsmp = np.mean(data[0 : halfwid + 1, :], axis=0, keepdims=True)
    newdata[0 : halfwid + 1, :] = data[0 : halfwid + 1, :] - avgsmp

    for smp in range(halfwid, totsamps - halfwid + 1):
        winstart = int(smp - halfwid)
        winend = int(smp + halfwid)
        avgsmp = np.mean(data[winstart : winend + 1, :], axis=0, keepdims=True)
        newdata[smp, :] = data[smp, :] - avgsmp

    avgsmp = np.mean(data[totsamps - halfwid : totsamps + 1, :], axis=0, keepdims=True)
    newdata[totsamps - halfwid : totsamps + 1, :] = (
        data[totsamps - halfwid : totsamps + 1, :] - avgsmp
    )
    return newdata


@dataclass
class PreparedDataset:
    date: str
    gpr_data: np.ndarray  # shape: depth x traces
    gps_track: pd.DataFrame
    mileage_series: np.ndarray


def build_gps_track(
    mileage_smooth: np.ndarray,
    lat_smooth: np.ndarray,
    lon_smooth: np.ndarray,
    time_smooth: np.ndarray,
) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "index": np.arange(len(mileage_smooth), dtype=int),
            "lat": lat_smooth,
            "lon": lon_smooth,
            "distance_miles": mileage_smooth,
            "distance_km": mileage_smooth * 1.60934,
            "timestamp": pd.to_datetime(time_smooth).astype(str),
        }
    )


def apply_filters(gpr_data: np.ndarray, filters: List[str] | None) -> np.ndarray:
    if not filters:
        return gpr_data

    out = np.array(gpr_data, dtype=float, copy=True)
    for filt in filters:
        name = (filt or "").strip().lower()
        if name == "raw":
            continue
        if name == "dewow":
            out = dewow(out, 250)
            continue
        if name in {"remove_median", "linear_gain", "exp_gain"}:
            raise NotImplementedError(f"Filter '{name}' is reserved for later implementation")
        raise ValueError(f"Unsupported filter '{name}'")
    return out


def to_frontend_payload(
    date: str,
    gpr_subset: np.ndarray,
    gps_subset: pd.DataFrame,
    metadata: Dict,
) -> Dict:
    start = gps_subset.iloc[0]
    end = gps_subset.iloc[-1]
    return {
        "date": date,
        "data": gpr_subset.tolist(),
        "width": int(gpr_subset.shape[1]),
        "height": int(gpr_subset.shape[0]),
        "start_lat": float(start["lat"]),
        "start_lon": float(start["lon"]),
        "end_lat": float(end["lat"]),
        "end_lon": float(end["lon"]),
        "gps_track": gps_subset.to_dict(orient="records"),
        "metadata": metadata,
    }
