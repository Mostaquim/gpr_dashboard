/**
 * API Service Module
 * Handles all communication with the backend API
 */

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP error ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

async function postAPI(endpoint, body) {
    return fetchAPI(endpoint, {
        method: 'POST',
        body: JSON.stringify(body || {})
    });
}

/**
 * Build query string from parameters object
 */
function buildQueryString(params) {
    const filtered = Object.entries(params)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    
    return filtered.length > 0 ? `?${filtered.join('&')}` : '';
}

// ===========================
// GPR API Functions
// ===========================

/**
 * Get list of available dates with GPR data
 */
export async function getAvailableDates() {
    return fetchAPI('/gpr/dates');
}

/**
 * Get GPR slice data for the specified parameters
 */
export async function getGPRSlice(params) {
    const { date, startLat, startLon, endLat, endLon, zoomLevel = 1 } = params;

    return postAPI('/gpr/query-latlng', {
        date,
        zoom_level: zoomLevel,
        filters: ['raw'],
        startpoint: { lat: startLat, lng: startLon },
        endpoint: { lat: endLat, lng: endLon }
    });
}

/**
 * Query GPR slice using mileage start/end
 */
export async function getGPRByMileage(params) {
    const { date, startMileage, endMileage, filters = ['raw'] } = params;
    return postAPI('/gpr/query-mileage', {
        date,
        start_mileage: startMileage,
        end_mileage: endMileage,
        filters
    });
}

/**
 * Get data bounds for a specific date
 */
export async function getDataBounds(date) {
    return fetchAPI(`/gpr/bounds?date=${encodeURIComponent(date)}`);
}

// ===========================
// GPS API Functions
// ===========================

/**
 * Get GPS track for a date
 */
export async function getGPSTrack(params) {
    const queryString = buildQueryString(params);
    return fetchAPI(`/gps/track${queryString}`);
}

/**
 * Get location at a specific time
 */
export async function getLocationAtTime(date, time) {
    return fetchAPI(`/gps/location-at-time?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`);
}

// ===========================
// POI API Functions
// ===========================

/**
 * Create a new POI
 */
export async function createPOI(poiData) {
    return postAPI('/poi', poiData);
}

/**
 * Get all POIs, optionally filtered
 */
export async function getPOIs(filters = {}) {
    const queryString = buildQueryString(filters);
    return fetchAPI(`/poi/${queryString}`);
}

/**
 * Get a specific POI by ID
 */
export async function getPOI(poiId) {
    return fetchAPI(`/poi/${encodeURIComponent(poiId)}`);
}

/**
 * Update a POI
 */
export async function updatePOI(poiId, updateData) {
    return Promise.reject(new Error('POI update is not implemented on backend yet'));
}

/**
 * Delete a POI
 */
export async function deletePOI(poiId) {
    return fetchAPI(`/poi/${encodeURIComponent(poiId)}`, {
        method: 'DELETE'
    });
}

/**
 * Export all POIs for a date to a separate labels file
 */
export async function exportPOIs(date, pois) {
    return postAPI('/poi/export', { date, pois });
}

/**
 * Get available POI types
 */
export async function getPOITypes() {
    return {
        types: ['culvert', 'pipe', 'void', 'anomaly', 'other']
    };
}

// ===========================
// Connection Health
// ===========================

/**
 * Check if backend is reachable
 */
export async function checkHealth() {
    try {
        const response = await fetch('http://localhost:8000/health');
        return response.ok;
    } catch {
        return false;
    }
}
