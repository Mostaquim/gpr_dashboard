from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import pandas as pd

from processing import (
    PreparedDataset,
    build_gps_track,
    fix_rounding_error,
    smooth_gps_points,
)


@dataclass
class DatasetConfig:
    gpr_csv: Path
    gps_csv: Path


class DatasetStore:
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir
        self._cache: Dict[str, PreparedDataset] = {}

    def get_available_dates(self) -> list[str]:
        gps_csv = self.root_dir / "processed_gps.csv"
        if not gps_csv.exists():
            return []
        gps_df = pd.read_csv(gps_csv)
        times = pd.to_datetime(gps_df["time"], errors="coerce")
        dates = sorted({d.strftime("%Y-%m-%d") for d in times.dropna()})
        return dates

    def get_date_config(self, date: str) -> DatasetConfig:
        gpr_csv = self.root_dir / "output.csv"
        gps_csv = self.root_dir / "processed_gps.csv"
        if not gps_csv.exists():
            raise FileNotFoundError("Expected processed_gps.csv at project root")

        # Primary source: output.csv already in notebook-compatible format.
        if gpr_csv.exists():
            return DatasetConfig(gpr_csv=gpr_csv, gps_csv=gps_csv)

        # Fallback source: single parquet run file in workspace root.
        parquet_files = sorted(self.root_dir.glob("*.parquet"))
        if parquet_files:
            return DatasetConfig(gpr_csv=parquet_files[0], gps_csv=gps_csv)

        raise FileNotFoundError("Expected output.csv or a .parquet GPR file, plus processed_gps.csv")

    def _load_gpr_table(self, gpr_path: Path) -> pd.DataFrame:
        if gpr_path.suffix.lower() == ".parquet":
            gpr_df = pd.read_parquet(gpr_path)
            if "time" not in gpr_df.columns:
                # Try common timestamp aliases before failing.
                for alias in ["timestamp", "datetime", "date_time"]:
                    if alias in gpr_df.columns:
                        gpr_df = gpr_df.rename(columns={alias: "time"})
                        break
            if "time" not in gpr_df.columns:
                raise ValueError("Parquet GPR input must contain a time/timestamp column")

            # Ensure 200 channel columns named as strings "0".."199".
            numeric_cols = [c for c in gpr_df.columns if str(c).isdigit()]
            if len(numeric_cols) < 200:
                raise ValueError("Parquet GPR input must provide at least 200 signal channels")

            keep_cols = ["time"] + [str(i) for i in range(200)]
            renamed = {}
            for i in range(200):
                key = str(i)
                if key not in gpr_df.columns:
                    # Handle int-like column names.
                    if i in gpr_df.columns:
                        renamed[i] = key
            if renamed:
                gpr_df = gpr_df.rename(columns=renamed)

            missing = [str(i) for i in range(200) if str(i) not in gpr_df.columns]
            if missing:
                raise ValueError(f"Parquet GPR channels missing: {missing[:5]}...")

            gpr_df = gpr_df[keep_cols].copy()
            gpr_df.insert(0, "index", np.arange(len(gpr_df), dtype=int))
            return gpr_df

        # CSV path expected in output.csv shape: index,time,0..199
        return pd.read_csv(
            gpr_path,
            header=None,
            names=["index", "time"] + [f"{i}" for i in range(200)],
        )

    def load_date(self, date: str, traces: int = 2000) -> PreparedDataset:
        if date in self._cache:
            return self._cache[date]

        cfg = self.get_date_config(date)
        gpr_df = self._load_gpr_table(cfg.gpr_csv)
        gps_df = pd.read_csv(cfg.gps_csv)

        gpr_df["time"] = pd.to_datetime(gpr_df["time"], errors="coerce").astype("datetime64[ns]")
        gps_df["time"] = pd.to_datetime(gps_df["time"], errors="coerce").astype("datetime64[ns]")
        gpr_df = gpr_df.dropna(subset=["time"]).sort_values("time")
        gps_df = gps_df.dropna(subset=["time"]).sort_values("time")

        day = pd.to_datetime(date).date()
        gpr_df = gpr_df[gpr_df["time"].dt.date == day]
        gps_df = gps_df[gps_df["time"].dt.date == day]
        if gpr_df.empty or gps_df.empty:
            raise ValueError(f"No records found for date {date}")

        merged = pd.merge_asof(gpr_df, gps_df, on="time")

        mileage = np.array(fix_rounding_error(merged["mileage"].values), dtype=float)
        gpr_signal = merged[[str(i) for i in range(200)]].values

        mile_min = float(np.min(mileage))
        mile_max = float(np.max(mileage))

        gpr_smooth, mileage_smooth = smooth_gps_points(
            gpr_signal,
            mile_min,
            mile_max,
            traces,
            mileage,
        )

        base_x = np.linspace(0.0, 1.0, len(merged))
        target_x = np.linspace(0.0, 1.0, traces)

        lat_smooth = np.interp(target_x, base_x, merged["latitude"].values)
        lon_smooth = np.interp(target_x, base_x, merged["longitude"].values)
        time_ns = merged["time"].astype("int64").values
        time_smooth_ns = np.interp(target_x, base_x, time_ns)
        time_smooth = pd.to_datetime(time_smooth_ns.astype(np.int64))

        gps_track = build_gps_track(mileage_smooth, lat_smooth, lon_smooth, time_smooth)

        prepared = PreparedDataset(
            date=date,
            gpr_data=gpr_smooth,
            gps_track=gps_track,
            mileage_series=mileage_smooth,
        )
        self._cache[date] = prepared
        return prepared

    def slice_by_index(self, dataset: PreparedDataset, idx_start: int, idx_end: int) -> Tuple[np.ndarray, pd.DataFrame]:
        lo = max(0, min(idx_start, idx_end))
        hi = min(dataset.gpr_data.shape[1] - 1, max(idx_start, idx_end))
        if hi <= lo:
            raise ValueError("Selected range is empty")
        gpr = dataset.gpr_data[:, lo : hi + 1]
        gps = dataset.gps_track.iloc[lo : hi + 1].reset_index(drop=True)
        return gpr, gps

    def slice_by_mileage(self, dataset: PreparedDataset, start_mileage: float, end_mileage: float) -> Tuple[np.ndarray, pd.DataFrame]:
        lo, hi = sorted([start_mileage, end_mileage])
        mask = (dataset.gps_track["distance_miles"] >= lo) & (dataset.gps_track["distance_miles"] <= hi)
        idx = np.flatnonzero(mask.values)
        if len(idx) == 0:
            raise ValueError("No points found in mileage range")
        return self.slice_by_index(dataset, int(idx[0]), int(idx[-1]))

    def slice_by_latlng(
        self,
        dataset: PreparedDataset,
        start_lat: float,
        start_lng: float,
        end_lat: float,
        end_lng: float,
    ) -> Tuple[np.ndarray, pd.DataFrame]:
        gps = dataset.gps_track
        start_dist = (gps["lat"] - start_lat) ** 2 + (gps["lon"] - start_lng) ** 2
        end_dist = (gps["lat"] - end_lat) ** 2 + (gps["lon"] - end_lng) ** 2
        idx_start = int(start_dist.idxmin())
        idx_end = int(end_dist.idxmin())
        return self.slice_by_index(dataset, idx_start, idx_end)
