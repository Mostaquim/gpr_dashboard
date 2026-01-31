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
    
    const queryString = buildQueryString({
        date,
        start_lat: startLat,
        start_lon: startLon,
        end_lat: endLat,
        end_lon: endLon,
        zoom_level: zoomLevel
    });
    
    return fetchAPI(`/gpr/slice${queryString}`);
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
    return fetchAPI('/poi/', {
        method: 'POST',
        body: JSON.stringify(poiData)
    });
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
    return fetchAPI(`/poi/${poiId}`);
}

/**
 * Update a POI
 */
export async function updatePOI(poiId, updateData) {
    return fetchAPI(`/poi/${poiId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
    });
}

/**
 * Delete a POI
 */
export async function deletePOI(poiId) {
    return fetchAPI(`/poi/${poiId}`, {
        method: 'DELETE'
    });
}

/**
 * Get available POI types
 */
export async function getPOITypes() {
    return fetchAPI('/poi/types/list');
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
