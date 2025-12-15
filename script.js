// Drape Area Calculator - FIXED Drape Coefficient Calculation

// Global variables
let stream = null;
let streaming = false;
let capturedImage = null;
let referencePoint = null;
let measurementHistory = [];
let isProcessing = false;
let cv = null;
let originalImageMat = null;
let processedImageMat = null;
let displayScale = 1;
let actualWidth = 0;
let actualHeight = 0;
let pixelToCmRatio = 1; // CRITICAL: Store this globally
let referenceRadiusPixels = 0;

// OpenCV ready handler
function onOpenCvReady() {
    console.log('OpenCV.js is ready');
    cv = window.cv;
    initializeApp();
}

// Initialize the application
function initializeApp() {
    console.log('Initializing Drape Calculator...');
    
    // Check if OpenCV is loaded
    if (!cv) {
        console.error('OpenCV not loaded yet');
        document.getElementById('status').textContent = 'Loading OpenCV...';
        return;
    }
    
    // Set up all event listeners
    setupEventListeners();
    
    // ADD THIS LINE: Setup diagnostic listeners
    setupDiagnosticListeners();
    
    // Load history from localStorage
    loadHistory();
    
    // Update UI state
    updateUIState();
    
    // Initialize device orientation
    initializeLevelIndicator();
    
    console.log('App initialized successfully');
}

// Setup event listeners
function setupEventListeners() {
    // ... (keep your existing event listener setup code) ...
}

// Handle canvas click for reference selection
function handleCanvasClick(event) {
    if (!originalImageMat) {
        alert('Please capture or upload an image first');
        return;
    }
    
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate click position
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log('Canvas click - Display coordinates:', x, y);
    console.log('Canvas dimensions:', canvas.width, canvas.height);
    console.log('Actual image dimensions:', actualWidth, actualHeight);
    console.log('Display scale:', displayScale);
    
    // Calculate actual image coordinates
    const actualX = Math.round(x / displayScale);
    const actualY = Math.round(y / displayScale);
    
    console.log('Calculated actual coordinates:', actualX, actualY);
    
    // Validate coordinates
    if (actualX < 0 || actualX >= actualWidth || actualY < 0 || actualY >= actualHeight) {
        alert('Click is outside the image area. Please click on the coin within the image.');
        return;
    }
    
    // Store reference point
    referencePoint = {
        displayX: x,
        displayY: y,
        actualX: actualX,
        actualY: actualY
    };
    
    console.log('Reference point stored:', referencePoint);
    
    // Draw visual feedback
    drawReferenceMarker(canvas, x, y);
    createClickFeedback(x, y);
    
    document.getElementById('status').textContent = 'Reference selected. Processing image...';
    updateUIState();
    
    setTimeout(() => {
        processImageWithReference();
    }, 300);
}

// Process image with reference - FIXED VERSION
async function processImageWithReference() {
    if (!originalImageMat || !referencePoint || isProcessing) {
        console.error('Cannot process: missing data');
        return;
    }
    
    isProcessing = true;
    document.getElementById('status').textContent = 'Processing image...';
    
    try {
        // Get reference diameter in cm
        const refType = document.getElementById('refType').value;
        const customDiameter = parseFloat(document.getElementById('refDiameter').value) || 2.5;
        const referenceDiameterCM = getReferenceDiameter(refType, customDiameter);
        
        console.log('=== DRAPE CALCULATION START ===');
        console.log('Reference diameter (cm):', referenceDiameterCM);
        console.log('Reference point (actual):', referencePoint.actualX, referencePoint.actualY);
        
        // FIX 1: Better reference object detection
        referenceRadiusPixels = detectReferenceObjectImproved(originalImageMat, referencePoint.actualX, referencePoint.actualY);
        
        console.log('Detected reference radius (pixels):', referenceRadiusPixels);
        
        if (referenceRadiusPixels <= 5) { // More reasonable threshold
            throw new Error('Could not detect reference object. Please click precisely on the center of the coin.');
        }
        
        // Calculate pixel to cm ratio
        pixelToCmRatio = referenceDiameterCM / (referenceRadiusPixels * 2);
        console.log('Pixel to cm ratio:', pixelToCmRatio);
        console.log('1 cm =', (1/pixelToCmRatio).toFixed(2), 'pixels');
        
        // FIX 2: Better drape area detection
        const drapeResults = detectDrapeAreaImproved(originalImageMat);
        const drapeAreaPixels = drapeResults.area;
        const drapeContour = drapeResults.contour;
        
        console.log('Drape area (pixels):', drapeAreaPixels);
        
        // FIX 3: Validate area is reasonable
        if (drapeAreaPixels < 100) {
            throw new Error('Detected drape area is too small. Please ensure good lighting and contrast.');
        }
        
        // Calculate actual area in cm²
        const pixelAreaInCm = pixelToCmRatio * pixelToCmRatio; // cm² per pixel
        const drapeAreaCm2 = drapeAreaPixels * pixelAreaInCm;
        
        console.log('Pixel area in cm²:', pixelAreaInCm.toFixed(6));
        console.log('Drape area (cm²):', drapeAreaCm2.toFixed(2));
        
        // FIX 4: Validate area is physically possible
        const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value) || 30.0;
        const maxPossibleArea = Math.PI * Math.pow(fabricDiameter/2, 2) * 1.5; // Allow 50% extra for folds
        
        if (drapeAreaCm2 > maxPossibleArea) {
            console.warn('Detected area seems too large. Possible measurement error.');
            alert('Warning: Detected area seems larger than physically possible. Please check reference object size.');
        }
        
        // Update results
        document.getElementById('pixelArea').textContent = Math.round(drapeAreaPixels);
        document.getElementById('actualArea').textContent = drapeAreaCm2.toFixed(2);
        
        // FIX 5: Calculate and validate drape coefficient
        const drapeCoefficient = calculateDrapeCoefficient(drapeAreaCm2);
        
        if (drapeCoefficient !== null) {
            console.log('Drape coefficient:', drapeCoefficient.toFixed(2) + '%');
            
            // Validate drape coefficient
            if (drapeCoefficient < 0 || drapeCoefficient > 100) {
                console.warn('Drape coefficient outside expected range:', drapeCoefficient);
                
                // Provide debugging info
                const debugInfo = debugDrapeCalculation(drapeAreaCm2);
                alert(`Warning: Drape coefficient ${drapeCoefficient.toFixed(2)}% is outside expected range (0-100%).\n\nPossible issues:\n1. Wrong coin size selected?\n2. Clicked wrong spot on coin?\n3. Poor image contrast?\n\nDebug Info:\n${debugInfo}`);
            }
            
            document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
            
            // Store for processed image
            window.drapeContour = drapeContour;
            
            addToHistory(drapeAreaCm2, drapeCoefficient);
        }
        
        // Create and display processed image
        createProcessedImage();
        
        console.log('=== DRAPE CALCULATION COMPLETE ===');
        document.getElementById('status').textContent = 'Analysis complete';
        
    } catch (error) {
        console.error('Error processing image:', error);
        document.getElementById('status').textContent = 'Error: ' + error.message;
        alert('Error processing image: ' + error.message);
    } finally {
        isProcessing = false;
    }
}

// FIXED: Improved reference object detection
function detectReferenceObjectImproved(srcMat, clickX, clickY) {
    // Create working copy
    let gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGB2GRAY);
    
    // Apply blur
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    
    // Try multiple parameter sets for circle detection
    const paramSets = [
        { dp: 1, minDist: 30, param1: 100, param2: 30, minRadius: 10, maxRadius: 100 },
        { dp: 1, minDist: 20, param1: 80, param2: 25, minRadius: 15, maxRadius: 150 },
        { dp: 1.2, minDist: 40, param1: 120, param2: 35, minRadius: 8, maxRadius: 80 }
    ];
    
    let bestRadius = 0;
    let bestDistance = Infinity;
    
    for (const params of paramSets) {
        let circles = new cv.Mat();
        
        cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 
            params.dp, params.minDist, params.param1, 
            params.param2, params.minRadius, params.maxRadius
        );
        
        for (let i = 0; i < circles.cols; i++) {
            const circle = circles.data32F.slice(i * 3, (i + 1) * 3);
            const x = circle[0];
            const y = circle[1];
            const radius = circle[2];
            
            const distance = Math.sqrt(Math.pow(x - clickX, 2) + Math.pow(y - clickY, 2));
            
            // Prefer circles close to click point
            if (distance < bestDistance && distance < 50) { // Must be within 50 pixels
                bestDistance = distance;
                bestRadius = radius;
            }
        }
        
        circles.delete();
    }
    
    // If no circle detected, estimate based on typical coin size
    if (bestRadius <= 0) {
        console.log('No circle detected, estimating from typical coin size');
        
        // Typical coin in image: 2.5cm coin at 10cm distance = ~100px diameter
        // Estimate based on image dimensions
        const estimatedRadius = Math.min(actualWidth, actualHeight) * 0.05; // 5% of image dimension
        bestRadius = Math.max(20, Math.min(estimatedRadius, 100)); // Between 20-100 pixels
        
        console.log('Estimated radius:', bestRadius);
    }
    
    gray.delete();
    
    console.log('Selected reference radius:', bestRadius, 'pixels, distance from click:', bestDistance);
    return bestRadius;
}

// FIXED: Improved drape area detection
function detectDrapeAreaImproved(srcMat) {
    let gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGB2GRAY);
    
    // Apply Gaussian blur to reduce noise
    cv.GaussianBlur(gray, gray, new cv.Size(7, 7), 0);
    
    // Use adaptive threshold for better shadow detection
    let binary = new cv.Mat();
    cv.adaptiveThreshold(gray, binary, 
        255, // max value
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV, // Invert to get dark areas
        21, // block size (odd number)
        10  // constant subtracted from mean
    );
    
    // Apply morphological operations to clean up
    let kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel);
    cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel);
    
    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, 
        cv.RETR_EXTERNAL, 
        cv.CHAIN_APPROX_SIMPLE
    );
    
    let maxArea = 0;
    let largestContour = null;
    let imageCenterX = srcMat.cols / 2;
    let imageCenterY = srcMat.rows / 2;
    
    // Find the largest contour near center (likely the drape)
    for (let i = 0; i < contours.size(); i++) {
        let contour = contours.get(i);
        let area = cv.contourArea(contour);
        
        // Get contour center
        let moments = cv.moments(contour);
        if (moments.m00 > 0) {
            let centerX = moments.m10 / moments.m00;
            let centerY = moments.m01 / moments.m00;
            
            // Distance from image center
            let distance = Math.sqrt(
                Math.pow(centerX - imageCenterX, 2) + 
                Math.pow(centerY - imageCenterY, 2)
            );
            
            // Prefer contours near center and with reasonable size
            if (area > maxArea && distance < Math.min(srcMat.cols, srcMat.rows) * 0.4) {
                maxArea = area;
                largestContour = contour.clone();
            }
        }
    }
    
    // Clean up
    gray.delete();
    binary.delete();
    kernel.delete();
    hierarchy.delete();
    
    // Store contour for display
    if (largestContour) {
        if (window.drapeContour) {
            window.drapeContour.delete();
        }
        window.drapeContour = largestContour;
    }
    
    return {
        area: maxArea,
        contour: largestContour
    };
}

// FIXED: Calculate drape coefficient with proper validation
function calculateDrapeCoefficient(measuredArea) {
    const diskDiameter = parseFloat(document.getElementById('diskDiameter').value) || 18.0;
    const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value) || 30.0;
    
    console.log('\n=== DRAPE COEFFICIENT CALCULATION ===');
    console.log('Inputs:', {
        measuredArea: measuredArea.toFixed(2) + ' cm²',
        diskDiameter: diskDiameter + ' cm',
        fabricDiameter: fabricDiameter + ' cm'
    });
    
    // Validation
    if (isNaN(diskDiameter) || diskDiameter <= 0) {
        alert('Please enter a valid positive diameter for the support disk');
        return null;
    }
    
    if (isNaN(fabricDiameter) || fabricDiameter <= 0) {
        alert('Please enter a valid positive diameter for the fabric sample');
        return null;
    }
    
    if (fabricDiameter <= diskDiameter) {
        alert(`Fabric diameter (${fabricDiameter} cm) must be larger than disk diameter (${diskDiameter} cm)`);
        return null;
    }
    
    if (isNaN(measuredArea) || measuredArea <= 0) {
        alert('Invalid measured area. Please capture and analyze an image first.');
        return null;
    }
    
    // Calculate areas
    const diskRadius = diskDiameter / 2;
    const fabricRadius = fabricDiameter / 2;
    
    const diskArea = Math.PI * Math.pow(diskRadius, 2);
    const fabricArea = Math.PI * Math.pow(fabricRadius, 2);
    
    console.log('Calculated areas:', {
        diskArea: diskArea.toFixed(2) + ' cm²',
        fabricArea: fabricArea.toFixed(2) + ' cm²'
    });
    
    // Calculate drape coefficient
    const numerator = measuredArea - diskArea;
    const denominator = fabricArea - diskArea;
    
    console.log('Calculation:', {
        numerator: numerator.toFixed(2),
        denominator: denominator.toFixed(2)
    });
    
    if (denominator <= 0) {
        alert('Calculation error: Fabric area must be larger than disk area');
        return null;
    }
    
    const drapeCoefficient = (numerator / denominator) * 100;
    
    console.log('Result:', drapeCoefficient.toFixed(2) + '%');
    
    // Provide detailed feedback if result is unreasonable
    if (drapeCoefficient > 100 || drapeCoefficient < 0) {
        console.warn('UNREASONABLE RESULT - Possible errors:');
        console.warn('1. Wrong reference object size?');
        console.warn('2. Incorrect pixel-to-cm ratio:', pixelToCmRatio);
        console.warn('3. Detected wrong area?');
        console.warn('4. Disk/Fabric diameters incorrect?');
    }
    
    return drapeCoefficient;
}

// Debug function to identify calculation issues
function debugDrapeCalculation(measuredArea) {
    const diskDiameter = parseFloat(document.getElementById('diskDiameter').value) || 18.0;
    const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value) || 30.0;
    
    const diskArea = Math.PI * Math.pow(diskDiameter/2, 2);
    const fabricArea = Math.PI * Math.pow(fabricDiameter/2, 2);
    
    let debugInfo = '';
    debugInfo += `Measured Area: ${measuredArea.toFixed(2)} cm²\n`;
    debugInfo += `Disk Area (π×(${diskDiameter/2})²): ${diskArea.toFixed(2)} cm²\n`;
    debugInfo += `Fabric Area (π×(${fabricDiameter/2})²): ${fabricArea.toFixed(2)} cm²\n`;
    debugInfo += `Pixel-to-cm ratio: ${pixelToCmRatio.toFixed(6)}\n`;
    debugInfo += `1 cm = ${(1/pixelToCmRatio).toFixed(2)} pixels\n`;
    debugInfo += `Reference radius: ${referenceRadiusPixels.toFixed(2)} pixels\n`;
    
    // Check if measured area is reasonable
    if (measuredArea < diskArea) {
        debugInfo += `\n⚠️ ERROR: Measured area (${measuredArea.toFixed(2)} cm²) is LESS than disk area (${diskArea.toFixed(2)} cm²)\n`;
        debugInfo += 'This means the fabric appears smaller than the disk, which is impossible.\n';
        debugInfo += 'Possible causes:\n';
        debugInfo += '1. Reference coin size is wrong\n';
        debugInfo += '2. Clicked wrong spot on coin\n';
        debugInfo += '3. Image is not properly aligned\n';
    }
    
    if (measuredArea > fabricArea * 2) {
        debugInfo += `\n⚠️ ERROR: Measured area (${measuredArea.toFixed(2)} cm²) is MORE than double fabric area (${fabricArea.toFixed(2)} cm²)\n`;
        debugInfo += 'The draped area cannot be larger than the original fabric.\n';
        debugInfo += 'Possible causes:\n';
        debugInfo += '1. Reference coin is too small in image\n';
        debugInfo += '2. Pixel-to-cm ratio calculation is wrong\n';
        debugInfo += '3. Detected area includes background\n';
    }
    
    return debugInfo;
}

// Create processed image with measurement overlay
function createProcessedImage() {
    if (!originalImageMat || !referencePoint) return;
    
    const processedCanvas = document.getElementById('processedCanvas');
    const displayCtx = processedCanvas.getContext('2d');
    
    // Set canvas dimensions
    processedCanvas.width = displayWidth;
    processedCanvas.height = displayHeight;
    
    // Clear canvas
    displayCtx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
    
    try {
        // Draw the original image
        const originalCanvas = document.getElementById('originalCanvas');
        displayCtx.drawImage(originalCanvas, 0, 0, displayWidth, displayHeight);
        
        // Highlight drape area if available
        if (window.drapeContour) {
            displayCtx.save();
            
            const contour = window.drapeContour;
            const scaleX = displayWidth / actualWidth;
            const scaleY = displayHeight / actualHeight;
            
            displayCtx.beginPath();
            
            // Draw contour
            for (let i = 0; i < contour.data32S.length; i += 2) {
                const x = contour.data32S[i] * scaleX;
                const y = contour.data32S[i + 1] * scaleY;
                
                if (i === 0) {
                    displayCtx.moveTo(x, y);
                } else {
                    displayCtx.lineTo(x, y);
                }
            }
            
            // Close path
            if (contour.data32S.length > 0) {
                const firstX = contour.data32S[0] * scaleX;
                const firstY = contour.data32S[1] * scaleY;
                displayCtx.lineTo(firstX, firstY);
            }
            
            displayCtx.closePath();
            
            // Fill with semi-transparent color
            displayCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            displayCtx.fill();
            
            // Draw contour outline
            displayCtx.strokeStyle = '#ff0000';
            displayCtx.lineWidth = 2;
            displayCtx.stroke();
            
            displayCtx.restore();
        }
        
        // Highlight reference point
        displayCtx.save();
        
        const displayX = referencePoint.displayX;
        const displayY = referencePoint.displayY;
        
        // Draw reference circle with actual size
        const referenceRadiusDisplay = referenceRadiusPixels * displayScale;
        displayCtx.beginPath();
        displayCtx.arc(displayX, displayY, referenceRadiusDisplay, 0, Math.PI * 2);
        displayCtx.strokeStyle = '#00ff00';
        displayCtx.lineWidth = 2;
        displayCtx.stroke();
        
        // Draw center marker
        displayCtx.beginPath();
        displayCtx.arc(displayX, displayY, 3, 0, Math.PI * 2);
        displayCtx.fillStyle = '#00ff00';
        displayCtx.fill();
        
        // Add measurement info
        displayCtx.save();
        displayCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        displayCtx.fillRect(10, 10, 300, 100);
        
        displayCtx.fillStyle = 'white';
        displayCtx.font = 'bold 14px Arial';
        displayCtx.fillText('Measurement Results', 20, 30);
        
        displayCtx.font = '12px Arial';
        const area = document.getElementById('actualArea').textContent;
        const drape = document.getElementById('drapeCoefficient').textContent;
        displayCtx.fillText(`Area: ${area} cm²`, 20, 50);
        displayCtx.fillText(`Drape: ${drape}`, 20, 70);
        displayCtx.fillText(`Scale: 1 cm = ${(1/pixelToCmRatio).toFixed(1)} px`, 20, 90);
        
        displayCtx.restore();
        
        // Show processed canvas
        processedCanvas.style.display = 'block';
        
    } catch (error) {
        console.error('Error creating processed image:', error);
        processedCanvas.style.display = 'block';
    }
}

// Helper function to get reference diameter
function getReferenceDiameter(refType, customDiameter) {
    switch(refType) {
        case 'coin2':
            return 2.5; // Indian 2 Rupee Coin
        case 'coin10':
            return 2.7; // Indian 10 Rupee Coin
        case 'custom':
            return parseFloat(customDiameter) || 2.5;
        default:
            return 2.5;
    }
}

// Calculate drape coefficient
function calculateDrapeCoefficient(measuredArea) {
    const diskDiameter = parseFloat(document.getElementById('diskDiameter').value) || 18.0;
    const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value) || 30.0;
    
    // Simple validation
    if (isNaN(diskDiameter) || isNaN(fabricDiameter)) {
        alert('Please enter valid diameters for disk and fabric');
        return null;
    }
    
    if (fabricDiameter <= diskDiameter) {
        alert('Fabric diameter must be larger than disk diameter');
        return null;
    }
    
    // Calculate areas
    const diskArea = Math.PI * Math.pow(diskDiameter / 2, 2);
    const fabricArea = Math.PI * Math.pow(fabricDiameter / 2, 2);
    
    // Calculate drape coefficient
    const drapeCoefficient = ((measuredArea - diskArea) / (fabricArea - diskArea)) * 100;
    
    return drapeCoefficient;
}

// Calculate Drape Percentage
function calculateDrapePercentage() {
    const measuredAreaText = document.getElementById('actualArea').textContent;
    
    if (measuredAreaText === '--') {
        alert('Please capture and analyze an image first');
        return;
    }
    
    const measuredArea = parseFloat(measuredAreaText);
    
    if (isNaN(measuredArea)) {
        alert('Please capture and analyze an image first');
        return;
    }
    
    const drapeCoefficient = calculateDrapeCoefficient(measuredArea);
    
    if (drapeCoefficient !== null) {
        document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
        addToHistory(measuredArea, drapeCoefficient);
    }
}

// Auto calculate drape
function autoCalculateDrape() {
    if (!originalImageMat) {
        alert('Please capture or upload an image first');
        return;
    }
    
    if (!referencePoint) {
        alert('Please select reference point first by clicking on the coin');
        return;
    }
    
    processImageWithReference();
}

// Add to history
function addToHistory(area, drapePercent) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString();
    
    const measurement = {
        id: Date.now(),
        date: dateString,
        time: timeString,
        area: area.toFixed(2),
        drapePercent: drapePercent.toFixed(2),
        timestamp: now.toISOString()
    };
    
    measurementHistory.unshift(measurement);
    if (measurementHistory.length > 20) {
        measurementHistory.pop();
    }
    
    updateHistoryTable();
    saveHistory();
}

// Update history table
function updateHistoryTable() {
    const historyBody = document.getElementById('historyBody');
    if (!historyBody) return;
    
    historyBody.innerHTML = '';
    
    measurementHistory.forEach(measurement => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${measurement.time}<br><small>${measurement.date}</small></td>
            <td>${measurement.area} cm²</td>
            <td>${measurement.drapePercent}%</td>
            <td>
                <button class="btn-small" onclick="deleteMeasurement(${measurement.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        historyBody.appendChild(row);
    });
}

// Delete measurement
function deleteMeasurement(id) {
    measurementHistory = measurementHistory.filter(m => m.id !== id);
    updateHistoryTable();
    saveHistory();
    alert('Measurement deleted');
}

// Clear history
function clearHistory() {
    if (measurementHistory.length === 0) {
        alert('No measurements to clear');
        return;
    }
    
    if (confirm('Are you sure you want to clear all measurement history?')) {
        measurementHistory = [];
        updateHistoryTable();
        saveHistory();
        alert('History cleared');
    }
}

// Save history
function saveHistory() {
    try {
        localStorage.setItem('drapeMeasurements', JSON.stringify(measurementHistory));
    } catch (e) {
        console.error('Error saving history:', e);
    }
}

// Load history
function loadHistory() {
    try {
        const saved = localStorage.getItem('drapeMeasurements');
        if (saved) {
            measurementHistory = JSON.parse(saved);
            updateHistoryTable();
        }
    } catch (e) {
        console.error('Error loading history:', e);
    }
}

// Export to CSV
function exportToCSV() {
    if (measurementHistory.length === 0) {
        alert('No measurements to export');
        return;
    }
    
    let csv = 'Date,Time,Area (cm²),Drape Coefficient (%)\n';
    
    measurementHistory.forEach(measurement => {
        csv += `"${measurement.date}","${measurement.time}","${measurement.area}","${measurement.drapePercent}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drape-measurements-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    alert('Data exported successfully');
}

// Reset application
function resetApp() {
    const video = document.getElementById('video');
    const originalCanvas = document.getElementById('originalCanvas');
    const processedCanvas = document.getElementById('processedCanvas');
    
    // Stop camera
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Reset OpenCV mats
    if (originalImageMat) {
        originalImageMat.delete();
        originalImageMat = null;
    }
    
    if (processedImageMat) {
        processedImageMat.delete();
        processedImageMat = null;
    }
    
    if (window.largestContour) {
        window.largestContour.delete();
        window.largestContour = null;
    }
    
    // Reset displays
    video.style.display = 'block';
    originalCanvas.style.display = 'none';
    processedCanvas.style.display = 'none';
    
    // Clear canvases
    const ctx1 = originalCanvas.getContext('2d');
    const ctx2 = processedCanvas.getContext('2d');
    ctx1.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    ctx2.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
    
    // Reset results
    document.getElementById('pixelArea').textContent = '--';
    document.getElementById('actualArea').textContent = '--';
    document.getElementById('drapeCoefficient').textContent = '--';
    document.getElementById('status').textContent = 'Ready';
    
    // Reset level indicator
    const bubbleCenter = document.querySelector('.bubble-center');
    const levelStatus = document.getElementById('levelStatus');
    if (bubbleCenter) {
        bubbleCenter.style.transform = 'translate(-50%, -50%) translate(0px, 0px)';
        bubbleCenter.style.background = '#00ff00';
        bubbleCenter.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.7)';
    }
    if (levelStatus) {
        levelStatus.textContent = '--';
        levelStatus.style.color = '#00ff00';
    }
    
    // Clear stored data
    capturedImage = null;
    referencePoint = null;
    streaming = false;
    isProcessing = false;
    displayScale = 1;
    imageDataURL = null;
    displayWidth = 0;
    displayHeight = 0;
    actualWidth = 0;
    actualHeight = 0;
    
    // Update UI
    updateUIState();
    
    alert('Application reset');
}
// ============================================
// DIAGNOSTIC AND CALIBRATION FUNCTIONS
// ============================================

// Setup diagnostic event listeners - Call this from initializeApp()
function setupDiagnosticListeners() {
    console.log('Setting up diagnostic listeners...');
    
    // Run Diagnostics button
    const runDiagnosticsBtn = document.getElementById('runDiagnostics');
    if (runDiagnosticsBtn) {
        runDiagnosticsBtn.addEventListener('click', runDiagnostics);
        console.log('Run Diagnostics button listener added');
    }
    
    // Calibrate Scale button
    const calibrateScaleBtn = document.getElementById('calibrateScale');
    if (calibrateScaleBtn) {
        calibrateScaleBtn.addEventListener('click', calibrateScale);
        console.log('Calibrate Scale button listener added');
    }
    
    // Show Debug Info button
    const showDebugInfoBtn = document.getElementById('showDebugInfo');
    if (showDebugInfoBtn) {
        showDebugInfoBtn.addEventListener('click', showDebugInfo);
        console.log('Show Debug Info button listener added');
    }
    
    // Update estimated diameter when manual scale changes
    const manualScaleInput = document.getElementById('manualScale');
    if (manualScaleInput) {
        manualScaleInput.addEventListener('input', updateEstimatedDiameter);
    }
}

// Update estimated coin diameter based on manual scale
function updateEstimatedDiameter() {
    const manualScale = parseFloat(document.getElementById('manualScale').value);
    if (!isNaN(manualScale) && manualScale > 0) {
        // Calculate: coin diameter in pixels = 2.5cm / scale
        const estimatedPixels = 2.5 / manualScale;
        document.getElementById('estimatedDiameter').value = Math.round(estimatedPixels);
    }
}

// Run comprehensive diagnostics
function runDiagnostics() {
    if (!originalImageMat || !referencePoint) {
        alert('Please capture an image and select a reference point first.');
        return;
    }
    
    console.log('=== RUNNING COMPREHENSIVE DIAGNOSTICS ===');
    
    let diagnosticReport = '🔍 DIAGNOSTIC REPORT\n\n';
    let issuesFound = 0;
    
    // 1. Check reference point
    diagnosticReport += '1. REFERENCE POINT ANALYSIS:\n';
    diagnosticReport += `   • Click position: (${referencePoint.actualX}, ${referencePoint.actualY})\n`;
    diagnosticReport += `   • Image dimensions: ${actualWidth} × ${actualHeight} px\n`;
    
    if (referencePoint.actualX < 10 || referencePoint.actualX > actualWidth - 10 || 
        referencePoint.actualY < 10 || referencePoint.actualY > actualHeight - 10) {
        diagnosticReport += '   ⚠️ WARNING: Click too close to image edge\n';
        issuesFound++;
    } else {
        diagnosticReport += '   ✅ OK: Click well within image bounds\n';
    }
    
    // 2. Check scale calculation
    diagnosticReport += '\n2. SCALE CALCULATION:\n';
    diagnosticReport += `   • Reference radius: ${referenceRadiusPixels.toFixed(1)} px\n`;
    diagnosticReport += `   • Pixel-to-cm ratio: ${pixelToCmRatio.toFixed(6)}\n`;
    diagnosticReport += `   • 1 cm = ${(1/pixelToCmRatio).toFixed(1)} pixels\n`;
    
    // Typical values: 2.5cm coin = ~100px diameter = ~50px radius
    // So pixelToCmRatio should be ~0.025
    const expectedRatio = 0.025; // 2.5cm / 100px
    const ratioDiff = Math.abs(pixelToCmRatio - expectedRatio) / expectedRatio;
    
    if (ratioDiff > 0.5) { // More than 50% off
        diagnosticReport += `   ❌ PROBLEM: Scale is ${(ratioDiff * 100).toFixed(0)}% off expected value\n`;
        diagnosticReport += `   Expected: ~0.025 cm/px (2.5cm coin = 100px diameter)\n`;
        diagnosticReport += `   Current: ${pixelToCmRatio.toFixed(6)} cm/px\n`;
        issuesFound++;
    } else {
        diagnosticReport += '   ✅ OK: Scale is reasonable\n';
    }
    
    // 3. Check measured area
    const measuredAreaText = document.getElementById('actualArea').textContent;
    const measuredArea = parseFloat(measuredAreaText) || 0;
    const pixelArea = parseFloat(document.getElementById('pixelArea').textContent) || 0;
    
    diagnosticReport += '\n3. AREA MEASUREMENT:\n';
    diagnosticReport += `   • Pixel area: ${pixelArea.toLocaleString()} px²\n`;
    diagnosticReport += `   • Actual area: ${measuredArea.toFixed(2)} cm²\n`;
    
    // 4. Check against expected ranges
    const diskDiameter = parseFloat(document.getElementById('diskDiameter').value) || 18.0;
    const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value) || 30.0;
    
    const diskArea = Math.PI * Math.pow(diskDiameter/2, 2);
    const fabricArea = Math.PI * Math.pow(fabricDiameter/2, 2);
    
    diagnosticReport += '\n4. EXPECTED RANGES:\n';
    diagnosticReport += `   • Disk area (${diskDiameter}cm): ${diskArea.toFixed(2)} cm²\n`;
    diagnosticReport += `   • Fabric area (${fabricDiameter}cm): ${fabricArea.toFixed(2)} cm²\n`;
    diagnosticReport += `   • Drape should be between: ${diskArea.toFixed(2)} - ${fabricArea.toFixed(2)} cm²\n`;
    
    if (measuredArea < diskArea * 0.9) {
        diagnosticReport += '   ❌ PROBLEM: Area too small (less than disk)\n';
        diagnosticReport += '   Possible: Wrong coin size or bad reference detection\n';
        issuesFound++;
    } else if (measuredArea > fabricArea * 1.5) {
        diagnosticReport += '   ❌ PROBLEM: Area too large (more than fabric)\n';
        diagnosticReport += '   Possible: Scale too small or includes background\n';
        issuesFound++;
    } else if (measuredArea >= diskArea && measuredArea <= fabricArea) {
        diagnosticReport += '   ✅ OK: Area within reasonable range\n';
    } else {
        diagnosticReport += '   ⚠️ WARNING: Area slightly outside expected range\n';
    }
    
    // 5. Check drape coefficient
    const drapeText = document.getElementById('drapeCoefficient').textContent;
    const drapeMatch = drapeText.match(/(\d+\.?\d*)/);
    const drapeValue = drapeMatch ? parseFloat(drapeMatch[1]) : 0;
    
    diagnosticReport += '\n5. DRAPE COEFFICIENT:\n';
    diagnosticReport += `   • Current value: ${drapeValue.toFixed(2)}%\n`;
    
    if (drapeValue < 0 || drapeValue > 100) {
        diagnosticReport += `   ❌ PROBLEM: Value ${drapeValue.toFixed(2)}% outside 0-100% range\n`;
        issuesFound++;
    } else if (drapeValue >= 0 && drapeValue <= 100) {
        diagnosticReport += '   ✅ OK: Value within 0-100% range\n';
    }
    
    // 6. Recommendations
    diagnosticReport += '\n6. RECOMMENDATIONS:\n';
    
    if (issuesFound === 0) {
        diagnosticReport += '   ✅ All checks passed! Measurements appear correct.\n';
    } else {
        diagnosticReport += `   Found ${issuesFound} potential issue(s):\n`;
        
        if (ratioDiff > 0.5) {
            diagnosticReport += '   • Try manual scale calibration\n';
            diagnosticReport += '   • Ensure you clicked the CENTER of the coin\n';
            diagnosticReport += '   • Verify coin size in settings (2.5cm for Indian 2 Rupee)\n';
        }
        
        if (measuredArea < diskArea * 0.9) {
            diagnosticReport += '   • Coin may be detected as too large\n';
            diagnosticReport += '   • Try clicking closer to coin center\n';
            diagnosticReport += '   • Use smaller manual scale value\n';
        }
        
        if (measuredArea > fabricArea * 1.5) {
            diagnosticReport += '   • Coin may be detected as too small\n';
            diagnosticReport += '   • Try clicking exactly on coin edge\n';
            diagnosticReport += '   • Use larger manual scale value\n';
        }
    }
    
    // Show report in alert and console
    console.log(diagnosticReport);
    
    // Create a nicer display
    showDiagnosticReport(diagnosticReport, issuesFound);
}

// Show diagnostic report in a modal
function showDiagnosticReport(report, issuesFound) {
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'diagnosticModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        padding: 20px;
    `;
    
    // Modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 10px;
        padding: 25px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 5px 30px rgba(0,0,0,0.3);
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #eee;
    `;
    
    const title = document.createElement('h3');
    title.style.margin = '0';
    title.style.color = issuesFound > 0 ? '#e74c3c' : '#2ecc71';
    title.innerHTML = `<i class="fas fa-stethoscope"></i> Diagnostic Results ${issuesFound > 0 ? ' - Issues Found' : ' - All Good!'}`;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #7f8c8d;
    `;
    closeBtn.onclick = () => {
        document.body.removeChild(modal);
    };
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Report content
    const content = document.createElement('div');
    content.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 20px;
        max-height: 400px;
        overflow-y: auto;
    `;
    content.textContent = report;
    
    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 20px;
    `;
    
    const calibrateBtn = document.createElement('button');
    calibrateBtn.innerHTML = '<i class="fas fa-ruler"></i> Calibrate Scale';
    calibrateBtn.className = 'btn btn-warning';
    calibrateBtn.onclick = () => {
        document.body.removeChild(modal);
        showCalibrationHelp();
    };
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '<i class="fas fa-check"></i> Close';
    closeButton.className = 'btn btn-primary';
    closeButton.onclick = () => {
        document.body.removeChild(modal);
    };
    
    actions.appendChild(calibrateBtn);
    actions.appendChild(closeButton);
    
    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(content);
    modalContent.appendChild(actions);
    modal.appendChild(modalContent);
    
    // Add to page
    document.body.appendChild(modal);
    
    // Close on ESC key
    modal.onkeydown = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
        }
    };
    modal.focus();
}

// Show calibration help
function showCalibrationHelp() {
    const helpText = `📏 CALIBRATION GUIDE

If drape coefficient is >100%, follow these steps:

STEP 1: Check Coin Detection
• The green circle should match the coin size
• If circle is too small/big, scale is wrong

STEP 2: Manual Calibration
1. Measure coin diameter in image (pixels):
   - Right-click image → "Inspect"
   - Use ruler tool or count pixels

2. Calculate correct scale:
   Scale = Coin Diameter (cm) ÷ Pixel Diameter

3. Enter scale in "Manual Scale" field
   Example: 2.5cm coin = 100 pixels
   Scale = 2.5 ÷ 100 = 0.025

STEP 3: Apply and Retest
1. Click "Apply Manual Scale"
2. Click coin again to recalculate
3. Check if drape coefficient is now 0-100%

Common Scale Values:
• 2.5cm coin = ~100px → 0.025
• 2.5cm coin = ~80px  → 0.03125
• 2.5cm coin = ~120px → 0.02083

Need help? Try these test scales: 0.020, 0.025, 0.030`;

    alert(helpText);
    
    // Focus on manual scale input
    const manualScaleInput = document.getElementById('manualScale');
    if (manualScaleInput) {
        manualScaleInput.focus();
        manualScaleInput.select();
    }
}

// Apply manual scale calibration
function calibrateScale() {
    const manualScaleInput = document.getElementById('manualScale');
    const manualScale = parseFloat(manualScaleInput.value);
    
    if (isNaN(manualScale) || manualScale <= 0 || manualScale > 1) {
        alert('Please enter a valid scale between 0.001 and 1.0');
        manualScaleInput.focus();
        manualScaleInput.select();
        return;
    }
    
    // Update global scale
    pixelToCmRatio = manualScale;
    
    // Update estimated diameter display
    updateEstimatedDiameter();
    
    // If we have a measured pixel area, recalculate
    const pixelAreaText = document.getElementById('pixelArea').textContent;
    if (pixelAreaText !== '--') {
        const pixelArea = parseFloat(pixelAreaText);
        if (!isNaN(pixelArea)) {
            // Recalculate area
            const newArea = pixelArea * manualScale * manualScale;
            document.getElementById('actualArea').textContent = newArea.toFixed(2);
            
            // Recalculate drape coefficient
            const drapeCoefficient = calculateDrapeCoefficient(newArea);
            if (drapeCoefficient !== null) {
                document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
                
                // Update history with new calculation
                const historyIndex = measurementHistory.findIndex(m => m.area === pixelAreaText);
                if (historyIndex !== -1) {
                    measurementHistory[historyIndex].area = newArea.toFixed(2);
                    measurementHistory[historyIndex].drapePercent = drapeCoefficient.toFixed(2);
                    updateHistoryTable();
                    saveHistory();
                }
            }
            
            alert(`Scale calibrated to: ${manualScale.toFixed(6)} cm/pixel\n1 cm = ${(1/manualScale).toFixed(1)} pixels\nAreas recalculated.`);
        }
    } else {
        alert(`Scale set to: ${manualScale.toFixed(6)} cm/pixel\n1 cm = ${(1/manualScale).toFixed(1)} pixels\nCapture a new image to use this scale.`);
    }
}

// Show debug information
function showDebugInfo() {
    let debugInfo = '🛠️ DEBUG INFORMATION\n\n';
    
    debugInfo += 'Image Properties:\n';
    debugInfo += `• Original dimensions: ${actualWidth} × ${actualHeight} px\n`;
    debugInfo += `• Display dimensions: ${displayWidth} × ${displayHeight} px\n`;
    debugInfo += `• Display scale: ${displayScale.toFixed(4)}\n\n`;
    
    debugInfo += 'Reference Information:\n';
    if (referencePoint) {
        debugInfo += `• Click position: (${referencePoint.displayX}, ${referencePoint.displayY}) display\n`;
        debugInfo += `• Actual position: (${referencePoint.actualX}, ${referencePoint.actualY}) px\n`;
        debugInfo += `• Reference radius: ${referenceRadiusPixels.toFixed(1)} px\n`;
    } else {
        debugInfo += '• No reference point selected\n';
    }
    
    debugInfo += `• Pixel-to-cm ratio: ${pixelToCmRatio.toFixed(6)}\n`;
    debugInfo += `• 1 pixel = ${(pixelToCmRatio * 10).toFixed(3)} mm\n\n`;
    
    debugInfo += 'Current Measurements:\n';
    debugInfo += `• Pixel area: ${document.getElementById('pixelArea').textContent}\n`;
    debugInfo += `• Actual area: ${document.getElementById('actualArea').textContent}\n`;
    debugInfo += `• Drape coefficient: ${document.getElementById('drapeCoefficient').textContent}\n\n`;
    
    debugInfo += 'Settings:\n';
    debugInfo += `• Disk diameter: ${document.getElementById('diskDiameter').value} cm\n`;
    debugInfo += `• Fabric diameter: ${document.getElementById('fabricDiameter').value} cm\n`;
    debugInfo += `• Reference type: ${document.getElementById('refType').value}\n`;
    
    // Show in console
    console.log(debugInfo);
    
    // Show to user
    const debugModal = document.createElement('div');
    debugModal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 5px 30px rgba(0,0,0,0.3);
        z-index: 2000;
        max-width: 500px;
        max-height: 70vh;
        overflow-y: auto;
    `;
    
    debugModal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin: 0; color: #3498db;"><i class="fas fa-bug"></i> Debug Information</h4>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #7f8c8d;">×</button>
        </div>
        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-size: 12px; line-height: 1.4; white-space: pre-wrap; max-height: 400px; overflow-y: auto;">${debugInfo}</pre>
        <div style="margin-top: 15px; text-align: center;">
            <button onclick="this.parentElement.parentElement.remove()" class="btn btn-primary" style="padding: 8px 20px;">Close</button>
        </div>
    `;
    
    document.body.appendChild(debugModal);
}


// Initialize when page loads (fallback)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Make deleteMeasurement available globally
window.deleteMeasurement = deleteMeasurement;
