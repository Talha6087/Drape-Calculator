// Drape Area Calculator - Complete Fixed Version

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
let openCvReady = false;

// OpenCV ready handler
function onOpenCvReady() {
    console.log('OpenCV.js is ready');
    openCvReady = true;
    initializeEventListeners();
    loadHistory();
    setupDeviceOrientation();
}

// Initialize all event listeners
function initializeEventListeners() {
    // Start Camera button
    document.getElementById('startCamera').addEventListener('click', startCamera);
    
    // Upload Image button
    document.getElementById('uploadImage').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    // File input change
    document.getElementById('fileInput').addEventListener('change', handleImageUpload);
    
    // Capture button
    document.getElementById('capture').addEventListener('click', captureImage);
    
    // Reset button
    document.getElementById('reset').addEventListener('click', resetApp);
    
    // Reference type change
    document.getElementById('refType').addEventListener('change', function() {
        const customRef = document.getElementById('customRefGroup');
        customRef.style.display = this.value === 'custom' ? 'block' : 'none';
    });
    
    // Calculate Drape % button
    document.getElementById('calculateDrape').addEventListener('click', calculateDrapePercentage);
    
    // Export CSV button
    document.getElementById('exportData').addEventListener('click', exportToCSV);
    
    // Clear History button
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
}

// Start camera function
function startCamera() {
    const video = document.getElementById('video');
    const status = document.getElementById('status');
    
    status.textContent = 'Starting camera...';
    
    // Stop existing stream if any
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    // Request camera access
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false 
    })
    .then(function(mediaStream) {
        stream = mediaStream;
        video.srcObject = stream;
        
        video.onloadedmetadata = function() {
            video.play();
            
            // Update UI
            document.getElementById('startCamera').disabled = true;
            document.getElementById('capture').disabled = false;
            document.getElementById('reset').disabled = false;
            document.getElementById('uploadImage').disabled = true;
            status.textContent = 'Camera ready - Position phone above drape';
            
            streaming = true;
        };
        
        video.onerror = function(err) {
            console.error('Video error:', err);
            status.textContent = 'Error starting video stream';
        };
    })
    .catch(function(err) {
        console.error('Error accessing camera:', err);
        status.textContent = 'Error accessing camera: ' + err.message;
        alert('Unable to access camera. Please ensure camera permissions are granted.');
    });
}

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const status = document.getElementById('status');
    status.textContent = 'Loading image...';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Create canvas
            const canvas = document.getElementById('canvas');
            const outputCanvas = document.getElementById('outputCanvas');
            
            // Set canvas dimensions
            canvas.width = img.width;
            canvas.height = img.height;
            outputCanvas.width = img.width;
            outputCanvas.height = img.height;
            
            // Draw image to canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // Store the image data
            capturedImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Display on output canvas
            const outputCtx = outputCanvas.getContext('2d');
            outputCtx.drawImage(img, 0, 0);
            
            // Show canvas, hide video
            const video = document.getElementById('video');
            video.style.display = 'none';
            outputCanvas.style.display = 'block';
            
            // Update UI
            status.textContent = 'Click on reference object (coin) in image';
            document.getElementById('capture').disabled = true;
            document.getElementById('startCamera').disabled = true;
            document.getElementById('uploadImage').disabled = true;
            document.getElementById('reset').disabled = false;
            
            // Store canvas dimensions for click coordinate mapping
            currentCanvas = outputCanvas;
            canvasDisplayWidth = outputCanvas.offsetWidth;
            canvasDisplayHeight = outputCanvas.offsetHeight;
            canvasActualWidth = outputCanvas.width;
            canvasActualHeight = outputCanvas.height;
            
            // Enable canvas clicking for reference selection
            outputCanvas.style.cursor = 'crosshair';
            outputCanvas.addEventListener('click', handleCanvasClick);
        };
        
        img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

// Capture image function
function captureImage() {
    if (!streaming) return;
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const outputCanvas = document.getElementById('outputCanvas');
    const status = document.getElementById('status');
    
    status.textContent = 'Capturing image...';
    
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
    status.textContent = 'Click on reference object (coin) in image';
    document.getElementById('capture').disabled = true;
    document.getElementById('startCamera').disabled = true;
    document.getElementById('uploadImage').disabled = true;
    
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

// Handle canvas click for reference point selection
function handleCanvasClick(event) {
    if (!capturedImage) return;
    
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate actual canvas coordinates (considering scaling)
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
    
    const status = document.getElementById('status');
    status.textContent = 'Processing image...';
    
    if (!openCvReady) {
        status.textContent = 'OpenCV not loaded yet. Please wait...';
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
            
            if (area > maxArea && area > 1000) {
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
                const area = cv.contourArea(contour);
                
                // Reference object should be small and near click point
                if (distance < 150 && aspectRatio > 0.7 && area > 50 && area < 5000 && distance < minDistance) {
                    minDistance = distance;
                    referenceContour = contour;
                    referenceRect = rect;
                }
            }
            
            if (referenceContour && referenceRect) {
                // Calculate reference diameter in pixels
                const referencePixelDiameter = (referenceRect.width + referenceRect.height) / 2;
                
                // Get actual reference diameter in cm
                const refType = document.getElementById('refType').value;
                let referenceDiameterCm;
                
                if (refType === 'custom') {
                    referenceDiameterCm = parseFloat(document.getElementById('refDiameter').value) || 2.5;
                } else {
                    referenceDiameterCm = parseFloat(refType);
                }
                
                // Validate reference diameter
                if (isNaN(referenceDiameterCm) || referenceDiameterCm <= 0) {
                    referenceDiameterCm = 2.5;
                }
                
                // Calculate pixel to cm ratio
                const pixelToCm = referenceDiameterCm / referencePixelDiameter;
                
                // Calculate actual area in cm²
                const actualArea = pixelArea * Math.pow(pixelToCm, 2);
                document.getElementById('actualArea').textContent = actualArea.toFixed(2);
                
                // Display on processed canvas
                displayProcessedImage(src, contours, largestContour, referenceContour);
                
                // Enable calculate button
                document.getElementById('calculateDrape').disabled = false;
                
                status.textContent = 'Analysis complete. Click "Calculate Drape %"';
            } else {
                status.textContent = 'Reference object not found near clicked point';
            }
        } else {
            status.textContent = 'No drape contour found';
        }
        
        // Cleanup
        src.delete();
        gray.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
    } catch (error) {
        console.error('Error processing image:', error);
        status.textContent = 'Error processing image';
    }
}

// Display processed image with contours
function displayProcessedImage(src, contours, drapeContour, refContour) {
    const processedCanvas = document.getElementById('processedCanvas');
    const originalCanvas = document.getElementById('originalCanvas');
    
    // Set canvas size
    processedCanvas.width = capturedImage.width;
    processedCanvas.height = capturedImage.height;
    originalCanvas.width = capturedImage.width;
    originalCanvas.height = capturedImage.height;
    
    // Draw original image on original canvas
    const originalCtx = originalCanvas.getContext('2d');
    originalCtx.putImageData(capturedImage, 0, 0);
    
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
    
    // Display on processed canvas
    cv.imshow(processedCanvas, drawing);
    
    // Cleanup
    drawing.delete();
    drapeContours.delete();
    refContours.delete();
}

// Calculate Drape Percentage (called by button)
function calculateDrapePercentage() {
    const measuredAreaText = document.getElementById('actualArea').textContent;
    const status = document.getElementById('status');
    
    if (measuredAreaText === '--') {
        alert('Please capture and analyze an image first');
        return;
    }
    
    const measuredArea = parseFloat(measuredAreaText);
    
    if (isNaN(measuredArea) || measuredArea <= 0) {
        alert('Invalid area measurement. Please analyze image again.');
        return;
    }
    
    // Get diameters
    const diskDiameter = parseFloat(document.getElementById('diskDiameter').value);
    const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value);
    
    // Validate diameters
    if (isNaN(diskDiameter) || diskDiameter <= 0) {
        alert('Please enter a valid support disk diameter');
        return;
    }
    
    if (isNaN(fabricDiameter) || fabricDiameter <= 0) {
        alert('Please enter a valid fabric diameter');
        return;
    }
    
    if (fabricDiameter <= diskDiameter) {
        alert('Fabric diameter must be larger than support disk diameter');
        return;
    }
    
    // Calculate areas
    const diskArea = Math.PI * Math.pow(diskDiameter / 2, 2);
    const fabricArea = Math.PI * Math.pow(fabricDiameter / 2, 2);
    
    // Calculate drape percentage using standard formula
    // Drape Coefficient (%) = [(A - A_d) / (A_f - A_d)] × 100
    const drapeCoefficient = ((measuredArea - diskArea) / (fabricArea - diskArea)) * 100;
    
    // Validate result
    if (drapeCoefficient < 0 || drapeCoefficient > 100) {
        status.textContent = 'Warning: Drape coefficient out of range (0-100%)';
    } else {
        status.textContent = 'Calculation complete';
    }
    
    // Display result
    document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
    
    // Add to history
    addToHistory(measuredArea, drapeCoefficient);
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
        drapePercent: Math.min(100, Math.max(0, drapePercent)).toFixed(2),
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

// Clear all history
function clearHistory() {
    if (confirm('Are you sure you want to clear all measurement history?')) {
        measurementHistory = [];
        updateHistoryTable();
        saveHistory();
    }
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

// Setup device orientation for level indicator
function setupDeviceOrientation() {
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ devices need permission
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleDeviceOrientation);
                }
            })
            .catch(console.error);
    } else {
        // Android and other devices
        window.addEventListener('deviceorientation', handleDeviceOrientation);
    }
}

// Handle device orientation for level indicator
function handleDeviceOrientation(event) {
    const bubbleCenter = document.querySelector('.bubble-center');
    const levelStatus = document.getElementById('levelStatus');
    
    if (!bubbleCenter || !levelStatus) return;
    
    // Use beta (front-to-back tilt) for angle
    const beta = event.beta || 0; // -180 to 180
    const gamma = event.gamma || 0; // -90 to 90
    
    // Calculate angle from vertical (absolute value)
    const angle = Math.min(Math.abs(beta), Math.abs(gamma));
    
    // Update angle display
    levelStatus.textContent = angle.toFixed(1);
    
    // Calculate bubble position
    const maxTilt = 45;
    const maxMovement = 18;
    
    const normX = Math.max(Math.min(gamma / maxTilt, 1), -1);
    const normY = Math.max(Math.min(beta / maxTilt, 1), -1);
    
    const posX = normX * maxMovement;
    const posY = normY * maxMovement;
    
    bubbleCenter.style.transform = `translate(-50%, -50%) translate(${posX}px, ${posY}px)`;
    
    // Update color based on angle
    if (angle < 2) {
        bubbleCenter.style.background = '#00ff00';
        levelStatus.style.color = '#00ff00';
    } else if (angle < 5) {
        bubbleCenter.style.background = '#ffff00';
        levelStatus.style.color = '#ffff00';
    } else {
        bubbleCenter.style.background = '#ff0000';
        levelStatus.style.color = '#ff0000';
    }
}

// Reset application
function resetApp() {
    const video = document.getElementById('video');
    const outputCanvas = document.getElementById('outputCanvas');
    const processedCanvas = document.getElementById('processedCanvas');
    const originalCanvas = document.getElementById('originalCanvas');
    const status = document.getElementById('status');
    
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
    const ctx3 = originalCanvas.getContext('2d');
    ctx1.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx2.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
    ctx3.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    
    // Reset results
    document.getElementById('pixelArea').textContent = '--';
    document.getElementById('actualArea').textContent = '--';
    document.getElementById('drapeCoefficient').textContent = '--';
    document.getElementById('calculateDrape').disabled = true;
    status.textContent = 'Ready';
    
    // Reset buttons
    document.getElementById('capture').disabled = true;
    document.getElementById('reset').disabled = true;
    document.getElementById('startCamera').disabled = false;
    document.getElementById('uploadImage').disabled = false;
    
    // Clear stored data
    capturedImage = null;
    referencePoint = null;
    streaming = false;
    
    // Remove event listeners from canvas
    outputCanvas.style.cursor = 'default';
    outputCanvas.removeEventListener('click', handleCanvasClick);
    
    // Clear file input
    document.getElementById('fileInput').value = '';
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Drape Area Calculator initialized');
    
    // Set default values
    document.getElementById('diskDiameter').value = '18.0';
    document.getElementById('fabricDiameter').value = '30.0';
    document.getElementById('refDiameter').value = '2.5';
    
    // Check if OpenCV is already loaded
    if (typeof cv !== 'undefined') {
        onOpenCvReady();
    }
});
