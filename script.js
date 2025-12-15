// Drape Area Calculator - Complete Script with all features
// Features: Camera leveler, image upload, auto-highlight, batch processing

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
let batchMode = false;
let batchMeasurements = [];
let levelInterval = null;
let currentAngle = 0;
let isProcessing = false;
let clickDebounce = null;

// OpenCV ready handler
function onOpenCvReady() {
    console.log('OpenCV.js is ready');
    initializeEventListeners();
    loadHistory();
    setupAccelerometer();
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
        const customRef = document.getElementById('customRef');
        if (this.value === 'custom') {
            customRef.style.display = 'block';
        } else {
            customRef.style.display = 'none';
        }
    });
    
    // Calculate Drape % button
    document.getElementById('calculateDrape').addEventListener('click', calculateDrapePercentage);
    
    // Auto Calculate button
    document.getElementById('autoCalculate').addEventListener('click', autoCalculateDrape);
    
    // Export CSV button
    document.getElementById('exportData').addEventListener('click', exportToCSV);
    
    // Clear History button
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
    
    // Start Batch Mode button
    document.getElementById('startBatch').addEventListener('click', startBatchMode);
    
    // End Batch Mode button
    document.getElementById('endBatch').addEventListener('click', endBatchMode);
    
    // Auto-highlight checkbox
    document.getElementById('autoHighlight').addEventListener('change', function() {
        if (capturedImage && referencePoint) {
            processImageWithReference();
        }
    });
    
    // Auto-detect reference checkbox
    document.getElementById('autoDetectReference').addEventListener('change', function() {
        if (this.checked && capturedImage) {
            autoDetectReference();
        }
    });
    
    // Disk diameter validation
    document.getElementById('diskDiameter').addEventListener('change', validateDiameters);
    document.getElementById('fabricDiameter').addEventListener('change', validateDiameters);
}

// Setup accelerometer for level detection
function setupAccelerometer() {
    if (!DeviceUtils.hasAccelerometer()) {
        console.log('Accelerometer not available');
        return;
    }
    
    DeviceUtils.requestAccelerometerPermission().then(granted => {
        if (granted) {
            startLevelMonitoring();
        }
    });
}

// Start level monitoring
function startLevelMonitoring() {
    if (levelInterval) clearInterval(levelInterval);
    
    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', handleDeviceMotion);
    } else {
        // Fallback: simulate level for desktop
        levelInterval = setInterval(() => {
            if (streaming) {
                // Simulate small random movement for testing
                const simulatedAngle = Math.random() * 5;
                UIUtils.updateLevelIndicator(simulatedAngle);
            }
        }, 500);
    }
}

// Handle device motion for level detection
function handleDeviceMotion(event) {
    if (!event.accelerationIncludingGravity) return;
    
    const acceleration = event.accelerationIncludingGravity;
    const angle = ImageUtils.calculateAngleFromAcceleration(acceleration);
    currentAngle = angle;
    
    UIUtils.updateLevelIndicator(angle);
    
    // Show warning if angle is too large
    if (streaming && angle > 10) {
        document.getElementById('status').textContent = `Warning: Camera tilted ${angle.toFixed(1)}°. Level your device.`;
    }
}

// Validate diameters
function validateDiameters() {
    const diskDiameter = parseFloat(document.getElementById('diskDiameter').value);
    const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value);
    
    const validation = Validation.validateDrapeInputs(diskDiameter, fabricDiameter);
    if (!validation.valid) {
        UIUtils.showToast(validation.error, 'warning');
    }
}

// Start camera function
async function startCamera() {
    if (streaming) return;
    
    const video = document.getElementById('video');
    const statusElement = document.getElementById('status');
    
    // Check camera permissions and capabilities
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        UIUtils.showToast('Camera access not supported in this browser', 'error');
        return;
    }
    
    UIUtils.showLoading(true, 'Accessing camera...');
    
    try {
        // Request camera access
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment', // Use back camera on mobile
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false 
        });
        
        stream = mediaStream;
        video.srcObject = stream;
        
        // Wait for video to start playing
        await video.play();
        
        // Update UI
        UIUtils.updateButtonState('startCamera', false, '<i class="fas fa-camera"></i> Camera Active');
        UIUtils.updateButtonState('capture', true);
        UIUtils.updateButtonState('reset', true);
        UIUtils.updateButtonState('uploadImage', false);
        
        statusElement.textContent = 'Camera ready - Level your device above the drape';
        streaming = true;
        
        // Start level monitoring
        startLevelMonitoring();
        
        UIUtils.showToast('Camera started successfully. Ensure device is level.', 'success');
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        let errorMessage = 'Unable to access camera. ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please grant camera permissions.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No camera found.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += 'Camera is already in use.';
        } else {
            errorMessage += error.message;
        }
        
        statusElement.textContent = errorMessage;
        UIUtils.showToast(errorMessage, 'error');
    } finally {
        UIUtils.showLoading(false);
    }
}

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        UIUtils.showToast('Please select an image file', 'error');
        return;
    }
    
    UIUtils.showLoading(true, 'Loading image...');
    
    FileUtils.loadImage(file)
        .then(img => {
            const canvas = document.getElementById('canvas');
            const outputCanvas = document.getElementById('originalCanvas');
            
            // Set canvas dimensions to image dimensions
            canvas.width = img.width;
            canvas.height = img.height;
            outputCanvas.width = img.width;
            outputCanvas.height = img.height;
            
            // Draw image to canvas
            const context = canvas.getContext('2d');
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Store the image data
            capturedImage = context.getImageData(0, 0, canvas.width, canvas.height);
            
            // Display the image on output canvas
            const outputContext = outputCanvas.getContext('2d');
            outputContext.drawImage(img, 0, 0, outputCanvas.width, outputCanvas.height);
            
            // Update UI
            document.getElementById('status').textContent = 'Image loaded. Click on reference object (coin) in image';
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
            
            // Auto-detect reference if enabled
            if (document.getElementById('autoDetectReference').checked) {
                setTimeout(autoDetectReference, 500);
            }
            
            UIUtils.showToast('Image loaded successfully', 'success');
        })
        .catch(error => {
            console.error('Error loading image:', error);
            UIUtils.showToast('Error loading image: ' + error.message, 'error');
            document.getElementById('status').textContent = 'Error loading image';
        })
        .finally(() => {
            UIUtils.showLoading(false);
            // Reset file input
            event.target.value = '';
        });
}

// Capture image function
function captureImage() {
    if (!streaming) {
        UIUtils.showToast('Camera not ready. Please start camera first.', 'error');
        return;
    }
    
    if (currentAngle > 15) {
        if (!confirm(`Camera is tilted ${currentAngle.toFixed(1)}°. Continue anyway?`)) {
            return;
        }
    }
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const outputCanvas = document.getElementById('originalCanvas');
    
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
    
    // Auto-detect reference if enabled
    if (document.getElementById('autoDetectReference').checked) {
        setTimeout(autoDetectReference, 500);
    }
    
    UIUtils.showToast('Image captured. Click on reference object.', 'info');
}

// Handle canvas click for reference point selection
function handleCanvasClick(event) {
    if (clickDebounce) return;
    if (!capturedImage) return;
    
    clickDebounce = setTimeout(() => {
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
        
        clickDebounce = null;
    }, 100);
}

// Auto-detect reference object
function autoDetectReference() {
    if (!capturedImage || isProcessing) return;
    
    UIUtils.showLoading(true, 'Auto-detecting reference...');
    
    try {
        if (typeof cv === 'undefined') {
            throw new Error('OpenCV not loaded');
        }
        
        // Convert to grayscale
        const src = cv.matFromImageData(capturedImage);
        const gray = new cv.Mat();
        const blurred = new cv.Mat();
        const edges = new cv.Mat();
        
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        cv.Canny(blurred, edges, 50, 150);
        
        // Find contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // Look for circular contours near center
        const centerX = src.cols / 2;
        const centerY = src.rows / 2;
        let bestContour = null;
        let bestScore = 0;
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            // Filter by size (look for coin-sized objects)
            if (area < 100 || area > 10000) continue;
            
            // Get bounding rect
            const rect = cv.boundingRect(contour);
            const contourCenterX = rect.x + rect.width / 2;
            const contourCenterY = rect.y + rect.height / 2;
            
            // Check if near center (within 1/3 of image)
            const distanceToCenter = Math.sqrt(
                Math.pow(contourCenterX - centerX, 2) + 
                Math.pow(contourCenterY - centerY, 2)
            );
            
            const maxDistance = Math.min(src.cols, src.rows) / 3;
            if (distanceToCenter > maxDistance) continue;
            
            // Check circularity
            const perimeter = cv.arcLength(contour, true);
            const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
            
            // Score based on circularity and distance to center
            const score = circularity * (1 - (distanceToCenter / maxDistance));
            
            if (score > bestScore) {
                bestScore = score;
                bestContour = contour;
            }
        }
        
        if (bestContour && bestScore > 0.3) {
            const rect = cv.boundingRect(bestContour);
            const referenceX = rect.x + rect.width / 2;
            const referenceY = rect.y + rect.height / 2;
            
            // Scale to display coordinates
            const scaleX = canvasDisplayWidth / canvasActualWidth;
            const scaleY = canvasDisplayHeight / canvasActualHeight;
            
            referencePoint = {
                x: referenceX,
                y: referenceY,
                displayX: referenceX * scaleX,
                displayY: referenceY * scaleY
            };
            
            // Draw marker on canvas
            const canvas = document.getElementById('originalCanvas');
            const ctx = canvas.getContext('2d');
            
            ctx.beginPath();
            ctx.arc(referencePoint.displayX, referencePoint.displayY, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Add text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.fillText('Auto-detected', referencePoint.displayX - 40, referencePoint.displayY - 15);
            
            canvas.style.cursor = 'default';
            canvas.removeEventListener('click', handleCanvasClick);
            
            UIUtils.showToast('Reference auto-detected successfully', 'success');
            
            // Process image
            setTimeout(() => processImageWithReference(), 500);
        } else {
            UIUtils.showToast('Could not auto-detect reference. Please click manually.', 'warning');
        }
        
        // Cleanup
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
        
    } catch (error) {
        console.error('Auto-detect error:', error);
        UIUtils.showToast('Auto-detect failed: ' + error.message, 'error');
    } finally {
        UIUtils.showLoading(false);
    }
}

// Process image with reference point
async function processImageWithReference() {
    if (!capturedImage || !referencePoint || isProcessing) return;
    
    isProcessing = true;
    UIUtils.showLoading(true, 'Processing image...');
    document.getElementById('status').textContent = 'Processing image...';
    
    try {
        if (typeof cv === 'undefined') {
            throw new Error('OpenCV not loaded yet');
        }
        
        // Convert to OpenCV mat
        const src = cv.matFromImageData(capturedImage);
        
        // Validate image
        const validation = Validation.validateImage(src);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Process image in steps
        const gray = new cv.Mat();
        const blurred = new cv.Mat();
        const edges = new cv.Mat();
        
        // Convert to grayscale and blur
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        
        // Detect edges
        cv.Canny(blurred, edges, 50, 150);
        
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
            
            // Ignore very small contours
            if (area > maxArea && area > 1000) {
                maxArea = area;
                largestContour = contour;
            }
        }
        
        if (!largestContour) {
            throw new Error('No drape contour found');
        }
        
        // Calculate pixel area
        const pixelArea = maxArea;
        document.getElementById('pixelArea').textContent = pixelArea.toFixed(0);
        
        // Find reference object near the clicked point
        let referenceContour = null;
        let referenceRect = null;
        let minDistance = Infinity;
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const rect = cv.boundingRect(contour);
            
            // Check if contour is near reference point
            const contourCenterX = rect.x + rect.width / 2;
            const contourCenterY = rect.y + rect.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(contourCenterX - referencePoint.x, 2) + 
                Math.pow(contourCenterY - referencePoint.y, 2)
            );
            
            // Check if contour is roughly circular
            const aspectRatio = Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
            const area = cv.contourArea(contour);
            const perimeter = cv.arcLength(contour, true);
            const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
            
            // Look for coin-sized, circular objects near click point
            if (distance < 200 && aspectRatio > 0.7 && circularity > 0.5 && 
                area > 100 && area < 10000 && distance < minDistance) {
                minDistance = distance;
                referenceContour = contour;
                referenceRect = rect;
            }
        }
        
        if (!referenceContour || !referenceRect) {
            throw new Error('Reference object not found near clicked point');
        }
        
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
            
            // Add to history if not in batch mode
            if (!batchMode) {
                addToHistory(actualArea, drapeCoefficient);
            } else {
                // Add to batch measurements
                batchMeasurements.push({
                    area: actualArea,
                    drapeCoefficient: drapeCoefficient,
                    timestamp: new Date()
                });
                updateBatchInfo();
            }
        }
        
        document.getElementById('status').textContent = 'Analysis complete';
        UIUtils.showToast('Analysis completed successfully', 'success');
        
        // Cleanup
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
        
    } catch (error) {
        console.error('Error processing image:', error);
        document.getElementById('status').textContent = 'Error: ' + error.message;
        UIUtils.showToast('Processing error: ' + error.message, 'error');
    } finally {
        UIUtils.showLoading(false);
        isProcessing = false;
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
    
    // Convert to BGR for OpenCV drawing
    cv.cvtColor(drawing, drawing, cv.COLOR_RGBA2BGR);
    
    // Draw all contours in light green
    cv.drawContours(drawing, contours, -1, [0, 200, 0, 255], 1);
    
    // Draw drape contour in blue
    const drapeContours = new cv.MatVector();
    drapeContours.push_back(drapeContour);
    cv.drawContours(drawing, drapeContours, 0, [255, 0, 0, 255], 3);
    
    // Draw reference contour in yellow
    const refContours = new cv.MatVector();
    refContours.push_back(refContour);
    cv.drawContours(drawing, refContours, 0, [0, 255, 255, 255], 2);
    
    // Draw reference point
    cv.circle(drawing, new cv.Point(referencePoint.x, referencePoint.y), 10, [0, 0, 255, 255], 3);
    
    // Highlight drape area if auto-highlight is enabled
    if (document.getElementById('autoHighlight').checked) {
        // Create a mask for the drape area
        const mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);
        cv.drawContours(mask, drapeContours, 0, [255, 255, 255, 255], -1);
        
        // Apply highlight color
        const highlight = new cv.Mat(src.rows, src.cols, src.type(), [0, 0, 255, 100]);
        cv.addWeighted(drawing, 1, highlight, 0.3, 0, drawing);
        
        mask.delete();
        highlight.delete();
    }
    
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
    
    // Validate inputs
    const validation = Validation.validateDrapeInputs(diskDiameter, fabricDiameter);
    if (!validation.valid) {
        UIUtils.showToast(validation.error, 'error');
        return null;
    }
    
    // Calculate areas
    const diskArea = DrapeFormulas.circleArea(diskDiameter);
    const fabricArea = DrapeFormulas.circleArea(fabricDiameter);
    
    // Calculate drape percentage using standard formula
    const drapePercentage = DrapeFormulas.drapeCoefficient(measuredArea, diskDiameter, fabricDiameter);
    
    return drapePercentage;
}

// Auto calculate drape (automatic process)
function autoCalculateDrape() {
    if (!capturedImage) {
        UIUtils.showToast('Please capture or upload an image first', 'error');
        return;
    }
    
    // Auto-detect reference if not already done
    if (!referencePoint && document.getElementById('autoDetectReference').checked) {
        autoDetectReference();
    } else if (!referencePoint) {
        UIUtils.showToast('Please select reference point first', 'warning');
        return;
    }
    
    // Process image
    processImageWithReference();
}

// Calculate Drape Percentage (called by button)
function calculateDrapePercentage() {
    const measuredAreaText = document.getElementById('actualArea').textContent;
    
    if (measuredAreaText === '--') {
        UIUtils.showToast('Please capture and analyze an image first', 'error');
        return;
    }
    
    const measuredArea = parseFloat(measuredAreaText);
    
    if (isNaN(measuredArea)) {
        UIUtils.showToast('Please capture and analyze an image first', 'error');
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
    
    const fabricStatus = DrapeFormulas.fabricProperties(drapePercent);
    
    const measurement = {
        id: Date.now(),
        date: dateString,
        time: timeString,
        area: area.toFixed(2),
        drapePercent: drapePercent.toFixed(2),
        status: fabricStatus,
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
            <td>${measurement.drapePercent}%<br><small>${measurement.status}</small></td>
            <td>
                <button class="btn-small" onclick="deleteMeasurement(${measurement.id})" title="Delete">
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
    UIUtils.showToast('Measurement deleted', 'success');
}

// Clear all history
function clearHistory() {
    if (measurementHistory.length === 0) {
        UIUtils.showToast('No measurements to clear', 'info');
        return;
    }
    
    if (confirm('Are you sure you want to clear all measurement history?')) {
        measurementHistory = [];
        updateHistoryTable();
        saveHistory();
        UIUtils.showToast('History cleared', 'success');
    }
}

// Save history to localStorage
function saveHistory() {
    try {
        localStorage.setItem('drapeMeasurements', JSON.stringify(measurementHistory));
    } catch (e) {
        console.error('Error saving history:', e);
        UIUtils.showToast('Error saving history to storage', 'error');
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
        UIUtils.showToast('No measurements to export', 'warning');
        return;
    }
    
    FileUtils.saveCSV(measurementHistory);
    UIUtils.showToast('Data exported successfully', 'success');
}

// Start batch mode
function startBatchMode() {
    batchMode = true;
    batchMeasurements = [];
    
    // Show batch section
    document.querySelector('.batch-mode').style.display = 'block';
    document.querySelector('.batch-mode').classList.add('active');
    
    // Update buttons
    document.getElementById('startBatch').disabled = true;
    document.getElementById('endBatch').disabled = false;
    
    UIUtils.showToast('Batch mode started. Capture multiple measurements.', 'info');
    updateBatchInfo();
}

// End batch mode
function endBatchMode() {
    if (batchMeasurements.length === 0) {
        UIUtils.showToast('No batch measurements recorded', 'warning');
    } else {
        // Add all batch measurements to history
        batchMeasurements.forEach(measurement => {
            addToHistory(measurement.area, measurement.drapeCoefficient);
        });
        
        UIUtils.showToast(`${batchMeasurements.length} measurements added to history`, 'success');
    }
    
    batchMode = false;
    batchMeasurements = [];
    
    // Hide batch section
    document.querySelector('.batch-mode').style.display = 'none';
    document.querySelector('.batch-mode').classList.remove('active');
    
    // Update buttons
    document.getElementById('startBatch').disabled = false;
    document.getElementById('endBatch').disabled = true;
    
    updateBatchInfo();
}

// Update batch info display
function updateBatchInfo() {
    const batchInfo = document.getElementById('batchInfo');
    
    if (batchMeasurements.length === 0) {
        batchInfo.innerHTML = '<p>No batch measurements yet. Capture images to add measurements.</p>';
    } else {
        batchInfo.innerHTML = `
            <p><strong>Batch Measurements:</strong> ${batchMeasurements.length} recorded</p>
            <p><strong>Average Drape:</strong> ${calculateAverageDrape().toFixed(2)}%</p>
            <p><strong>Last Measurement:</strong> ${batchMeasurements[batchMeasurements.length - 1].area.toFixed(2)} cm²</p>
        `;
    }
}

// Calculate average drape from batch
function calculateAverageDrape() {
    if (batchMeasurements.length === 0) return 0;
    
    const total = batchMeasurements.reduce((sum, m) => sum + m.drapeCoefficient, 0);
    return total / batchMeasurements.length;
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
    
    // Stop level monitoring
    if (levelInterval) {
        clearInterval(levelInterval);
        levelInterval = null;
    }
    
    if (window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleDeviceMotion);
    }
    
    // Reset displays
    video.style.display = 'block';
    originalCanvas.style.display = 'none';
    
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
    
    // Reset buttons
    document.getElementById('capture').disabled = true;
    document.getElementById('reset').disabled = true;
    document.getElementById('startCamera').disabled = false;
    document.getElementById('uploadImage').disabled = false;
    
    // Clear stored data
    capturedImage = null;
    referencePoint = null;
    streaming = false;
    isProcessing = false;
    
    // Remove event listeners from canvas
    originalCanvas.style.cursor = 'default';
    originalCanvas.removeEventListener('click', handleCanvasClick);
    
    // Reset level indicator
    UIUtils.updateLevelIndicator(0);
    
    UIUtils.showToast('Application reset', 'info');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Drape Area Calculator initialized with all features');
    
    // Check if on mobile
    if (DeviceUtils.isMobile()) {
        console.log('Running on mobile device');
    }
    
    // Add some helpful tips
    setTimeout(() => {
        if (!capturedImage) {
            UIUtils.showToast('Tip: Use a coin as reference for accurate measurements', 'info', 5000);
        }
    }, 3000);
});
