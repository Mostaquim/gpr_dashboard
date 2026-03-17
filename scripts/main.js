/**
 * Main Application Entry Point
 * Initializes all modules and coordinates the application
 */

import * as api from './api.js';
import { SliceViewer } from './sliceViewer.js';
import { MapManager } from './mapManager.js';
import { Controls } from './controls.js';
import { generateMockDataset, getMockPOIs } from './mockData.js';

class GPRApp {
    constructor() {
        this.viewer1 = null;
        this.viewer2 = null;
        this.mapManager = null;
        this.controls = null;
        
        // Current data
        this.currentData = null;
        this.gpsTrack = null;
        this.pois = [];
        this.poiCounter = 100; // For generating unique IDs
        this.availableDates = [];
        this.currentDateIndex = -1;
        
        this.init();
    }
    
    async init() {
        console.log('Initializing GPR/GPS Visualization App...');
        
        // Wait for DOM to be ready
        await this.waitForDOM();
        
        // Initialize modules
        this.initializeViewers();
        this.initializeMap();
        this.initializeControls();
        
        // Wire up callbacks
        this.setupCallbacks();
        
        // Check backend connection
        await this.checkConnection();
        await this.loadAvailableDates();
        
        console.log('App initialized successfully');
        this.controls.setStatus('Ready - Click "Load Sample Data" to test');
    }
    
    waitForDOM() {
        return new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }
    
    initializeViewers() {
        // Initialize dual GPR slice viewers with Plotly
        this.viewer1 = new SliceViewer('gpr-plot-1', 'plotly-container-1');
        this.viewer2 = new SliceViewer('gpr-plot-2', 'plotly-container-2');
        
        console.log('Plotly slice viewers initialized');
    }
    
    initializeMap() {
        // Initialize Leaflet map
        this.mapManager = new MapManager('map-container');
        console.log('Map manager initialized');
    }
    
    initializeControls() {
        // Initialize controls with both viewers
        this.controls = new Controls(
            [this.viewer1, this.viewer2],
            this.mapManager
        );
    }
    
    setupCallbacks() {
        // Handle query form submission
        this.controls.onQuerySubmit = async (params) => {
            await this.loadData(params);
        };
        
        // Handle load sample button
        this.controls.onLoadSample = () => {
            this.loadSampleData();
        };
        
        // Handle colorscale change
        const colorscaleSelect = document.getElementById('colorscale-select');
        colorscaleSelect?.addEventListener('change', (e) => {
            const colorscale = e.target.value;
            this.viewer1.setColorscale(colorscale);
            this.viewer2.setColorscale(colorscale);
        });
        
        // Map click -> sync to GPR viewers
        this.mapManager.onPositionClick = (point) => {
            this.syncToTrackPosition(point.index);
        };
        
        // Viewer position -> update map
        this.viewer1.onPositionChange = (position) => {
            this.handleViewerPositionChange(position);
        };
        
        // Viewer click -> handle POI marking
        this.viewer1.onClick = (clickData) => {
            this.handleViewerClick(clickData, 1);
        };
        
        this.viewer2.onClick = (clickData) => {
            this.handleViewerClick(clickData, 2);
        };
        
        // Viewer viewport sync
        this.viewer1.onViewportChange = (viewport) => {
            if (this.controls.syncViewers && viewport.eventData) {
                this.viewer2.syncViewport(viewport.eventData);
            }
            this.controls.updateZoomDisplay();
        };
        
        this.viewer2.onViewportChange = (viewport) => {
            if (this.controls.syncViewers && viewport.eventData) {
                this.viewer1.syncViewport(viewport.eventData);
            }
        };

        // Dataset date navigation for multi-file workflows.
        const prevDateBtn = document.getElementById('prev-date-btn');
        const nextDateBtn = document.getElementById('next-date-btn');
        prevDateBtn?.addEventListener('click', () => this.loadAdjacentDate(-1));
        nextDateBtn?.addEventListener('click', () => this.loadAdjacentDate(1));

        const exportPoiBtn = document.getElementById('export-poi-btn');
        exportPoiBtn?.addEventListener('click', async () => {
            await this.exportCurrentPOIs();
        });

        const dateInput = document.getElementById('date-select');
        dateInput?.addEventListener('change', async (e) => {
            const date = e.target?.value;
            if (date) {
                await this.populateBoundsForDate(date);
            }
        });
    }

    async loadAvailableDates() {
        try {
            const result = await api.getAvailableDates();
            this.availableDates = result?.dates || [];
            if (this.availableDates.length === 0) return;

            const dateInput = document.getElementById('date-select');
            if (dateInput && !dateInput.value) {
                dateInput.value = this.availableDates[this.availableDates.length - 1];
            }

            const selectedDate = dateInput?.value;
            if (selectedDate) {
                await this.populateBoundsForDate(selectedDate);
            }
            this.currentDateIndex = this.availableDates.indexOf(selectedDate);
            if (this.currentDateIndex < 0) {
                this.currentDateIndex = this.availableDates.length - 1;
            }
        } catch (error) {
            console.warn('Could not load available dates:', error);
        }
    }

    async populateBoundsForDate(date) {
        try {
            const bounds = await api.getDataBounds(date);
            const setValue = (id, value) => {
                const el = document.getElementById(id);
                if (el && Number.isFinite(value)) {
                    el.value = Number(value).toFixed(6);
                }
            };

            setValue('start-lat', bounds.min_lat);
            setValue('start-lon', bounds.min_lon);
            setValue('end-lat', bounds.max_lat);
            setValue('end-lon', bounds.max_lon);
            setValue('start-mileage', bounds.min_mileage);
            setValue('end-mileage', bounds.max_mileage);
        } catch (error) {
            console.warn('Could not populate bounds for date:', error);
        }
    }

    async loadAdjacentDate(delta) {
        if (!this.availableDates.length || !this.currentData) {
            this.controls.setStatus('Load a dataset first before using previous/next date');
            return;
        }

        const nextIndex = this.currentDateIndex + delta;
        if (nextIndex < 0 || nextIndex >= this.availableDates.length) {
            this.controls.setStatus('No more dates in that direction');
            return;
        }

        this.currentDateIndex = nextIndex;
        const nextDate = this.availableDates[this.currentDateIndex];
        const dateInput = document.getElementById('date-select');
        if (dateInput) {
            dateInput.value = nextDate;
        }

        // Reuse current query coordinates so date-switching is one click.
        const params = {
            date: nextDate,
            queryMode: document.getElementById('query-mode')?.value || 'latlng',
            startLat: parseFloat(document.getElementById('start-lat')?.value),
            startLon: parseFloat(document.getElementById('start-lon')?.value),
            endLat: parseFloat(document.getElementById('end-lat')?.value),
            endLon: parseFloat(document.getElementById('end-lon')?.value),
            startMileage: parseFloat(document.getElementById('start-mileage')?.value),
            endMileage: parseFloat(document.getElementById('end-mileage')?.value)
        };

        await this.loadData(params);
    }
    
    /**
     * Handle click on GPR viewer - create POI if in POI mode
     */
    handleViewerClick(clickData, viewerNum) {
        // Check if POI mode is active
        if (!this.controls.isPOIModeActive()) {
            console.log('Click detected but POI mode not active');
            return;
        }
        
        if (!this.currentData) {
            console.log('No data loaded');
            return;
        }
        
        // Get POI type from dropdown
        const poiType = this.controls.getPOIType();
        
        // Calculate geo coordinates from click position
        const geoCoords = this.viewer1.dataToGeoCoords(clickData.dataX, clickData.dataY);
        
        // Generate unique ID
        this.poiCounter++;
        const poiId = `poi-user-${this.poiCounter}`;
        
        // Create new POI
        const newPOI = {
            id: poiId,
            type: poiType,
            label: `${poiType.charAt(0).toUpperCase() + poiType.slice(1)} #${this.poiCounter}`,
            slice_x: clickData.dataX,
            slice_y: clickData.dataY,
            lat: geoCoords?.lat || 0,
            lon: geoCoords?.lon || 0,
            mile_marker: geoCoords?.mile || 0,
            notes: `Added from viewer ${viewerNum} at ${new Date().toLocaleTimeString()}`
        };
        
        console.log('Creating new POI:', newPOI);
        
        // Add to POI list
        this.pois.push(newPOI);

        // Persist labels to separate backend-managed file.
        api.createPOI({ ...newPOI, date: this.currentData?.date }).catch((error) => {
            console.warn('Failed to persist POI to backend:', error);
        });
        
        // Update both viewers
        this.viewer1.setPOIs(this.pois);
        this.viewer2.setPOIs(this.pois);
        
        // Update map
        this.mapManager.addPOIMarkers(this.pois);
        
        // Update POI list in sidebar
        this.updatePOIList();
        
        // Status update
        this.controls.setStatus(`Added ${newPOI.label} at position (${clickData.dataX}, ${clickData.dataY})`);
    }
    
    /**
     * Update the POI list in the sidebar
     */
    updatePOIList() {
        const poiListEl = document.getElementById('poi-list');
        if (!poiListEl) return;
        
        poiListEl.innerHTML = '';
        
        this.pois.forEach((poi, index) => {
            const poiItem = document.createElement('div');
            poiItem.className = `poi-item poi-type-${poi.type}`;
            poiItem.innerHTML = `
                <span class="poi-icon">${this.getPoiIcon(poi.type)}</span>
                <span class="poi-label">${poi.label}</span>
                <span class="poi-position">x:${poi.slice_x}, y:${poi.slice_y}</span>
                <button class="poi-delete" data-index="${index}" title="Delete POI">×</button>
            `;
            
            // Click to navigate
            poiItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('poi-delete')) {
                    this.navigateToPOI(poi);
                }
            });
            
            // Delete button
            const deleteBtn = poiItem.querySelector('.poi-delete');
            deleteBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePOI(index);
            });
            
            poiListEl.appendChild(poiItem);
        });
    }
    
    /**
     * Get icon for POI type
     */
    getPoiIcon(type) {
        const icons = {
            culvert: '🔵',
            pipe: '🟢',
            void: '🟡',
            anomaly: '🔴',
            other: '⚪'
        };
        return icons[type] || icons.other;
    }
    
    /**
     * Navigate to a POI
     */
    navigateToPOI(poi) {
        // Center viewers on POI
        this.viewer1.centerOnDataX(poi.slice_x);
        this.viewer2.centerOnDataX(poi.slice_x);
        
        // Calculate track index
        if (this.gpsTrack && this.currentData) {
            const t = poi.slice_x / this.currentData.width;
            const trackIndex = Math.floor(t * (this.gpsTrack.length - 1));
            this.mapManager.updatePositionIndicator(trackIndex);
        }
        
        this.controls.setStatus(`Navigated to ${poi.label}`);
    }
    
    /**
     * Delete a POI
     */
    deletePOI(index) {
        if (index < 0 || index >= this.pois.length) return;
        
        const deleted = this.pois.splice(index, 1)[0];

        api.deletePOI(deleted.id).catch((error) => {
            console.warn('Failed to delete POI from backend:', error);
        });
        
        // Update viewers
        this.viewer1.setPOIs(this.pois);
        this.viewer2.setPOIs(this.pois);
        
        // Update map
        this.mapManager.addPOIMarkers(this.pois);
        
        // Update list
        this.updatePOIList();
        
        this.controls.setStatus(`Deleted ${deleted.label}`);
    }
    
    async checkConnection() {
        try {
            const connected = await api.checkHealth();
            if (connected) {
                this.controls.setConnectionStatus('● Connected');
            } else {
                this.controls.setConnectionStatus('● Demo Mode');
            }
        } catch (error) {
            this.controls.setConnectionStatus('● Demo Mode');
        }
    }

    async exportCurrentPOIs() {
        if (!this.currentData) {
            this.controls.setStatus('Load data before exporting POIs');
            return;
        }

        try {
            const result = await api.exportPOIs(this.currentData.date, this.pois);
            this.controls.setStatus(`Exported ${result.count} labels to ${result.file}`);
        } catch (error) {
            this.controls.setStatus(`POI export failed: ${error.message}`);
        }
    }
    
    /**
     * Load sample data for testing
     */
    loadSampleData() {
        console.log('Loading sample data...');
        this.controls.setStatus('Loading sample data...');
        this.controls.showLoading();
        
        // Generate mock data
        const mockData = generateMockDataset();
        const mockPOIs = getMockPOIs();
        
        // Store data
        this.currentData = mockData;
        this.gpsTrack = mockData.gps_track;
        this.pois = [...mockPOIs]; // Clone array
        
        // Prepare data for viewers
        const viewerData = {
            data: mockData.gpr_data,
            width: mockData.width,
            height: mockData.height,
            date: mockData.date,
            start_lat: mockData.start_lat,
            start_lon: mockData.start_lon,
            end_lat: mockData.end_lat,
            end_lon: mockData.end_lon,
            metadata: mockData.metadata,
            gps_track: mockData.gps_track
        };
        
        // Load data into viewers
        this.viewer1.loadData(viewerData);
        this.viewer2.loadData(viewerData);
        
        // Add POI markers
        this.viewer1.setPOIs(this.pois);
        this.viewer2.setPOIs(this.pois);
        
        // Load GPS track into map
        this.mapManager.loadTrack(mockData.gps_track);
        
        // Add POI markers to map
        this.mapManager.addPOIMarkers(this.pois);
        
        // Update POI list in sidebar
        this.updatePOIList();
        
        // Update UI
        this.controls.hideLoading();
        this.controls.hidePlaceholders();
        this.controls.setStatus(`Loaded: ${mockData.date} | ${mockData.metadata.total_distance_miles.toFixed(2)} miles | ${mockData.width}x${mockData.height}`);
        
        // Update track info
        const trackInfo = this.mapManager.getTrackInfo();
        if (trackInfo) {
            this.controls.updateTrackInfo(trackInfo);
        }
        
        // Update viewer info
        this.controls.updateViewerInfo(1, `${mockData.width}x${mockData.height} | Full Track`);
        this.controls.updateViewerInfo(2, `${mockData.width}x${mockData.height} | Full Track`);
        
        console.log('Sample data loaded successfully');
    }
    
    /**
     * Load data from API
     */
    async loadData(params) {
        this.controls.setStatus('Loading GPR data...');
        this.controls.showLoading();
        
        try {
            // Try to fetch from backend
            const gprData = params.queryMode === 'mileage'
                ? await api.getGPRByMileage(params)
                : await api.getGPRSlice(params);
            
            // Load into viewers
            this.viewer1.loadData(gprData);
            this.viewer2.loadData(gprData);

            this.currentData = gprData;
            this.gpsTrack = gprData.gps_track || [];
            
            // Load GPS track into map
            if (gprData.gps_track) {
                this.mapManager.loadTrack(gprData.gps_track);
            }

            this.currentDateIndex = this.availableDates.indexOf(params.date);
            
            this.controls.hideLoading();
            this.controls.hidePlaceholders();
            this.controls.setStatus(`Loaded data for ${params.date}`);

            const trackInfo = this.mapManager.getTrackInfo();
            if (trackInfo) {
                this.controls.updateTrackInfo(trackInfo);
            }

            this.controls.updateViewerInfo(1, `${gprData.width}x${gprData.height} | API Query`);
            this.controls.updateViewerInfo(2, `${gprData.width}x${gprData.height} | API Query`);
            
        } catch (error) {
            console.warn('Backend query failed:', error);
            this.controls.hideLoading();
            this.controls.setStatus(`Query failed: ${error.message}`);
        }
    }
    
    /**
     * Sync GPR viewers to a specific track position
     */
    syncToTrackPosition(trackIndex) {
        if (!this.gpsTrack || trackIndex < 0) return;
        
        const point = this.gpsTrack[trackIndex];
        console.log(`Syncing to track position ${trackIndex}: Mile ${point.distance_miles.toFixed(2)}`);
        
        // Calculate corresponding X position in GPR data
        const dataX = Math.floor((trackIndex / this.gpsTrack.length) * this.currentData.width);
        
        // Center viewers on this position
        this.viewer1.centerOnDataX(dataX);
        this.viewer2.centerOnDataX(dataX);
        
        // Update map position indicator
        this.mapManager.updatePositionIndicator(trackIndex);
        
        this.controls.setStatus(`Position: Mile ${point.distance_miles.toFixed(2)}`);
    }
    
    /**
     * Handle position changes from GPR viewer
     */
    handleViewerPositionChange(position) {
        // Update info bar
        this.controls.updateCursorInfo(position);
        
        // Update map position (throttled)
        if (position.trackIndex !== undefined) {
            this.throttledMapUpdate(position.trackIndex);
        }
    }
    
    // Throttle map updates for performance
    _lastMapUpdate = 0;
    throttledMapUpdate(trackIndex) {
        const now = Date.now();
        if (now - this._lastMapUpdate > 50) { // Max 20 updates per second
            this._lastMapUpdate = now;
            this.mapManager.updatePositionIndicator(trackIndex);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.gprApp = new GPRApp();
});