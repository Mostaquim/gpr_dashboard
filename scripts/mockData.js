/**
 * Mock Data Generator
 * Generates realistic sample GPR and GPS data for testing
 */

/**
 * Generate a realistic GPS track along a railway line
 * Simulates a train route with slight variations
 */
export function generateMockGPSTrack(startLat, startLon, endLat, endLon, numPoints = 500) {
    const track = [];
    let cumulativeDistance = 0;
    
    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        
        // Linear interpolation with some random drift (simulating GPS inaccuracy)
        const drift = 0.0001 * Math.sin(i * 0.3) + (Math.random() - 0.5) * 0.00005;
        const lat = startLat + (endLat - startLat) * t + drift;
        const lon = startLon + (endLon - startLon) * t + drift * 0.5;
        
        // Calculate distance from previous point
        if (i > 0) {
            const prevPoint = track[i - 1];
            const dist = haversineDistance(prevPoint.lat, prevPoint.lon, lat, lon);
            cumulativeDistance += dist;
        }
        
        // Convert to miles
        const miles = cumulativeDistance * 0.621371;
        
        // Generate timestamp (assuming 30 mph average speed on railway)
        const baseTime = new Date('2025-06-15T08:00:00Z');
        const hoursElapsed = miles / 30;
        const timestamp = new Date(baseTime.getTime() + hoursElapsed * 3600 * 1000);
        
        track.push({
            index: i,
            lat: lat,
            lon: lon,
            distance_km: cumulativeDistance,
            distance_miles: miles,
            timestamp: timestamp.toISOString(),
            elevation: 200 + Math.sin(i * 0.1) * 20 + Math.random() * 5,
            speed_kmh: 40 + Math.random() * 20
        });
    }
    
    return track;
}

/**
 * Haversine formula for distance between two GPS coordinates
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Generate realistic GPR slice data
 * Creates a 2D array simulating ground penetrating radar returns
 */
export function generateMockGPRData(width = 1200, height = 200) {
    const data = [];
    
    // Create base layer pattern (soil layers)
    for (let y = 0; y < height; y++) {
        const row = [];
        const depth = y / height; // 0 to 1, represents depth
        
        for (let x = 0; x < width; x++) {
            // Base signal decreases with depth
            let intensity = 128 - depth * 60;
            
            // Add horizontal layer reflections
            if (y > 20 && y < 28) intensity += 40; // Surface layer
            if (y > 55 && y < 65) intensity += 30 + Math.sin(x * 0.08) * 10; // Subsurface layer
            if (y > 100 && y < 112) intensity += 25; // Deeper layer
            if (y > 140 && y < 155) intensity += 20; // Deep layer
            if (y > 175 && y < 185) intensity += 15; // Very deep layer
            
            // Add some random noise
            intensity += (Math.random() - 0.5) * 30;
            
            // Add many hyperbolic reflections (typical GPR response to point objects)
            // Spread across the longer width
            intensity += addHyperbola(x, y, 80, 38, 0.3) * 60;    // Culvert #1
            intensity += addHyperbola(x, y, 180, 55, 0.25) * 50;  // Pipe #1
            intensity += addHyperbola(x, y, 300, 42, 0.35) * 55;  // Object #1
            intensity += addHyperbola(x, y, 420, 70, 0.2) * 45;   // Deeper object
            intensity += addHyperbola(x, y, 520, 35, 0.32) * 58;  // Culvert #2
            intensity += addHyperbola(x, y, 650, 60, 0.28) * 48;  // Pipe #2
            intensity += addHyperbola(x, y, 780, 48, 0.3) * 52;   // Object #2
            intensity += addHyperbola(x, y, 880, 80, 0.22) * 42;  // Deep feature
            intensity += addHyperbola(x, y, 980, 40, 0.33) * 56;  // Culvert #3
            intensity += addHyperbola(x, y, 1100, 52, 0.27) * 50; // Pipe #3
            
            // Add some vertical features (rebar, utilities)
            if (Math.abs(x - 120) < 2 && y > 15 && y < 70) intensity += 50;
            if (Math.abs(x - 350) < 2 && y > 20 && y < 55) intensity += 45;
            if (Math.abs(x - 580) < 2 && y > 18 && y < 65) intensity += 48;
            if (Math.abs(x - 820) < 2 && y > 22 && y < 60) intensity += 44;
            if (Math.abs(x - 1050) < 2 && y > 16 && y < 58) intensity += 46;
            
            // Add some void/cavity signatures (diffuse areas)
            intensity += addVoid(x, y, 260, 90, 25, 15) * 35;
            intensity += addVoid(x, y, 700, 110, 30, 20) * 30;
            intensity += addVoid(x, y, 950, 95, 22, 18) * 32;
            
            // Clamp to valid range
            intensity = Math.max(0, Math.min(255, Math.round(intensity)));
            row.push(intensity);
        }
        data.push(row);
    }
    
    return data;
}

/**
 * Generate hyperbolic reflection pattern (characteristic of buried objects in GPR)
 */
function addHyperbola(x, y, centerX, centerY, spread) {
    const dx = (x - centerX) * spread;
    const hypY = centerY + Math.sqrt(1 + dx * dx) * 8;
    const distance = Math.abs(y - hypY);
    
    if (distance < 3) {
        return Math.exp(-distance * 0.5);
    }
    return 0;
}

/**
 * Generate void/cavity signature (diffuse reflection)
 */
function addVoid(x, y, centerX, centerY, radiusX, radiusY) {
    const dx = (x - centerX) / radiusX;
    const dy = (y - centerY) / radiusY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 1) {
        return Math.exp(-dist * 2) * (0.8 + Math.random() * 0.4);
    }
    return 0;
}

/**
 * Generate complete mock dataset for testing
 */
export function generateMockDataset() {
    // Default coordinates (simulating a longer railway section in Ontario, Canada)
    // Extended route for more data
    const startLat = 42.9647;
    const startLon = -81.2897;
    const endLat = 43.0556;
    const endLon = -81.0823;
    
    // Generate GPS track (500 points for longer track)
    const gpsTrack = generateMockGPSTrack(startLat, startLon, endLat, endLon, 500);
    
    // Generate GPR data (1200 x 200 for more detail)
    const gprData = generateMockGPRData(1200, 200);
    
    // Calculate total distance
    const totalDistance = gpsTrack[gpsTrack.length - 1].distance_km;
    const totalMiles = gpsTrack[gpsTrack.length - 1].distance_miles;
    
    return {
        date: '2025-06-15',
        start_lat: startLat,
        start_lon: startLon,
        end_lat: endLat,
        end_lon: endLon,
        gps_track: gpsTrack,
        gpr_data: gprData,
        width: gprData[0].length,
        height: gprData.length,
        metadata: {
            total_distance_km: totalDistance,
            total_distance_miles: totalMiles,
            depth_range_m: [0, 6],
            recording_start: gpsTrack[0].timestamp,
            recording_end: gpsTrack[gpsTrack.length - 1].timestamp,
            sample_rate: 'simulated',
            antenna_frequency: '400 MHz (simulated)'
        }
    };
}

/**
 * Get mock POI data (pre-marked points of interest)
 */
export function getMockPOIs() {
    return [
        {
            id: 'poi-1',
            type: 'culvert',
            label: 'Culvert #1',
            slice_x: 80,
            slice_y: 38,
            lat: 42.9712,
            lon: -81.2765,
            mile_marker: 0.42,
            notes: 'Metal culvert, approx 24" diameter'
        },
        {
            id: 'poi-2',
            type: 'pipe',
            label: 'Utility Pipe #1',
            slice_x: 180,
            slice_y: 55,
            lat: 42.9823,
            lon: -81.2556,
            mile_marker: 1.14,
            notes: 'Possible water main'
        },
        {
            id: 'poi-3',
            type: 'void',
            label: 'Void Area',
            slice_x: 260,
            slice_y: 90,
            lat: 42.9912,
            lon: -81.2378,
            mile_marker: 1.72,
            notes: 'Subsurface void - investigate'
        },
        {
            id: 'poi-4',
            type: 'anomaly',
            label: 'Unknown Feature',
            slice_x: 420,
            slice_y: 70,
            lat: 43.0089,
            lon: -81.1978,
            mile_marker: 2.89,
            notes: 'Deep anomaly - needs investigation'
        },
        {
            id: 'poi-5',
            type: 'culvert',
            label: 'Culvert #2',
            slice_x: 520,
            slice_y: 35,
            lat: 43.0178,
            lon: -81.1756,
            mile_marker: 3.56,
            notes: 'Concrete culvert'
        }
    ];
}