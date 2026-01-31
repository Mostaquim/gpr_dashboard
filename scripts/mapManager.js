/**
 * Map Manager Module
 * Handles Leaflet map initialization and GPS track visualization
 */

export class MapManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.trackLayer = null;
        this.markersLayer = null;
        this.positionMarker = null;
        this.poiMarkers = [];
        
        // Track data
        this.gpsTrack = null;
        
        // Settings
        this.showMarkers = true;
        
        // Callbacks
        this.onPositionClick = null;
        this.onMapHover = null;
        
        this.init();
    }
    
    init() {
        // Initialize Leaflet map
        this.map = L.map(this.containerId, {
            zoomControl: true,
            attributionControl: true
        }).setView([42.99, -81.22], 13);
        
        // Add dark-themed tile layer (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);
        
        // Initialize layer groups
        this.trackLayer = L.layerGroup().addTo(this.map);
        this.markersLayer = L.layerGroup().addTo(this.map);
        
        // Set up event handlers
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // Track mouse movement for coordinate display
        this.map.on('mousemove', (e) => {
            if (this.onMapHover) {
                this.onMapHover({
                    lat: e.latlng.lat,
                    lon: e.latlng.lng
                });
            }
        });
        
        // Handle click on track
        this.map.on('click', (e) => {
            if (this.gpsTrack && this.onPositionClick) {
                const nearest = this.findNearestTrackPoint(e.latlng.lat, e.latlng.lng);
                if (nearest) {
                    this.onPositionClick(nearest);
                }
            }
        });
    }
    
    /**
     * Load and display GPS track
     */
    loadTrack(gpsTrack) {
        this.gpsTrack = gpsTrack;
        
        // Clear existing track
        this.trackLayer.clearLayers();
        this.markersLayer.clearLayers();
        
        if (!gpsTrack || gpsTrack.length === 0) return;
        
        // Create track line
        const coordinates = gpsTrack.map(point => [point.lat, point.lon]);
        
        // Main track line
        const trackLine = L.polyline(coordinates, {
            color: '#3498db',
            weight: 4,
            opacity: 0.8,
            lineJoin: 'round'
        });
        
        // Add glow effect with a wider, more transparent line behind
        const glowLine = L.polyline(coordinates, {
            color: '#3498db',
            weight: 8,
            opacity: 0.3,
            lineJoin: 'round'
        });
        
        this.trackLayer.addLayer(glowLine);
        this.trackLayer.addLayer(trackLine);
        
        // Add start and end markers
        const startPoint = gpsTrack[0];
        const endPoint = gpsTrack[gpsTrack.length - 1];
        
        const startMarker = L.circleMarker([startPoint.lat, startPoint.lon], {
            radius: 8,
            fillColor: '#2ecc71',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).bindPopup(`<b>Start</b><br>Mile: 0.00<br>Time: ${startPoint.timestamp}`);
        
        const endMarker = L.circleMarker([endPoint.lat, endPoint.lon], {
            radius: 8,
            fillColor: '#e74c3c',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).bindPopup(`<b>End</b><br>Mile: ${endPoint.distance_miles.toFixed(2)}<br>Time: ${endPoint.timestamp}`);
        
        this.markersLayer.addLayer(startMarker);
        this.markersLayer.addLayer(endMarker);
        
        // Add mile markers if track is long enough
        if (this.showMarkers) {
            this.addMileMarkers(gpsTrack);
        }
        
        // Fit map to track bounds
        this.fitToTrack();
    }
    
    /**
     * Add mile markers along the track
     */
    addMileMarkers(gpsTrack) {
        let lastMile = -1;
        
        gpsTrack.forEach((point, index) => {
            const currentMile = Math.floor(point.distance_miles);
            
            if (currentMile > lastMile && currentMile > 0) {
                lastMile = currentMile;
                
                const marker = L.circleMarker([point.lat, point.lon], {
                    radius: 5,
                    fillColor: '#f39c12',
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(`<b>Mile ${currentMile}</b><br>Lat: ${point.lat.toFixed(5)}<br>Lon: ${point.lon.toFixed(5)}`);
                
                this.markersLayer.addLayer(marker);
            }
        });
    }
    
    /**
     * Update current position indicator on map
     */
    updatePositionIndicator(trackIndex) {
        if (!this.gpsTrack || trackIndex < 0 || trackIndex >= this.gpsTrack.length) {
            return;
        }
        
        const point = this.gpsTrack[trackIndex];
        
        // Remove existing position marker
        if (this.positionMarker) {
            this.map.removeLayer(this.positionMarker);
        }
        
        // Create new position marker
        this.positionMarker = L.circleMarker([point.lat, point.lon], {
            radius: 10,
            fillColor: '#e74c3c',
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9,
            className: 'position-marker'
        }).bindPopup(`
            <b>Current Position</b><br>
            Mile: ${point.distance_miles.toFixed(2)}<br>
            Lat: ${point.lat.toFixed(5)}<br>
            Lon: ${point.lon.toFixed(5)}
        `);
        
        this.positionMarker.addTo(this.map);
    }
    
    /**
     * Add POI markers to map
     */
    addPOIMarkers(pois) {
        // Clear existing POI markers
        this.poiMarkers.forEach(marker => this.map.removeLayer(marker));
        this.poiMarkers = [];
        
        const poiColors = {
            culvert: '#FF6B6B',
            pipe: '#4ECDC4',
            void: '#45B7D1',
            anomaly: '#FFEAA7',
            other: '#DFE6E9'
        };
        
        pois.forEach(poi => {
            const color = poiColors[poi.type] || poiColors.other;
            
            const marker = L.circleMarker([poi.lat, poi.lon], {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).bindPopup(`
                <b>${poi.label}</b><br>
                Type: ${poi.type}<br>
                Mile: ${poi.mile_marker?.toFixed(2) || '--'}<br>
                ${poi.notes || ''}
            `);
            
            marker.addTo(this.map);
            this.poiMarkers.push(marker);
        });
    }
    
    /**
     * Find nearest track point to given coordinates
     */
    findNearestTrackPoint(lat, lon) {
        if (!this.gpsTrack) return null;
        
        let nearest = null;
        let minDistance = Infinity;
        
        this.gpsTrack.forEach((point, index) => {
            const dist = Math.sqrt(
                Math.pow(point.lat - lat, 2) + 
                Math.pow(point.lon - lon, 2)
            );
            
            if (dist < minDistance) {
                minDistance = dist;
                nearest = { ...point, index };
            }
        });
        
        // Only return if within reasonable distance (about 100m)
        if (minDistance < 0.001) {
            return nearest;
        }
        
        return null;
    }
    
    /**
     * Fit map view to track bounds
     */
    fitToTrack() {
        if (!this.gpsTrack || this.gpsTrack.length === 0) return;
        
        const bounds = L.latLngBounds(
            this.gpsTrack.map(point => [point.lat, point.lon])
        );
        
        this.map.fitBounds(bounds, { padding: [20, 20] });
    }
    
    /**
     * Toggle mile markers visibility
     */
    toggleMarkers() {
        this.showMarkers = !this.showMarkers;
        
        if (this.showMarkers) {
            this.markersLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.markersLayer);
        }
        
        return this.showMarkers;
    }
    
    /**
     * Pan map to specific track position
     */
    panToPosition(trackIndex) {
        if (!this.gpsTrack || trackIndex < 0 || trackIndex >= this.gpsTrack.length) {
            return;
        }
        
        const point = this.gpsTrack[trackIndex];
        this.map.panTo([point.lat, point.lon]);
    }
    
    /**
     * Highlight a section of the track
     */
    highlightSection(startIndex, endIndex) {
        // Remove existing highlight
        if (this.highlightLayer) {
            this.map.removeLayer(this.highlightLayer);
        }
        
        if (!this.gpsTrack || startIndex >= endIndex) return;
        
        const sectionCoords = this.gpsTrack
            .slice(startIndex, endIndex + 1)
            .map(point => [point.lat, point.lon]);
        
        this.highlightLayer = L.polyline(sectionCoords, {
            color: '#e74c3c',
            weight: 6,
            opacity: 0.8
        }).addTo(this.map);
    }
    
    /**
     * Get track info summary
     */
    getTrackInfo() {
        if (!this.gpsTrack || this.gpsTrack.length === 0) {
            return null;
        }
        
        const lastPoint = this.gpsTrack[this.gpsTrack.length - 1];
        
        return {
            totalPoints: this.gpsTrack.length,
            totalDistanceKm: lastPoint.distance_km,
            totalDistanceMiles: lastPoint.distance_miles,
            startTime: this.gpsTrack[0].timestamp,
            endTime: lastPoint.timestamp
        };
    }
    
    /**
     * Resize map (call when container size changes)
     */
    invalidateSize() {
        if (this.map) {
            this.map.invalidateSize();
        }
    }
}
