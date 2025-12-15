// Drape Area Calculator - Fixed Reference Point Selection

// Global variables
let stream = null;
let streaming = false;
let capturedImage = null;
let referencePoint = null;
let measurementHistory = [];
let isProcessing = false;
let cv = null; // OpenCV instance
let originalImageMat = null;
let processedImageMat = null;
let displayScale = 1;
let actualWidth = 0;
let actualHeight = 0;
let imageDataURL = null; // Store original image data URL

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
    
    // Start Camera button
    const startCameraBtn = document.getElementById('startCamera');
    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', startCamera);
        console.log('Start Camera button listener added');
    } else {
        console.error('Start Camera button not found!');
    }
    
    // Upload Image button
    const uploadImageBtn = document.getElementById('uploadImage');
    if (uploadImageBtn) {
        uploadImageBtn.addEventListener('click', () => {
            console.log('Upload Image button clicked');
            document.getElementById('fileInput').click();
        });
        console.log('Upload Image button listener added');
    } else {
        console.error('Upload Image button not found!');
    }
    
    // File input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleImageUpload);
        console.log('File input listener added');
    } else {
        console.error('File input not found!');
    }
    
    // Capture button
    const captureBtn = document.getElementById('capture');
    if (captureBtn) {
        captureBtn.addEventListener('click', captureImage);
        console.log('Capture button listener added');
    } else {
        console.error('Capture button not found!');
    }
    
    // Reset button
    const resetBtn = document.getElementById('reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetApp);
        console.log('Reset button listener added');
    } else {
        console.error('Reset button not found!');
    }
    
    // Calculate Drape button
    const calculateDrapeBtn = document.getElementById('calculateDrape');
    if (calculateDrapeBtn) {
        calculateDrapeBtn.addEventListener('click', calculateDrapePercentage);
        console.log('Calculate Drape button listener added');
    } else {
        console.error('Calculate Drape button not found!');
    }
    
    // Auto Calculate button
    const autoCalculateBtn = document.getElementById('autoCalculate');
    if (autoCalculateBtn) {
        autoCalculateBtn.addEventListener('click', autoCalculateDrape);
        console.log('Auto Calculate button listener added');
    } else {
        console.error('Auto Calculate button not found!');
    }
    
    // Export CSV button
    const exportDataBtn = document.getElementById('exportData');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportToCSV);
        console.log('Export Data button listener added');
    } else {
        console.error('Export Data button not found!');
    }
    
    // Clear History button
    const clearHistoryBtn = document.getElementById('clearHistory');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearHistory);
        console.log('Clear History button listener added');
    } else {
        console.error('Clear History button not found!');
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
    
    // Canvas click for reference selection - FIXED
    const originalCanvas = document.getElementById('originalCanvas');
    if (originalCanvas) {
        originalCanvas.addEventListener('click', handleCanvasClick);
        console.log('Canvas click listener added');
    }
    
    console.log('All event listeners set up');
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
    const beta = event.beta;  // front-to-back tilt (-180 to 180)
    const gamma = event.gamma; // left-to-right tilt (-90 to 90)
    
    if (beta !== null && gamma !== null) {
        // Calculate overall tilt angle
        const angle = Math.sqrt(beta * beta + gamma * gamma);
        
        // Update level indicator
        const bubbleCenter = document.querySelector('.bubble-center');
        const levelStatus = document.getElementById('levelStatus');
        
        if (bubbleCenter && levelStatus) {
            // Calculate bubble position
            const maxTilt = 45;
            const maxMovement = 18;
            
            const normX = Math.max(Math.min(gamma / maxTilt, 1), -1);
            const normY = Math.max(Math.min(beta / maxTilt, 1), -1);
            
            const posX = normX * maxMovement;
            const posY = normY * maxMovement;
            
            bubbleCenter.style.transform = `translate(-50%, -50%) translate(${posX}px, ${posY}px)`;
            
            // Update angle display
            levelStatus.textContent = angle.toFixed(1);
            
            // Update color based on angle
            if (angle < 2) {
                bubbleCenter.style.background = '#00ff00';
                bubbleCenter.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.7)';
                levelStatus.style.color = '#00ff00';
            } else if (angle < 5) {
                bubbleCenter.style.background = '#ffff00';
                bubbleCenter.style.boxShadow = '0 0 10px rgba(255, 255, 0, 0.7)';
                levelStatus.style.color = '#ffff00';
            } else {
                bubbleCenter.style.background = '#ff0000';
                bubbleCenter.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.7)';
                levelStatus.style.color = '#ff0000';
            }
        }
    }
}

// FIXED: Handle canvas click for reference selection
function handleCanvasClick(event) {
    if (!originalImageMat) {
        alert('Please capture or upload an image first');
        return;
    }
    
    const canvas = event.target;
    
    // Use the fixed utility function
    const clickData = ImageUtils.calculateCanvasClick(
        event, 
        canvas, 
        actualWidth, 
        actualHeight
    );
    
    // Validate the click
    const validation = Validation.validateCanvasClick(
        clickData, 
        canvas, 
        actualWidth, 
        actualHeight
    );
    
    if (!validation.valid) {
        alert(validation.error);
        return;
    }
    
    // Store reference point
    referencePoint = {
        displayX: clickData.clickX,
        displayY: clickData.clickY,
        actualX: clickData.actualX,
        actualY: clickData.actualY,
        canvasX: clickData.canvasX,
        canvasY: clickData.canvasY
    };
    
    console.log('Reference point selected:', referencePoint);
    
    // Draw visual feedback
    UIUtils.drawReferenceMarkerOnCanvas(canvas, clickData.clickX, clickData.clickY);
    UIUtils.createClickFeedback(clickData.clickX, clickData.clickY);
    
    // Process image
    setTimeout(() => {
        processImageWithReference();
    }, 300);
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
    
    // Force canvas redraw
    canvas.style.display = 'none';
    canvas.style.display = 'block';
}

// Create click feedback animation
function createClickFeedback(x, y) {
    const feedback = document.createElement('div');
    feedback.className = 'click-feedback';
    feedback.style.left = (x - 15) + 'px';
    feedback.style.top = (y - 15) + 'px';
    
    const cameraContainer = document.querySelector('.camera-container');
    cameraContainer.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 500);
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
        if (startCameraBtn) startCameraBtn.disabled = true;
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

// Start camera function
async function startCamera() {
    console.log('Starting camera...');
    
    const video = document.getElementById('video');
    const statusElement = document.getElementById('status');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera access is not supported in your browser. Please use Chrome, Firefox, or Edge.');
        return;
    }
    
    try {
        statusElement.textContent = 'Requesting camera access...';
        
        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false 
        });
        
        video.srcObject = stream;
        
        // Wait for video to start
        await video.play();
        
        streaming = true;
        statusElement.textContent = 'Camera ready. Click "Capture & Analyze" when ready.';
        
        // Update UI
        updateUIState();
        
        console.log('Camera started successfully');
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        
        let errorMessage = 'Could not access camera: ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Camera permission denied. Please allow camera access.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No camera found on your device.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += 'Camera is already in use by another application.';
        } else {
            errorMessage += error.message;
        }
        
        statusElement.textContent = errorMessage;
        alert(errorMessage);
    }
}

// Handle image upload
function handleImageUpload(event) {
    console.log('Handling image upload...');
    
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if it's an image
    if (!file.type.match('image.*')) {
        alert('Please select an image file (JPEG, PNG, etc.)');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = new Image();
        
        img.onload = function() {
            processUploadedImage(img);
            imageDataURL = e.target.result; // Store for later use
        };
        
        img.onerror = function() {
            alert('Error loading image. Please try another image.');
            document.getElementById('status').textContent = 'Error loading image';
        };
        
        img.src = e.target.result;
    };
    
    reader.onerror = function() {
        alert('Error reading file. Please try again.');
        document.getElementById('status').textContent = 'Error reading file';
    };
    
    reader.readAsDataURL(file);
}

// Process uploaded image
function processUploadedImage(img) {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
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
    const maxWidth = originalCanvas.parentElement.clientWidth - 40; // Account for padding
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

// Capture image from camera
function captureImage() {
    console.log('Capturing image...');
    
    if (!streaming) {
        alert('Camera is not ready. Please start the camera first.');
        return;
    }
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const originalCanvas = document.getElementById('originalCanvas');
    
    // Set canvas to video dimensions
    actualWidth = video.videoWidth;
    actualHeight = video.videoHeight;
    
    console.log('Video dimensions:', actualWidth, 'x', actualHeight);
    
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
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, actualWidth, actualHeight);
    
    // Convert to OpenCV Mat
    const imageData = ctx.getImageData(0, 0, actualWidth, actualHeight);
    originalImageMat = cv.matFromImageData(imageData);
    
    // Save as data URL for later use
    imageDataURL = canvas.toDataURL('image/png');
    
    // Draw to display canvas
    const displayCtx = originalCanvas.getContext('2d');
    displayCtx.drawImage(video, 0, 0, displayWidth, displayHeight);
    
    // Show canvas, hide video
    video.style.display = 'none';
    originalCanvas.style.display = 'block';
    
    // Update UI
    document.getElementById('status').textContent = 'Image captured. Click on the coin to select reference.';
    updateUIState();
    
    // Reset reference point
    referencePoint = null;
    
    console.log('Image captured successfully');
}

// Process image with reference using OpenCV
async function processImageWithReference() {
    if (!originalImageMat || !referencePoint || isProcessing) {
        console.error('Cannot process: missing data');
        return;
    }
    
    isProcessing = true;
    document.getElementById('status').textContent = 'Processing image...';
    
    try {
        // Get reference diameter
        const refType = document.getElementById('refType').value;
        const customDiameter = parseFloat(document.getElementById('refDiameter').value) || 2.5;
        const referenceDiameterCM = getReferenceDiameter(refType, customDiameter);
        
        console.log('Reference diameter (cm):', referenceDiameterCM);
        console.log('Reference point (actual):', referencePoint.actualX, referencePoint.actualY);
        
        // Detect reference object (coin) and calculate pixel-to-cm ratio
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
        
        // Calculate actual area
        const drapeAreaCm2 = drapeAreaPixels * pixelToCmRatio * pixelToCmRatio;
        console.log('Drape area (cm²):', drapeAreaCm2);
        
        // Update results
        document.getElementById('pixelArea').textContent = Math.round(drapeAreaPixels);
        document.getElementById('actualArea').textContent = drapeAreaCm2.toFixed(2);
        
        // Calculate drape coefficient
        const drapeCoefficient = calculateDrapeCoefficient(drapeAreaCm2);
        if (drapeCoefficient !== null) {
            document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
            addToHistory(drapeAreaCm2, drapeCoefficient);
        }
        
        // Create and display processed image
        createProcessedImage();
        
        document.getElementById('status').textContent = 'Analysis complete';
        
        console.log('Image processed successfully');
        
    } catch (error) {
        console.error('Error processing image:', error);
        document.getElementById('status').textContent = 'Error: ' + error.message;
        alert('Error processing image: ' + error.message);
    } finally {
        isProcessing = false;
    }
}

// Detect reference object using OpenCV
function detectReferenceObject(srcMat, clickX, clickY) {
    // Create a copy for processing
    let processedMat = new cv.Mat();
    cv.cvtColor(srcMat, processedMat, cv.COLOR_RGBA2GRAY);
    
    // Apply Gaussian blur
    cv.GaussianBlur(processedMat, processedMat, new cv.Size(5, 5), 0);
    
    // Detect circles using Hough Transform
    let circles = new cv.Mat();
    cv.HoughCircles(processedMat, circles, cv.HOUGH_GRADIENT, 
        1, // dp
        30, // minDist (increased for better detection)
        100, // param1
        30, // param2 (lowered for better detection)
        20, // minRadius
        150 // maxRadius
    );
    
    console.log('Circles found:', circles.cols);
    
    let detectedRadius = 0;
    let minDistance = Infinity;
    
    // Find the circle closest to the click point
    for (let i = 0; i < circles.cols; i++) {
        let circle = circles.data32F.slice(i * 3, (i + 1) * 3);
        let x = circle[0];
        let y = circle[1];
        let radius = circle[2];
        
        // Calculate distance from click point
        let distance = Math.sqrt(Math.pow(x - clickX, 2) + Math.pow(y - clickY, 2));
        
        console.log(`Circle ${i}: x=${x.toFixed(1)}, y=${y.toFixed(1)}, r=${radius.toFixed(1)}, dist=${distance.toFixed(1)}`);
        
        if (distance < minDistance) {
            minDistance = distance;
            detectedRadius = radius;
        }
    }
    
    // Clean up
    processedMat.delete();
    circles.delete();
    
    // If no circle detected or too far from click, use a reasonable default
    if (detectedRadius <= 0 || minDistance > 100) {
        console.log('No circle detected near click, using default radius');
        return 40; // Default reasonable radius in pixels
    }
    
    console.log('Selected circle radius:', detectedRadius, 'pixels, distance:', minDistance);
    return detectedRadius;
}

// Detect drape area using OpenCV
function detectDrapeArea(srcMat) {
    // Create a copy for processing
    let processedMat = new cv.Mat();
    cv.cvtColor(srcMat, processedMat, cv.COLOR_RGBA2GRAY);
    
    // Apply Gaussian blur
    cv.GaussianBlur(processedMat, processedMat, new cv.Size(5, 5), 0);
    
    // Apply threshold to highlight dark areas (drape shadow)
    let thresholdMat = new cv.Mat();
    cv.adaptiveThreshold(processedMat, thresholdMat, 
        255, // max value
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV,
        11, // block size
        2 // constant
    );
    
    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(thresholdMat, contours, hierarchy, 
        cv.RETR_EXTERNAL, 
        cv.CHAIN_APPROX_SIMPLE
    );
    
    let maxArea = 0;
    
    // Find the largest contour (likely the drape area)
    for (let i = 0; i < contours.size(); i++) {
        let contour = contours.get(i);
        let area = cv.contourArea(contour);
        
        if (area > maxArea) {
            maxArea = area;
            // Store for processed image
            if (window.largestContour) {
                window.largestContour.delete();
            }
            window.largestContour = contour.clone();
        }
    }
    
    // Clean up
    processedMat.delete();
    thresholdMat.delete();
    hierarchy.delete();
    
    return maxArea;
}

// Create processed image with highlights
function createProcessedImage() {
    if (!originalImageMat || !referencePoint) return;
    
    const processedCanvas = document.getElementById('processedCanvas');
    const displayCtx = processedCanvas.getContext('2d');
    
    // Set canvas dimensions
    processedCanvas.width = originalImageMat.cols * displayScale;
    processedCanvas.height = originalImageMat.rows * displayScale;
    
    // Convert OpenCV Mat to ImageData for display
    let displayMat = new cv.Mat();
    cv.resize(originalImageMat, displayMat, 
        new cv.Size(processedCanvas.width, processedCanvas.height),
        0, 0, cv.INTER_LINEAR
    );
    
    // Convert to RGB for drawing
    cv.cvtColor(displayMat, displayMat, cv.COLOR_RGBA2RGB);
    
    // Create ImageData
    const imageData = new ImageData(
        new Uint8ClampedArray(displayMat.data),
        displayMat.cols,
        displayMat.rows
    );
    
    // Draw original image
    displayCtx.putImageData(imageData, 0, 0);
    
    // Highlight drape area if contour is available
    if (window.largestContour) {
        displayCtx.save();
        
        // Scale context for contour drawing
        displayCtx.scale(displayScale, displayScale);
        
        // Draw drape area with transparency
        displayCtx.beginPath();
        
        // Convert contour points to path
        const contour = window.largestContour;
        const points = [];
        
        for (let i = 0; i < contour.data32S.length; i += 2) {
            const x = contour.data32S[i];
            const y = contour.data32S[i + 1];
            points.push({x, y});
            
            if (i === 0) {
                displayCtx.moveTo(x, y);
            } else {
                displayCtx.lineTo(x, y);
            }
        }
        
        if (points.length > 0) {
            displayCtx.lineTo(points[0].x, points[0].y);
        }
        
        // Fill with semi-transparent color
        displayCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        displayCtx.fill();
        
        // Draw contour outline
        displayCtx.strokeStyle = '#ff0000';
        displayCtx.lineWidth = 3;
        displayCtx.stroke();
        
        displayCtx.restore();
    }
    
    // Highlight reference point
    displayCtx.save();
    
    const displayX = referencePoint.displayX;
    const displayY = referencePoint.displayY;
    
    // Draw reference point circle
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
    displayCtx.strokeStyle = '#00ff00';
    displayCtx.lineWidth = 2;
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
    
    // Draw text background
    displayCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    displayCtx.fillRect(displayX - textWidth/2 - 5, displayY - 35, textWidth + 10, 18);
    
    // Draw text
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
    
    // Clean up
    displayMat.delete();
}

// Get reference diameter based on type
function getReferenceDiameter(refType, customDiameter) {
    switch(refType) {
        case 'coin2':
            return 2.5; // Indian 2 Rupee Coin
        case 'coin10':
            return 2.7; // Indian 10 Rupee Coin
        case 'custom':
            return parseFloat(customDiameter) || 2.5;
        default:
            return 2.5; // Default to 2 Rupee coin
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
