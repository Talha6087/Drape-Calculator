You're right! The click precision issue is likely due to incorrect coordinate mapping between the display canvas and the actual canvas. Let me fix this by providing the complete corrected code.

File 1: script.js (COMPLETELY UPDATED - Fixed Click Precision)

```javascript
// Drape Area Calculator - Complete Script with all features

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
let levelInterval = null;
let currentAngle = 0;
let isProcessing = false;
let clickDebounce = null;
let canvasScaleX = 1;
let canvasScaleY = 1;

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
    
    // Window resize handler
    window.addEventListener('resize', updateCanvasScaleFactors);
}

// Setup accelerometer for level detection
function setupAccelerometer() {
    if (!DeviceUtils.hasAccelerometer()) {
        console.log('Accelerometer not available');
        // Fallback for desktop testing
        startDesktopLevelSimulation();
        return;
    }
    
    DeviceUtils.requestAccelerometerPermission().then(granted => {
        if (granted) {
            startLevelMonitoring();
        } else {
            startDesktopLevelSimulation();
        }
    });
}

// Start level monitoring
function startLevelMonitoring() {
    if (levelInterval) clearInterval(levelInterval);
    
    // Try DeviceOrientation API first (more accurate for tilt)
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleDeviceOrientation);
        console.log('Using DeviceOrientation API for level detection');
    } else if (window.DeviceMotionEvent) {
        // Fallback to DeviceMotion API
        window.addEventListener('devicemotion', handleDeviceMotion);
        console.log('Using DeviceMotion API for level detection');
    } else {
        startDesktopLevelSimulation();
    }
}

// Desktop simulation for testing
function startDesktopLevelSimulation() {
    console.log('Using desktop level simulation');
    if (levelInterval) clearInterval(levelInterval);
    
    levelInterval = setInterval(() => {
        if (streaming) {
            // Simulate small random movement for testing
            const simulatedAngle = Math.random() * 5;
            const simulatedBeta = (Math.random() - 0.5) * 10;
            const simulatedGamma = (Math.random() - 0.5) * 10;
            
            UIUtils.updateLevelIndicator(simulatedAngle, simulatedBeta, simulatedGamma);
        }
    }, 1000);
}

// Handle device orientation (more accurate for mobile)
function handleDeviceOrientation(event) {
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;
    
    const angle = Math.sqrt(beta * beta + gamma * gamma);
    currentAngle = angle;
    
    UIUtils.updateLevelIndicator(angle, beta, gamma);
    
    if (streaming && angle > 10) {
        document.getElementById('status').textContent = `Warning: Camera tilted ${angle.toFixed(1)}°. Level your device.`;
    }
}

// Handle device motion (fallback)
function handleDeviceMotion(event) {
    if (!event.accelerationIncludingGravity) return;
    
    const accel = event.accelerationIncludingGravity;
    const x = accel.x || 0;
    const y = accel.y || 0;
    const z = accel.z || 9.81;
    
    const beta = Math.atan2(x, Math.sqrt(y*y + z*z)) * (180 / Math.PI);
    const gamma = Math.atan2(y, Math.sqrt(x*x + z*z)) * (180 / Math.PI);
    
    const angle = Math.sqrt(beta * beta + gamma * gamma);
    currentAngle = angle;
    
    UIUtils.updateLevelIndicator(angle, beta, gamma);
    
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

// Update canvas scale factors for precise click mapping
function updateCanvasScaleFactors() {
    if (!currentCanvas) return;
    
    const rect = currentCanvas.getBoundingClientRect();
    canvasDisplayWidth = rect.width;
    canvasDisplayHeight = rect.height;
    
    // Calculate the actual rendered dimensions (considering object-fit: contain)
    const canvasAspect = canvasActualWidth / canvasActualHeight;
    const displayAspect = canvasDisplayWidth / canvasDisplayHeight;
    
    let renderedWidth, renderedHeight, offsetX = 0, offsetY = 0;
    
    if (displayAspect > canvasAspect) {
        // Canvas is taller than display area
        renderedHeight = canvasDisplayHeight;
        renderedWidth = canvasDisplayHeight * canvasAspect;
        offsetX = (canvasDisplayWidth - renderedWidth) / 2;
    } else {
        // Canvas is wider than display area
        renderedWidth = canvasDisplayWidth;
        renderedHeight = canvasDisplayWidth / canvasAspect;
        offsetY = (canvasDisplayHeight - renderedHeight) / 2;
    }
    
    canvasScaleX = canvasActualWidth / renderedWidth;
    canvasScaleY = canvasActualHeight / renderedHeight;
    
    // Store offset for click calculations
    currentCanvas.dataset.offsetX = offsetX;
    currentCanvas.dataset.offsetY = offsetY;
    currentCanvas.dataset.renderedWidth = renderedWidth;
    currentCanvas.dataset.renderedHeight = renderedHeight;
}

// Start camera function
async function startCamera() {
    if (streaming) return;
    
    const video = document.getElementById('video');
    const statusElement = document.getElementById('status');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        UIUtils.showToast('Camera access not supported in this browser', 'error');
        return;
    }
    
    UIUtils.showLoading(true, 'Accessing camera...');
    
    try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false 
        });
        
        stream = mediaStream;
        video.srcObject = stream;
        
        await video.play();
        
        document.getElementById('startCamera').disabled = true;
        document.getElementById('capture').disabled = false;
        document.getElementById('reset').disabled = false;
        document.getElementById('uploadImage').disabled = false;
        
        statusElement.textContent = 'Camera ready - Level your device above the drape';
        streaming = true;
        
        UIUtils.showToast('Camera started successfully', 'success');
        
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
        UIUtils.showToast('Please select an image file (JPEG, PNG, etc.)', 'error');
        return;
    }
    
    UIUtils.showLoading(true, 'Loading image...');
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = new Image();
        
        img.onload = function() {
            const video = document.getElementById('video');
            const canvas = document.getElementById('canvas');
            const originalCanvas = document.getElementById('originalCanvas');
            
            // Hide video
            video.style.display = 'none';
            
            // Store actual dimensions
            canvasActualWidth = img.width;
            canvasActualHeight = img.height;
            
            // Set canvas to actual image dimensions for processing
            canvas.width = canvasActualWidth;
            canvas.height = canvasActualHeight;
            
            // For display, set to container size
            const container = originalCanvas.parentElement;
            const maxWidth = container.clientWidth - 30; // Account for padding
            const maxHeight = 400;
            
            let displayWidth = canvasActualWidth;
            let displayHeight = canvasActualHeight;
            
            // Maintain aspect ratio
            if (displayWidth > maxWidth || displayHeight > maxHeight) {
                const ratio = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
                displayWidth = Math.floor(displayWidth * ratio);
                displayHeight = Math.floor(displayHeight * ratio);
            }
            
            originalCanvas.width = displayWidth;
            originalCanvas.height = displayHeight;
            
            // Draw to processing canvas (full size)
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Store image data
            capturedImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Draw to display canvas (scaled with high quality)
            const displayCtx = originalCanvas.getContext('2d');
            displayCtx.imageSmoothingEnabled = true;
            displayCtx.imageSmoothingQuality = 'high';
            displayCtx.drawImage(img, 0, 0, displayWidth, displayHeight);
            
            // Make visible
            originalCanvas.style.display = 'block';
            
            // Update UI
            document.getElementById('status').textContent = 'Click on reference object (coin)';
            document.getElementById('capture').disabled = true;
            document.getElementById('startCamera').disabled = true;
            document.getElementById('uploadImage').disabled = false;
            document.getElementById('reset').disabled = false;
            
            // Setup for clicking
            currentCanvas = originalCanvas;
            canvasDisplayWidth = originalCanvas.offsetWidth;
            canvasDisplayHeight = originalCanvas.offsetHeight;
            
            // Calculate scale factors
            updateCanvasScaleFactors();
            
            // Enable clicking
            originalCanvas.style.cursor = 'crosshair';
            originalCanvas.addEventListener('click', handleCanvasClick);
            
            referencePoint = null;
            
            UIUtils.showToast('Image loaded. Click precisely on the coin.', 'success');
        };
        
        img.onerror = function() {
            UIUtils.showToast('Error loading image', 'error');
            UIUtils.showLoading(false);
        };
        
        img.src = e.target.result;
    };
    
    reader.onerror = function() {
        UIUtils.showToast('Error reading file', 'error');
        UIUtils.showLoading(false);
    };
    
    reader.readAsDataURL(file);
}

// Capture image function
function captureImage() {
    if (!streaming) {
        UIUtils.showToast('Camera not ready. Please start camera first.', 'error');
        return;
    }
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const originalCanvas = document.getElementById('originalCanvas');
    
    // Get video dimensions
    canvasActualWidth = video.videoWidth;
    canvasActualHeight = video.videoHeight;
    
    // Set canvas to actual video dimensions for processing
    canvas.width = canvasActualWidth;
    canvas.height = canvasActualHeight;
    
    // Draw current video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Store the image data
    capturedImage = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Calculate display dimensions
    const container = originalCanvas.parentElement;
    const maxWidth = container.clientWidth - 30;
    const maxHeight = 400;
    
    let displayWidth = canvasActualWidth;
    let displayHeight = canvasActualHeight;
    
    // Maintain aspect ratio
    if (displayWidth > maxWidth || displayHeight > maxHeight) {
        const ratio = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
        displayWidth = Math.floor(displayWidth * ratio);
        displayHeight = Math.floor(displayHeight * ratio);
    }
    
    originalCanvas.width = displayWidth;
    originalCanvas.height = displayHeight;
    
    // Display the captured image on original canvas
    const originalCtx = originalCanvas.getContext('2d');
    originalCtx.imageSmoothingEnabled = true;
    originalCtx.imageSmoothingQuality = 'high';
    originalCtx.drawImage(video, 0, 0, displayWidth, displayHeight);
    
    // Show canvas, hide video
    video.style.display = 'none';
    originalCanvas.style.display = 'block';
    
    // Update UI
    document.getElementById('status').textContent = 'Click precisely on reference object (coin)';
    document.getElementById('capture').disabled = true;
    document.getElementById('startCamera').disabled = true;
    document.getElementById('uploadImage').disabled = false;
    
    // Setup for clicking
    currentCanvas = originalCanvas;
    canvasDisplayWidth = originalCanvas.offsetWidth;
    canvasDisplayHeight = originalCanvas.offsetHeight;
    
    // Calculate scale factors
    updateCanvasScaleFactors();
    
    // Enable canvas clicking for reference selection
    originalCanvas.style.cursor = 'crosshair';
    originalCanvas.addEventListener('click', handleCanvasClick);
    
    referencePoint = null;
    
    UIUtils.showToast('Image captured. Click precisely on the coin.', 'info');
}

// FIXED: Handle canvas click with precise coordinate mapping
function handleCanvasClick(event) {
    if (clickDebounce || !capturedImage) return;
    
    clickDebounce = setTimeout(() => {
        const canvas = event.target;
        const rect = canvas.getBoundingClientRect();
        
        // Get the rendered area dimensions and offset
        const offsetX = parseFloat(canvas.dataset.offsetX) || 0;
        const offsetY = parseFloat(canvas.dataset.offsetY) || 0;
        const renderedWidth = parseFloat(canvas.dataset.renderedWidth) || canvasDisplayWidth;
        const renderedHeight = parseFloat(canvas.dataset.renderedHeight) || canvasDisplayHeight;
        
        // Calculate click position within the rendered image area
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Check if click is within the rendered image (not in the padding area)
        if (clickX < offsetX || clickX > offsetX + renderedWidth ||
            clickY < offsetY || clickY > offsetY + renderedHeight) {
            UIUtils.showToast('Please click on the image area, not the padding', 'warning');
            clickDebounce = null;
            return;
        }
        
        // Calculate position within the rendered image (0 to renderedWidth/Height)
        const renderedX = clickX - offsetX;
        const renderedY = clickY - offsetY;
        
        // Calculate actual canvas coordinates using scale factors
        const actualX = Math.round(renderedX * canvasScaleX);
        const actualY = Math.round(renderedY * canvasScaleY);
        
        // Clamp to canvas bounds
        const clampedX = Math.max(0, Math.min(actualX, canvasActualWidth - 1));
        const clampedY = Math.max(0, Math.min(actualY, canvasActualHeight - 1));
        
        // Store reference point with both display and actual coordinates
        referencePoint = { 
            x: clampedX, 
            y: clampedY,
            displayX: clickX,
            displayY: clickY,
            renderedX: renderedX,
            renderedY: renderedY
        };
        
        console.log('Click coordinates:', {
            click: {x: clickX, y: clickY},
            rendered: {x: renderedX, y: renderedY},
            actual: {x: clampedX, y: clampedY},
            scale: {x: canvasScaleX, y: canvasScaleY},
            offset: {x: offsetX, y: offsetY}
        });
        
        // Draw a marker at the clicked point on display canvas
        const ctx = canvas.getContext('2d');
        
        // Clear previous markers
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Redraw the image
        if (capturedImage) {
            ctx.putImageData(capturedImage, 0, 0);
        }
        
        // Draw precision marker (crosshair with circle)
        ctx.save();
        
        // Outer circle
        ctx.beginPath();
        ctx.arc(referencePoint.displayX, referencePoint.displayY, 15, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(referencePoint.displayX, referencePoint.displayY, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Crosshair lines
        ctx.beginPath();
        // Horizontal line
        ctx.moveTo(referencePoint.displayX - 25, referencePoint.displayY);
        ctx.lineTo(referencePoint.displayX + 25, referencePoint.displayY);
        // Vertical line
        ctx.moveTo(referencePoint.displayX, referencePoint.displayY - 25);
        ctx.lineTo(referencePoint.displayX, referencePoint.displayY + 25);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Add text label
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Reference Point', referencePoint.displayX, referencePoint.displayY - 30);
        
        ctx.restore();
        
        // Remove click listener
        canvas.style.cursor = 'default';
        canvas.removeEventListener('click', handleCanvasClick);
        
        // Process the image with the reference point
        setTimeout(() => {
            processImageWithReference();
        }, 500);
        
        clickDebounce = null;
    }, 50);
}

// Auto-detect reference object
function autoDetectReference() {
    if (!capturedImage || isProcessing) return;
    
    UIUtils.showLoading(true, 'Auto-detecting reference...');
    
    setTimeout(() => {
        try {
            if (typeof cv === 'undefined') {
                throw new Error('OpenCV not loaded');
            }
            
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
            
            // Look for circular contours
            let bestContour = null;
            let bestScore = 0;
            const centerX = src.cols / 2;
            const centerY = src.rows / 2;
            
            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                
                // Filter by size (coin-sized objects)
                if (area < 100 || area > 10000) continue;
                
                const rect = cv.boundingRect(contour);
                const contourCenterX = rect.x + rect.width / 2;
                const contourCenterY = rect.y + rect.height / 2;
                
                // Distance from center
                const distance = Math.sqrt(
                    Math.pow(contourCenterX - centerX, 2) + 
                    Math.pow(contourCenterY - centerY, 2)
                );
                
                // Circularity
                const perimeter = cv.arcLength(contour, true);
                const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
                
                // Aspect ratio
                const aspectRatio = Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
                
                // Score based on multiple factors
                const score = circularity * aspectRatio * (1 - Math.min(distance / 500, 1));
                
                if (score > bestScore && circularity > 0.5 && aspectRatio > 0.7) {
                    bestScore = score;
                    bestContour = contour;
                }
            }
            
            if (bestContour && bestScore > 0.3) {
                const rect = cv.boundingRect(bestContour);
                const referenceX = rect.x + rect.width / 2;
                const referenceY = rect.y + rect.height / 2;
                
                // Convert to display coordinates
                const displayX = (referenceX / canvasScaleX) + (parseFloat(currentCanvas.dataset.offsetX) || 0);
                const displayY = (referenceY / canvasScaleY) + (parseFloat(currentCanvas.dataset.offsetY) || 0);
                
                referencePoint = {
                    x: referenceX,
                    y: referenceY,
                    displayX: displayX,
                    displayY: displayY,
                    renderedX: referenceX / canvasScaleX,
                    renderedY: referenceY / canvasScaleY
                };
                
                // Draw marker on canvas
                const canvas = document.getElementById('originalCanvas');
                const ctx = canvas.getContext('2d');
                
                // Draw precision marker
                ctx.beginPath();
                ctx.arc(referencePoint.displayX, referencePoint.displayY, 12, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Add crosshair
                ctx.beginPath();
                ctx.moveTo(referencePoint.displayX - 20, referencePoint.displayY);
                ctx.lineTo(referencePoint.displayX + 20, referencePoint.displayY);
                ctx.moveTo(referencePoint.displayX, referencePoint.displayY - 20);
                ctx.lineTo(referencePoint.displayX, referencePoint.displayY + 20);
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                // Add text
                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Auto-detected', referencePoint.displayX, referencePoint.displayY - 25);
                
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
    }, 500);
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
        
        const src = cv.matFromImageData(capturedImage);
        
        // Validate image
        const validation = Validation.validateImage(src);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Process image
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
        
        // Find largest contour (drape area)
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
        
        if (!largestContour) {
            throw new Error('No drape contour found');
        }
        
        // Calculate pixel area
        const pixelArea = maxArea;
        document.getElementById('pixelArea').textContent = pixelArea.toFixed(0);
        
        // Find reference object (search in a larger area around click point)
        let referenceContour = null;
        let referenceRect = null;
        let minDistance = Infinity;
        const searchRadius = 300; // Increased search radius
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const rect = cv.boundingRect(contour);
            
            const contourCenterX = rect.x + rect.width / 2;
            const contourCenterY = rect.y + rect.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(contourCenterX - referencePoint.x, 2) + 
                Math.pow(contourCenterY - referencePoint.y, 2)
            );
            
            // Calculate circularity
            const area = cv.contourArea(contour);
            const perimeter = cv.arcLength(contour, true);
            const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
            
            // Aspect ratio
            const aspectRatio = Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
            
            // Look for coin-sized, circular objects
            if (distance < searchRadius && 
                aspectRatio > 0.6 && 
                circularity > 0.4 && 
                area > 50 && 
                area < 20000 && 
                distance < minDistance) {
                
                minDistance = distance;
                referenceContour = contour;
                referenceRect = rect;
            }
        }
        
        if (!referenceContour || !referenceRect) {
            throw new Error(`Reference object not found within ${searchRadius}px of click point`);
        }
        
        // Calculate reference diameter in pixels
        const referencePixelDiameter = (referenceRect.width + referenceRect.height) / 2;
        
        // Get actual reference diameter in cm
        let referenceDiameterCm;
        const refType = document.getElementById('refType').value;
        
        if (refType === 'coin2') {
            referenceDiameterCm = 2.5; // Indian 2 Rupee Coin
        } else if (refType === 'coin10') {
            referenceDiameterCm = 2.7; // Indian 10 Rupee Coin
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
            addToHistory(actualArea, drapeCoefficient);
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
    
    // Set canvas size to match original display canvas
    const originalCanvas = document.getElementById('originalCanvas');
    processedCanvas.width = originalCanvas.width;
    processedCanvas.height = originalCanvas.height;
    
    // Make sure processed canvas is visible
    processedCanvas.style.display = 'block';
    
    // Create a copy of source for drawing
    const drawing = src.clone();
    
    // Convert to BGR for OpenCV drawing
    cv.cvtColor(drawing, drawing, cv.COLOR_RGBA2BGR);
    
    // Scale for display
    const scaleX = processedCanvas.width / src.cols;
    const scaleY = processedCanvas.height / src.rows;
    
    const resized = new cv.Mat();
    cv.resize(drawing, resized, new cv.Size(processedCanvas.width, processedCanvas.height));
    
    // Draw reference point
    const displayRefX = referencePoint.x * scaleX;
    const displayRefY = referencePoint.y * scaleY;
    cv.circle(resized, new cv.Point(displayRefX, displayRefY), 10, [0, 0, 255, 255], 3);
    
    // Display on canvas
    cv.imshow(processedCanvas, resized);
    
    // Cleanup
    drawing.delete();
    resized.delete();
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
    
    // Calculate drape percentage
    const drapePercentage = DrapeFormulas.drapeCoefficient(measuredArea, diskDiameter, fabricDiameter);
    
    return drapePercentage;
}

// Auto calculate drape
function autoCalculateDrape() {
    if (!capturedImage) {
        UIUtils.showToast('Please capture or upload an image first', 'error');
        return;
    }
    
    if (!referencePoint && document.getElementById('autoDetectReference').checked) {
        autoDetectReference();
    } else if (!referencePoint) {
        UIUtils.showToast('Please select reference point first', 'warning');
        return;
    } else {
        processImageWithReference();
    }
}

// Calculate Drape Percentage
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
    
    if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleDeviceOrientation);
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
    
    // Reset canvas dimensions
    originalCanvas.width = 0;
    originalCanvas.height = 0;
    processedCanvas.width = 0;
    processedCanvas.height = 0;
    
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
    canvasScaleX = 1;
    canvasScaleY = 1;
    
    // Remove event listeners from canvas
    originalCanvas.style.cursor = 'default';
    originalCanvas.removeEventListener('click', handleCanvasClick);
    
    // Reset level indicator
    UIUtils.resetLevelIndicator();
    currentAngle = 0;
    
    UIUtils.showToast('Application reset', 'info');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Drape Area Calculator initialized');
    
    if (DeviceUtils.isMobile()) {
        console.log('Running on mobile device');
    }
    
    setTimeout(() => {
        if (!capturedImage) {
            UIUtils.showToast('Tip: Use a coin as reference for accurate measurements', 'info', 5000);
        }
    }, 3000);
});