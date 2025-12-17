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
    referenceLine: {
        start: null,
        end: null,
        isDrawing: false
    },
    
    // Cropping state
    isCropping: false,
    cropCircle: null,
    cropCenter: { x: 0, y: 0 },
    cropDiameterPixels: 0,
    
    // Zoom state
    zoomLevel: 1.0,
    panOffset: { x: 0, y: 0 },
    isPanning: false,
    panStart: { x: 0, y: 0 },
    
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
        }
    });
    
    document.getElementById('refDiameter').addEventListener('input', function() {
        AppState.referenceDiameter = parseFloat(this.value) || 2.5;
        if (AppState.referenceLine.start && AppState.referenceLine.end) {
            updateScaleFactor();
        }
    });
    
    document.getElementById('clearReference').addEventListener('click', clearReferenceLine);
    
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
    
    // Canvas mouse events for reference line drawing
    AppState.mainCanvas.addEventListener('mousedown', handleCanvasMouseDown);
    AppState.mainCanvas.addEventListener('mousemove', handleCanvasMouseMove);
    AppState.mainCanvas.addEventListener('mouseup', handleCanvasMouseUp);
    
    // Touch events for mobile
    AppState.mainCanvas.addEventListener('touchstart', handleCanvasTouchStart);
    AppState.mainCanvas.addEventListener('touchmove', handleCanvasTouchMove);
    AppState.mainCanvas.addEventListener('touchend', handleCanvasTouchEnd);
    
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
        
        // Display image
        displayImageOnMainCanvas(AppState.capturedImage);
        
        // Enable controls
        document.getElementById('capture').disabled = false;
        document.getElementById('enableCrop').disabled = false;
        document.getElementById('reset').disabled = false;
        
        updateStatus('Image loaded. Draw reference line across coin.');
        
        // Reset zoom
        resetZoom();
        
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
    
    AppState.mainCtx.save();
    
    // Clear canvas
    AppState.mainCtx.clearRect(0, 0, AppState.mainCanvas.width, AppState.mainCanvas.height);
    
    // Calculate dimensions to maintain aspect ratio
    const video = AppState.video;
    const canvas = AppState.mainCanvas;
    
    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = canvas.width / canvas.height;
    
    let renderWidth, renderHeight, offsetX, offsetY;
    
    if (videoAspect > canvasAspect) {
        renderHeight = canvas.height;
        renderWidth = videoAspect * renderHeight;
        offsetX = (canvas.width - renderWidth) / 2;
        offsetY = 0;
    } else {
        renderWidth = canvas.width;
        renderHeight = renderWidth / videoAspect;
        offsetX = 0;
        offsetY = (canvas.height - renderHeight) / 2;
    }
    
    // Apply zoom and pan
    const zoom = AppState.zoomLevel;
    const panX = AppState.panOffset.x;
    const panY = AppState.panOffset.y;
    
    const scaledWidth = renderWidth * zoom;
    const scaledHeight = renderHeight * zoom;
    const scaledOffsetX = offsetX + (renderWidth - scaledWidth) / 2 + panX;
    const scaledOffsetY = offsetY + (renderHeight - scaledHeight) / 2 + panY;
    
    AppState.mainCtx.drawImage(
        video,
        scaledOffsetX, scaledOffsetY,
        scaledWidth, scaledHeight
    );
    
    // Draw reference line if drawing
    if (AppState.referenceLine.isDrawing && AppState.referenceLine.start) {
        const start = AppState.referenceLine.start;
        const current = AppState.referenceLine.current;
        
        if (start && current) {
            const pixelDist = ImageUtils.distance(start.x, start.y, current.x, current.y);
            ImageUtils.drawReferenceLine(AppState.mainCtx, start.x, start.y, current.x, current.y, pixelDist);
        }
    }
    
    // Draw existing reference line
    if (AppState.referenceLine.start && AppState.referenceLine.end) {
        const pixelDist = ImageUtils.distance(
            AppState.referenceLine.start.x, AppState.referenceLine.start.y,
            AppState.referenceLine.end.x, AppState.referenceLine.end.y
        );
        ImageUtils.drawReferenceLine(
            AppState.mainCtx,
            AppState.referenceLine.start.x, AppState.referenceLine.start.y,
            AppState.referenceLine.end.x, AppState.referenceLine.end.y,
            pixelDist,
            AppState.scaleFactor
        );
    }
    
    AppState.mainCtx.restore();
    
    requestAnimationFrame(renderVideo);
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
        
        // Stop camera
        stopCamera();
    }
    
    // Process and display
    if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
        updateStatus('Image captured. Draw reference line or enable cropping.');
        
        // Show output canvas
        cv.imshow(AppState.outputCanvas, AppState.capturedImage);
        
        // Enable crop button
        document.getElementById('enableCrop').disabled = false;
    }
}

// Display image on main canvas with zoom/pan
function displayImageOnMainCanvas(mat) {
    if (!mat || mat.empty()) return;
    
    AppState.mainCtx.save();
    AppState.mainCtx.clearRect(0, 0, AppState.mainCanvas.width, AppState.mainCanvas.height);
    
    // Calculate dimensions to maintain aspect ratio
    const imgAspect = mat.cols / mat.rows;
    const canvasAspect = AppState.mainCanvas.width / AppState.mainCanvas.height;
    
    let renderWidth, renderHeight, offsetX, offsetY;
    
    if (imgAspect > canvasAspect) {
        renderHeight = AppState.mainCanvas.height;
        renderWidth = imgAspect * renderHeight;
        offsetX = (AppState.mainCanvas.width - renderWidth) / 2;
        offsetY = 0;
    } else {
        renderWidth = AppState.mainCanvas.width;
        renderHeight = renderWidth / imgAspect;
        offsetX = 0;
        offsetY = (AppState.mainCanvas.height - renderHeight) / 2;
    }
    
    // Apply zoom and pan
    const zoom = AppState.zoomLevel;
    const panX = AppState.panOffset.x;
    const panY = AppState.panOffset.y;
    
    const scaledWidth = renderWidth * zoom;
    const scaledHeight = renderHeight * zoom;
    const scaledOffsetX = offsetX + (renderWidth - scaledWidth) / 2 + panX;
    const scaledOffsetY = offsetY + (renderHeight - scaledHeight) / 2 + panY;
    
    // Convert Mat to ImageData and draw
    const imgData = new ImageData(
        new Uint8ClampedArray(mat.data),
        mat.cols,
        mat.rows
    );
    
    // Create temporary canvas for ImageData
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mat.cols;
    tempCanvas.height = mat.rows;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imgData, 0, 0);
    
    AppState.mainCtx.drawImage(
        tempCanvas,
        scaledOffsetX, scaledOffsetY,
        scaledWidth, scaledHeight
    );
    
    // Draw reference line if exists
    if (AppState.referenceLine.start && AppState.referenceLine.end) {
        const pixelDist = ImageUtils.distance(
            AppState.referenceLine.start.x, AppState.referenceLine.start.y,
            AppState.referenceLine.end.x, AppState.referenceLine.end.y
        );
        ImageUtils.drawReferenceLine(
            AppState.mainCtx,
            AppState.referenceLine.start.x, AppState.referenceLine.start.y,
            AppState.referenceLine.end.x, AppState.referenceLine.end.y,
            pixelDist,
            AppState.scaleFactor
        );
    }
    
    AppState.mainCtx.restore();
}

// Canvas mouse event handlers
function handleCanvasMouseDown(event) {
    const rect = AppState.mainCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if we're in cropping mode
    if (AppState.isCropping && AppState.cropCircle) {
        const circleRect = AppState.cropCircle.getBoundingClientRect();
        const circleCenterX = circleRect.left + circleRect.width / 2;
        const circleCenterY = circleRect.top + circleRect.height / 2;
        const distance = Math.sqrt(
            Math.pow(event.clientX - circleCenterX, 2) + 
            Math.pow(event.clientY - circleCenterY, 2)
        );
        
        if (distance <= circleRect.width / 2) {
            AppState.isPanning = true;
            AppState.panStart = { x: event.clientX, y: event.clientY };
            return;
        }
    }
    
    // Start drawing reference line
    if (AppState.capturedImage && !AppState.isCropping) {
        AppState.referenceLine.start = { x, y };
        AppState.referenceLine.end = null;
        AppState.referenceLine.isDrawing = true;
        AppState.referenceLine.current = { x, y };
    }
}

function handleCanvasMouseMove(event) {
    const rect = AppState.mainCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Handle panning (for moving crop circle)
    if (AppState.isPanning && AppState.cropCircle) {
        const dx = event.clientX - AppState.panStart.x;
        const dy = event.clientY - AppState.panStart.y;
        
        const currentLeft = parseInt(AppState.cropCircle.style.left);
        const currentTop = parseInt(AppState.cropCircle.style.top);
        
        AppState.cropCircle.style.left = `${currentLeft + dx}px`;
        AppState.cropCircle.style.top = `${currentTop + dy}px`;
        
        AppState.panStart = { x: event.clientX, y: event.clientY };
        
        // Update crop center
        const circleRect = AppState.cropCircle.getBoundingClientRect();
        const canvasRect = AppState.mainCanvas.getBoundingClientRect();
        
        AppState.cropCenter.x = circleRect.left - canvasRect.left + circleRect.width / 2;
        AppState.cropCenter.y = circleRect.top - canvasRect.top + circleRect.height / 2;
        
        return;
    }
    
    // Update current position for reference line drawing
    if (AppState.referenceLine.isDrawing) {
        AppState.referenceLine.current = { x, y };
        
        // Redraw
        if (AppState.isCameraActive) {
            // Will be drawn in next renderVideo frame
        } else if (AppState.capturedImage) {
            displayImageOnMainCanvas(AppState.capturedImage);
        }
    }
}

function handleCanvasMouseUp(event) {
    const rect = AppState.mainCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Stop panning
    if (AppState.isPanning) {
        AppState.isPanning = false;
        return;
    }
    
    // Finish drawing reference line
    if (AppState.referenceLine.isDrawing && AppState.referenceLine.start) {
        AppState.referenceLine.end = { x, y };
        AppState.referenceLine.isDrawing = false;
        AppState.referenceLine.current = null;
        
        // Calculate pixel distance
        const pixelDistance = ImageUtils.distance(
            AppState.referenceLine.start.x, AppState.referenceLine.start.y,
            AppState.referenceLine.end.x, AppState.referenceLine.end.y
        );
        
        // Update UI
        document.getElementById('pixelDistance').textContent = pixelDistance.toFixed(1);
        
        // Calculate scale factor
        updateScaleFactor();
        
        // Redraw with permanent line
        if (AppState.capturedImage) {
            displayImageOnMainCanvas(AppState.capturedImage);
        }
        
        updateStatus('Reference line set. Adjust diameter if needed.');
    }
}

// Touch event handlers for mobile
function handleCanvasTouchStart(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        AppState.mainCanvas.dispatchEvent(mouseEvent);
    }
}

function handleCanvasTouchMove(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        AppState.mainCanvas.dispatchEvent(mouseEvent);
    }
}

function handleCanvasTouchEnd(event) {
    event.preventDefault();
    const mouseEvent = new MouseEvent('mouseup');
    AppState.mainCanvas.dispatchEvent(mouseEvent);
}

// Update scale factor based on reference line
function updateScaleFactor() {
    if (!AppState.referenceLine.start || !AppState.referenceLine.end) return;
    
    const pixelDistance = ImageUtils.distance(
        AppState.referenceLine.start.x, AppState.referenceLine.start.y,
        AppState.referenceLine.end.x, AppState.referenceLine.end.y
    );
    
    AppState.scaleFactor = pixelDistance / AppState.referenceDiameter;
    document.getElementById('scaleFactor').textContent = AppState.scaleFactor.toFixed(2);
}

// Clear reference line
function clearReferenceLine() {
    AppState.referenceLine.start = null;
    AppState.referenceLine.end = null;
    AppState.referenceLine.isDrawing = false;
    AppState.referenceLine.current = null;
    AppState.scaleFactor = null;
    
    document.getElementById('pixelDistance').textContent = '--';
    document.getElementById('scaleFactor').textContent = '--';
    
    if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
    }
    
    updateStatus('Reference cleared. Draw new reference line.');
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
    
    // Convert crop diameter from cm to pixels using scale factor
    let diameterPixels = 300; // Default if no scale
    if (AppState.scaleFactor) {
        const cropDiameterCm = parseFloat(document.getElementById('cropDiameter').value) || 30.0;
        diameterPixels = cropDiameterCm * AppState.scaleFactor;
        
        // Adjust for canvas scaling
        const imgAspect = AppState.capturedImage.cols / AppState.capturedImage.rows;
        const canvasAspect = AppState.mainCanvas.width / AppState.mainCanvas.height;
        
        let scaleFactorX, scaleFactorY;
        if (imgAspect > canvasAspect) {
            scaleFactorY = AppState.mainCanvas.height / AppState.capturedImage.rows;
            scaleFactorX = scaleFactorY;
        } else {
            scaleFactorX = AppState.mainCanvas.width / AppState.capturedImage.cols;
            scaleFactorY = scaleFactorX;
        }
        
        diameterPixels *= scaleFactorX;
    }
    
    // Ensure diameter fits within canvas
    diameterPixels = Math.min(diameterPixels, Math.min(canvasRect.width, canvasRect.height) * 0.9);
    
    AppState.cropDiameterPixels = diameterPixels;
    AppState.cropCenter = { x: centerX, y: centerY };
    
    // Create and display crop circle
    if (AppState.cropCircle) {
        AppState.cropCircle.remove();
    }
    
    AppState.cropCircle = document.createElement('div');
    AppState.cropCircle.className = 'crop-circle';
    AppState.cropCircle.style.cssText = `
        position: absolute;
        left: ${centerX - diameterPixels/2}px;
        top: ${centerY - diameterPixels/2}px;
        width: ${diameterPixels}px;
        height: ${diameterPixels}px;
        border: 2px dashed #3498db;
        border-radius: 50%;
        background: transparent;
        z-index: 4;
        cursor: move;
        box-sizing: border-box;
    `;
    
    AppState.mainCanvas.parentElement.appendChild(AppState.cropCircle);
    
    updateStatus('Cropping enabled. Drag circle to position, adjust diameter, then apply.');
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
        
        // Calculate center in image coordinates
        const centerX = (circleRect.left - canvasRect.left + circleRect.width / 2);
        const centerY = (circleRect.top - canvasRect.top + circleRect.height / 2);
        
        // Convert screen coordinates to image coordinates
        const imgAspect = AppState.capturedImage.cols / AppState.capturedImage.rows;
        const canvasAspect = AppState.mainCanvas.width / AppState.mainCanvas.height;
        
        let offsetX, offsetY, scale;
        
        if (imgAspect > canvasAspect) {
            // Image wider than canvas
            const renderHeight = AppState.mainCanvas.height;
            const renderWidth = imgAspect * renderHeight;
            offsetX = (AppState.mainCanvas.width - renderWidth) / 2;
            offsetY = 0;
            scale = renderHeight / AppState.capturedImage.rows;
        } else {
            // Image taller than canvas
            const renderWidth = AppState.mainCanvas.width;
            const renderHeight = renderWidth / imgAspect;
            offsetX = 0;
            offsetY = (AppState.mainCanvas.height - renderHeight) / 2;
            scale = renderWidth / AppState.capturedImage.cols;
        }
        
        // Adjust for zoom and pan
        const zoom = AppState.zoomLevel;
        const panX = AppState.panOffset.x;
        const panY = AppState.panOffset.y;
        
        const scaledWidth = AppState.mainCanvas.width * zoom;
        const scaledHeight = AppState.mainCanvas.height * zoom;
        const scaledOffsetX = offsetX + (AppState.mainCanvas.width - scaledWidth) / 2 + panX;
        const scaledOffsetY = offsetY + (AppState.mainCanvas.height - scaledHeight) / 2 + panY;
        
        // Calculate image coordinates
        const imageCenterX = (centerX - scaledOffsetX) / (scale * zoom);
        const imageCenterY = (centerY - scaledOffsetY) / (scale * zoom);
        
        // Calculate diameter in image pixels
        let diameterImagePixels = AppState.cropDiameterPixels / (scale * zoom);
        
        // Ensure coordinates are within image bounds
        const clampedCenterX = Math.max(0, Math.min(AppState.capturedImage.cols, imageCenterX));
        const clampedCenterY = Math.max(0, Math.min(AppState.capturedImage.rows, imageCenterY));
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
        
        // Display cropped image
        displayImageOnMainCanvas(AppState.capturedImage);
        cv.imshow(AppState.outputCanvas, AppState.capturedImage);
        
        // Clean up cropping
        cancelCrop();
        
        updateStatus('Crop applied. Draw reference line if needed, then process.');
        
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

// Zoom functions
function adjustZoom(factor) {
    AppState.zoomLevel *= factor;
    AppState.zoomLevel = Math.max(0.1, Math.min(10, AppState.zoomLevel));
    
    // Redraw
    if (AppState.isCameraActive) {
        // Will be updated in next renderVideo frame
    } else if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
    }
}

function resetZoom() {
    AppState.zoomLevel = 1.0;
    AppState.panOffset = { x: 0, y: 0 };
    
    if (AppState.isCameraActive) {
        // Will be updated in next renderVideo frame
    } else if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
    }
}

// Process Image for Drape Area
function processImage() {
    if (!AppState.capturedImage || AppState.isProcessing) return;
    
    AppState.isProcessing = true;
    updateStatus('Processing image...');
    UIUtils.showLoading(true);
    
    try {
        // Create a copy of the image
        let src = AppState.capturedImage.clone();
        
        // Convert to grayscale
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // Apply Gaussian blur to reduce noise
        let blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
        
        // Apply adaptive thresholding
        let binary = new cv.Mat();
        cv.adaptiveThreshold(blurred, binary, 255, 
            cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
        
        // Find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // Find the largest contour (assumed to be the drape)
        let maxArea = 0;
        let maxContourIndex = -1;
        
        for (let i = 0; i < contours.size(); i++) {
            let contour = contours.get(i);
            let area = cv.contourArea(contour);
            
            if (area > maxArea) {
                maxArea = area;
                maxContourIndex = i;
            }
        }
        
        // If we found a contour
        if (maxContourIndex !== -1) {
            let largestContour = contours.get(maxContourIndex);
            
            // Calculate area in pixels
            AppState.pixelArea = maxArea;
            
            // Calculate actual area if scale is available
            if (AppState.scaleFactor) {
                const actualAreaCm2 = AppState.pixelArea / (AppState.scaleFactor * AppState.scaleFactor);
                AppState.drapeArea = actualAreaCm2;
                
                // Update UI
                document.getElementById('pixelArea').textContent = AppState.pixelArea.toFixed(0);
                document.getElementById('actualArea').textContent = actualAreaCm2.toFixed(2);
            }
            
            // Draw the contour on processed image
            let processed = new cv.Mat(src.rows, src.cols, cv.CV_8UC3, [255, 255, 255, 255]);
            cv.drawContours(processed, contours, maxContourIndex, [0, 255, 0, 255], 2);
            
            // Fill the contour area
            cv.drawContours(processed, contours, maxContourIndex, [0, 255, 0, 255], -1);
            
            // Display processed image
            cv.imshow(AppState.processedCanvas, processed);
            
            // Enable drape calculation
            document.getElementById('calculateDrape').disabled = false;
            document.getElementById('saveImage').disabled = false;
            
            updateStatus('Processing complete. Click "Calculate Drape %"');
            
            // Clean up
            processed.delete();
        } else {
            updateStatus('No drape contour found. Try better lighting/contrast.');
        }
        
        // Clean up mats
        src.delete();
        gray.delete();
        blurred.delete();
        binary.delete();
        contours.delete();
        hierarchy.delete();
        
    } catch (error) {
        console.error('Processing error:', error);
        updateStatus('Error processing image');
    } finally {
        AppState.isProcessing = false;
        UIUtils.showLoading(false);
    }
}

// Calculate Drape Coefficient
function calculateDrapeCoefficient() {
    if (!AppState.drapeArea || !AppState.scaleFactor) {
        updateStatus('Process image and set reference first');
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
    
    // Update UI
    document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
    
    // Add to history
    addToHistory(AppState.drapeArea, drapeCoefficient);
    
    updateStatus('Drape coefficient calculated');
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
    
    // Reset state
    if (AppState.originalImage) {
        AppState.originalImage.delete();
        AppState.originalImage = null;
    }
    
    if (AppState.capturedImage && AppState.capturedImage !== AppState.originalImage) {
        AppState.capturedImage.delete();
        AppState.capturedImage = null;
    }
    
    clearReferenceLine();
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
    
    // Combine original and processed images
    const combinedCanvas = document.createElement('canvas');
    combinedCanvas.width = 800;
    combinedCanvas.height = 400;
    const ctx = combinedCanvas.getContext('2d');
    
    // Draw original/cropped image
    ctx.drawImage(AppState.outputCanvas, 0, 0, 400, 400);
    
    // Draw processed image
    ctx.drawImage(AppState.processedCanvas, 400, 0, 400, 400);
    
    // Add text overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 800, 30);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Drape Measurement Results', 400, 20);
    
    ctx.textAlign = 'left';
    ctx.font = '12px Arial';
    ctx.fillText(`Area: ${AppState.drapeArea ? AppState.drapeArea.toFixed(2) : '--'} cm²`, 10, 360);
    ctx.fillText(`Drape: ${document.getElementById('drapeCoefficient').textContent}`, 10, 380);
    
    // Save image
    FileUtils.saveImage(combinedCanvas, `drape-measurement-${new Date().getTime()}.png`);
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
