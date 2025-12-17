// Main Application State
const AppState = {
    video: null,
    mainCanvas: null,
    mainCtx: null,
    outputCanvas: null,
    outputCtx: null,
    processedCanvas: null,
    processedCtx: null,
    isCameraActive: false,
    capturedImage: null,
    originalImage: null,
    isProcessing: false,
    scaleFactor: null,
    
    // Reference selection
    referenceCircle: null,
    referenceDiameterPixels: 0,
    
    // Cropping state
    isCropping: false,
    cropCircle: null,
    cropCenter: { x: 0, y: 0 },
    cropDiameterPixels: 0,
    
    // Zoom state
    zoomLevel: 1.0,
    panOffset: { x: 0, y: 0 },
    
    // Image display info
    imageDisplayInfo: {
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        imgWidth: 0,
        imgHeight: 0,
        canvasWidth: 0,
        canvasHeight: 0
    },
    
    // Measurement data
    pixelArea: 0,
    drapeArea: 0,
    measurements: [],
    
    // Settings
    referenceDiameter: 2.5,
    diskDiameter: 18.0,
    fabricDiameter: 30.0
};

// OpenCV Ready Handler
function onOpenCvReady() {
    console.log('OpenCV loaded, version:', cv.getBuildInformation());
    updateStatus('OpenCV loaded successfully');
    
    // Initialize elements
    AppState.video = document.getElementById('video');
    AppState.mainCanvas = document.getElementById('mainCanvas');
    AppState.mainCtx = AppState.mainCanvas.getContext('2d');
    AppState.outputCanvas = document.getElementById('outputCanvas');
    AppState.outputCtx = AppState.outputCanvas.getContext('2d');
    AppState.processedCanvas = document.getElementById('processedCanvas');
    AppState.processedCtx = AppState.processedCanvas.getContext('2d');
    
    // Set canvas dimensions
    setCanvasSizes();
    
    // Initialize event listeners
    initializeEventListeners();
    
    updateStatus('Ready - Use camera or upload image');
}

// Set canvas sizes
function setCanvasSizes() {
    const mainContainer = document.querySelector('.image-wrapper');
    const width = mainContainer.clientWidth;
    const height = mainContainer.clientHeight;
    
    AppState.mainCanvas.width = width;
    AppState.mainCanvas.height = height;
    AppState.outputCanvas.width = 400;
    AppState.outputCanvas.height = 400;
    AppState.processedCanvas.width = 400;
    AppState.processedCanvas.height = 400;
    
    AppState.imageDisplayInfo.canvasWidth = width;
    AppState.imageDisplayInfo.canvasHeight = height;
}

// Convert screen coordinates to image coordinates
function screenToImageCoordinates(screenX, screenY) {
    const info = AppState.imageDisplayInfo;
    
    // Adjust for zoom and pan
    const zoom = AppState.zoomLevel;
    const panX = AppState.panOffset.x;
    const panY = AppState.panOffset.y;
    
    // Calculate scaled dimensions
    const scaledWidth = info.imgWidth * info.scale * zoom;
    const scaledHeight = info.imgHeight * info.scale * zoom;
    
    // Calculate offset with panning
    const scaledOffsetX = info.offsetX + (info.canvasWidth - scaledWidth) / 2 + panX;
    const scaledOffsetY = info.offsetY + (info.canvasHeight - scaledHeight) / 2 + panY;
    
    // Convert to image coordinates
    const imgX = (screenX - scaledOffsetX) / (info.scale * zoom);
    const imgY = (screenY - scaledOffsetY) / (info.scale * zoom);
    
    return { x: Math.round(imgX), y: Math.round(imgY) };
}

// Initialize all event listeners
function initializeEventListeners() {
    // Camera controls
    document.getElementById('startCamera').addEventListener('click', startCamera);
    document.getElementById('uploadImage').addEventListener('click', () => {
        document.getElementById('imageUpload').click();
    });
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    document.getElementById('reset').addEventListener('click', resetApp);
    
    // Capture and cropping
    document.getElementById('capture').addEventListener('click', captureImage);
    document.getElementById('enableCrop').addEventListener('click', enableCropping);
    document.getElementById('applyCrop').addEventListener('click', applyCrop);
    document.getElementById('cancelCrop').addEventListener('click', cancelCrop);
    
    // Reference selection
    document.getElementById('refType').addEventListener('change', function() {
        const diameters = {
            'coin': 2.5,  // 1 Rupee
            'coin2': 2.7, // 2 Rupee
            'coin5': 2.5  // 5 Rupee
        };
        if (this.value !== 'custom') {
            AppState.referenceDiameter = diameters[this.value] || 2.5;
            document.getElementById('refDiameter').value = AppState.referenceDiameter;
            if (AppState.referenceCircle) {
                updateScaleFactor();
            }
        }
    });
    
    document.getElementById('refDiameter').addEventListener('input', function() {
        AppState.referenceDiameter = parseFloat(this.value) || 2.5;
        if (AppState.referenceCircle) {
            updateScaleFactor();
        }
    });
    
    document.getElementById('clearReference').addEventListener('click', clearReference);
    
    // Drape tester settings
    document.getElementById('diskDiameter').addEventListener('input', function() {
        AppState.diskDiameter = parseFloat(this.value) || 18.0;
    });
    
    document.getElementById('fabricDiameter').addEventListener('input', function() {
        AppState.fabricDiameter = parseFloat(this.value) || 30.0;
    });
    
    document.getElementById('calculateDrape').addEventListener('click', calculateDrapeCoefficient);
    
    // Export and save
    document.getElementById('exportData').addEventListener('click', exportToCSV);
    document.getElementById('saveImage').addEventListener('click', saveResultImage);
    
    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => adjustZoom(1.2));
    document.getElementById('zoomOut').addEventListener('click', () => adjustZoom(0.8));
    document.getElementById('resetZoom').addEventListener('click', resetZoom);
    
    // Crop diameter change
    document.getElementById('cropDiameter').addEventListener('input', updateCropCircleSize);
    
    // Canvas click for coin detection
    AppState.mainCanvas.addEventListener('click', handleCanvasClick);
    
    // Touch events for mobile
    AppState.mainCanvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });
    
    // Window resize
    window.addEventListener('resize', setCanvasSizes);
}

// Handle image upload
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        UIUtils.showLoading(true);
        updateStatus('Loading image...');
        
        // Load image using FileUtils
        const img = await FileUtils.loadImage(file);
        
        // Convert to OpenCV Mat
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        AppState.originalImage = cv.matFromImageData(imageData);
        AppState.capturedImage = AppState.originalImage.clone();
        
        // Store image dimensions
        AppState.imageDisplayInfo.imgWidth = img.width;
        AppState.imageDisplayInfo.imgHeight = img.height;
        
        // Display image
        displayImageOnMainCanvas(AppState.capturedImage);
        
        // Enable controls
        document.getElementById('capture').disabled = false;
        document.getElementById('enableCrop').disabled = false;
        document.getElementById('reset').disabled = false;
        
        updateStatus('Image loaded. First, apply circular crop to isolate drape area.');
        
        // Reset zoom and clear any previous reference
        resetZoom();
        clearReference();
        
    } catch (error) {
        console.error('Error loading image:', error);
        updateStatus('Error loading image');
        alert('Error loading image. Please try another image.');
    } finally {
        UIUtils.showLoading(false);
        // Clear file input
        event.target.value = '';
    }
}

// Start Camera Function
async function startCamera() {
    try {
        updateStatus('Accessing camera...');
        UIUtils.showLoading(true);
        
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        AppState.video.srcObject = stream;
        AppState.isCameraActive = true;
        AppState.video.style.display = 'block';
        
        // Enable/disable buttons
        document.getElementById('startCamera').disabled = true;
        document.getElementById('uploadImage').disabled = true;
        document.getElementById('capture').disabled = false;
        document.getElementById('reset').disabled = false;
        
        // Wait for video dimensions
        AppState.video.onloadedmetadata = () => {
            AppState.imageDisplayInfo.imgWidth = AppState.video.videoWidth;
            AppState.imageDisplayInfo.imgHeight = AppState.video.videoHeight;
        };
        
        // Start video rendering
        requestAnimationFrame(renderVideo);
        
        updateStatus('Camera active. Position drape and tap "Capture"');
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        updateStatus('Error: Could not access camera');
        alert('Camera access denied. Please allow camera permissions.');
    } finally {
        UIUtils.showLoading(false);
    }
}

// Render video to canvas
function renderVideo() {
    if (!AppState.isCameraActive) return;
    
    const canvas = AppState.mainCanvas;
    const ctx = AppState.mainCtx;
    const video = AppState.video;
    
    if (!video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(renderVideo);
        return;
    }
    
    // Calculate display dimensions maintaining aspect ratio
    const canvasAspect = canvas.width / canvas.height;
    const videoAspect = video.videoWidth / video.videoHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (videoAspect > canvasAspect) {
        // Video is wider than canvas
        drawHeight = canvas.height;
        drawWidth = drawHeight * videoAspect;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
    } else {
        // Video is taller than canvas
        drawWidth = canvas.width;
        drawHeight = drawWidth / videoAspect;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
    }
    
    // Update display info
    AppState.imageDisplayInfo.offsetX = offsetX;
    AppState.imageDisplayInfo.offsetY = offsetY;
    AppState.imageDisplayInfo.scale = drawWidth / video.videoWidth;
    
    // Apply zoom and pan
    const zoom = AppState.zoomLevel;
    const panX = AppState.panOffset.x;
    const panY = AppState.panOffset.y;
    
    const scaledWidth = drawWidth * zoom;
    const scaledHeight = drawHeight * zoom;
    const scaledOffsetX = offsetX + (drawWidth - scaledWidth) / 2 + panX;
    const scaledOffsetY = offsetY + (drawHeight - scaledHeight) / 2 + panY;
    
    // Clear and draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, scaledOffsetX, scaledOffsetY, scaledWidth, scaledHeight);
    
    requestAnimationFrame(renderVideo);
}

// Display image on main canvas
function displayImageOnMainCanvas(mat) {
    if (!mat || mat.empty()) return;
    
    const canvas = AppState.mainCanvas;
    const ctx = AppState.mainCtx;
    
    // Calculate display dimensions maintaining aspect ratio
    const canvasAspect = canvas.width / canvas.height;
    const imgAspect = mat.cols / mat.rows;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgAspect > canvasAspect) {
        // Image is wider than canvas
        drawHeight = canvas.height;
        drawWidth = drawHeight * imgAspect;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
    } else {
        // Image is taller than canvas
        drawWidth = canvas.width;
        drawHeight = drawWidth / imgAspect;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
    }
    
    // Update display info
    AppState.imageDisplayInfo.offsetX = offsetX;
    AppState.imageDisplayInfo.offsetY = offsetY;
    AppState.imageDisplayInfo.scale = drawWidth / mat.cols;
    
    // Apply zoom and pan
    const zoom = AppState.zoomLevel;
    const panX = AppState.panOffset.x;
    const panY = AppState.panOffset.y;
    
    const scaledWidth = drawWidth * zoom;
    const scaledHeight = drawHeight * zoom;
    const scaledOffsetX = offsetX + (drawWidth - scaledWidth) / 2 + panX;
    const scaledOffsetY = offsetY + (drawHeight - scaledHeight) / 2 + panY;
    
    // Clear and draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Convert Mat to ImageData
    const imgData = new ImageData(
        new Uint8ClampedArray(mat.data),
        mat.cols,
        mat.rows
    );
    
    // Create temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mat.cols;
    tempCanvas.height = mat.rows;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imgData, 0, 0);
    
    // Draw the image
    ctx.drawImage(tempCanvas, scaledOffsetX, scaledOffsetY, scaledWidth, scaledHeight);
}

// Handle canvas click for coin detection
function handleCanvasClick(event) {
    if (!AppState.capturedImage || AppState.isCropping) return;
    
    // Get click coordinates
    const rect = AppState.mainCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert to image coordinates
    const imgCoords = screenToImageCoordinates(x, y);
    
    // Check if coordinates are within image bounds
    if (imgCoords.x < 0 || imgCoords.x >= AppState.imageDisplayInfo.imgWidth ||
        imgCoords.y < 0 || imgCoords.y >= AppState.imageDisplayInfo.imgHeight) {
        return;
    }
    
    // Detect coin at clicked location
    detectCoin(imgCoords.x, imgCoords.y);
}

// Handle canvas touch for mobile
function handleCanvasTouch(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const clickEvent = new MouseEvent('click', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true
        });
        AppState.mainCanvas.dispatchEvent(clickEvent);
    }
}

// Detect coin using Hough Circle Transform
function detectCoin(clickX, clickY) {
    if (!AppState.capturedImage || AppState.isProcessing) return;
    
    try {
        UIUtils.showLoading(true);
        updateStatus('Detecting coin...');
        
        // Create a copy of the image
        let src = AppState.capturedImage.clone();
        
        // Convert to grayscale
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // Apply Gaussian blur
        let blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 2, 2);
        
        // Apply Hough Circle Transform
        let circles = new cv.Mat();
        cv.HoughCircles(blurred, circles, cv.HOUGH_GRADIENT, 
            1, // dp
            20, // minDist
            100, // param1
            30, // param2
            10, // minRadius (pixels)
            50  // maxRadius (pixels)
        );
        
        let detectedCircle = null;
        let minDistance = Infinity;
        
        // Find the circle closest to the click point
        for (let i = 0; i < circles.cols; i++) {
            let x = Math.round(circles.data32F[i * 3]);
            let y = Math.round(circles.data32F[i * 3 + 1]);
            let radius = Math.round(circles.data32F[i * 3 + 2]);
            
            // Calculate distance from click point
            let distance = Math.sqrt(Math.pow(x - clickX, 2) + Math.pow(y - clickY, 2));
            
            if (distance < minDistance && distance < radius * 2) {
                minDistance = distance;
                detectedCircle = { x, y, radius };
            }
        }
        
        // If no circle detected, try alternative method using contour detection
        if (!detectedCircle) {
            detectedCircle = detectCoinByContour(src, clickX, clickY);
        }
        
        if (detectedCircle) {
            // Store reference circle
            AppState.referenceCircle = detectedCircle;
            AppState.referenceDiameterPixels = detectedCircle.radius * 2;
            
            // Update UI
            document.getElementById('pixelDistance').textContent = 
                `${AppState.referenceDiameterPixels.toFixed(1)} px`;
            
            // Calculate scale factor
            updateScaleFactor();
            
            // Draw reference circle on image
            drawReferenceCircle();
            
            // Process image for drape area
            processDrapeArea();
            
            updateStatus('Coin detected. Processing drape area...');
        } else {
            updateStatus('No coin detected. Click closer to coin center.');
        }
        
        // Clean up
        src.delete();
        gray.delete();
        blurred.delete();
        circles.delete();
        
    } catch (error) {
        console.error('Coin detection error:', error);
        updateStatus('Error detecting coin');
    } finally {
        UIUtils.showLoading(false);
    }
}

// Alternative coin detection using contours
function detectCoinByContour(src, clickX, clickY) {
    try {
        // Convert to grayscale
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // Apply binary threshold
        let binary = new cv.Mat();
        cv.threshold(gray, binary, 100, 255, cv.THRESH_BINARY);
        
        // Find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        let detectedCircle = null;
        let minDistance = Infinity;
        
        // Find contour closest to click point
        for (let i = 0; i < contours.size(); i++) {
            let contour = contours.get(i);
            let moments = cv.moments(contour);
            
            if (moments.m00 > 0) {
                let centerX = moments.m10 / moments.m00;
                let centerY = moments.m01 / moments.m00;
                
                // Calculate area and approximate radius
                let area = cv.contourArea(contour);
                let radius = Math.sqrt(area / Math.PI);
                
                // Check if radius is reasonable for a coin
                if (radius >= 10 && radius <= 100) {
                    let distance = Math.sqrt(Math.pow(centerX - clickX, 2) + Math.pow(centerY - clickY, 2));
                    
                    if (distance < minDistance && distance < radius * 2) {
                        minDistance = distance;
                        detectedCircle = {
                            x: Math.round(centerX),
                            y: Math.round(centerY),
                            radius: Math.round(radius)
                        };
                    }
                }
            }
        }
        
        // Clean up
        gray.delete();
        binary.delete();
        contours.delete();
        hierarchy.delete();
        
        return detectedCircle;
        
    } catch (error) {
        console.error('Contour detection error:', error);
        return null;
    }
}

// Draw reference circle on canvas
function drawReferenceCircle() {
    if (!AppState.referenceCircle) return;
    
    // Clear previous drawings
    displayImageOnMainCanvas(AppState.capturedImage);
    
    const ctx = AppState.mainCtx;
    const circle = AppState.referenceCircle;
    
    // Calculate screen coordinates
    const screenX = circle.x * AppState.imageDisplayInfo.scale * AppState.zoomLevel + 
                   AppState.imageDisplayInfo.offsetX + 
                   (AppState.imageDisplayInfo.canvasWidth - 
                    AppState.imageDisplayInfo.imgWidth * AppState.imageDisplayInfo.scale * AppState.zoomLevel) / 2 +
                   AppState.panOffset.x;
    
    const screenY = circle.y * AppState.imageDisplayInfo.scale * AppState.zoomLevel + 
                   AppState.imageDisplayInfo.offsetY + 
                   (AppState.imageDisplayInfo.canvasHeight - 
                    AppState.imageDisplayInfo.imgHeight * AppState.imageDisplayInfo.scale * AppState.zoomLevel) / 2 +
                   AppState.panOffset.y;
    
    const screenRadius = circle.radius * AppState.imageDisplayInfo.scale * AppState.zoomLevel;
    
    // Draw circle
    ctx.beginPath();
    ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw center point
    ctx.beginPath();
    ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff0000';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw measurement text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Diameter: ${AppState.referenceDiameterPixels.toFixed(1)} px`, screenX, screenY - screenRadius - 10);
    ctx.fillText(`${AppState.referenceDiameter} cm`, screenX, screenY - screenRadius - 25);
}

// Update scale factor based on reference circle
function updateScaleFactor() {
    if (!AppState.referenceCircle) return;
    
    AppState.scaleFactor = AppState.referenceDiameterPixels / AppState.referenceDiameter;
    document.getElementById('scaleFactor').textContent = AppState.scaleFactor.toFixed(2);
}

// Clear reference
function clearReference() {
    AppState.referenceCircle = null;
    AppState.referenceDiameterPixels = 0;
    AppState.scaleFactor = null;
    
    document.getElementById('pixelDistance').textContent = '--';
    document.getElementById('scaleFactor').textContent = '--';
    document.getElementById('pixelArea').textContent = '--';
    document.getElementById('actualArea').textContent = '--';
    document.getElementById('drapeCoefficient').textContent = '--';
    
    if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
    }
    
    updateStatus('Reference cleared. Click on coin to detect.');
}

// Process drape area
function processDrapeArea() {
    if (!AppState.capturedImage || AppState.isProcessing) return;
    
    AppState.isProcessing = true;
    updateStatus('Processing drape area...');
    
    setTimeout(() => {
        try {
            // Create a copy of the image
            let src = AppState.capturedImage.clone();
            
            // Convert to grayscale
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            
            // Apply Gaussian blur
            let blurred = new cv.Mat();
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
            
            // Apply threshold
            let binary = new cv.Mat();
            cv.threshold(blurred, binary, 50, 255, cv.THRESH_BINARY_INV);
            
            // Find contours
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            // Find largest contour (drape area)
            let maxArea = 0;
            let maxContour = null;
            
            for (let i = 0; i < contours.size(); i++) {
                let contour = contours.get(i);
                let area = cv.contourArea(contour);
                
                // Skip very small areas
                if (area > maxArea && area > 1000) {
                    maxArea = area;
                    maxContour = contour;
                }
            }
            
            if (maxContour) {
                AppState.pixelArea = maxArea;
                
                // Calculate actual area if scale is available
                if (AppState.scaleFactor) {
                    const actualAreaCm2 = AppState.pixelArea / (AppState.scaleFactor * AppState.scaleFactor);
                    AppState.drapeArea = actualAreaCm2;
                    
                    // Update UI
                    document.getElementById('pixelArea').textContent = AppState.pixelArea.toFixed(0);
                    document.getElementById('actualArea').textContent = actualAreaCm2.toFixed(2);
                    
                    // Enable drape calculation
                    document.getElementById('calculateDrape').disabled = false;
                    document.getElementById('saveImage').disabled = false;
                    
                    updateStatus('Drape area calculated. Click "Calculate Drape %"');
                    
                    // Draw processed image
                    drawProcessedImage(src, maxContour);
                    
                    // Auto-calculate drape if area is reasonable
                    if (actualAreaCm2 > 50 && actualAreaCm2 < 1000) {
                        setTimeout(calculateDrapeCoefficient, 500);
                    }
                }
            } else {
                updateStatus('No drape area found. Try adjusting crop or lighting.');
            }
            
            // Clean up
            src.delete();
            gray.delete();
            blurred.delete();
            binary.delete();
            contours.delete();
            hierarchy.delete();
            
        } catch (error) {
            console.error('Drape processing error:', error);
            updateStatus('Error processing drape area');
        } finally {
            AppState.isProcessing = false;
        }
    }, 100);
}

// Draw processed image with drape contour
function drawProcessedImage(src, drapeContour) {
    try {
        // Create processed image
        let processed = new cv.Mat(src.rows, src.cols, cv.CV_8UC3, [255, 255, 255, 255]);
        
        // Draw drape contour
        cv.drawContours(processed, [drapeContour], 0, [0, 255, 0, 255], 2);
        
        // Fill drape area with transparency
        let filled = new cv.Mat(src.rows, src.cols, cv.CV_8UC4, [255, 255, 255, 0]);
        cv.drawContours(filled, [drapeContour], 0, [0, 255, 0, 100], -1);
        
        // Combine with original
        cv.addWeighted(processed, 0.7, filled, 0.3, 0, processed);
        
        // Display processed image
        cv.imshow(AppState.processedCanvas, processed);
        
        // Clean up
        processed.delete();
        filled.delete();
        
    } catch (error) {
        console.error('Error drawing processed image:', error);
    }
}

// Enable circular cropping
function enableCropping() {
    if (!AppState.capturedImage) return;
    
    AppState.isCropping = true;
    
    // Show crop controls
    document.getElementById('cropControls').style.display = 'block';
    document.getElementById('enableCrop').disabled = true;
    document.getElementById('capture').disabled = true;
    
    // Create crop circle at center
    const canvasRect = AppState.mainCanvas.getBoundingClientRect();
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;
    
    // Calculate crop diameter
    const cropDiameterCm = parseFloat(document.getElementById('cropDiameter').value) || 30.0;
    let diameterPixels = 300; // Default
    
    // If we already have scale, use it
    if (AppState.scaleFactor) {
        diameterPixels = cropDiameterCm * AppState.scaleFactor;
        diameterPixels *= AppState.imageDisplayInfo.scale;
    }
    
    // Ensure diameter fits within canvas
    diameterPixels = Math.min(diameterPixels, Math.min(canvasRect.width, canvasRect.height) * 0.9);
    
    AppState.cropDiameterPixels = diameterPixels;
    AppState.cropCenter = { x: centerX, y: centerY };
    
    // Create and display crop circle
    if (AppState.cropCircle) {
        AppState.cropCircle.remove();
    }
    
    AppState.cropCircle = UIUtils.createCropCircle(
        AppState.mainCanvas,
        centerX,
        centerY,
        diameterPixels
    );
    
    // Make crop circle draggable
    makeCropCircleDraggable();
    
    updateStatus('Drag circle to position drape. Adjust diameter if needed, then Apply Crop.');
}

// Make crop circle draggable
function makeCropCircleDraggable() {
    if (!AppState.cropCircle) return;
    
    let isDragging = false;
    let startX, startY;
    let startLeft, startTop;
    
    AppState.cropCircle.addEventListener('mousedown', startDrag);
    AppState.cropCircle.addEventListener('touchstart', startDragTouch);
    
    function startDrag(e) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(AppState.cropCircle.style.left);
        startTop = parseInt(AppState.cropCircle.style.top);
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    }
    
    function startDragTouch(e) {
        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startLeft = parseInt(AppState.cropCircle.style.left);
            startTop = parseInt(AppState.cropCircle.style.top);
            
            document.addEventListener('touchmove', dragTouch);
            document.addEventListener('touchend', stopDrag);
            e.preventDefault();
        }
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        AppState.cropCircle.style.left = `${startLeft + dx}px`;
        AppState.cropCircle.style.top = `${startTop + dy}px`;
    }
    
    function dragTouch(e) {
        if (!isDragging || e.touches.length !== 1) return;
        
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        
        AppState.cropCircle.style.left = `${startLeft + dx}px`;
        AppState.cropCircle.style.top = `${startTop + dy}px`;
    }
    
    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', dragTouch);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
    }
}

// Update crop circle size
function updateCropCircleSize() {
    if (!AppState.isCropping || !AppState.cropCircle) return;
    
    const cropDiameterCm = parseFloat(document.getElementById('cropDiameter').value) || 30.0;
    
    // Calculate diameter in pixels
    let diameterPixels = 300; // Default
    
    if (AppState.scaleFactor) {
        diameterPixels = cropDiameterCm * AppState.scaleFactor;
        diameterPixels *= AppState.imageDisplayInfo.scale;
    }
    
    // Ensure diameter fits within canvas
    const canvasRect = AppState.mainCanvas.getBoundingClientRect();
    diameterPixels = Math.min(diameterPixels, Math.min(canvasRect.width, canvasRect.height) * 0.9);
    
    // Update crop circle
    const currentLeft = parseInt(AppState.cropCircle.style.left);
    const currentTop = parseInt(AppState.cropCircle.style.top);
    const currentCenterX = currentLeft + AppState.cropDiameterPixels / 2;
    const currentCenterY = currentTop + AppState.cropDiameterPixels / 2;
    
    AppState.cropDiameterPixels = diameterPixels;
    AppState.cropCircle.style.width = `${diameterPixels}px`;
    AppState.cropCircle.style.height = `${diameterPixels}px`;
    AppState.cropCircle.style.left = `${currentCenterX - diameterPixels/2}px`;
    AppState.cropCircle.style.top = `${currentCenterY - diameterPixels/2}px`;
}

// Apply circular crop
function applyCrop() {
    if (!AppState.capturedImage || !AppState.cropCircle || !AppState.isCropping) return;
    
    try {
        UIUtils.showLoading(true);
        updateStatus('Applying crop...');
        
        // Get crop parameters
        const canvasRect = AppState.mainCanvas.getBoundingClientRect();
        const circleRect = AppState.cropCircle.getBoundingClientRect();
        
        // Calculate center in screen coordinates
        const centerX = circleRect.left - canvasRect.left + circleRect.width / 2;
        const centerY = circleRect.top - canvasRect.top + circleRect.height / 2;
        
        // Convert screen coordinates to image coordinates
        const imgCenter = screenToImageCoordinates(centerX, centerY);
        
        // Calculate diameter in image pixels
        let diameterImagePixels = AppState.cropDiameterPixels / (AppState.imageDisplayInfo.scale * AppState.zoomLevel);
        
        // Ensure coordinates are within image bounds
        const clampedCenterX = Math.max(0, Math.min(AppState.capturedImage.cols, imgCenter.x));
        const clampedCenterY = Math.max(0, Math.min(AppState.capturedImage.rows, imgCenter.y));
        diameterImagePixels = Math.min(
            diameterImagePixels,
            Math.min(clampedCenterX, AppState.capturedImage.cols - clampedCenterX) * 2,
            Math.min(clampedCenterY, AppState.capturedImage.rows - clampedCenterY) * 2
        );
        
        // Apply circular crop
        const croppedImage = ImageUtils.applyCircularCrop(
            AppState.capturedImage,
            clampedCenterX,
            clampedCenterY,
            diameterImagePixels
        );
        
        // Update captured image
        AppState.capturedImage.delete();
        AppState.capturedImage = croppedImage;
        
        // Update image dimensions
        AppState.imageDisplayInfo.imgWidth = croppedImage.cols;
        AppState.imageDisplayInfo.imgHeight = croppedImage.rows;
        
        // Clear previous reference (since coordinates changed)
        clearReference();
        
        // Display cropped image
        displayImageOnMainCanvas(AppState.capturedImage);
        cv.imshow(AppState.outputCanvas, AppState.capturedImage);
        
        // Clean up cropping
        cancelCrop();
        
        updateStatus('Crop applied. Now click on the coin in the image to set reference.');
        
    } catch (error) {
        console.error('Error applying crop:', error);
        updateStatus('Error applying crop');
    } finally {
        UIUtils.showLoading(false);
    }
}

// Cancel cropping
function cancelCrop() {
    AppState.isCropping = false;
    
    // Hide crop controls
    document.getElementById('cropControls').style.display = 'none';
    document.getElementById('enableCrop').disabled = false;
    document.getElementById('capture').disabled = false;
    
    // Remove crop circle
    if (AppState.cropCircle) {
        AppState.cropCircle.remove();
        AppState.cropCircle = null;
    }
    
    updateStatus('Cropping cancelled');
}

// Capture Image Function
function captureImage() {
    if (AppState.isCameraActive) {
        // Capture from video
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = AppState.video.videoWidth;
        tempCanvas.height = AppState.video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(AppState.video, 0, 0);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        AppState.originalImage = cv.matFromImageData(imageData);
        AppState.capturedImage = AppState.originalImage.clone();
        
        // Update image dimensions
        AppState.imageDisplayInfo.imgWidth = tempCanvas.width;
        AppState.imageDisplayInfo.imgHeight = tempCanvas.height;
        
        // Stop camera
        stopCamera();
    }
    
    // Process and display
    if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
        
        // Show output canvas
        cv.imshow(AppState.outputCanvas, AppState.capturedImage);
        
        // Enable crop button
        document.getElementById('enableCrop').disabled = false;
        
        updateStatus('Image captured. First, apply circular crop to isolate drape area.');
        
        // Clear any previous reference
        clearReference();
    }
}

// Zoom functions
function adjustZoom(factor) {
    AppState.zoomLevel *= factor;
    AppState.zoomLevel = Math.max(0.1, Math.min(10, AppState.zoomLevel));
    
    // Redraw
    if (AppState.isCameraActive) {
        // Will be updated in next renderVideo frame
    } else if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
        if (AppState.referenceCircle) {
            drawReferenceCircle();
        }
    }
}

function resetZoom() {
    AppState.zoomLevel = 1.0;
    AppState.panOffset = { x: 0, y: 0 };
    
    if (AppState.isCameraActive) {
        // Will be updated in next renderVideo frame
    } else if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
        if (AppState.referenceCircle) {
            drawReferenceCircle();
        }
    }
}

// Calculate Drape Coefficient
function calculateDrapeCoefficient() {
    if (!AppState.drapeArea || !AppState.scaleFactor) {
        updateStatus('Need reference and drape area first');
        return;
    }
    
    // Get drape tester dimensions
    const diskArea = DrapeFormulas.circleArea(AppState.diskDiameter);
    const fabricArea = DrapeFormulas.circleArea(AppState.fabricDiameter);
    
    // Calculate drape coefficient
    const drapeCoefficient = DrapeFormulas.drapeCoefficient(
        AppState.drapeArea,
        AppState.diskDiameter,
        AppState.fabricDiameter
    );
    
    // Get fabric properties
    const fabricProps = DrapeFormulas.fabricProperties(drapeCoefficient);
    
    // Update UI
    document.getElementById('drapeCoefficient').textContent = 
        `${drapeCoefficient.toFixed(2)}% (${fabricProps})`;
    
    // Add to history
    addToHistory(AppState.drapeArea, drapeCoefficient);
    
    updateStatus(`Drape coefficient: ${drapeCoefficient.toFixed(2)}% - ${fabricProps}`);
    
    return drapeCoefficient;
}

// Helper Functions
function updateStatus(message) {
    document.getElementById('status').textContent = message;
    console.log('Status:', message);
}

function stopCamera() {
    if (AppState.video.srcObject) {
        const tracks = AppState.video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        AppState.video.srcObject = null;
        AppState.isCameraActive = false;
        AppState.video.style.display = 'none';
    }
    
    document.getElementById('startCamera').disabled = false;
    document.getElementById('uploadImage').disabled = false;
}

function resetApp() {
    stopCamera();
    
    // Clear canvases
    const canvases = [AppState.mainCanvas, AppState.outputCanvas, AppState.processedCanvas];
    canvases.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    
    // Reset OpenCV mats
    if (AppState.originalImage) {
        AppState.originalImage.delete();
        AppState.originalImage = null;
    }
    
    if (AppState.capturedImage && AppState.capturedImage !== AppState.originalImage) {
        AppState.capturedImage.delete();
        AppState.capturedImage = null;
    }
    
    // Reset state
    clearReference();
    cancelCrop();
    
    AppState.pixelArea = 0;
    AppState.drapeArea = 0;
    AppState.zoomLevel = 1.0;
    AppState.panOffset = { x: 0, y: 0 };
    
    // Reset UI
    document.getElementById('pixelArea').textContent = '--';
    document.getElementById('actualArea').textContent = '--';
    document.getElementById('drapeCoefficient').textContent = '--';
    document.getElementById('pixelDistance').textContent = '--';
    document.getElementById('scaleFactor').textContent = '--';
    
    document.getElementById('capture').disabled = true;
    document.getElementById('enableCrop').disabled = true;
    document.getElementById('calculateDrape').disabled = true;
    document.getElementById('saveImage').disabled = true;
    
    updateStatus('App reset. Ready to start again.');
}

function addToHistory(area, coefficient) {
    const historyBody = document.getElementById('historyBody');
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${timeStr}</td>
        <td>${area.toFixed(2)} cm²</td>
        <td>${coefficient.toFixed(2)}%</td>
        <td>
            <button class="btn-small" onclick="deleteRow(this)">Delete</button>
        </td>
    `;
    
    historyBody.prepend(row);
    
    // Store in app state
    AppState.measurements.push({
        time: now,
        area: area,
        coefficient: coefficient
    });
}

function deleteRow(button) {
    const row = button.closest('tr');
    const index = Array.from(row.parentNode.children).indexOf(row);
    
    // Remove from measurements array
    if (index !== -1) {
        AppState.measurements.splice(index, 1);
    }
    
    row.remove();
}

function exportToCSV() {
    if (AppState.measurements.length === 0) {
        alert('No measurements to export');
        return;
    }
    
    // Create CSV content
    let csv = 'Time,Area (cm²),Drape Coefficient (%)\n';
    
    AppState.measurements.forEach(m => {
        const timeStr = m.time.toLocaleString();
        csv += `"${timeStr}",${m.area.toFixed(2)},${m.coefficient.toFixed(2)}\n`;
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drape-measurements-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function saveResultImage() {
    if (!AppState.capturedImage) return;
    
    // Create a canvas with both images side by side
    const combinedCanvas = document.createElement('canvas');
    combinedCanvas.width = 800;
    combinedCanvas.height = 400;
    const ctx = combinedCanvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
    
    // Draw original/cropped image
    const outputImgData = AppState.outputCtx.getImageData(0, 0, 400, 400);
    ctx.putImageData(outputImgData, 0, 0);
    
    // Draw processed image
    const processedImgData = AppState.processedCtx.getImageData(0, 0, 400, 400);
    ctx.putImageData(processedImgData, 400, 0);
    
    // Add labels
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 800, 30);
    ctx.fillRect(0, 370, 800, 30);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Original / Cropped', 200, 20);
    ctx.fillText('Processed Result', 600, 20);
    
    // Add measurements
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Area: ${AppState.drapeArea ? AppState.drapeArea.toFixed(2) : '--'} cm²`, 10, 385);
    ctx.fillText(`Drape: ${document.getElementById('drapeCoefficient').textContent}`, 410, 385);
    
    // Add timestamp
    ctx.textAlign = 'right';
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    const now = new Date();
    ctx.fillText(now.toLocaleString(), 790, 390);
    
    // Save image
    FileUtils.saveImage(combinedCanvas, `drape-measurement-${now.getTime()}.png`);
    
    updateStatus('Result image saved');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if OpenCV is already loaded
    if (typeof cv !== 'undefined' && cv.getBuildInformation) {
        onOpenCvReady();
    } else {
        updateStatus('Loading OpenCV...');
    }
});
