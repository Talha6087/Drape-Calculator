// Drape Area Calculator - Complete Script
// Fixed: Reference point precision and Calculate Drape % functionality

// Global variables
let stream = null;
let streaming = false;
let capturedImage = null;
let referencePoint = null;
let currentCanvas = null;
let canvasDisplayWidth = 0;
let canvasDisplayHeight = 0;
let canvasActualWidth = 0;
let canvasActualHeight = 0;
let measurementHistory = [];

// OpenCV ready handler
function onOpenCvReady() {
    console.log('OpenCV.js is ready');
    initializeEventListeners();
    loadHistory();
}

// Initialize all event listeners
function initializeEventListeners() {
    // Start Camera button
    document.getElementById('startCamera').addEventListener('click', startCamera);
    
    // Capture button
    document.getElementById('capture').addEventListener('click', captureImage);
    
    // Reset button
    document.getElementById('reset').addEventListener('click', resetApp);
    
    // Reference type change
    document.getElementById('refType').addEventListener('change', function() {
        const customRef = document.getElementById('customRef');
        if (this.value === 'custom') {
            customRef.style.display = 'block';
        } else {
            customRef.style.display = 'none';
        }
    });
    
    // Calculate Drape % button
    document.getElementById('calculateDrape').addEventListener('click', calculateDrapePercentage);
    
    // Export CSV button
    document.getElementById('exportData').addEventListener('click', exportToCSV);
}

// Start camera function
function startCamera() {
    const video = document.getElementById('video');
    
    // Request camera access
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: 'environment', // Use back camera on mobile
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        },
        audio: false 
    })
    .then(function(mediaStream) {
        stream = mediaStream;
        video.srcObject = stream;
        video.play();
        
        // Update UI
        document.getElementById('startCamera').disabled = true;
        document.getElementById('capture').disabled = false;
        document.getElementById('reset').disabled = false;
        document.getElementById('status').textContent = 'Camera ready - Position phone above drape';
        
        // Set streaming flag when video starts playing
        video.onplaying = function() {
            streaming = true;
        };
    })
    .catch(function(err) {
        console.error('Error accessing camera:', err);
        document.getElementById('status').textContent = 'Error accessing camera: ' + err.message;
        alert('Unable to access camera. Please ensure camera permissions are granted.');
    });
}

// Capture image function
function captureImage() {
    if (!streaming) return;
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const outputCanvas = document.getElementById('outputCanvas');
    
    // Set canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    outputCanvas.width = video.videoWidth;
    outputCanvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Store the image data
    capturedImage = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Display the captured image on output canvas
    const outputContext = outputCanvas.getContext('2d');
    outputContext.putImageData(capturedImage, 0, 0);
    
    // Show canvas, hide video
    video.style.display = 'none';
    outputCanvas.style.display = 'block';
    
    // Update UI
    document.getElementById('status').textContent = 'Click on reference object (coin) in image';
    document.getElementById('capture').disabled = true;
    document.getElementById('startCamera').disabled = true;
    
    // Store canvas dimensions for click coordinate mapping
    currentCanvas = outputCanvas;
    canvasDisplayWidth = outputCanvas.offsetWidth;
    canvasDisplayHeight = outputCanvas.offsetHeight;
    canvasActualWidth = outputCanvas.width;
    canvasActualHeight = outputCanvas.height;
    
    // Enable canvas clicking for reference selection
    outputCanvas.style.cursor = 'crosshair';
    outputCanvas.addEventListener('click', handleCanvasClick);
}

// Handle canvas click for reference point selection (FIXED for precision)
function handleCanvasClick(event) {
    if (!capturedImage) return;
    
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate actual canvas coordinates (considering scaling) - FIXED
    const scaleX = canvasActualWidth / canvasDisplayWidth;
    const scaleY = canvasActualHeight / canvasDisplayHeight;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Store reference point
    referencePoint = { 
        x: Math.round(x), 
        y: Math.round(y),
        displayX: event.clientX - rect.left,
        displayY: event.clientY - rect.top
    };
    
    // Draw a marker at the clicked point
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(referencePoint.displayX, referencePoint.displayY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add crosshair
    ctx.beginPath();
    ctx.moveTo(referencePoint.displayX - 15, referencePoint.displayY);
    ctx.lineTo(referencePoint.displayX + 15, referencePoint.displayY);
    ctx.moveTo(referencePoint.displayX, referencePoint.displayY - 15);
    ctx.lineTo(referencePoint.displayX, referencePoint.displayY + 15);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Remove click listener
    canvas.style.cursor = 'default';
    canvas.removeEventListener('click', handleCanvasClick);
    
    // Process the image with the reference point
    processImageWithReference();
}

// Process image with reference point
function processImageWithReference() {
    if (!capturedImage || !referencePoint) return;
    
    document.getElementById('status').textContent = 'Processing image...';
    
    // Use OpenCV for image processing
    if (typeof cv === 'undefined') {
        document.getElementById('status').textContent = 'OpenCV not loaded yet';
        return;
    }
    
    try {
        // Convert to grayscale and find edges
        const src = cv.matFromImageData(capturedImage);
        const gray = new cv.Mat();
        const edges = new cv.Mat();
        
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
        cv.Canny(gray, edges, 50, 150);
        
        // Find contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // Find largest contour (likely the drape)
        let largestContour = null;
        let maxArea = 0;
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            if (area > maxArea && area > 1000) { // Ignore small contours
                maxArea = area;
                largestContour = contour;
            }
        }
        
        if (largestContour) {
            // Calculate pixel area
            const pixelArea = maxArea;
            document.getElementById('pixelArea').textContent = pixelArea.toFixed(0);
            
            // Find reference object (coin) near the clicked point
            let referenceContour = null;
            let minDistance = Infinity;
            let referenceRect = null;
            
            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);
                const rect = cv.boundingRect(contour);
                
                // Check if contour is near reference point and is roughly circular
                const contourCenterX = rect.x + rect.width / 2;
                const contourCenterY = rect.y + rect.height / 2;
                
                const distance = Math.sqrt(
                    Math.pow(contourCenterX - referencePoint.x, 2) + 
                    Math.pow(contourCenterY - referencePoint.y, 2)
                );
                
                // Check if contour is roughly circular (width ≈ height)
                const aspectRatio = Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
                
                if (distance < 150 && aspectRatio > 0.7 && distance < minDistance) {
                    minDistance = distance;
                    referenceContour = contour;
                    referenceRect = rect;
                }
            }
            
            if (referenceContour && referenceRect) {
                // Calculate reference diameter in pixels
                const referencePixelDiameter = (referenceRect.width + referenceRect.height) / 2;
                
                // Get actual reference diameter in cm
                let referenceDiameterCm;
                const refType = document.getElementById('refType').value;
                
                if (refType === 'coin') {
                    referenceDiameterCm = 2.5;
                } else if (refType === 'coin2') {
                    referenceDiameterCm = 2.7;
                } else if (refType === 'coin5') {
                    referenceDiameterCm = 2.5;
                } else {
                    referenceDiameterCm = parseFloat(document.getElementById('refDiameter').value) || 2.5;
                }
                
                // Calculate pixel to cm ratio
                const pixelToCm = referenceDiameterCm / referencePixelDiameter;
                
                // Calculate actual area in cm²
                const actualArea = pixelArea * Math.pow(pixelToCm, 2);
                document.getElementById('actualArea').textContent = actualArea.toFixed(2);
                
                // Display on processed canvas
                displayProcessedImage(src, contours, largestContour, referenceContour);
                
                // Calculate and display drape coefficient
                const drapeCoefficient = calculateDrapeCoefficient(actualArea);
                if (drapeCoefficient !== null) {
                    document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
                }
                
                document.getElementById('status').textContent = 'Analysis complete';
            } else {
                document.getElementById('status').textContent = 'Reference object not found near clicked point';
            }
        } else {
            document.getElementById('status').textContent = 'No drape contour found';
        }
        
        // Cleanup
        src.delete();
        gray.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
    } catch (error) {
        console.error('Error processing image:', error);
        document.getElementById('status').textContent = 'Error processing image';
    }
}

// Display processed image with contours
function displayProcessedImage(src, contours, drapeContour, refContour) {
    const processedCanvas = document.getElementById('processedCanvas');
    const processedCtx = processedCanvas.getContext('2d');
    
    // Set canvas size
    processedCanvas.width = capturedImage.width;
    processedCanvas.height = capturedImage.height;
    
    // Create a copy of source for drawing
    const drawing = src.clone();
    
    // Draw all contours in light green
    cv.drawContours(drawing, contours, -1, [0, 200, 0, 255], 1);
    
    // Draw drape contour in blue
    const drapeContours = new cv.MatVector();
    drapeContours.push_back(drapeContour);
    cv.drawContours(drawing, drapeContours, 0, [0, 0, 255, 255], 3);
    
    // Draw reference contour in yellow
    const refContours = new cv.MatVector();
    refContours.push_back(refContour);
    cv.drawContours(drawing, refContours, 0, [255, 255, 0, 255], 2);
    
    // Draw reference point
    cv.circle(drawing, new cv.Point(referencePoint.x, referencePoint.y), 10, [255, 0, 0, 255], 3);
    
    // Display on canvas
    cv.imshow(processedCanvas, drawing);
    
    // Cleanup
    drawing.delete();
    drapeContours.delete();
    refContours.delete();
}

// Calculate drape coefficient
function calculateDrapeCoefficient(measuredArea) {
    const diskDiameter = parseFloat(document.getElementById('diskDiameter').value);
    const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value);
    
    if (!diskDiameter || !fabricDiameter || isNaN(diskDiameter) || isNaN(fabricDiameter)) {
        alert('Please enter valid diameters for disk and fabric');
        return null;
    }
    
    // Calculate areas
    const diskArea = Math.PI * Math.pow(diskDiameter / 2, 2);
    const fabricArea = Math.PI * Math.pow(fabricDiameter / 2, 2);
    
    // Calculate drape percentage using standard formula
    const drapePercentage = ((measuredArea - diskArea) / (fabricArea - diskArea)) * 100;
    
    return drapePercentage;
}

// Calculate Drape Percentage (called by button)
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
        
        // Add to history
        addToHistory(measuredArea, drapeCoefficient);
    }
}

// Add measurement to history
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
    
    measurementHistory.unshift(measurement); // Add to beginning
    if (measurementHistory.length > 20) {
        measurementHistory.pop(); // Keep only last 20 measurements
    }
    
    updateHistoryTable();
    saveHistory();
}

// Update history table
function updateHistoryTable() {
    const historyBody = document.getElementById('historyBody');
    historyBody.innerHTML = '';
    
    measurementHistory.forEach(measurement => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${measurement.time}<br><small>${measurement.date}</small></td>
            <td>${measurement.area} cm²</td>
            <td>${measurement.drapePercent}%</td>
            <td>
                <button class="btn-small" onclick="deleteMeasurement(${measurement.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        historyBody.appendChild(row);
    });
}

// Delete a measurement
function deleteMeasurement(id) {
    measurementHistory = measurementHistory.filter(m => m.id !== id);
    updateHistoryTable();
    saveHistory();
}

// Save history to localStorage
function saveHistory() {
    try {
        localStorage.setItem('drapeMeasurements', JSON.stringify(measurementHistory));
    } catch (e) {
        console.error('Error saving history:', e);
    }
}

// Load history from localStorage
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

// Export data to CSV
function exportToCSV() {
    if (measurementHistory.length === 0) {
        alert('No measurements to export');
        return;
    }
    
    // CSV header
    let csv = 'Date,Time,Area (cm²),Drape Coefficient (%)\n';
    
    // Add data rows
    measurementHistory.forEach(measurement => {
        csv += `"${measurement.date}","${measurement.time}","${measurement.area}","${measurement.drapePercent}"\n`;
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drape-measurements-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Reset application
function resetApp() {
    const video = document.getElementById('video');
    const outputCanvas = document.getElementById('outputCanvas');
    const processedCanvas = document.getElementById('processedCanvas');
    
    // Stop camera
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Reset displays
    video.style.display = 'block';
    outputCanvas.style.display = 'none';
    
    // Clear canvases
    const ctx1 = outputCanvas.getContext('2d');
    const ctx2 = processedCanvas.getContext('2d');
    ctx1.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx2.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
    
    // Reset results
    document.getElementById('pixelArea').textContent = '--';
    document.getElementById('actualArea').textContent = '--';
    document.getElementById('drapeCoefficient').textContent = '--';
    document.getElementById('status').textContent = 'Ready';
    
    // Reset buttons
    document.getElementById('capture').disabled = true;
    document.getElementById('reset').disabled = true;
    document.getElementById('startCamera').disabled = false;
    
    // Clear stored data
    capturedImage = null;
    referencePoint = null;
    streaming = false;
    
    // Remove event listeners from canvas
    outputCanvas.style.cursor = 'default';
    outputCanvas.removeEventListener('click', handleCanvasClick);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Add CSS for small buttons
    const style = document.createElement('style');
    style.textContent = `
        .btn-small {
            padding: 5px 10px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn-small:hover {
            background: #c0392b;
        }
    `;
    document.head.appendChild(style);
    
    console.log('Drape Area Calculator initialized');
});
