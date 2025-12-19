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
    
    // Reference detection
    detectedCoin: null,
    coinCircleElement: null,
    
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
    UIUtils.showToast('OpenCV loaded successfully', 'success');
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
    
    updateStatus('Ready - Upload image or use camera');
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
    
    console.log('Canvas sizes set:', width, 'x', height);
}

// Initialize all event listeners
// ... existing code ...

// Initialize all event listeners
function initializeEventListeners() {
    console.log('Initializing event listeners...');
    
    // Camera controls
    document.getElementById('startCamera').addEventListener('click', startCamera);
    
    // Upload button fix - directly trigger file input click
  document.getElementById('uploadImage').addEventListener('click', function () {
    document.getElementById('imageUpload').click();
});
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    document.getElementById('reset').addEventListener('click', resetApp);
    
}

// Start Camera Function - Fixed promise handling
async function startCamera() {
    console.log('Starting camera...');
    try {
        updateStatus('Accessing camera...');
        UIUtils.showLoading(true);
        
        // Check if browser supports mediaDevices
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera API not supported in this browser');
        }
        
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        console.log('Requesting camera with constraints:', constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Camera access granted');
        
        AppState.video.srcObject = stream;
        await AppState.video.play();
        AppState.isCameraActive = true;
        AppState.video.style.display = 'block';
        
        // Enable/disable buttons
        document.getElementById('startCamera').disabled = true;
        document.getElementById('uploadImage').disabled = true;
        document.getElementById('capture').disabled = false;
        document.getElementById('reset').disabled = false;
        
        // Wait for video to be ready
        return new Promise((resolve) => {
            AppState.video.onloadedmetadata = () => {
                console.log('Video metadata loaded:', AppState.video.videoWidth, 'x', AppState.video.videoHeight);
                AppState.imageDisplayInfo.imgWidth = AppState.video.videoWidth;
                AppState.imageDisplayInfo.imgHeight = AppState.video.videoHeight;
                
                // Start video rendering
                requestAnimationFrame(renderVideo);
                
                updateStatus('Camera active. Position drape and coin, then click "Capture Image"');
                UIUtils.showToast('Camera started successfully', 'success');
                resolve();
            };
        });
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        updateStatus('Error: Could not access camera');
        UIUtils.showToast('Camera error: ' + error.message, 'error');
        
        // Show detailed error message
        let errorMessage = 'Camera access denied. ';
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage += 'No camera found.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage += 'Camera is already in use by another application.';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            errorMessage += 'Camera constraints could not be satisfied.';
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage += 'Camera permission denied. Please allow camera access.';
        } else if (error.name === 'TypeError' || error.message.includes('getUserMedia')) {
            errorMessage += 'Camera API not supported. Try Chrome, Firefox, or Edge.';
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
    } finally {
        UIUtils.showLoading(false);
    }
}

// Handle image upload - Fixed to work properly
async function handleImageUpload(event) {
    console.log('Image upload triggered');
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    // Check if file is an image
    if (!file.type.match('image.*')) {
        alert('Please select an image file');
        return;
    }
    
    try {
        UIUtils.showLoading(true);
        updateStatus('Loading image...');
        console.log('Loading image:', file.name);
        
        // Stop camera if active
        if (AppState.isCameraActive) {
            stopCamera();
        }
        
        // Load image using FileUtils
        const img = await FileUtils.loadImage(file);
        console.log('Image loaded:', img.width, 'x', img.height);
        
        // Create temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Check if OpenCV is ready
        if (typeof cv === 'undefined') {
            throw new Error('OpenCV not loaded');
        }
        
        // Create OpenCV Mat from image data
        AppState.originalImage = cv.matFromImageData(imageData);
        AppState.capturedImage = AppState.originalImage.clone();
        
        // Store image dimensions
        AppState.imageDisplayInfo.imgWidth = img.width;
        AppState.imageDisplayInfo.imgHeight = img.height;
        
        console.log('Image converted to OpenCV Mat:', AppState.capturedImage.cols, 'x', AppState.capturedImage.rows);
        
        // Display image
        displayImageOnMainCanvas(AppState.capturedImage);
        
        // Show output canvas
        cv.imshow(AppState.outputCanvas, AppState.capturedImage);
        
        // Enable controls
        document.getElementById('capture').disabled = false;
        document.getElementById('reset').disabled = false;
        
        updateStatus('Image loaded. Click precisely on the coin in the image.');
        UIUtils.showToast('Image loaded successfully', 'success');
        
        // Reset zoom and clear any previous reference
        resetZoom();
        clearReference();
        
    } catch (error) {
        console.error('Error loading image:', error);
        updateStatus('Error loading image');
        UIUtils.showToast('Error loading image: ' + error.message, 'error');
        alert('Error loading image. Please try another image.');
    } finally {
        UIUtils.showLoading(false);
        // Clear file input
        event.target.value = '';
    }
}

// Render video to canvas
function renderVideo() {
    if (!AppState.isCameraActive) return;
    
    const canvas = AppState.mainCanvas;
    const ctx = AppState.mainCtx;
    const video = AppState.video;
    
    // Check if video is ready
    if (!video.videoWidth || !video.videoHeight || video.videoWidth === 0 || video.videoHeight === 0) {
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
    if (!mat || mat.empty()) {
        console.error('Invalid or empty image matrix');
        return;
    }
    
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
    
    try {
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
        
    } catch (error) {
        console.error('Error displaying image:', error);
        // Fallback: Draw a placeholder
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Error displaying image', canvas.width / 2, canvas.height / 2);
    }
}

// Handle canvas click for coin detection
function handleCanvasClick(event) {
    if (!AppState.capturedImage || AppState.isProcessing) {
        UIUtils.showToast('Please load an image first', 'error');
        return;
    }
    
    // Get click coordinates
    const rect = AppState.mainCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log('Canvas clicked at:', x, y);
    
    // Detect coin at clicked location
    detectCoin(x, y);
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

// Detect coin at clicked location
function detectCoin(screenX, screenY) {
    if (!AppState.capturedImage || AppState.isProcessing) {
        UIUtils.showToast('Please load an image first', 'error');
        return;
    }
    
    try {
        UIUtils.showLoading(true);
        updateStatus('Detecting coin...');
        console.log('Starting coin detection...');
        
        // Convert screen coordinates to image coordinates
        const imgCoords = screenToImageCoordinates(screenX, screenY);
        console.log('Image coordinates:', imgCoords);
        
        // Validate coordinates are within image bounds
        if (imgCoords.x < 0 || imgCoords.x >= AppState.imageDisplayInfo.imgWidth ||
            imgCoords.y < 0 || imgCoords.y >= AppState.imageDisplayInfo.imgHeight) {
            updateStatus('Click must be within the image area');
            UIUtils.showToast('Click must be within the image area', 'error');
            UIUtils.showLoading(false);
            return;
        }
        
        // Create a copy of the image
        let src = AppState.capturedImage.clone();
        
        // Method 1: Try Hough Circle Transform first (most accurate for coins)
        let detectedCircle = detectCoinHough(src, imgCoords.x, imgCoords.y);
        
        // Method 2: If Hough fails, try contour detection
        if (!detectedCircle) {
            detectedCircle = detectCoinContour(src, imgCoords.x, imgCoords.y);
        }
        
        if (detectedCircle) {
            console.log('Coin detected:', detectedCircle);
            
            // Store detected coin
            AppState.detectedCoin = detectedCircle;
            
            // Update detection status
            document.getElementById('detectionStatus').textContent = 'Detected';
            document.getElementById('detectionStatus').className = 'detected';
            
            // Update pixel diameter display
            document.getElementById('pixelDistance').textContent = 
                `${(detectedCircle.radius * 2).toFixed(1)} px`;
            
            // Calculate and update scale factor
            updateScaleFactor();
            
            // Draw coin circle on image
            drawCoinCircle();
            
            // Process drape area
            processDrapeArea();
            
            // Enable clear reference button
            document.getElementById('clearReference').disabled = false;
            
            updateStatus('Coin detected! Processing drape area...');
            UIUtils.showToast('Coin detected successfully', 'success');
        } else {
            console.log('Coin not detected');
            updateStatus('Could not detect coin. Click closer to coin center.');
            UIUtils.showToast('Click closer to the center of the coin', 'error');
        }
        
        // Clean up
        src.delete();
        
    } catch (error) {
        console.error('Coin detection error:', error);
        updateStatus('Error detecting coin');
        UIUtils.showToast('Error detecting coin: ' + error.message, 'error');
    } finally {
        UIUtils.showLoading(false);
    }
}

// Detect coin using Hough Circle Transform
function detectCoinHough(src, clickX, clickY) {
    try {
        // Convert to grayscale
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // Apply Gaussian blur
        let blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 2, 2);
        
        // Apply Hough Circle Transform
        let circles = new cv.Mat();
        cv.HoughCircles(blurred, circles, cv.HOUGH_GRADIENT, 
            1,      // dp
            30,     // minDist (between circle centers)
            100,    // param1 (canny edge threshold)
            30,     // param2 (accumulator threshold)
            15,     // minRadius (pixels) - minimum coin size
            50      // maxRadius (pixels) - maximum coin size
        );
        
        console.log('Hough circles found:', circles.cols);
        
        let bestCircle = null;
        let minDistance = Infinity;
        
        // Find the circle closest to the click point
        for (let i = 0; i < circles.cols; i++) {
            let x = Math.round(circles.data32F[i * 3]);
            let y = Math.round(circles.data32F[i * 3 + 1]);
            let radius = Math.round(circles.data32F[i * 3 + 2]);
            
            // Calculate distance from click point
            let distance = Math.sqrt(Math.pow(x - clickX, 2) + Math.pow(y - clickY, 2));
            
            // Accept circle if click is within or very close to it
            if (distance < Math.max(radius, 30) && distance < minDistance) {
                minDistance = distance;
                bestCircle = { x, y, radius };
                console.log('Found circle at:', x, y, 'radius:', radius, 'distance:', distance);
            }
        }
        
        // Clean up
        gray.delete();
        blurred.delete();
        circles.delete();
        
        return bestCircle;
        
    } catch (error) {
        console.error('Hough detection error:', error);
        return null;
    }
}

// Detect coin using contour detection
function detectCoinContour(src, clickX, clickY) {
    try {
        // Convert to grayscale
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // Apply binary threshold
        let binary = new cv.Mat();
        cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        
        // Apply morphological operations to clean up
        let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
        let morph = new cv.Mat();
        cv.morphologyEx(binary, morph, cv.MORPH_CLOSE, kernel);
        
        // Find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(morph, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        console.log('Contours found:', contours.size());
        
        let bestCircle = null;
        let minDistance = Infinity;
        
        // Find contour closest to click point
        for (let i = 0; i < contours.size(); i++) {
            let contour = contours.get(i);
            let area = cv.contourArea(contour);
            
            // Filter by area (coin should be reasonable size)
            if (area < 100 || area > 10000) continue;
            
            // Get bounding circle
            let center = new cv.Point(0, 0);
            let radius = 0;
            cv.minEnclosingCircle(contour, center, radius);
            
            let x = Math.round(center.x);
            let y = Math.round(center.y);
            radius = Math.round(radius);
            
            // Calculate circularity
            let perimeter = cv.arcLength(contour, true);
            let circularity = (4 * Math.PI * area) / (perimeter * perimeter);
            
            // Accept if it's reasonably circular and close to click
            if (circularity > 0.7) {
                let distance = Math.sqrt(Math.pow(x - clickX, 2) + Math.pow(y - clickY, 2));
                
                if (distance < Math.max(radius, 30) && distance < minDistance) {
                    minDistance = distance;
                    bestCircle = { x, y, radius };
                    console.log('Found contour circle at:', x, y, 'radius:', radius, 'circularity:', circularity);
                }
            }
        }
        
        // Clean up
        gray.delete();
        binary.delete();
        kernel.delete();
        morph.delete();
        contours.delete();
        hierarchy.delete();
        
        return bestCircle;
        
    } catch (error) {
        console.error('Contour detection error:', error);
        return null;
    }
}

// Draw detected coin circle on canvas
function drawCoinCircle() {
    if (!AppState.detectedCoin) return;
    
    // Remove previous circle if exists
    if (AppState.coinCircleElement) {
        AppState.coinCircleElement.remove();
    }
    
    const coin = AppState.detectedCoin;
    const info = AppState.imageDisplayInfo;
    
    // Calculate screen coordinates
    const screenX = coin.x * info.scale * AppState.zoomLevel + 
                   info.offsetX + 
                   (info.canvasWidth - info.imgWidth * info.scale * AppState.zoomLevel) / 2 +
                   AppState.panOffset.x;
    
    const screenY = coin.y * info.scale * AppState.zoomLevel + 
                   info.offsetY + 
                   (info.canvasHeight - info.imgHeight * info.scale * AppState.zoomLevel) / 2 +
                   AppState.panOffset.y;
    
    const screenRadius = coin.radius * info.scale * AppState.zoomLevel;
    
    // Create circle element
    AppState.coinCircleElement = document.createElement('div');
    AppState.coinCircleElement.className = 'coin-circle';
    AppState.coinCircleElement.style.cssText = `
        position: absolute;
        left: ${screenX - screenRadius}px;
        top: ${screenY - screenRadius}px;
        width: ${screenRadius * 2}px;
        height: ${screenRadius * 2}px;
        border: 2px solid #e74c3c;
        border-radius: 50%;
        background: transparent;
        pointer-events: none;
        z-index: 5;
        box-shadow: 0 0 10px rgba(231, 76, 60, 0.3);
    `;
    
    // Add center point
    const centerPoint = document.createElement('div');
    centerPoint.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
        background: #e74c3c;
        border-radius: 50%;
        border: 2px solid white;
    `;
    AppState.coinCircleElement.appendChild(centerPoint);
    
    // Add measurement text
    const textElement = document.createElement('div');
    textElement.style.cssText = `
        position: absolute;
        top: -25px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(231, 76, 60, 0.9);
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        white-space: nowrap;
    `;
    textElement.textContent = `${(coin.radius * 2).toFixed(0)} px`;
    AppState.coinCircleElement.appendChild(textElement);
    
    // Add to canvas container
    AppState.mainCanvas.parentElement.appendChild(AppState.coinCircleElement);
}

// Update scale factor based on detected coin
function updateScaleFactor() {
    if (!AppState.detectedCoin) return;
    
    const pixelDiameter = AppState.detectedCoin.radius * 2;
    AppState.scaleFactor = pixelDiameter / AppState.referenceDiameter;
    
    console.log('Scale factor calculated:', AppState.scaleFactor, 'px/cm');
    
    // Update UI
    document.getElementById('scaleFactor').textContent = AppState.scaleFactor.toFixed(2);
}

// Process drape area
function processDrapeArea() {
    if (!AppState.capturedImage || !AppState.detectedCoin || AppState.isProcessing) return;
    
    AppState.isProcessing = true;
    updateStatus('Processing drape area...');
    
    setTimeout(() => {
        try {
            console.log('Processing drape area...');
            
            // Create a copy of the image
            let src = AppState.capturedImage.clone();
            
            // Convert to grayscale
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            
            // Apply Gaussian blur
            let blurred = new cv.Mat();
            cv.GaussianBlur(gray, blurred, new cv.Size(7, 7), 2, 2);
            
            // Apply adaptive thresholding for better drape detection
            let binary = new cv.Mat();
            cv.adaptiveThreshold(blurred, binary, 255,
                cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
            
            // Find contours
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            console.log('Found contours:', contours.size());
            
            // Find the largest contour (drape area)
            let maxArea = 0;
            let maxContour = null;
            
            for (let i = 0; i < contours.size(); i++) {
                let contour = contours.get(i);
                let area = cv.contourArea(contour);
                
                // Filter out very small areas and the coin area
                if (area > maxArea && area > 5000) {
                    maxArea = area;
                    maxContour = contour;
                }
            }
            
            if (maxContour) {
                // Calculate drape area in cm²
                const pixelArea = maxArea;
                const actualAreaCm2 = pixelArea / (AppState.scaleFactor * AppState.scaleFactor);
                AppState.drapeArea = actualAreaCm2;
                
                console.log('Drape area calculated:', pixelArea, 'px² =', actualAreaCm2, 'cm²');
                
                // Update UI
                document.getElementById('actualArea').textContent = actualAreaCm2.toFixed(2);
                
                // Draw processed image
                drawProcessedImage(src, maxContour);
                
                // Calculate drape coefficient
                calculateDrapeCoefficient();
                
                // Enable save button
                document.getElementById('saveImage').disabled = false;
                
                updateStatus('Drape area processed successfully');
                UIUtils.showToast('Drape area processed successfully', 'success');
            } else {
                console.log('No drape area found');
                updateStatus('Could not detect drape area. Ensure good contrast.');
                UIUtils.showToast('Could not detect drape area. Ensure good contrast.', 'error');
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
            UIUtils.showToast('Error processing drape area: ' + error.message, 'error');
        } finally {
            AppState.isProcessing = false;
        }
    }, 100);
}

// Draw processed image with drape contour
function drawProcessedImage(src, drapeContour) {
    try {
        // Create processed image with original colors
        let processed = src.clone();
        
        // Create a mask for the drape area
        let mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
        cv.drawContours(mask, [drapeContour], 0, new cv.Scalar(255), -1);
        
        // Create colored overlay
        let overlay = new cv.Mat(src.rows, src.cols, cv.CV_8UC3, [0, 255, 0, 0]);
        
        // Apply overlay to drape area
        overlay.copyTo(processed, mask);
        
        // Blend with original
        cv.addWeighted(processed, 0.5, src, 0.5, 0, processed);
        
        // Draw contour outline
        cv.drawContours(processed, [drapeContour], 0, [0, 200, 0, 255], 2);
        
        // Display processed image
        cv.imshow(AppState.processedCanvas, processed);
        
        // Clean up
        mask.delete();
        overlay.delete();
        processed.delete();
        
    } catch (error) {
        console.error('Error drawing processed image:', error);
    }
}

// Calculate Drape Coefficient
function calculateDrapeCoefficient() {
    if (!AppState.drapeArea || !AppState.scaleFactor) {
        updateStatus('Need coin reference and drape area first');
        return;
    }
    
    console.log('Calculating drape coefficient...');
    
    // Calculate drape coefficient
    const drapeCoefficient = DrapeFormulas.drapeCoefficient(
        AppState.drapeArea,
        AppState.diskDiameter,
        AppState.fabricDiameter
    );
    
    // Get fabric properties
    const fabricProps = DrapeFormulas.fabricProperties(drapeCoefficient);
    
    console.log('Drape coefficient:', drapeCoefficient, 'Fabric:', fabricProps);
    
    // Update UI
    document.getElementById('drapeCoefficient').textContent = `${drapeCoefficient.toFixed(2)}%`;
    document.getElementById('fabricProperty').textContent = fabricProps;
    
    // Add to history
    addToHistory(AppState.drapeArea, drapeCoefficient, fabricProps);
    
    updateStatus(`Drape: ${drapeCoefficient.toFixed(2)}% - ${fabricProps}`);
    UIUtils.showToast(`Drape coefficient: ${drapeCoefficient.toFixed(2)}% (${fabricProps})`, 'success');
    
    return drapeCoefficient;
}

// Capture Image Function
function captureImage() {
    if (!AppState.isCameraActive) {
        UIUtils.showToast('Start camera first', 'error');
        return;
    }
    
    console.log('Capturing image from camera...');
    
    try {
        UIUtils.showLoading(true);
        updateStatus('Capturing image...');
        
        // Create temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = AppState.video.videoWidth;
        tempCanvas.height = AppState.video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw current video frame to canvas
        tempCtx.drawImage(AppState.video, 0, 0);
        
        // Get image data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Convert to OpenCV Mat
        AppState.originalImage = cv.matFromImageData(imageData);
        AppState.capturedImage = AppState.originalImage.clone();
        
        // Update image dimensions
        AppState.imageDisplayInfo.imgWidth = tempCanvas.width;
        AppState.imageDisplayInfo.imgHeight = tempCanvas.height;
        
        console.log('Image captured:', tempCanvas.width, 'x', tempCanvas.height);
        
        // Stop camera
        stopCamera();
        
        // Process and display
        displayImageOnMainCanvas(AppState.capturedImage);
        
        // Show output canvas
        cv.imshow(AppState.outputCanvas, AppState.capturedImage);
        
        updateStatus('Image captured. Click precisely on the coin in the image.');
        UIUtils.showToast('Image captured successfully', 'success');
        
        // Clear any previous reference
        clearReference();
        
    } catch (error) {
        console.error('Error capturing image:', error);
        updateStatus('Error capturing image');
        UIUtils.showToast('Error capturing image: ' + error.message, 'error');
    } finally {
        UIUtils.showLoading(false);
    }
}

// Clear reference
function clearReference() {
    console.log('Clearing reference...');
    
    // Remove coin circle
    if (AppState.coinCircleElement) {
        AppState.coinCircleElement.remove();
        AppState.coinCircleElement = null;
    }
    
    // Reset state
    AppState.detectedCoin = null;
    AppState.scaleFactor = null;
    AppState.drapeArea = 0;
    
    // Reset UI
    document.getElementById('detectionStatus').textContent = 'Not detected';
    document.getElementById('detectionStatus').className = '';
    document.getElementById('pixelDistance').textContent = '--';
    document.getElementById('scaleFactor').textContent = '--';
    document.getElementById('actualArea').textContent = '--';
    document.getElementById('drapeCoefficient').textContent = '--';
    document.getElementById('fabricProperty').textContent = '--';
    
    document.getElementById('clearReference').disabled = true;
    document.getElementById('saveImage').disabled = true;
    
    // Clear processed canvas
    AppState.processedCtx.clearRect(0, 0, 
        AppState.processedCanvas.width, 
        AppState.processedCanvas.height);
    
    updateStatus('Reference cleared. Click on coin to detect.');
}

// Zoom functions
function adjustZoom(factor) {
    AppState.zoomLevel *= factor;
    AppState.zoomLevel = Math.max(0.1, Math.min(10, AppState.zoomLevel));
    
    console.log('Zoom level:', AppState.zoomLevel);
    
    // Redraw
    if (AppState.isCameraActive) {
        // Will be updated in next renderVideo frame
    } else if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
        if (AppState.detectedCoin) {
            drawCoinCircle();
        }
    }
}

function resetZoom() {
    AppState.zoomLevel = 1.0;
    AppState.panOffset = { x: 0, y: 0 };
    
    console.log('Zoom reset');
    
    if (AppState.isCameraActive) {
        // Will be updated in next renderVideo frame
    } else if (AppState.capturedImage) {
        displayImageOnMainCanvas(AppState.capturedImage);
        if (AppState.detectedCoin) {
            drawCoinCircle();
        }
    }
}

// Helper Functions
function updateStatus(message) {
    document.getElementById('status').textContent = message;
    console.log('Status:', message);
}

function stopCamera() {
    if (AppState.video.srcObject) {
        const stream = AppState.video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => {
            track.stop();
            stream.removeTrack(track);
        });
        AppState.video.srcObject = null;
        AppState.isCameraActive = false;
        AppState.video.style.display = 'none';
    }
    
    document.getElementById('startCamera').disabled = false;
    document.getElementById('uploadImage').disabled = false;
    
    console.log('Camera stopped');
}

function resetApp() {
    console.log('Resetting app...');
    
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
    
    AppState.zoomLevel = 1.0;
    AppState.panOffset = { x: 0, y: 0 };
    
    // Reset UI
    document.getElementById('capture').disabled = true;
    document.getElementById('calculateDrape').disabled = true;
    document.getElementById('saveImage').disabled = true;
    
    updateStatus('App reset. Ready to start again.');
    UIUtils.showToast('App reset successfully', 'info');
}

function addToHistory(area, coefficient, property) {
    const historyBody = document.getElementById('historyBody');
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${timeStr}</td>
        <td>${area.toFixed(2)} cm²</td>
        <td>${coefficient.toFixed(2)}%</td>
        <td>${property}</td>
        <td>
            <button class="btn-small" onclick="deleteRow(this)">Delete</button>
        </td>
    `;
    
    historyBody.prepend(row);
    
    // Store in app state
    AppState.measurements.push({
        time: now,
        area: area,
        coefficient: coefficient,
        property: property
    });
    
    console.log('Added to history:', area, coefficient, property);
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
    let csv = 'Time,Area (cm²),Drape Coefficient (%),Fabric Property\n';
    
    AppState.measurements.forEach(m => {
        const timeStr = m.time.toLocaleString();
        csv += `"${timeStr}",${m.area.toFixed(2)},${m.coefficient.toFixed(2)},${m.property}\n`;
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
    
    console.log('CSV exported:', AppState.measurements.length, 'measurements');
}

function saveResultImage() {
    if (!AppState.capturedImage) {
        UIUtils.showToast('No image to save', 'error');
        return;
    }
    
    console.log('Saving result image...');
    
    try {
        // Create a canvas with both images side by side
        const combinedCanvas = document.createElement('canvas');
        combinedCanvas.width = 800;
        combinedCanvas.height = 400;
        const ctx = combinedCanvas.getContext('2d');
        
        // Draw background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
        
        // Draw original image with coin circle
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = AppState.capturedImage.cols;
        tempCanvas.height = AppState.capturedImage.rows;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Convert Mat to ImageData
        const imgData = new ImageData(
            new Uint8ClampedArray(AppState.capturedImage.data),
            AppState.capturedImage.cols,
            AppState.capturedImage.rows
        );
        tempCtx.putImageData(imgData, 0, 0);
        
        // Draw coin circle on original
        if (AppState.detectedCoin) {
            tempCtx.beginPath();
            tempCtx.arc(AppState.detectedCoin.x, AppState.detectedCoin.y, 
                       AppState.detectedCoin.radius, 0, Math.PI * 2);
            tempCtx.strokeStyle = '#e74c3c';
            tempCtx.lineWidth = 3;
            tempCtx.stroke();
            
            tempCtx.beginPath();
            tempCtx.arc(AppState.detectedCoin.x, AppState.detectedCoin.y, 
                       5, 0, Math.PI * 2);
            tempCtx.fillStyle = '#e74c3c';
            tempCtx.fill();
        }
        
        // Draw original image
        ctx.drawImage(tempCanvas, 0, 0, 400, 400);
        
        // Draw processed image
        ctx.drawImage(AppState.processedCanvas, 400, 0, 400, 400);
        
        // Add labels and measurements
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, 800, 30);
        ctx.fillRect(0, 370, 800, 30);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Original with Coin', 200, 20);
        ctx.fillText('Drape Area Detected', 600, 20);
        
        // Add measurements
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Area: ${AppState.drapeArea.toFixed(2)} cm²`, 10, 385);
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
        UIUtils.showToast('Result image saved successfully', 'success');
        
    } catch (error) {
        console.error('Error saving result image:', error);
        UIUtils.showToast('Error saving image: ' + error.message, 'error');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking OpenCV...');
    
    // Check if OpenCV is already loaded
    if (typeof cv !== 'undefined' && cv.getBuildInformation) {
        console.log('OpenCV already loaded');
        onOpenCvReady();
    } else {
        console.log('OpenCV not loaded yet, waiting...');
        updateStatus('Loading OpenCV...');
        
        // Check every 500ms if OpenCV is loaded
        const checkOpenCV = setInterval(() => {
            if (typeof cv !== 'undefined' && cv.getBuildInformation) {
                clearInterval(checkOpenCV);
                onOpenCvReady();
            }
        }, 500);
        
        // Timeout after 30 seconds
        setTimeout(() => {
            clearInterval(checkOpenCV);
            if (typeof cv === 'undefined') {
                updateStatus('Error: OpenCV failed to load. Please refresh the page.');
                UIUtils.showToast('OpenCV failed to load. Please refresh.', 'error');
                console.error('OpenCV failed to load after 30 seconds');
            }
        }, 30000);
    }
});
// Utility functions for the Drape Calculator

// Image processing utilities
const ImageUtils = {
    // Convert between coordinate systems
    scaleCoordinates: function(x, y, fromWidth, fromHeight, toWidth, toHeight) {
        return {
            x: (x / fromWidth) * toWidth,
            y: (y / fromHeight) * toHeight
        };
    },
    
    // Calculate distance between two points
    distance: function(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    
    // Apply circular crop to image
    applyCircularCrop: function(srcMat, centerX, centerY, diameterPixels) {
        try {
            // Create a circular mask
            let mask = new cv.Mat.zeros(srcMat.rows, srcMat.cols, cv.CV_8UC1);
            let center = new cv.Point(centerX, centerY);
            let radius = Math.floor(diameterPixels / 2);
            
            // Draw white circle on mask
            cv.circle(mask, center, radius, new cv.Scalar(255, 255, 255), -1);
            
            // Apply mask to source image
            let result = new cv.Mat();
            srcMat.copyTo(result, mask);
            
            // Clean up
            mask.delete();
            
            return result;
        } catch (error) {
            console.error('Error in circular crop:', error);
            return srcMat.clone();
        }
    }
};

// Validation utilities
const Validation = {
    isNumber: function(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    },
    
    validateDiameter: function(diameter) {
        if (!this.isNumber(diameter)) {
            return { valid: false, error: 'Diameter must be a number' };
        }
        if (diameter <= 0) {
            return { valid: false, error: 'Diameter must be positive' };
        }
        return { valid: true };
    },
    
    validateImage: function(imageMat) {
        if (!imageMat || imageMat.empty()) {
            return { valid: false, error: 'No image available' };
        }
        return { valid: true };
    }
};

// File utilities
const FileUtils = {
    saveImage: function(canvas, filename = 'drape-measurement.png') {
        try {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
            return true;
        } catch (error) {
            console.error('Error saving image:', error);
            return false;
        }
    },
    
    loadImage: function(file) {
        return new Promise((resolve, reject) => {
            // Check if file is provided
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }
            
            // Check if file is an image
            if (!file.type.match('image.*')) {
                reject(new Error('File is not an image'));
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = new Image();
                
                img.onload = function() {
                    console.log('Image loaded successfully:', img.width, 'x', img.height);
                    resolve(img);
                };
                
                img.onerror = function(err) {
                    console.error('Error loading image:', err);
                    reject(new Error('Failed to load image'));
                };
                
                img.src = e.target.result;
            };
            
            reader.onerror = function(err) {
                console.error('FileReader error:', err);
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsDataURL(file);
        });
    },
    
    loadImageToMat: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    // Create canvas to convert image to Mat
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    // Check if OpenCV is loaded
                    if (typeof cv === 'undefined') {
                        reject(new Error('OpenCV not loaded'));
                        return;
                    }
                    
                    const mat = cv.matFromImageData(imageData);
                    resolve(mat);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
};

// Drape calculation formulas
const DrapeFormulas = {
    // Calculate area from diameter
    circleArea: function(diameter) {
        const radius = diameter / 2;
        return Math.PI * radius * radius;
    },
    
    // Standard drape coefficient formula
    drapeCoefficient: function(drapedArea, diskDiameter, fabricDiameter) {
        const diskArea = this.circleArea(diskDiameter);
        const fabricArea = this.circleArea(fabricDiameter);
        
        if (fabricArea === diskArea) return 0;
        
        return ((drapedArea - diskArea) / (fabricArea - diskArea)) * 100;
    },
    
    // Calculate fabric properties
    fabricProperties: function(drapeCoefficient) {
        // Categorize drape based on coefficient
        if (drapeCoefficient < 30) return 'Stiff';
        if (drapeCoefficient < 60) return 'Medium Drape';
        if (drapeCoefficient < 85) return 'Good Drape';
        return 'Excellent Drape';
    }
};

// UI utilities
const UIUtils = {
    showToast: function(message, type = 'info') {
        try {
            // Remove existing toast
            const existingToast = document.querySelector('.toast');
            if (existingToast) existingToast.remove();
            
            // Create new toast
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            
            // Style the toast
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
                color: white;
                border-radius: 6px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                animation: slideIn 0.3s ease;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                max-width: 300px;
                word-wrap: break-word;
            `;
            
            document.body.appendChild(toast);
            
            // Remove toast after 3 seconds
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 3000);
            
        } catch (error) {
            console.error('Error showing toast:', error);
        }
    },
    
    showLoading: function(show = true) {
        try {
            let loader = document.getElementById('global-loader');
            
            if (show && !loader) {
                loader = document.createElement('div');
                loader.id = 'global-loader';
                loader.innerHTML = '<div class="loader"></div><p>Processing...</p>';
                loader.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255,255,255,0.9);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                `;
                document.body.appendChild(loader);
            } else if (!show && loader) {
                loader.remove();
            }
        } catch (error) {
            console.error('Error showing loading:', error);
        }
    },
    
    updateButtonState: function(buttonId, enabled, text = null) {
        try {
            const button = document.getElementById(buttonId);
            if (!button) {
                console.warn('Button not found:', buttonId);
                return;
            }
            
            button.disabled = !enabled;
            if (text !== null) {
                button.innerHTML = text;
            }
        } catch (error) {
            console.error('Error updating button state:', error);
        }
    },
    
    // Create a draggable/resizable circle for cropping
    createCropCircle: function(canvas, centerX, centerY, diameter) {
        const circle = document.createElement('div');
        circle.className = 'crop-circle';
        circle.style.cssText = `
            position: absolute;
            left: ${centerX - diameter/2}px;
            top: ${centerY - diameter/2}px;
            width: ${diameter}px;
            height: ${diameter}px;
            border: 2px dashed #3498db;
            border-radius: 50%;
            background: transparent;
            z-index: 4;
            cursor: move;
            box-sizing: border-box;
        `;
        
        canvas.parentElement.appendChild(circle);
        return circle;
    }
};

// Add CSS for animations
(function() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
})();

// Export all utilities
window.ImageUtils = ImageUtils;
window.Validation = Validation;
window.FileUtils = FileUtils;
window.DrapeFormulas = DrapeFormulas;
window.UIUtils = UIUtils;
