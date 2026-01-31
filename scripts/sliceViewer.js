/**
 * Slice Viewer Module (Plotly.js version)
 * Renders GPR data as an interactive heatmap using Plotly
 */

export class SliceViewer {
    constructor(plotDivId, containerId) {
        this.plotDiv = document.getElementById(plotDivId);
        this.container = document.getElementById(containerId);
        this.plotId = plotDivId;
        
        // Data state
        this.data = null;
        this.metadata = null;
        this.gpsTrack = null;
        
        // Viewport state (for compatibility)
        this.viewport = {
            zoom: 1,
            offsetX: 0,
            offsetY: 0
        };
        
        // Settings
        this.colorscale = 'RdBu';
        this.reversescale = true;
        
        // POI markers
        this.pois = [];
        
        // Callbacks
        this.onPositionChange = null;
        this.onViewportChange = null;
        this.onClick = null;
        
        // Internal flag to prevent sync loops
        this._isSyncing = false;
        
        this.init();
    }
    
    init() {
        // Set up resize observer
        this.resizeObserver = new ResizeObserver(() => {
            this.handleResize();
        });
        this.resizeObserver.observe(this.container);
        
        // Initialize empty plot
        this.initEmptyPlot();
    }
    
    initEmptyPlot() {
        const layout = this.getLayout();
        const config = this.getConfig();
        
        Plotly.newPlot(this.plotDiv, [], layout, config);
        
        // Set up event handlers
        this.setupEventHandlers();
    }
    
    getLayout() {
        return {
            paper_bgcolor: '#0a0a0a',
            plot_bgcolor: '#0a0a0a',
            margin: { l: 60, r: 20, t: 10, b: 40 },
            xaxis: {
                title: { text: 'Distance (samples)', font: { color: '#a0aec0', size: 11 } },
                color: '#a0aec0',
                gridcolor: '#2d3748',
                zerolinecolor: '#2d3748',
                tickfont: { size: 10 }
            },
            yaxis: {
                title: { text: 'Depth (samples)', font: { color: '#a0aec0', size: 11 } },
                color: '#a0aec0',
                gridcolor: '#2d3748',
                zerolinecolor: '#2d3748',
                autorange: 'reversed', // Depth increases downward
                tickfont: { size: 10 }
            },
            dragmode: 'zoom',
            hovermode: 'closest'
        };
    }
    
    getConfig() {
        return {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'sendDataToCloud'],
            displaylogo: false,
            scrollZoom: true
        };
    }
    
    setupEventHandlers() {
        // Hover event for position info
        this.plotDiv.on('plotly_hover', (data) => {
            if (data.points && data.points.length > 0) {
                const point = data.points[0];
                this.handleHover(point.x, point.y, point.z);
            }
        });
        
        // Click event for POI marking
        this.plotDiv.on('plotly_click', (data) => {
            if (data.points && data.points.length > 0) {
                const point = data.points[0];
                if (this.onClick) {
                    this.onClick({
                        dataX: Math.round(point.x),
                        dataY: Math.round(point.y),
                        intensity: point.z
                    });
                }
            }
        });
        
        // Zoom/pan events for syncing
        this.plotDiv.on('plotly_relayout', (eventData) => {
            if (this._isSyncing) return;
            
            // Extract new axis ranges
            const xRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
            const yRange = [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']];
            
            if (xRange[0] !== undefined || yRange[0] !== undefined) {
                if (this.onViewportChange) {
                    this.onViewportChange({
                        xRange: xRange[0] !== undefined ? xRange : null,
                        yRange: yRange[0] !== undefined ? yRange : null,
                        eventData: eventData
                    });
                }
            }
        });
    }
    
    handleHover(x, y, intensity) {
        if (this.onPositionChange) {
            const geoCoords = this.dataToGeoCoords(x, y);
            this.onPositionChange({
                dataX: Math.round(x),
                dataY: Math.round(y),
                intensity: intensity,
                lat: geoCoords?.lat,
                lon: geoCoords?.lon,
                depth: geoCoords?.depth,
                mile: geoCoords?.mile,
                trackIndex: geoCoords?.trackIndex
            });
        }
    }
    
    /**
     * Load GPR data into the viewer
     */
    loadData(gprResponse) {
        this.data = gprResponse.data;
        this.metadata = {
            width: gprResponse.width,
            height: gprResponse.height,
            date: gprResponse.date,
            startLat: gprResponse.start_lat,
            startLon: gprResponse.start_lon,
            endLat: gprResponse.end_lat,
            endLon: gprResponse.end_lon,
            depthRange: gprResponse.metadata?.depth_range_m || [0, 5],
            ...gprResponse.metadata
        };
        this.gpsTrack = gprResponse.gps_track || null;
        
        this.render();
    }
    
    /**
     * Render the GPR data using Plotly heatmap
     */
    render() {
        if (!this.data || this.data.length === 0) {
            return;
        }
        
        // Create heatmap trace
        const heatmapTrace = {
            z: this.data,
            type: 'heatmap',
            colorscale: this.colorscale,
            reversescale: this.reversescale,
            zsmooth: 'best', // Smooth interpolation
            hovertemplate: 'X: %{x}<br>Depth: %{y}<br>Intensity: %{z}<extra></extra>',
            colorbar: {
                title: { text: 'Intensity', font: { color: '#a0aec0', size: 10 } },
                tickfont: { color: '#a0aec0', size: 9 },
                thickness: 15,
                len: 0.9
            }
        };
        
        const traces = [heatmapTrace];
        
        // Add POI markers if any
        if (this.pois.length > 0) {
            const poiTrace = {
                x: this.pois.map(p => p.slice_x),
                y: this.pois.map(p => p.slice_y),
                mode: 'markers+text',
                type: 'scatter',
                marker: {
                    size: 12,
                    color: this.pois.map(p => this.getPoiColor(p.type)),
                    symbol: 'diamond',
                    line: { color: 'white', width: 2 }
                },
                text: this.pois.map(p => p.label),
                textposition: 'top center',
                textfont: { color: '#fff', size: 10 },
                hovertemplate: '%{text}<extra></extra>',
                name: 'POIs'
            };
            traces.push(poiTrace);
        }
        
        const layout = this.getLayout();
        
        Plotly.react(this.plotDiv, traces, layout, this.getConfig());
    }
    
    getPoiColor(type) {
        const colors = {
            culvert: '#FF6B6B',
            pipe: '#4ECDC4',
            void: '#45B7D1',
            anomaly: '#FFEAA7',
            other: '#DFE6E9'
        };
        return colors[type] || colors.other;
    }
    
    /**
     * Update colorscale
     */
    setColorscale(colorscale) {
        this.colorscale = colorscale;
        if (this.data) {
            this.render();
        }
    }
    
    /**
     * Add a POI marker
     */
    addPOI(poi) {
        this.pois.push(poi);
        this.render();
    }
    
    /**
     * Set POIs
     */
    setPOIs(pois) {
        this.pois = pois || [];
        if (this.data) {
            this.render();
        }
    }
    
    /**
     * Convert data coordinates to geo coordinates
     */
    dataToGeoCoords(dataX, dataY) {
        if (!this.metadata) return null;
        
        const { startLat, startLon, endLat, endLon, width, height, depthRange } = this.metadata;
        
        const t = dataX / width;
        const lat = startLat + (endLat - startLat) * t;
        const lon = startLon + (endLon - startLon) * t;
        
        const depthT = dataY / height;
        const depth = depthRange[0] + (depthRange[1] - depthRange[0]) * depthT;
        
        // Calculate mile marker from GPS track if available
        let mile = null;
        let trackIndex = null;
        if (this.gpsTrack && this.gpsTrack.length > 0) {
            trackIndex = Math.floor(t * (this.gpsTrack.length - 1));
            trackIndex = Math.max(0, Math.min(trackIndex, this.gpsTrack.length - 1));
            mile = this.gpsTrack[trackIndex].distance_miles;
        }
        
        return { lat, lon, depth, mile, trackIndex };
    }
    
    /**
     * Reset viewport to show all data
     */
    resetViewport() {
        if (!this.data) return;
        
        Plotly.relayout(this.plotDiv, {
            'xaxis.autorange': true,
            'yaxis.autorange': 'reversed'
        });
    }
    
    /**
     * Zoom in
     */
    zoomIn() {
        const currentRange = this.getCurrentRange();
        if (!currentRange) return;
        
        const xCenter = (currentRange.x[0] + currentRange.x[1]) / 2;
        const yCenter = (currentRange.y[0] + currentRange.y[1]) / 2;
        const xSpan = (currentRange.x[1] - currentRange.x[0]) * 0.4;
        const ySpan = (currentRange.y[1] - currentRange.y[0]) * 0.4;
        
        Plotly.relayout(this.plotDiv, {
            'xaxis.range': [xCenter - xSpan, xCenter + xSpan],
            'yaxis.range': [yCenter + ySpan, yCenter - ySpan]
        });
    }
    
    /**
     * Zoom out
     */
    zoomOut() {
        const currentRange = this.getCurrentRange();
        if (!currentRange) return;
        
        const xCenter = (currentRange.x[0] + currentRange.x[1]) / 2;
        const yCenter = (currentRange.y[0] + currentRange.y[1]) / 2;
        const xSpan = (currentRange.x[1] - currentRange.x[0]) * 0.8;
        const ySpan = (currentRange.y[1] - currentRange.y[0]) * 0.8;
        
        Plotly.relayout(this.plotDiv, {
            'xaxis.range': [xCenter - xSpan, xCenter + xSpan],
            'yaxis.range': [yCenter + ySpan, yCenter - ySpan]
        });
    }
    
    /**
     * Center view on a specific X position
     */
    centerOnDataX(dataX) {
        if (!this.data || !this.metadata) return;
        
        const currentRange = this.getCurrentRange();
        if (!currentRange) return;
        
        const xSpan = (currentRange.x[1] - currentRange.x[0]) / 2;
        
        Plotly.relayout(this.plotDiv, {
            'xaxis.range': [dataX - xSpan, dataX + xSpan]
        });
    }
    
    /**
     * Sync viewport with another viewer
     */
    syncViewport(eventData) {
        if (!eventData) return;
        
        this._isSyncing = true;
        Plotly.relayout(this.plotDiv, eventData).then(() => {
            this._isSyncing = false;
        });
    }
    
    /**
     * Get current axis ranges
     */
    getCurrentRange() {
        if (!this.plotDiv || !this.plotDiv._fullLayout) return null;
        
        const xaxis = this.plotDiv._fullLayout.xaxis;
        const yaxis = this.plotDiv._fullLayout.yaxis;
        
        return {
            x: [xaxis.range[0], xaxis.range[1]],
            y: [yaxis.range[0], yaxis.range[1]]
        };
    }
    
    /**
     * Get zoom percentage (approximate)
     */
    getZoomPercentage() {
        if (!this.data || !this.metadata) return 100;
        
        const currentRange = this.getCurrentRange();
        if (!currentRange) return 100;
        
        const visibleWidth = Math.abs(currentRange.x[1] - currentRange.x[0]);
        const totalWidth = this.metadata.width;
        
        return Math.round((totalWidth / visibleWidth) * 100);
    }
    
    /**
     * Seek left
     */
    seekLeft(amount = 50) {
        const currentRange = this.getCurrentRange();
        if (!currentRange) return;
        
        Plotly.relayout(this.plotDiv, {
            'xaxis.range': [currentRange.x[0] - amount, currentRange.x[1] - amount]
        });
    }
    
    /**
     * Seek right
     */
    seekRight(amount = 50) {
        const currentRange = this.getCurrentRange();
        if (!currentRange) return;
        
        Plotly.relayout(this.plotDiv, {
            'xaxis.range': [currentRange.x[0] + amount, currentRange.x[1] + amount]
        });
    }
    
    /**
     * Handle container resize
     */
    handleResize() {
        if (this.plotDiv) {
            Plotly.Plots.resize(this.plotDiv);
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        Plotly.purge(this.plotDiv);
    }
}