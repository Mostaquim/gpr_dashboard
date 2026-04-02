# Backend (I used Flask instead of FastAPI)

## Run

```
cd backend
pip install -r requirements.txt
python app.py
```

Backend listens on `http://localhost:8000`.

## Implemented endpoints

- `GET /health`
- `GET /api/gpr/dates`
- `GET /api/gpr/bounds`
- `GET /api/gpr/slice` (compat wrapper)
- `POST /api/gpr/query-latlng`
- `POST /api/gpr/query-mileage`
- `GET /api/gps/track`
- `POST /api/poi`
- `POST /api/poi/export`
- `DELETE /api/poi/<poi_id>`

## Data assumptions

- GPR data: `../output.csv`
- GPS data: `../processed_gps.csv`

Both are filtered by requested `date`.

## Filters

- Supported now: `raw`, `dewow`
- Reserved for later: `remove_median`, `linear_gain`, `exp_gain`
