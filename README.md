# GPR Dashboard

A web-based interactive dashboard for visualizing Ground Penetrating Radar (GPR) data synchronized with GPS tracking. This tool allows users to examine GPR slices based on geographic bounds (Latitude/Longitude) or track Mileage.

## 📂 Project Structure

```text
gpr_dashboard/
├── backend/                  # Flask Python backend
│   ├── app.py                # Main API server and routes
│   ├── processing.py         # GPR signal processing (dewow, smoothing, etc.)
│   ├── store.py              # Data loading, caching, and merging (GPS + GPR)
│   └── requirements.txt      # Python dependencies
├── scripts/                  # Frontend JavaScript
│   ├── api.js                # API communication
│   ├── controls.js           # UI event listeners and mode toggling
│   ├── main.js               # Application initialization and orchestration
│   ├── mapManager.js         # Leaflet map integration
│   └── sliceViewer.js        # Canvas/WebGL based GPR slice rendering
├── styles/                   # Frontend CSS
│   └── main.css
├── index.html                # Main application entry point
└── GPR.ipynb                 # Original Jupyter notebook used for prototyping
```

## 📥 Where to Put Data Files

To view your data, you must place the raw or processed data files directly into the **root directory** (`gpr_dashboard/`):

1. **GPS Data**: Place `processed_gps.csv` here. It must contain `time`, `latitude`, `longitude`, `mileage`, and `subdivision`.
2. **GPR Data**:
   - Place `output.csv` (the processed 200-depth channel GPR output) here. 
   - *Alternatively*, you can provide `.parquet` files (e.g., `7_202443...parquet`). The backend will automatically fall back to `.parquet` files if `output.csv` does not exist.

## 🚀 Setup and Installation

### 1. Start the Backend


**Windows:**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**Linux:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend server will start on `http://localhost:8000`.

### 2. Start the Frontend


Open a **new terminal**, ensure you are in the root `gpr_dashboard` folder, and run:

```bash
# Using Python's built-in HTTP server
python -m http.server 3000
```

Now, open your browser and go to `http://localhost:3000`.

## 🎮 How to Use the Dashboard

1. **Select a Date**: The app will automatically fetch available dates from the backend. (e.g., `2025-03-12`).
2. **Select Query Mode**:
   - **Latitude/Longitude**: Search within a bounding box. 
   - **Mileage Range**: Search between specific miles on the track.
3. *Note:* Changing the date automatically queries the backend and populates the exact Start/End coordinates and mileage boundaries for that dataset.
4. Click **Load Extent** to fetch the fused GPR and GPS data and plot it on the viewers.

### Exporting Files

- **Points of Interest (POIs)**: If you mark POIs or labels on the map/viewer, clicking **Export Labels** will download the selected POIs as a CSV file to your local computer.

## 🛠 Troubleshooting

- **No Data Loading**: Ensure `processed_gps.csv` and `output.csv` (or your `.parquet` file) are in the **root folder**, not inside the `/backend/` folder.
- **Backend 400 Errors**: Usually caused by data formats not matching expected precision. The system merges GPS and GPR on nanosecond `datetime64[ns]` precision. Ensure your `.csv` headers are intact.
