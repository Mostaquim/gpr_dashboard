/**
 * Controls Module
 * Handles UI controls for zoom, seek, and query form
 */

export class Controls {
    constructor(viewers, mapManager) {
        this.viewers = viewers; // Array of SliceViewer instances [viewer1, viewer2]
        this.mapManager = mapManager;
        this.activeViewer = 'both'; // 'both', 'viewer1', or 'viewer2'
        this.syncViewers = true;
        
        // Element references
        this.elements = {
            // Viewer selector
            activeViewerSelect: document.getElementById('active-viewer-select'),
            syncViewersBtn: document.getElementById('sync-viewers-btn'),
            
            // Zoom controls
            zoomIn: document.getElementById('zoom-in'),
            zoomOut: document.getElementById('zoom-out'),
            zoomReset: document.getElementById('zoom-reset'),
            zoomLevel: document.getElementById('zoom-level'),
            
            // Seek controls
            seekLeft: document.getElementById('seek-left'),
            seekRight: document.getElementById('seek-right'),
            
            // POI controls
            poiModeToggle: document.getElementById('poi-mode-toggle'),
            poiTypeSelect: document.getElementById('poi-type-select'),
            
            // Query form
            queryForm: document.getElementById('query-form'),
            loadSampleBtn: document.getElementById('load-sample-btn'),
            dateSelect: document.getElementById('date-select'),
            startLat: document.getElementById('start-lat'),
            startLon: document.getElementById('start-lon'),
            endLat: document.getElementById('end-lat'),
            endLon: document.getElementById('end-lon'),
            
            // Info displays
            cursorPosition: document.getElementById('cursor-position'),
            depthDisplay: document.getElementById('depth-display'),
            coordinatesDisplay: document.getElementById('coordinates-display'),
            mileMarker: document.getElementById('mile-marker'),
            mapCursorCoords: document.getElementById('map-cursor-coords'),
            
            // Track info
            trackDistance: document.getElementById('track-distance'),
            trackPoints: document.getElementById('track-points'),
            
            // Map controls
            mapFitBounds: document.getElementById('map-fit-bounds'),
            mapToggleMarkers: document.getElementById('map-toggle-markers'),
            
            // Loading/status
            statusMessage: document.getElementById('status-message'),
            connectionStatus: document.getElementById('connection-status'),
            
            // Viewer info
            viewer1Info: document.getElementById('viewer1-info'),
            viewer2Info: document.getElementById('viewer2-info'),
            
            // Placeholders
            placeholder1: document.getElementById('placeholder-1'),
            placeholder2: document.getElementById('placeholder-2'),
            loading1: document.getElementById('loading-overlay-1'),
            loading2: document.getElementById('loading-overlay-2')
        };
        
        // Callbacks
        this.onQuerySubmit = null;
        this.onLoadSample = null;
        
        this.init();
    }
    
    init() {
        this.setupViewerSelector();
        this.setupZoomControls();
        this.setupSeekControls();
        this.setupPOIControls();
        this.setupQueryForm();
        this.setupMapControls();
        this.setupViewerCallbacks();
        this.setupKeyboardShortcuts();
    }
    
    // ===========================
    // Viewer Selector
    // ===========================
    
    setupViewerSelector() {
        this.elements.activeViewerSelect?.addEventListener('change', (e) => {
            this.activeViewer = e.target.value;
        });
        
        this.elements.syncViewersBtn?.addEventListener('click', () => {
            this.syncViewers = !this.syncViewers;
            this.elements.syncViewersBtn.classList.toggle('active', this.syncViewers);
        });
    }
    
    getActiveViewers() {
        if (this.activeViewer === 'both') {
            return this.viewers;
        } else if (this.activeViewer === 'viewer1') {
            return [this.viewers[0]];
        } else {
            return [this.viewers[1]];
        }
    }
    
    // ===========================
    // Zoom Controls
    // ===========================
    
    setupZoomControls() {
        this.elements.zoomIn?.addEventListener('click', () => {
            this.getActiveViewers().forEach(v => v?.zoomIn());
        });
        
        this.elements.zoomOut?.addEventListener('click', () => {
            this.getActiveViewers().forEach(v => v?.zoomOut());
        });
        
        this.elements.zoomReset?.addEventListener('click', () => {
            this.getActiveViewers().forEach(v => v?.resetViewport());
        });
    }
    
    updateZoomDisplay() {
        const viewer = this.viewers[0];
        if (viewer && this.elements.zoomLevel) {
            this.elements.zoomLevel.textContent = `${viewer.getZoomPercentage()}%`;
        }
    }
    
    // ===========================
    // Seek Controls
    // ===========================
    
    setupSeekControls() {
        this.elements.seekLeft?.addEventListener('click', () => {
            this.getActiveViewers().forEach(v => v?.seekLeft());
        });
        
        this.elements.seekRight?.addEventListener('click', () => {
            this.getActiveViewers().forEach(v => v?.seekRight());
        });
    }
    
    // ===========================
    // POI Controls
    // ===========================
    
    setupPOIControls() {
        this.elements.poiModeToggle?.addEventListener('click', () => {
            const isActive = this.elements.poiModeToggle.classList.toggle('active');
            // Emit event or callback for POI mode change
        });
    }
    
    getPOIType() {
        return this.elements.poiTypeSelect?.value || 'other';
    }
    
    isPOIModeActive() {
        return this.elements.poiModeToggle?.classList.contains('active') || false;
    }
    
    // ===========================
    // Query Form
    // ===========================
    
    setupQueryForm() {
        this.elements.queryForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleQuerySubmit();
        });
        
        this.elements.loadSampleBtn?.addEventListener('click', () => {
            if (this.onLoadSample) {
                this.onLoadSample();
            }
        });
    }
    
    handleQuerySubmit() {
        const params = {
            date: this.elements.dateSelect?.value,
            startLat: parseFloat(this.elements.startLat?.value),
            startLon: parseFloat(this.elements.startLon?.value),
            endLat: parseFloat(this.elements.endLat?.value),
            endLon: parseFloat(this.elements.endLon?.value)
        };
        
        if (!params.date) {
            this.showError('Please select a date');
            return;
        }
        
        if (isNaN(params.startLat) || isNaN(params.startLon) || 
            isNaN(params.endLat) || isNaN(params.endLon)) {
            this.showError('Please enter valid coordinates');
            return;
        }
        
        if (this.onQuerySubmit) {
            this.onQuerySubmit(params);
        }
    }
    
    // ===========================
    // Map Controls
    // ===========================
    
    setupMapControls() {
        this.elements.mapFitBounds?.addEventListener('click', () => {
            this.mapManager?.fitToTrack();
        });
        
        this.elements.mapToggleMarkers?.addEventListener('click', () => {
            const visible = this.mapManager?.toggleMarkers();
            this.elements.mapToggleMarkers.classList.toggle('active', visible);
        });
    }
    
    // ===========================
    // Viewer Callbacks
    // ===========================
    
    setupViewerCallbacks() {
        // Sync viewport changes between viewers
        this.viewers.forEach((viewer, index) => {
            if (!viewer) return;
            
            viewer.onViewportChange = (viewport) => {
                this.updateZoomDisplay();
                
                // Sync other viewer if enabled
                if (this.syncViewers) {
                    const otherIndex = index === 0 ? 1 : 0;
                    const otherViewer = this.viewers[otherIndex];
                    if (otherViewer && !otherViewer._isSyncing) {
                        viewer._isSyncing = true;
                        otherViewer.viewport.zoom = viewport.zoom;
                        otherViewer.viewport.offsetX = viewport.offsetX;
                        otherViewer.viewport.offsetY = viewport.offsetY;
                        otherViewer.render();
                        viewer._isSyncing = false;
                    }
                }
            };
            
            viewer.onPositionChange = (position) => {
                this.updateCursorInfo(position);
                
                // Update map position indicator
                if (position.trackIndex !== undefined) {
                    this.mapManager?.updatePositionIndicator(position.trackIndex);
                }
            };
        });
        
        // Map hover callback
        if (this.mapManager) {
            this.mapManager.onMapHover = (coords) => {
                if (this.elements.mapCursorCoords) {
                    this.elements.mapCursorCoords.textContent = 
                        `Hover: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`;
                }
            };
        }
    }
    
    updateCursorInfo(position) {
        if (this.elements.cursorPosition) {
            this.elements.cursorPosition.textContent = 
                `Position: ${position.dataX}, ${position.dataY}`;
        }
        
        if (this.elements.depthDisplay && position.depth !== undefined) {
            this.elements.depthDisplay.textContent = 
                `Depth: ${position.depth.toFixed(2)}m`;
        }
        
        if (this.elements.coordinatesDisplay && position.lat !== undefined) {
            this.elements.coordinatesDisplay.textContent = 
                `Coords: ${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}`;
        }
        
        if (this.elements.mileMarker && position.mile !== undefined) {
            this.elements.mileMarker.textContent = 
                `Mile: ${position.mile.toFixed(2)}`;
        }
    }
    
    // ===========================
    // Keyboard Shortcuts
    // ===========================
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch (e.key) {
                case '+':
                case '=':
                    this.getActiveViewers().forEach(v => v?.zoomIn());
                    break;
                case '-':
                    this.getActiveViewers().forEach(v => v?.zoomOut());
                    break;
                case '0':
                    this.getActiveViewers().forEach(v => v?.resetViewport());
                    break;
                case 'ArrowLeft':
                    this.getActiveViewers().forEach(v => v?.seekLeft());
                    break;
                case 'ArrowRight':
                    this.getActiveViewers().forEach(v => v?.seekRight());
                    break;
                case 's':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        // Toggle sync
                        this.elements.syncViewersBtn?.click();
                    }
                    break;
            }
        });
    }
    
    // ===========================
    // Loading & Status
    // ===========================
    
    showLoading(viewerNum = 0) {
        if (viewerNum === 0 || viewerNum === 1) {
            this.elements.loading1?.classList.remove('hidden');
            this.elements.placeholder1?.classList.add('hidden');
        }
        if (viewerNum === 0 || viewerNum === 2) {
            this.elements.loading2?.classList.remove('hidden');
            this.elements.placeholder2?.classList.add('hidden');
        }
    }
    
    hideLoading(viewerNum = 0) {
        if (viewerNum === 0 || viewerNum === 1) {
            this.elements.loading1?.classList.add('hidden');
        }
        if (viewerNum === 0 || viewerNum === 2) {
            this.elements.loading2?.classList.add('hidden');
        }
    }
    
    hidePlaceholders() {
        this.elements.placeholder1?.classList.add('hidden');
        this.elements.placeholder2?.classList.add('hidden');
    }
    
    setStatus(message) {
        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = message;
        }
    }
    
    setConnectionStatus(status) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = status;
            this.elements.connectionStatus.classList.remove('connected', 'disconnected');
            if (status.includes('Connected')) {
                this.elements.connectionStatus.classList.add('connected');
            }
        }
    }
    
    showError(message) {
        alert(message);
    }
    
    // ===========================
    // Track Info
    // ===========================
    
    updateTrackInfo(info) {
        if (this.elements.trackDistance) {
            this.elements.trackDistance.textContent = 
                `${info.totalDistanceMiles?.toFixed(2) || '--'} mi`;
        }
        if (this.elements.trackPoints) {
            this.elements.trackPoints.textContent = info.totalPoints || '--';
        }
    }
    
    updateViewerInfo(viewerNum, info) {
        const el = viewerNum === 1 ? this.elements.viewer1Info : this.elements.viewer2Info;
        if (el) {
            el.textContent = info;
        }
    }
}
