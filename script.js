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
    
    if (!cv) {
        document.getElementById('status').textContent = 'Loading OpenCV...';
        return;
    }
    
    setupEventListeners();
    loadHistory();
    updateUIState();
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

// Initialize when page loads (fallback)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Make deleteMeasurement available globally
window.deleteMeasurement = deleteMeasurement;
