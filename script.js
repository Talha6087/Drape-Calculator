// Drape Area Calculator - Main Application Script

// Global variables
let stream = null;
let streaming = false;
let capturedImage = null;
let referencePoint = null;
let measurementHistory = [];
let isProcessing = false;
let cv = null; // OpenCV instance
let originalImageMat = null;
let displayScale = 1;
let actualWidth = 0;
let actualHeight = 0;

// OpenCV ready handler
function onOpenCvReady() {
    console.log('OpenCV.js is ready');
    cv = window.cv; // Get OpenCV from global scope
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
    
    // Load history from localStorage
    loadHistory();
    
    // Update UI state
    updateUIState();
    
    // Initialize device orientation
    initializeLevelIndicator();
    
    console.log('App initialized successfully');
}

// Set up all event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Start Camera button - FIXED: Use CameraUtils from utils.js
    const startCameraBtn = document.getElementById('startCamera');
    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', handleStartCamera);
        console.log('Start Camera button listener added');
    }
    
    // Upload Image button - FIXED: Use UploadUtils from utils.js
    const uploadImageBtn = document.getElementById('uploadImage');
    if (uploadImageBtn) {
        uploadImageBtn.addEventListener('click', handleUploadImage);
        console.log('Upload Image button listener added');
    }
    
    // File input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
        console.log('File input listener added');
    }
    
    // Capture button
    const captureBtn = document.getElementById('capture');
    if (captureBtn) {
        captureBtn.addEventListener('click', captureImage);
        console.log('Capture button listener added');
    }
    
    // Reset button
    const resetBtn = document.getElementById('reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetApp);
        console.log('Reset button listener added');
    }
    
    // Calculate Drape button
    const calculateDrapeBtn = document.getElementById('calculateDrape');
    if (calculateDrapeBtn) {
        calculateDrapeBtn.addEventListener('click', calculateDrapePercentage);
        console.log('Calculate Drape button listener added');
    }
    
    // Auto Calculate button
    const autoCalculateBtn = document.getElementById('autoCalculate');
    if (autoCalculateBtn) {
        autoCalculateBtn.addEventListener('click', autoCalculateDrape);
        console.log('Auto Calculate button listener added');
    }
    
    // Export CSV button
    const exportDataBtn = document.getElementById('exportData');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportToCSV);
        console.log('Export Data button listener added');
    }
    
    // Clear History button
    const clearHistoryBtn = document.getElementById('clearHistory');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearHistory);
        console.log('Clear History button listener added');
    }
    
    // Reference type change
    const refTypeSelect = document.getElementById('refType');
    if (refTypeSelect) {
        refTypeSelect.addEventListener('change', function() {
            const customRef = document.getElementById('customRef');
            if (this.value === 'custom') {
                customRef.style.display = 'block';
            } else {
                customRef.style.display = 'none';
            }
        });
        console.log('Reference type listener added');
    }
    
    // Canvas click for reference selection
    const originalCanvas = document.getElementById('originalCanvas');
    if (originalCanvas) {
        originalCanvas.addEventListener('click', handleCanvasClick);
        console.log('Canvas click listener added');
    }
    
    console.log('All event listeners set up');
}

async function handleStartCamera() {
    try {
        UIUtils.showLoading(true, 'Starting camera...');
        
        // Reset video display
        const video = document.getElementById('cameraVideo');
        video.style.display = 'block';
        
        // Hide canvases
        document.getElementById('originalCanvas').style.display = 'none';
        document.getElementById('processedCanvas').style.display = 'none';
        
        // Start camera
        await CameraUtils.startCamera();
        
        streaming = true;
        updateUIState();
        UIUtils.showToast('Camera started successfully', 'success');
        document.getElementById('status').textContent = 'Camera ready. Click "Capture & Analyze" when ready.';
        
    } catch (error) {
        console.error('Error starting camera:', error);
        UIUtils.showToast('Failed to start camera: ' + error, 'error');
        document.getElementById('status').textContent = 'Camera error: ' + error;
        
        // Try fallback for iOS Safari
        if (error.includes('requestDevice') || error.includes('permission')) {
            const video = document.getElementById('cameraVideo');
            const constraints = { video: true };
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                video.srcObject = stream;
                streaming = true;
                updateUIState();
                UIUtils.showToast('Camera started (fallback mode)', 'success');
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        }
    } finally {
        UIUtils.showLoading(false);
    }
}

// FIXED: Handle upload image
function handleUploadImage() {
    document.getElementById('fileInput').click();
}

// FIXED: Handle file upload with UploadUtils
async function handleFileUpload(event) {
    try {
        UIUtils.showLoading(true, 'Loading image...');
        
        // Use UploadUtils from utils.js
        const result = await UploadUtils.handleFileUpload(event, 5);
        
        processUploadedImage(result.image);
        UIUtils.showToast('Image loaded successfully', 'success');
        
    } catch (error) {
        console.error('Error uploading image:', error);
        UIUtils.showToast(error, 'error');
        document.getElementById('status').textContent = 'Upload error: ' + error;
    } finally {
        UIUtils.showLoading(false);
    }
}

// Process uploaded image
function processUploadedImage(img) {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const originalCanvas = document.getElementById('originalCanvas');
    
    // Hide video
    video.style.display = 'none';
    
    // Store actual dimensions
    actualWidth = img.width;
    actualHeight = img.height;
    
    console.log('Image dimensions:', actualWidth, 'x', actualHeight);
    
    // Set canvas dimensions
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    // Calculate display dimensions
    const maxWidth = originalCanvas.parentElement.clientWidth - 40;
    const maxHeight = 300;
    
    let displayWidth = actualWidth;
    let displayHeight = actualHeight;
    
    if (displayWidth > maxWidth || displayHeight > maxHeight) {
        const ratio = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
        displayWidth = Math.floor(displayWidth * ratio);
        displayHeight = Math.floor(displayHeight * ratio);
    }
    
    originalCanvas.width = displayWidth;
    originalCanvas.height = displayHeight;
    
    // Calculate display scale
    displayScale = displayWidth / actualWidth;
    console.log('Display scale calculated:', displayScale);
    
    // Draw to processing canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, actualWidth, actualHeight);
    
    // Convert to OpenCV Mat
    const imageData = ctx.getImageData(0, 0, actualWidth, actualHeight);
    originalImageMat = cv.matFromImageData(imageData);
    
    // Convert to proper color space for display
    cv.cvtColor(originalImageMat, originalImageMat, cv.COLOR_RGBA2RGB);
    
    // Draw to display canvas
    const displayCtx = originalCanvas.getContext('2d');
    displayCtx.drawImage(img, 0, 0, displayWidth, displayHeight);
    
    // Show canvas
    originalCanvas.style.display = 'block';
    
    // Update UI
    document.getElementById('status').textContent = 'Image loaded. Click on the coin to select reference.';
    updateUIState();
    
    // Reset reference point
    referencePoint = null;
    
    console.log('Image loaded successfully');
}

// Initialize device orientation for level indicator
function initializeLevelIndicator() {
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleDeviceOrientation);
    } else {
        console.log('Device orientation not supported');
    }
}

// Handle device orientation for level indicator
function handleDeviceOrientation(event) {
    const beta = event.beta;
    const gamma = event.gamma;
    
    if (beta !== null && gamma !== null) {
        const angle = Math.sqrt(beta * beta + gamma * gamma);
        
        // Use UIUtils from utils.js
        UIUtils.updateLevelIndicator(angle, beta, gamma);
    }
}

// Handle canvas click for reference selection
function handleCanvasClick(event) {
    if (!originalImageMat) {
        UIUtils.showToast('Please capture or upload an image first', 'warning');
        return;
    }
    
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    
    // Get mouse position relative to canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Ensure coordinates are within canvas bounds
    const canvasX = Math.max(0, Math.min(x, canvas.width - 1));
    const canvasY = Math.max(0, Math.min(y, canvas.height - 1));
    
    // Calculate actual image coordinates using the display scale
    const actualX = Math.round(canvasX / displayScale);
    const actualY = Math.round(canvasY / displayScale);
    
    // Validate coordinates
    if (actualX < 0 || actualX >= actualWidth || actualY < 0 || actualY >= actualHeight) {
        UIUtils.showToast('Click is outside the image area', 'warning');
        return;
    }
    
    console.log('Canvas click:', canvasX, canvasY);
    console.log('Actual coordinates:', actualX, actualY);
    console.log('Display scale:', displayScale);
    
    // Store reference point
    referencePoint = {
        displayX: canvasX,
        displayY: canvasY,
        actualX: actualX,
        actualY: actualY,
        timestamp: Date.now()
    };
    
    // Draw visual feedback on canvas
    drawReferenceMarker(canvas, canvasX, canvasY);
    
    // Create click animation
    UIUtils.createClickFeedback(x + rect.left, y + rect.top, 'rgba(0, 255, 0, 0.8)', 40);
    
    // Update status
    document.getElementById('status').textContent = 'Reference selected. Processing...';
    
    // Update UI
    updateUIState();
    
    // Process image after a short delay
    setTimeout(() => {
        processImageWithReference();
    }, 500);
}

// Draw reference marker on canvas
function drawReferenceMarker(canvas, x, y) {
    const ctx = canvas.getContext('2d');
    
    // Save current context state
    ctx.save();
    
    // Draw outer circle
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw inner crosshair
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y + 10);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw center dot
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff00';
    ctx.fill();
    
    // Add label with background
    ctx.font = 'bold 12px Arial';
    const text = 'REF';
    const textWidth = ctx.measureText(text).width;
    
    // Draw text background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - textWidth/2 - 5, y - 35, textWidth + 10, 18);
    
    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - 25);
    
    // Restore context
    ctx.restore();
}

// Update UI state based on current status
function updateUIState() {
    const captureBtn = document.getElementById('capture');
    const resetBtn = document.getElementById('reset');
    const startCameraBtn = document.getElementById('startCamera');
    const uploadImageBtn = document.getElementById('uploadImage');
    const calculateDrapeBtn = document.getElementById('calculateDrape');
    const autoCalculateBtn = document.getElementById('autoCalculate');
    
    if (originalImageMat) {
        // Image is captured/uploaded
        if (captureBtn) captureBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = false;
        if (startCameraBtn) startCameraBtn.disabled = false;
        if (uploadImageBtn) uploadImageBtn.disabled = false;
        if (calculateDrapeBtn) calculateDrapeBtn.disabled = false;
        if (autoCalculateBtn) autoCalculateBtn.disabled = false;
    } else if (streaming) {
        // Camera is streaming
        if (captureBtn) captureBtn.disabled = false;
        if (resetBtn) resetBtn.disabled = false;
        if (startCameraBtn) startCameraBtn.disabled = true;
        if (uploadImageBtn) uploadImageBtn.disabled = true;
        if (calculateDrapeBtn) calculateDrapeBtn.disabled = true;
        if (autoCalculateBtn) autoCalculateBtn.disabled = true;
    } else {
        // Initial state
        if (captureBtn) captureBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = true;
        if (startCameraBtn) startCameraBtn.disabled = false;
        if (uploadImageBtn) uploadImageBtn.disabled = false;
        if (calculateDrapeBtn) calculateDrapeBtn.disabled = true;
        if (autoCalculateBtn) autoCalculateBtn.disabled = true;
    }
}

// Capture image from camera
function captureImage() {
    if (!streaming) {
        UIUtils.showToast('Camera is not ready. Please start the camera first.', 'warning');
        return;
    }
    
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const originalCanvas = document.getElementById('originalCanvas');
    
    // Use CameraUtils to capture photo
    CameraUtils.capturePhoto()
        .then(img => {
            processUploadedImage(img);
            UIUtils.showToast('Image captured successfully', 'success');
            document.getElementById('status').textContent = 'Image captured. Click on the coin to select reference.';
        })
        .catch(error => {
            console.error('Error capturing image:', error);
            UIUtils.showToast('Failed to capture image: ' + error, 'error');
        });
}

// Process image with reference using OpenCV
async function processImageWithReference() {
    if (!originalImageMat || !referencePoint || isProcessing) {
        console.error('Cannot process: missing data');
        return;
    }
    
    isProcessing = true;
    UIUtils.showLoading(true, 'Processing image...');
    
    try {
        // Get reference diameter using DrapeFormulas
        const refType = document.getElementById('refType').value;
        const customDiameter = parseFloat(document.getElementById('refDiameter').value) || 2.5;
        const referenceDiameterCM = DrapeFormulas.getReferenceDiameter(refType, customDiameter);
        
        console.log('Reference diameter (cm):', referenceDiameterCM);
        
        // Detect reference object and calculate pixel-to-cm ratio
        const referenceRadiusPixels = detectReferenceObject(originalImageMat, referencePoint.actualX, referencePoint.actualY);
        
        console.log('Detected reference radius (pixels):', referenceRadiusPixels);
        
        if (referenceRadiusPixels <= 0) {
            throw new Error('Could not detect reference object. Please click precisely on the coin.');
        }
        
        // Calculate pixel to cm ratio
        const pixelToCmRatio = referenceDiameterCM / (referenceRadiusPixels * 2);
        console.log('Pixel to cm ratio:', pixelToCmRatio);
        
        // Detect drape area
        const drapeAreaPixels = detectDrapeArea(originalImageMat);
        console.log('Drape area (pixels):', drapeAreaPixels);
        
        if (drapeAreaPixels <= 0) {
            throw new Error('Could not detect drape area. Please ensure good lighting and contrast.');
        }
        
        // Calculate actual area using DrapeFormulas
        const drapeAreaCm2 = DrapeFormulas.calculateActualArea(drapeAreaPixels, pixelToCmRatio);
        console.log('Drape area (cm²):', drapeAreaCm2);
        
        // Update results
        document.getElementById('pixelArea').textContent = Math.round(drapeAreaPixels);
        document.getElementById('actualArea').textContent = drapeAreaCm2.toFixed(2);
        
        // Calculate drape coefficient using Validation
        const diskDiameter = parseFloat(document.getElementById('diskDiameter').value) || 18.0;
        const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value) || 30.0;
        
        const validation = Validation.validateDrapeInputs(diskDiameter, fabricDiameter);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        const drapeCoefficient = DrapeFormulas.drapeCoefficient(drapeAreaCm2, diskDiameter, fabricDiameter);
        document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
        
        // Add to history
        addToHistory(drapeAreaCm2, drapeCoefficient);
        
        // Create and display processed image
        createProcessedImage();
        
        document.getElementById('status').textContent = 'Analysis complete';
        UIUtils.showToast('Image analysis completed successfully', 'success');
        
        console.log('Image processed successfully');
        
    } catch (error) {
        console.error('Error processing image:', error);
        UIUtils.showToast('Error: ' + error.message, 'error');
        document.getElementById('status').textContent = 'Error: ' + error.message;
    } finally {
        isProcessing = false;
        UIUtils.showLoading(false);
    }
}
function processUploadedImage(img) {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const originalCanvas = document.getElementById('originalCanvas');
    
    // Hide video
    video.style.display = 'none';
    
    // Store actual dimensions
    actualWidth = img.naturalWidth || img.width;
    actualHeight = img.naturalHeight || img.height;
    
    console.log('Image dimensions:', actualWidth, 'x', actualHeight);
    
    // Set processing canvas to actual image size
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    // Draw image to processing canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, actualWidth, actualHeight);
    
    // Calculate display size (max 400px width)
    const maxDisplayWidth = 400;
    const maxDisplayHeight = 300;
    
    let displayWidth = actualWidth;
    let displayHeight = actualHeight;
    
    if (displayWidth > maxDisplayWidth) {
        const ratio = maxDisplayWidth / displayWidth;
        displayWidth = maxDisplayWidth;
        displayHeight = Math.round(displayHeight * ratio);
    }
    
    if (displayHeight > maxDisplayHeight) {
        const ratio = maxDisplayHeight / displayHeight;
        displayHeight = maxDisplayHeight;
        displayWidth = Math.round(displayWidth * ratio);
    }
    
    // Set display canvas dimensions
    originalCanvas.width = displayWidth;
    originalCanvas.height = displayHeight;
    
    // Calculate scale factor
    displayScale = displayWidth / actualWidth;
    console.log('Display dimensions:', displayWidth, 'x', displayHeight);
    console.log('Display scale:', displayScale);
    
    // Draw scaled image to display canvas
    const displayCtx = originalCanvas.getContext('2d');
    displayCtx.drawImage(img, 0, 0, displayWidth, displayHeight);
    
    // Convert to OpenCV Mat
    const imageData = ctx.getImageData(0, 0, actualWidth, actualHeight);
    if (originalImageMat) {
        originalImageMat.delete();
    }
    originalImageMat = cv.matFromImageData(imageData);
    
    // Convert to RGB for OpenCV processing
    cv.cvtColor(originalImageMat, originalImageMat, cv.COLOR_RGBA2RGB);
    
    // Show canvas
    originalCanvas.style.display = 'block';
    originalCanvas.style.cursor = 'crosshair';
    
    // Reset processed canvas
    const processedCanvas = document.getElementById('processedCanvas');
    processedCanvas.style.display = 'none';
    
    // Update UI
    document.getElementById('status').textContent = 'Image loaded. Click on the reference coin for scale.';
    document.getElementById('pixelArea').textContent = '--';
    document.getElementById('actualArea').textContent = '--';
    document.getElementById('drapeCoefficient').textContent = '--';
    
    // Reset reference point
    referencePoint = null;
    
    updateUIState();
    
    console.log('Image processed successfully');
}

// Detect reference object using OpenCV
function detectReferenceObject(srcMat, clickX, clickY) {
    console.log('Detecting reference at:', clickX, clickY);
    
    // Create a region of interest around the click point
    const roiSize = 200;
    const xStart = Math.max(0, clickX - roiSize/2);
    const yStart = Math.max(0, clickY - roiSize/2);
    const xEnd = Math.min(srcMat.cols, clickX + roiSize/2);
    const yEnd = Math.min(srcMat.rows, clickY + roiSize/2);
    
    // Extract ROI
    const roiRect = new cv.Rect(xStart, yStart, xEnd - xStart, yEnd - yStart);
    const roi = srcMat.roi(roiRect);
    
    // Convert to grayscale
    let gray = new cv.Mat();
    cv.cvtColor(roi, gray, cv.COLOR_RGB2GRAY);
    
    // Apply Gaussian blur
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    
    // Detect circles using Hough Transform
    let circles = new cv.Mat();
    cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 
        1,              // dp
        20,             // minDist
        100,            // param1
        30,             // param2
        20,             // minRadius
        100             // maxRadius
    );
    
    console.log('Circles found:', circles.cols);
    
    let bestCircle = null;
    let minDistance = Infinity;
    
    // Find the circle closest to the click point
    for (let i = 0; i < circles.cols; i++) {
        const circleData = circles.data32F.subarray(i * 3, (i + 1) * 3);
        const x = circleData[0] + xStart;
        const y = circleData[1] + yStart;
        const radius = circleData[2];
        
        const distance = Math.sqrt(Math.pow(x - clickX, 2) + Math.pow(y - clickY, 2));
        
        // Prefer circles closer to click point
        if (distance < minDistance && radius > 15 && radius < 100) {
            minDistance = distance;
            bestCircle = {
                x: x,
                y: y,
                radius: radius,
                distance: distance
            };
        }
    }
    
    // Clean up
    gray.delete();
    circles.delete();
    roi.delete();
    
    // If no circle found, try edge-based detection
    if (!bestCircle || minDistance > 50) {
        console.log('No circle detected, using edge detection');
        return detectReferenceByEdges(srcMat, clickX, clickY);
    }
    
    console.log('Best circle:', bestCircle);
    return bestCircle.radius;
}
function detectReferenceByEdges(srcMat, clickX, clickY) {
    const roiSize = 150;
    const xStart = Math.max(0, clickX - roiSize/2);
    const yStart = Math.max(0, clickY - roiSize/2);
    const xEnd = Math.min(srcMat.cols, clickX + roiSize/2);
    const yEnd = Math.min(srcMat.rows, clickY + roiSize/2);
    
    const roiRect = new cv.Rect(xStart, yStart, xEnd - xStart, yEnd - yStart);
    const roi = srcMat.roi(roiRect);
    
    let gray = new cv.Mat();
    cv.cvtColor(roi, gray, cv.COLOR_RGB2GRAY);
    
    // Edge detection
    let edges = new cv.Mat();
    cv.Canny(gray, edges, 50, 150);
    
    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, 
        cv.RETR_EXTERNAL, 
        cv.CHAIN_APPROX_SIMPLE
    );
    
    let bestContour = null;
    let bestCircularity = 0;
    
    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        const perimeter = cv.arcLength(contour, true);
        
        if (perimeter > 0) {
            const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
            
            if (circularity > 0.7 && circularity > bestCircularity) {
                bestCircularity = circularity;
                bestContour = contour;
            }
        }
    }
    
    let radius = 40; // Default
    
    if (bestContour) {
        // Calculate radius from area
        const area = cv.contourArea(bestContour);
        radius = Math.sqrt(area / Math.PI);
        console.log('Edge-based radius:', radius);
    }
    
    // Clean up
    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    roi.delete();
    
    return radius;
}


// Detect drape area using OpenCV
function detectDrapeArea(srcMat) {
    console.log('Detecting drape area...');
    
    // Convert to grayscale
    let gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGB2GRAY);
    
    // Apply Gaussian blur to reduce noise
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    
    // Use adaptive threshold for better shadow detection
    let binary = new cv.Mat();
    cv.adaptiveThreshold(gray, binary, 
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV,
        11,
        2
    );
    
    // Morphological operations to clean up
    let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
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
    
    // Find the largest contour (drape area)
    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        // Filter out very small areas
        if (area > maxArea && area > 1000) {
            maxArea = area;
            largestContour = contour;
        }
    }
    
    console.log('Largest drape area (pixels):', maxArea);
    
    // If no large contour found, try a different approach
    if (maxArea === 0) {
        console.log('No contour found, trying Otsu threshold...');
        
        // Try Otsu's method
        cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            if (area > maxArea && area > 1000) {
                maxArea = area;
                largestContour = contour;
            }
        }
    }
    
    // Clean up
    gray.delete();
    binary.delete();
    kernel.delete();
    hierarchy.delete();
    
    if (largestContour) {
        largestContour.delete();
    }
    
    return maxArea;
}
// Create processed image with highlights
function createProcessedImage() {
    if (!originalImageMat || !referencePoint) return;
    
    const processedCanvas = document.getElementById('processedCanvas');
    const originalCanvas = document.getElementById('originalCanvas');
    const displayCtx = processedCanvas.getContext('2d');
    
    // Copy original canvas content
    processedCanvas.width = originalCanvas.width;
    processedCanvas.height = originalCanvas.height;
    displayCtx.drawImage(originalCanvas, 0, 0);
    
    // Highlight reference point
    displayCtx.save();
    
    const displayX = referencePoint.displayX;
    const displayY = referencePoint.displayY;
    
    // Draw reference point
    displayCtx.beginPath();
    displayCtx.arc(displayX, displayY, 12, 0, Math.PI * 2);
    displayCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    displayCtx.fill();
    displayCtx.strokeStyle = '#00ff00';
    displayCtx.lineWidth = 2;
    displayCtx.stroke();
    
    // Draw crosshair
    displayCtx.beginPath();
    displayCtx.moveTo(displayX - 10, displayY);
    displayCtx.lineTo(displayX + 10, displayY);
    displayCtx.moveTo(displayX, displayY - 10);
    displayCtx.lineTo(displayX, displayY + 10);
    displayCtx.stroke();
    
    // Draw center dot
    displayCtx.beginPath();
    displayCtx.arc(displayX, displayY, 3, 0, Math.PI * 2);
    displayCtx.fillStyle = '#00ff00';
    displayCtx.fill();
    
    // Add label
    displayCtx.font = 'bold 12px Arial';
    const text = 'REF';
    const textWidth = displayCtx.measureText(text).width;
    
    displayCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    displayCtx.fillRect(displayX - textWidth/2 - 5, displayY - 35, textWidth + 10, 18);
    
    displayCtx.fillStyle = '#ffffff';
    displayCtx.textAlign = 'center';
    displayCtx.fillText(text, displayX, displayY - 25);
    
    displayCtx.restore();
    
    // Add measurement information
    displayCtx.save();
    displayCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    displayCtx.fillRect(10, 10, 250, 80);
    
    displayCtx.fillStyle = 'white';
    displayCtx.font = 'bold 14px Arial';
    displayCtx.fillText('Measurement Results', 20, 30);
    
    displayCtx.font = '12px Arial';
    const area = document.getElementById('actualArea').textContent;
    const drape = document.getElementById('drapeCoefficient').textContent;
    displayCtx.fillText(`Area: ${area} cm²`, 20, 50);
    displayCtx.fillText(`Drape: ${drape}`, 20, 70);
    
    displayCtx.restore();
    
    // Show processed canvas
    processedCanvas.style.display = 'block';
}

// Calculate drape percentage
function calculateDrapePercentage() {
    const measuredAreaText = document.getElementById('actualArea').textContent;
    
    if (measuredAreaText === '--') {
        UIUtils.showToast('Please capture and analyze an image first', 'warning');
        return;
    }
    
    const measuredArea = parseFloat(measuredAreaText);
    
    if (isNaN(measuredArea)) {
        UIUtils.showToast('Please capture and analyze an image first', 'warning');
        return;
    }
    
    const diskDiameter = parseFloat(document.getElementById('diskDiameter').value) || 18.0;
    const fabricDiameter = parseFloat(document.getElementById('fabricDiameter').value) || 30.0;
    
    const validation = Validation.validateDrapeInputs(diskDiameter, fabricDiameter);
    if (!validation.valid) {
        UIUtils.showToast(validation.error, 'error');
        return;
    }
    
    const drapeCoefficient = DrapeFormulas.drapeCoefficient(measuredArea, diskDiameter, fabricDiameter);
    
    document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
    addToHistory(measuredArea, drapeCoefficient);
    
    UIUtils.showToast('Drape coefficient calculated', 'success');
}

// Auto calculate drape
function autoCalculateDrape() {
    if (!originalImageMat) {
        UIUtils.showToast('Please capture or upload an image first', 'warning');
        return;
    }
    
    if (!referencePoint) {
        UIUtils.showToast('Please select reference point first by clicking on the coin', 'warning');
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
    UIUtils.showToast('Measurement deleted', 'success');
}

// Clear history
function clearHistory() {
    if (measurementHistory.length === 0) {
        UIUtils.showToast('No measurements to clear', 'warning');
        return;
    }
    
    if (confirm('Are you sure you want to clear all measurement history?')) {
        measurementHistory = [];
        updateHistoryTable();
        saveHistory();
        UIUtils.showToast('History cleared', 'success');
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
        UIUtils.showToast('No measurements to export', 'warning');
        return;
    }
    
    // Use FileUtils from utils.js
    FileUtils.saveCSV(measurementHistory, `drape-measurements-${new Date().toISOString().slice(0,10)}.csv`);
    UIUtils.showToast('Data exported successfully', 'success');
}

// Reset application
function resetApp() {
    // Stop camera using CameraUtils
    CameraUtils.stopCamera();
    
    // Reset OpenCV mats
    if (originalImageMat) {
        originalImageMat.delete();
        originalImageMat = null;
    }
    
    // Reset displays
    const video = document.getElementById('cameraVideo');
    const originalCanvas = document.getElementById('originalCanvas');
    const processedCanvas = document.getElementById('processedCanvas');
    
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
    
    // Reset level indicator using UIUtils
    UIUtils.resetLevelIndicator();
    
    // Clear stored data
    capturedImage = null;
    referencePoint = null;
    streaming = false;
    isProcessing = false;
    displayScale = 1;
    
    // Update UI
    updateUIState();
    
    UIUtils.showToast('Application reset', 'info');
}

// Initialize when page loads (fallback)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Make deleteMeasurement available globally
window.deleteMeasurement = deleteMeasurement;
