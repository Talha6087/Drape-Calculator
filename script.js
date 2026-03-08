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
  detectedDisk: null,

  // Workflow state
  workflowStep: 'coin', // 'coin' -> 'disk' -> 'complete'

  // Zoom state
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },

  // Level indicator state
  levelIndicatorActive: false,
  levelUpdateInterval: null,

  // Image display info
  imageDisplayInfo: {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    imgWidth: 0,
    imgHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
  },

  // Measurement data
  drapeArea: 0, // fabric-only drape area (cm²) for display
  drapePixelArea: 0, // fabric-only drape area (px²) for display
  drapeAreaTotal: 0, // total shadow area including disk (cm²) for coefficient
  drapePixelAreaTotal: 0, // total shadow area including disk (px²)
  shapeLength: 0,
  shapeWidth: 0,
  shapeArea: 0,
  referencePixelArea: 0,
  referenceAreaCm2: 0,
  measurements: [],

  // Coin measurement data
  coinPixelArea: 0,
  coinAreaCm2: 0,

  // UI selection: what to show area for in the reference panel
  refTarget: 'coin',

  // Settings
  referenceDiameter: 2.5,
  diskDiameter: 18.0,
  fabricDiameter: 30.0,
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

  // Upload button - trigger file input click
  document
    .getElementById('uploadImage')
    .addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Upload button clicked');
      document.getElementById('imageUpload').click();
    });

  // Image upload handler
  document
    .getElementById('imageUpload')
    .addEventListener('change', handleImageUpload);

  // Reset button
  document.getElementById('reset').addEventListener('click', resetApp);

  // Capture button
  document.getElementById('capture').addEventListener('click', captureImage);

  // Canvas click for coin detection
  AppState.mainCanvas.addEventListener('click', handleCanvasClick);
  AppState.mainCanvas.addEventListener('touchstart', handleCanvasTouch, {
    passive: false,
  });

  // Zoom controls
  document.getElementById('zoomIn').addEventListener('click', function () {
    adjustZoom(1.2);
  });
  document.getElementById('zoomOut').addEventListener('click', function () {
    adjustZoom(0.8);
  });
  document.getElementById('resetZoom').addEventListener('click', resetZoom);

  // Measure target dropdown (coin vs shape)
  const refTargetSelect = document.getElementById('refTarget');
  if (refTargetSelect) {
    refTargetSelect.addEventListener('change', function () {
      AppState.refTarget = this.value || 'coin';
      updateTargetAreaDisplays();
    });
  }

  // Reference coin type dropdown
  document.getElementById('refType').addEventListener('change', function () {
    const refType = this.value;
    const customDiv = document.getElementById('customRef');

    if (refType === 'custom') {
      customDiv.style.display = 'block';
    } else {
      customDiv.style.display = 'none';
      // Set reference diameter based on coin type
      switch (refType) {
        case 'coin':
          AppState.referenceDiameter = 2.5;
          break;
        case 'coin2':
          AppState.referenceDiameter = 2.7;
          break;
        case 'coin5':
          AppState.referenceDiameter = 2.5;
          break;
      }
      // Recalculate scale if coin is detected
      if (AppState.detectedCoin) {
        updateScaleFactor();
          updateCoinAreaDisplay();
      }
    }
  });

  // Custom reference diameter
  document
    .getElementById('refDiameter')
    .addEventListener('change', function () {
      const diameter = parseFloat(this.value);
      if (diameter > 0) {
        AppState.referenceDiameter = diameter;
        // Recalculate scale if coin is detected
        if (AppState.detectedCoin) {
          updateScaleFactor();
          updateCoinAreaDisplay();
        }
      }
    });

  // Clear reference button
  document
    .getElementById('clearReference')
    .addEventListener('click', clearReference);

  // Export and save buttons
  document.getElementById('exportData').addEventListener('click', exportToCSV);
  document
    .getElementById('saveImage')
    .addEventListener('click', saveResultImage);

  // Drape tester settings
  document
    .getElementById('diskDiameter')
    .addEventListener('change', function () {
      AppState.diskDiameter = parseFloat(this.value) || 18.0;
    });
  document
    .getElementById('fabricDiameter')
    .addEventListener('change', function () {
      AppState.fabricDiameter = parseFloat(this.value) || 30.0;
    });

  // Shape square size selector (1x1 to 5x5 cm)
  const shapeSquareSelect = document.getElementById('shapeSquareSize');
  if (shapeSquareSelect) {
    const updateShapeFromSelect = () => {
      const side = parseFloat(shapeSquareSelect.value);

      if (!isNaN(side) && side > 0) {
        AppState.shapeLength = side;
        AppState.shapeWidth = side;
        AppState.shapeArea = side * side;
      } else {
        AppState.shapeLength = 0;
        AppState.shapeWidth = 0;
        AppState.shapeArea = 0;
      }

      const shapeAreaEl = document.getElementById('shapeAreaValue');
      if (shapeAreaEl) {
        shapeAreaEl.textContent =
          AppState.shapeArea && AppState.shapeArea > 0
            ? AppState.shapeArea.toFixed(2)
            : '--';
      }

      updateTargetAreaDisplays();
    };

    shapeSquareSelect.addEventListener('change', updateShapeFromSelect);
    // Initialise with current selected value
    updateShapeFromSelect();
  }

  console.log('Event listeners initialized successfully');
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

    // Use simpler constraints for faster initialization on mobile
    const constraints = {
      video: {
        facingMode: 'environment',
      },
    };

    console.log('Requesting camera with constraints:', constraints);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Camera access granted');

    AppState.video.srcObject = stream;
    AppState.isCameraActive = true;
    // Keep video element hidden - we render it to canvas instead
    AppState.video.style.display = 'none';

    // Hide click instruction when camera is active
    const clickInstruction = document.querySelector('.click-instruction');
    if (clickInstruction) {
      clickInstruction.style.display = 'none';
    }

    // Enable/disable buttons
    document.getElementById('startCamera').disabled = true;
    document.getElementById('uploadImage').disabled = true;
    document.getElementById('capture').disabled = false;
    document.getElementById('reset').disabled = false;

    // Play video and wait for it to be ready
    await AppState.video.play();

    // Wait for video metadata to be loaded (use multiple events for better mobile compatibility)
    await new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error('Camera initialization timeout'));
        }
      }, 10000); // 10 second timeout

      const cleanup = () => {
        AppState.video.removeEventListener('loadedmetadata', onReady);
        AppState.video.removeEventListener('canplay', onReady);
        AppState.video.removeEventListener('playing', onReady);
      };

      const onReady = () => {
        if (resolved) return;
        
        // Check if video dimensions are available
        if (AppState.video.videoWidth > 0 && AppState.video.videoHeight > 0) {
          clearTimeout(timeout);
          resolved = true;
          cleanup();
          
          console.log(
            'Video metadata loaded:',
            AppState.video.videoWidth,
            'x',
            AppState.video.videoHeight
          );
          AppState.imageDisplayInfo.imgWidth = AppState.video.videoWidth;
          AppState.imageDisplayInfo.imgHeight = AppState.video.videoHeight;

          // Start video rendering
          requestAnimationFrame(renderVideo);

          // Show circular guide and level indicator
          showCameraOverlays();

          // Hide loading spinner
          UIUtils.showLoading(false);

          updateStatus(
            'Camera active. Position drape and coin, then click "Capture Image"'
          );
          UIUtils.showToast('Camera started successfully', 'success');
          resolve();
        }
      };

      // Check if already ready
      if (AppState.video.readyState >= 1 && AppState.video.videoWidth > 0) {
        onReady();
      } else {
        // Listen to multiple events for better compatibility
        AppState.video.addEventListener('loadedmetadata', onReady);
        AppState.video.addEventListener('canplay', onReady);
        AppState.video.addEventListener('playing', onReady);
      }
    });
  } catch (error) {
    console.error('Error accessing camera:', error);
    updateStatus('Error: Could not access camera');
    UIUtils.showToast('Camera error: ' + error.message, 'error');

    // Show detailed error message
    let errorMessage = 'Camera access denied. ';
    if (
      error.name === 'NotFoundError' ||
      error.name === 'DevicesNotFoundError'
    ) {
      errorMessage += 'No camera found.';
    } else if (
      error.name === 'NotReadableError' ||
      error.name === 'TrackStartError'
    ) {
      errorMessage += 'Camera is already in use by another application.';
    } else if (
      error.name === 'OverconstrainedError' ||
      error.name === 'ConstraintNotSatisfiedError'
    ) {
      errorMessage += 'Camera constraints could not be satisfied.';
    } else if (
      error.name === 'NotAllowedError' ||
      error.name === 'PermissionDeniedError'
    ) {
      errorMessage += 'Camera permission denied. Please allow camera access.';
    } else if (
      error.name === 'TypeError' ||
      error.message.includes('getUserMedia')
    ) {
      errorMessage += 'Camera API not supported. Try Chrome, Firefox, or Edge.';
    } else {
      errorMessage += error.message;
    }

    alert(errorMessage);
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
    const imageData = tempCtx.getImageData(
      0,
      0,
      tempCanvas.width,
      tempCanvas.height
    );

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

    console.log(
      'Image converted to OpenCV Mat:',
      AppState.capturedImage.cols,
      'x',
      AppState.capturedImage.rows
    );

    // Display image
    displayImageOnMainCanvas(AppState.capturedImage);

    // Show output canvas
    cv.imshow(AppState.outputCanvas, AppState.capturedImage);

    // Enable controls
    document.getElementById('capture').disabled = false;
    document.getElementById('reset').disabled = false;

    updateStatus('Image loaded. STEP 1: Click on the coin...');
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
  if (
    !video.videoWidth ||
    !video.videoHeight ||
    video.videoWidth === 0 ||
    video.videoHeight === 0
  ) {
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

// Show camera overlays (circular guide and level indicator)
function showCameraOverlays() {
  const circularGuide = document.getElementById('circularGuide');
  const levelIndicator = document.getElementById('levelIndicator');
  
  if (circularGuide) {
    circularGuide.style.display = 'block';
  }
  
  if (levelIndicator) {
    levelIndicator.style.display = 'flex';
    startLevelIndicator();
  }
}

// Hide camera overlays
function hideCameraOverlays() {
  const circularGuide = document.getElementById('circularGuide');
  const levelIndicator = document.getElementById('levelIndicator');
  
  if (circularGuide) {
    circularGuide.style.display = 'none';
  }
  
  if (levelIndicator) {
    levelIndicator.style.display = 'none';
    stopLevelIndicator();
  }
}

// Start level indicator using device orientation
function startLevelIndicator() {
  if (AppState.levelIndicatorActive) return;
  
  AppState.levelIndicatorActive = true;
  
  // Request device orientation permission (iOS 13+)
  if (typeof DeviceOrientationEvent !== 'undefined' && 
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleDeviceOrientation);
        }
      })
      .catch(err => console.log('Device orientation permission error:', err));
  } else {
    // For browsers that don't require permission
    window.addEventListener('deviceorientation', handleDeviceOrientation);
  }
  
  // Fallback: Use screen orientation if device orientation not available
  if (!window.DeviceOrientationEvent) {
    // Use a simple visual indicator based on screen orientation
    AppState.levelUpdateInterval = setInterval(() => {
      updateLevelIndicatorFallback();
    }, 100);
  }
}

// Stop level indicator
function stopLevelIndicator() {
  if (!AppState.levelIndicatorActive) return;
  
  AppState.levelIndicatorActive = false;
  window.removeEventListener('deviceorientation', handleDeviceOrientation);
  
  if (AppState.levelUpdateInterval) {
    clearInterval(AppState.levelUpdateInterval);
    AppState.levelUpdateInterval = null;
  }
  
  // Reset level dot position
  const levelDot = document.querySelector('.level-dot');
  if (levelDot) {
    levelDot.style.transform = 'translate(-50%, -50%)';
  }
}

// Handle device orientation event
function handleDeviceOrientation(event) {
  if (!AppState.levelIndicatorActive) return;
  
  // Beta is the front-to-back tilt (X axis) - what we want for level
  // Gamma is the left-to-right tilt (Y axis)
  const beta = event.beta; // -180 to 180, 0 is flat
  const gamma = event.gamma; // -90 to 90, 0 is upright
  
  // Update level indicator
  updateLevelIndicator(beta, gamma);
}

// Update level indicator based on orientation
function updateLevelIndicator(beta, gamma) {
  const levelDot = document.querySelector('.level-dot');
  if (!levelDot) return;
  
  // Beta ranges from -180 to 180, where 0 is flat
  // We want to show tilt based on beta (front-to-back)
  // Max tilt range: -45 to 45 degrees for visual purposes
  const maxTilt = 30;
  const normalizedBeta = Math.max(-maxTilt, Math.min(maxTilt, beta));
  const normalizedGamma = Math.max(-maxTilt, Math.min(maxTilt, gamma));
  
  // Calculate position (in percentage of bubble radius)
  // The bubble is 60px, so radius is 30px
  // We want to move the dot within the bubble
  const maxOffset = 22; // Leave some margin
  const xOffset = (normalizedGamma / maxTilt) * maxOffset;
  const yOffset = (normalizedBeta / maxTilt) * maxOffset;
  
  // Update dot position
  levelDot.style.transform = `translate(calc(-50% + ${xOffset}px), calc(-50% + ${yOffset}px))`;
  
  // Change color based on how level it is
  const distance = Math.sqrt(xOffset * xOffset + yOffset * yOffset);
  if (distance < 5) {
    // Very level - green
    levelDot.style.background = '#2ecc71';
  } else if (distance < 15) {
    // Getting close - orange
    levelDot.style.background = '#f39c12';
  } else {
    // Not level - red
    levelDot.style.background = '#e74c3c';
  }
}

// Fallback level indicator (when device orientation not available)
function updateLevelIndicatorFallback() {
  const levelDot = document.querySelector('.level-dot');
  if (!levelDot) return;
  
  // Simple random movement for demonstration
  // In a real app, you might use screen orientation API or other methods
  levelDot.style.background = '#95a5a6';
  levelDot.style.transform = 'translate(-50%, -50%)';
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
    ctx.drawImage(
      tempCanvas,
      scaledOffsetX,
      scaledOffsetY,
      scaledWidth,
      scaledHeight
    );
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

// Handle canvas click for reference detection (coin or shape)
function handleCanvasClick(event) {
  if (!AppState.capturedImage || AppState.isProcessing) {
    UIUtils.showToast('Please load an image first', 'error');
    return;
  }

  // Get click coordinates relative to canvas
  const rect = AppState.mainCanvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  // Scale click coordinates to match canvas internal resolution
  // (CSS may display canvas at different size than internal resolution)
  const scaleX = AppState.mainCanvas.width / rect.width;
  const scaleY = AppState.mainCanvas.height / rect.height;

  const x = clickX * scaleX;
  const y = clickY * scaleY;

  console.log('Canvas clicked at:', clickX, clickY, '-> scaled:', x, y);

  // Multi-step workflow: coin -> disk -> drape calculation
  if (AppState.workflowStep === 'coin') {
    // Step 1: Detect coin for reference
    detectCoin(x, y);
  } else if (AppState.workflowStep === 'disk') {
    // Step 2: Detect central disk for accuracy
    detectCentralDisk(x, y);
  }
}

// Handle canvas touch for mobile
function handleCanvasTouch(event) {
  event.preventDefault();
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    const clickEvent = new MouseEvent('click', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true,
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

  // Calculate base draw dimensions (at zoom 1.0) - must match displayImageOnMainCanvas
  const drawWidth = info.imgWidth * info.scale;
  const drawHeight = info.imgHeight * info.scale;

  // Calculate scaled dimensions with zoom
  const scaledWidth = drawWidth * zoom;
  const scaledHeight = drawHeight * zoom;

  // Calculate offset with panning - MUST match displayImageOnMainCanvas formula exactly
  // Formula: offsetX + (drawWidth - scaledWidth) / 2 + panX
  const scaledOffsetX = info.offsetX + (drawWidth - scaledWidth) / 2 + panX;
  const scaledOffsetY = info.offsetY + (drawHeight - scaledHeight) / 2 + panY;

  // Convert to image coordinates
  const imgX = (screenX - scaledOffsetX) / (info.scale * zoom);
  const imgY = (screenY - scaledOffsetY) / (info.scale * zoom);

  console.log('Coordinate conversion:', {
    screen: { x: screenX, y: screenY },
    scaledOffset: { x: scaledOffsetX, y: scaledOffsetY },
    result: { x: imgX, y: imgY },
    bounds: { w: info.imgWidth, h: info.imgHeight },
  });

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
    if (
      imgCoords.x < 0 ||
      imgCoords.x >= AppState.imageDisplayInfo.imgWidth ||
      imgCoords.y < 0 ||
      imgCoords.y >= AppState.imageDisplayInfo.imgHeight
    ) {
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

      // Calculate coin pixel area and update physical area
      AppState.coinPixelArea =
        Math.PI * detectedCircle.radius * detectedCircle.radius;

      // Update detection status
      document.getElementById('detectionStatus').textContent = 'Detected';
      document.getElementById('detectionStatus').className = 'detected';

      // Update pixel diameter display
      document.getElementById('pixelDistance').textContent = `${(
        detectedCircle.radius * 2
      ).toFixed(1)} px`;

      // Calculate and update scale factor
      updateScaleFactor();

      // Update coin area in cm² based on current reference
      updateCoinAreaDisplay();
      // Refresh which area is visible depending on user selection
      updateTargetAreaDisplays();

      // Draw coin circle on image
      drawCoinCircle();

      // Highlight coin region on original/output canvas
      drawCoinHighlightOnOutputCanvas();

      // Update workflow: coin detected, now waiting for disk detection
      AppState.workflowStep = 'disk';

      // Enable clear reference button
      document.getElementById('clearReference').disabled = false;

      updateStatus('✓ Coin detected! Now click on the central disk...');
      UIUtils.showToast('✓ Coin detected', 'success');
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

// Detect central disk at clicked location
function detectCentralDisk(screenX, screenY) {
  if (!AppState.capturedImage || AppState.isProcessing) {
    UIUtils.showToast('Please load an image first', 'error');
    return;
  }

  // Ensure coin was detected first
  if (!AppState.detectedCoin || !AppState.scaleFactor) {
    UIUtils.showToast('Please detect the coin first', 'error');
    updateStatus('Coin detection required before disk detection');
    return;
  }

  try {
    UIUtils.showLoading(true);
    updateStatus('Detecting central disk...');
    console.log('Starting central disk detection...');

    // Convert screen coordinates to image coordinates
    const imgCoords = screenToImageCoordinates(screenX, screenY);
    console.log('Image coordinates for disk:', imgCoords);

    // Validate coordinates are within image bounds
    if (
      imgCoords.x < 0 ||
      imgCoords.x >= AppState.imageDisplayInfo.imgWidth ||
      imgCoords.y < 0 ||
      imgCoords.y >= AppState.imageDisplayInfo.imgHeight
    ) {
      updateStatus('Click must be within the image area');
      UIUtils.showToast('Click must be within the image area', 'error');
      UIUtils.showLoading(false);
      return;
    }

    // Create a copy of the image
    let src = AppState.capturedImage.clone();
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // Detect disk circle using Hough Circle Transform
    const expectedDiskRadiusPx = (AppState.diskDiameter / 2) * AppState.scaleFactor;
    let detectedCircle = null;
    let minDist = Infinity;

    // Try Hough Circle detection for disk
    const circles = new cv.Mat();
    cv.HoughCircles(
      gray,
      circles,
      cv.HOUGH_GRADIENT,
      1,
      gray.rows / 8,
      100,
      30,
      Math.round(expectedDiskRadiusPx * 0.8),
      Math.round(expectedDiskRadiusPx * 1.2)
    );

    // Find the circle closest to the clicked point
    if (circles.cols > 0) {
      for (let i = 0; i < circles.cols; i++) {
        const cx = circles.data32F[i * 3];
        const cy = circles.data32F[i * 3 + 1];
        const radius = circles.data32F[i * 3 + 2];
        const dist = Math.sqrt(
          Math.pow(cx - imgCoords.x, 2) + Math.pow(cy - imgCoords.y, 2)
        );

        if (dist < minDist) {
          minDist = dist;
          detectedCircle = { x: Math.round(cx), y: Math.round(cy), radius: Math.round(radius) };
        }
      }
    }
    circles.delete();

    if (detectedCircle && minDist < expectedDiskRadiusPx) {
      console.log('Central disk detected:', detectedCircle);

      // Store detected disk
      AppState.detectedDisk = detectedCircle;

      // Visual feedback
      UIUtils.showToast('✓ Disk detected', 'success');
      updateStatus('✓ Disk detected! Calculating drape area...');

      // Move workflow to complete state
      AppState.workflowStep = 'complete';

      // Now process the drape area
      processDrapeArea();
    } else {
      console.log('Central disk not detected');
      updateStatus('Could not detect disk. Click closer to disk center.');
      UIUtils.showToast('Click closer to the center of the disk', 'error');
    }

    // Clean up
    src.delete();
    gray.delete();
  } catch (error) {
    console.error('Disk detection error:', error);
    updateStatus('Error detecting disk');
    UIUtils.showToast('Error detecting disk: ' + error.message, 'error');
  } finally {
    UIUtils.showLoading(false);
  }
}

// Detect a square-shaped reference object at the clicked location
function detectReferenceShape(screenX, screenY) {
  if (!AppState.capturedImage || AppState.isProcessing) {
    UIUtils.showToast('Please load an image first', 'error');
    return;
  }

  try {
    UIUtils.showLoading(true);
    updateStatus('Detecting square reference object...');
    console.log('Starting square reference detection...');

    // Ensure a square size has been selected
    if (!AppState.shapeArea || AppState.shapeArea <= 0) {
      UIUtils.showToast(
        'Select a square size (1×1 to 5×5 cm) before clicking on the reference object.',
        'error'
      );
      updateStatus(
        'Select a square size, then click inside the square reference object.'
      );
      UIUtils.showLoading(false);
      return;
    }

    // Convert screen coordinates to image coordinates
    const imgCoords = screenToImageCoordinates(screenX, screenY);
    console.log('Image coordinates for reference:', imgCoords);

    // Validate coordinates are within image bounds
    if (
      imgCoords.x < 0 ||
      imgCoords.x >= AppState.imageDisplayInfo.imgWidth ||
      imgCoords.y < 0 ||
      imgCoords.y >= AppState.imageDisplayInfo.imgHeight
    ) {
      updateStatus('Click must be within the image area');
      UIUtils.showToast('Click must be within the image area', 'error');
      UIUtils.showLoading(false);
      return;
    }

    // Work on a grayscale copy for segmentation
    let gray = new cv.Mat();
    cv.cvtColor(AppState.capturedImage, gray, cv.COLOR_RGBA2GRAY, 0);

    // Flood-fill from the clicked point to obtain the connected region
    let mask = new cv.Mat.zeros(
      gray.rows + 2,
      gray.cols + 2,
      cv.CV_8UC1
    );

    const seedPoint = new cv.Point(imgCoords.x, imgCoords.y);
    const newVal = new cv.Scalar(255);
    const loDiff = new cv.Scalar(10);
    const upDiff = new cv.Scalar(10);
    const rect = new cv.Rect();
    const flags = 4 | (255 << 8) | cv.FLOODFILL_FIXED_RANGE;

    const filledArea = cv.floodFill(
      gray,
      mask,
      seedPoint,
      newVal,
      rect,
      loDiff,
      upDiff,
      flags
    );

    console.log('Flood-fill reference area (pixels):', filledArea);

    // Extract the mask corresponding to the filled region
    const roiRect = new cv.Rect(1, 1, gray.cols, gray.rows);
    let refMask = mask.roi(roiRect);
    let referenceMask = new cv.Mat();
    refMask.copyTo(referenceMask);

    const pixelArea = cv.countNonZero(referenceMask);
    AppState.referencePixelArea = pixelArea;

    console.log('Reference pixel area (from mask):', pixelArea);

    if (!pixelArea || pixelArea <= 0) {
      updateStatus('Could not detect a reference region around the click.');
      UIUtils.showToast(
        'Could not detect a reference region. Try clicking more centrally on the square.',
        'error'
      );
      gray.delete();
      mask.delete();
      referenceMask.delete();
      refMask.delete();
      UIUtils.showLoading(false);
      return;
    }

    // Real square area (cm²) from selected size
    const realAreaCm2 = AppState.shapeArea;
    const pxPerCm = Math.sqrt(pixelArea / realAreaCm2);

    if (!isFinite(pxPerCm) || pxPerCm <= 0) {
      updateStatus('Could not compute a valid scale from the square reference.');
      UIUtils.showToast(
        'Could not compute a valid scale from the reference object.',
        'error'
      );
      gray.delete();
      mask.delete();
      referenceMask.delete();
      refMask.delete();
      UIUtils.showLoading(false);
      return;
    }

    // Update global scale factor based on this reference
    AppState.scaleFactor = pxPerCm;
    document.getElementById('scaleFactor').textContent =
      AppState.scaleFactor.toFixed(2);

    // Area from pixels in cm² (for display; will match the real area)
    const areaFromPixelsCm2 =
      pixelArea / (AppState.scaleFactor * AppState.scaleFactor);
    AppState.shapeArea = areaFromPixelsCm2;
    AppState.referenceAreaCm2 = areaFromPixelsCm2;

    // Update detection UI
    const detectionStatusEl = document.getElementById('detectionStatus');
    if (detectionStatusEl) {
      detectionStatusEl.textContent = 'Detected';
      detectionStatusEl.className = 'detected';
    }
    document.getElementById('pixelDistance').textContent = '--';

    const refAreaEl = document.getElementById('coinAreaCm2');
    if (refAreaEl) {
      refAreaEl.textContent = areaFromPixelsCm2.toFixed(2);
    }

    // Highlight reference region on the "Original with Coin" canvas
    drawReferenceHighlightOnOutputCanvas(referenceMask);

    // Update UI panels
    updateTargetAreaDisplays();

    // Enable clear reference
    document.getElementById('clearReference').disabled = false;

    updateStatus('Square reference detected and shape area calculated from pixels.');
    UIUtils.showToast(
      'Square reference detected and shape area calculated from pixels.',
      'success'
    );

    // Clean up
    gray.delete();
    mask.delete();
    referenceMask.delete();
    refMask.delete();
  } catch (error) {
    console.error('Reference detection error:', error);
    updateStatus('Error detecting square reference object');
    UIUtils.showToast(
      'Error detecting square reference object: ' + error.message,
      'error'
    );
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
    cv.GaussianBlur(gray, blurred, new cv.Size(9, 9), 2, 2);

    // Calculate adaptive radius based on image size
    // Assuming coin is about 2-5% of image width for typical drape test photos
    const imgDiagonal = Math.sqrt(src.cols * src.cols + src.rows * src.rows);
    const minRadius = Math.max(10, Math.floor(imgDiagonal * 0.01)); // At least 1% of diagonal
    const maxRadius = Math.floor(imgDiagonal * 0.15); // At most 15% of diagonal
    const minDist = Math.floor(minRadius * 2); // Minimum distance between circles

    console.log(
      'Hough params - minRadius:',
      minRadius,
      'maxRadius:',
      maxRadius,
      'minDist:',
      minDist
    );

    // Apply Hough Circle Transform
    let circles = new cv.Mat();
    cv.HoughCircles(
      blurred,
      circles,
      cv.HOUGH_GRADIENT,
      1, // dp
      minDist, // minDist (between circle centers)
      100, // param1 (canny edge threshold)
      30, // param2 (accumulator threshold)
      minRadius, // minRadius (pixels) - adaptive
      maxRadius // maxRadius (pixels) - adaptive
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
      let distance = Math.sqrt(
        Math.pow(x - clickX, 2) + Math.pow(y - clickY, 2)
      );

      // Accept circle only if click is within the coin, with a precise but not overly strict radius
      const acceptanceRadius = Math.max(radius * 0.9, 12);
      const isInsideCircle = distance <= radius;
      if (isInsideCircle && distance < acceptanceRadius && distance < minDistance) {
        minDistance = distance;
        bestCircle = { x, y, radius };
        console.log(
          'Found circle at:',
          x,
          y,
          'radius:',
          radius,
          'distance:',
          distance
        );
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

// Detect the support disk circle near the image center.
// Uses HoughCircles with radius constrained around expectedDiskRadiusPx.
function detectSupportDiskCircle(grayOrBlurred, expectedDiskRadiusPx) {
  try {
    if (!grayOrBlurred || grayOrBlurred.empty()) return null;

    // Ensure grayscale
    let gray = new cv.Mat();
    if (grayOrBlurred.type() === cv.CV_8UC1) {
      grayOrBlurred.copyTo(gray);
    } else {
      cv.cvtColor(grayOrBlurred, gray, cv.COLOR_RGBA2GRAY, 0);
    }

    // Blur for Hough stability
    let blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(9, 9), 2, 2);

    const r = Math.max(10, Math.round(expectedDiskRadiusPx));
    const minRadius = Math.max(10, Math.round(r * 0.75));
    const maxRadius = Math.round(r * 1.25);

    let circles = new cv.Mat();
    cv.HoughCircles(
      blurred,
      circles,
      cv.HOUGH_GRADIENT,
      1, // dp
      r, // minDist
      120, // param1
      35, // param2
      minRadius,
      maxRadius
    );

    if (!circles || circles.cols <= 0) {
      gray.delete();
      blurred.delete();
      circles.delete();
      return null;
    }

    const cx0 = gray.cols / 2;
    const cy0 = gray.rows / 2;

    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < circles.cols; i++) {
      const x = circles.data32F[i * 3];
      const y = circles.data32F[i * 3 + 1];
      const rad = circles.data32F[i * 3 + 2];

      const centerDist = Math.hypot(x - cx0, y - cy0);
      const radiusDiff = Math.abs(rad - r);

      // Prefer circles near center and near expected radius
      const score = centerDist * 1.0 + radiusDiff * 2.0;
      if (score < bestScore) {
        bestScore = score;
        best = { x: Math.round(x), y: Math.round(y), radius: rad };
      }
    }

    gray.delete();
    blurred.delete();
    circles.delete();

    return best;
  } catch (e) {
    console.error('Support disk circle detection error:', e);
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
    let kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    let morph = new cv.Mat();
    cv.morphologyEx(binary, morph, cv.MORPH_CLOSE, kernel);

    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(
      morph,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    console.log('Contours found:', contours.size());

    // Calculate adaptive area limits based on image size
    const imgArea = src.cols * src.rows;
    const minArea = imgArea * 0.0001; // 0.01% of image
    const maxArea = imgArea * 0.05; // 5% of image

    console.log('Contour area limits - min:', minArea, 'max:', maxArea);

    let bestCircle = null;
    let minDistance = Infinity;

    // Find contour closest to click point
    for (let i = 0; i < contours.size(); i++) {
      let contour = contours.get(i);
      let area = cv.contourArea(contour);

      // Filter by area (adaptive based on image size)
      if (area < minArea || area > maxArea) continue;

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

      // Accept if it's reasonably circular and close to click (tighter than before)
      if (circularity > 0.6) {
        let distance = Math.sqrt(
          Math.pow(x - clickX, 2) + Math.pow(y - clickY, 2)
        );

        // Precise click acceptance but not overly strict
        const acceptanceRadius = Math.max(radius * 0.9, 12);
        const isInsideCircle = distance <= radius;
        if (isInsideCircle && distance < acceptanceRadius && distance < minDistance) {
          minDistance = distance;
          bestCircle = { x, y, radius };
          console.log(
            'Found contour circle at:',
            x,
            y,
            'radius:',
            radius,
            'circularity:',
            circularity
          );
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
  const screenX =
    coin.x * info.scale * AppState.zoomLevel +
    info.offsetX +
    (info.canvasWidth - info.imgWidth * info.scale * AppState.zoomLevel) / 2 +
    AppState.panOffset.x;

  const screenY =
    coin.y * info.scale * AppState.zoomLevel +
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

// Update coin area (cm²) based on current reference diameter
function updateCoinAreaDisplay() {
  if (!AppState.detectedCoin) return;

  // Use detected pixel radius and current scaleFactor so
  // area comes directly from pixel count (for accuracy checking)
  if (!AppState.scaleFactor || AppState.scaleFactor <= 0) {
    return;
  }

  const radiusPx = AppState.detectedCoin.radius;
  const pixelArea = Math.PI * radiusPx * radiusPx; // px²
  AppState.coinPixelArea = pixelArea;

  // Convert px² to cm² using (px/cm)²
  AppState.coinAreaCm2 =
    pixelArea / (AppState.scaleFactor * AppState.scaleFactor);

  const coinAreaEl = document.getElementById('coinAreaCm2');
  if (coinAreaEl) {
    coinAreaEl.textContent = AppState.coinAreaCm2.toFixed(2);
  }
}

// Update what area is shown in the reference panel and shape section
function updateTargetAreaDisplays() {
  const refTargetSelect = document.getElementById('refTarget');
  const target =
    (refTargetSelect && refTargetSelect.value) || AppState.refTarget || 'coin';

  // Toggle which specification fields are visible
  const coinSpec = document.getElementById('coinSpecFields');
  const shapeSpec = document.getElementById('shapeSpecFields');
  if (coinSpec && shapeSpec) {
    coinSpec.style.display = target === 'coin' ? 'block' : 'none';
    shapeSpec.style.display = target === 'shape' ? 'block' : 'none';
  }

  // Update label text: Coin Area vs Shape Area
  const refAreaLabel = document.getElementById('refAreaLabel');
  if (refAreaLabel) {
    refAreaLabel.textContent =
      target === 'shape' ? 'Shape Area:' : 'Coin Area:';
  }

  // Reference panel area value
  const refAreaEl = document.getElementById('coinAreaCm2');
  let refAreaValue = '--';
  if (target === 'coin') {
    if (AppState.coinAreaCm2 && AppState.coinAreaCm2 > 0) {
      refAreaValue = AppState.coinAreaCm2.toFixed(2);
    }
  } else if (target === 'shape') {
    if (AppState.shapeArea && AppState.shapeArea > 0) {
      refAreaValue = AppState.shapeArea.toFixed(2);
    }
  }
  if (refAreaEl) {
    refAreaEl.textContent = refAreaValue;
  }

  // Shape section display (always shows current shape area if available)
  const shapeAreaEl = document.getElementById('shapeAreaValue');
  if (shapeAreaEl) {
    if (AppState.shapeArea && AppState.shapeArea > 0) {
      shapeAreaEl.textContent = AppState.shapeArea.toFixed(2);
    } else {
      shapeAreaEl.textContent = '--';
    }
  }
}

// Highlight the detected coin region on the original/output canvas
function drawCoinHighlightOnOutputCanvas() {
  if (!AppState.capturedImage || !AppState.detectedCoin) return;

  try {
    const coin = AppState.detectedCoin;

    // Work on a copy so original Mat stays untouched
    let src = AppState.capturedImage.clone();

    const center = new cv.Point(coin.x, coin.y);

    // Strong, visible fill similar in spirit to drape highlight
    cv.circle(
      src,
      center,
      coin.radius,
      // RGBA: bright yellow with some transparency
      new cv.Scalar(0, 255, 255, 80),
      -1
    );

    // Bold outline so the detected coin is very obvious
    cv.circle(
      src,
      center,
      coin.radius,
      new cv.Scalar(255, 0, 0, 255),
      4
    );

    // Render to the "Original with Coin" canvas
    cv.imshow(AppState.outputCanvas, src);

    // Clean up
    src.delete();
  } catch (error) {
    console.error('Error highlighting coin on output canvas:', error);
  }
}

// Highlight a generic reference mask (square) on the original/output canvas
function drawReferenceHighlightOnOutputCanvas(referenceMask) {
  if (!AppState.capturedImage || !referenceMask) return;

  try {
    // Work on a copy so original Mat stays untouched
    let src = AppState.capturedImage.clone();

    // Apply a semi-transparent blue overlay to the reference region
    for (let y = 0; y < src.rows; y++) {
      for (let x = 0; x < src.cols; x++) {
        if (referenceMask.ucharAt(y, x) === 255) {
          const idx = (y * src.cols + x) * 4;
          src.data[idx] = Math.round(src.data[idx] * 0.5 + 0 * 0.5); // R
          src.data[idx + 1] = Math.round(
            src.data[idx + 1] * 0.5 + 122 * 0.5
          ); // G
          src.data[idx + 2] = Math.round(
            src.data[idx + 2] * 0.5 + 255 * 0.5
          ); // B
        }
      }
    }

    cv.imshow(AppState.outputCanvas, src);

    src.delete();
  } catch (error) {
    console.error('Error highlighting reference on output canvas:', error);
  }
}

// Update scale factor based on detected coin
// Update scale factor based on detected coin
function updateScaleFactor() {
  if (!AppState.detectedCoin) return;

  const coinDiameterCm = 2.5; // Fixed reference coin diameter
  const pixelDiameter = AppState.detectedCoin.radius * 2;
  AppState.scaleFactor = pixelDiameter / coinDiameterCm;

  console.log('Scale factor calculated:', AppState.scaleFactor.toFixed(2), 'px/cm');
  console.log('Pixels per cm²:', Math.pow(AppState.scaleFactor, 2).toFixed(0));

  // Update UI
  document.getElementById('scaleFactor').textContent = AppState.scaleFactor.toFixed(2);
}

// Process drape area
function processDrapeArea() {
  if (
    !AppState.capturedImage ||
    !AppState.detectedCoin ||
    AppState.isProcessing
  )
    return;

  AppState.isProcessing = true;
  updateStatus('Processing drape area...');

  setTimeout(() => {
    try {
      console.log('Processing drape area...');
      console.log(
        'Image size:',
        AppState.capturedImage.cols,
        'x',
        AppState.capturedImage.rows
      );

      // Create a copy of the image
      let src = AppState.capturedImage.clone();

      // Convert to grayscale
      let gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

      // Apply Gaussian blur to reduce noise
      let blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.5, 1.5);

      // Use Canny edge detection to find edges between regions
      // This will detect the boundary between:
      // - Dark disk and gray drape
      // - Gray drape and beige outer fabric
      let edges = new cv.Mat();
      cv.Canny(blurred, edges, 30, 90, 3, false);

      // Dilate edges to close gaps
      let dilateKernel = cv.getStructuringElement(
        cv.MORPH_ELLIPSE,
        new cv.Size(3, 3)
      );
      cv.dilate(edges, edges, dilateKernel, new cv.Point(-1, -1), 2);

      // Find contours from edges
      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_TREE,
        cv.CHAIN_APPROX_SIMPLE
      );

      console.log('Found', contours.size(), 'contours from edge detection');

      // Calculate expected areas based on scale factor
      const diskRadiusPx = (AppState.diskDiameter / 2) * AppState.scaleFactor;
      const fabricRadiusPx =
        (AppState.fabricDiameter / 2) * AppState.scaleFactor;
      const expectedDiskAreaPx = Math.PI * diskRadiusPx * diskRadiusPx;
      const expectedFabricAreaPx = Math.PI * fabricRadiusPx * fabricRadiusPx;

      // The drape area should be between disk area and fabric area
      const minDrapeArea = expectedDiskAreaPx * 1.2; // At least 20% larger than disk
      const maxDrapeArea = expectedFabricAreaPx * 0.95; // At most 95% of fabric area

      console.log('Scale factor:', AppState.scaleFactor.toFixed(2), 'px/cm');
      console.log('Expected disk area:', expectedDiskAreaPx.toFixed(0), 'px²');
      console.log(
        'Expected fabric area:',
        expectedFabricAreaPx.toFixed(0),
        'px²'
      );
      console.log(
        'Looking for drape area between:',
        minDrapeArea.toFixed(0),
        'and',
        maxDrapeArea.toFixed(0),
        'px²'
      );

      // Find the contour that represents the drape boundary
      // It should be:
      // 1. Larger than the support disk
      // 2. Smaller than the original fabric
      // 3. Roughly circular (high circularity)
      let bestContourIndex = -1;
      let bestContourArea = 0;
      let bestCircularity = 0;

      for (let i = 0; i < contours.size(); i++) {
        let contour = contours.get(i);
        let area = cv.contourArea(contour);

        // Skip contours outside the expected range
        if (area < minDrapeArea || area > maxDrapeArea) {
          continue;
        }

        // Calculate circularity: 4π × Area / Perimeter²
        let perimeter = cv.arcLength(contour, true);
        let circularity = (4 * Math.PI * area) / (perimeter * perimeter);

        console.log(
          `Contour ${i}: area=${area.toFixed(
            0
          )} px², circularity=${circularity.toFixed(3)}`
        );

        // We want a contour that is:
        // - In the right size range (between disk and fabric)
        // - Reasonably circular (circularity > 0.3 for irregular drape shapes)
        if (circularity > 0.3 && area > bestContourArea) {
          bestContourArea = area;
          bestContourIndex = i;
          bestCircularity = circularity;
        }
      }

      // If edge detection didn't work well, try intensity-based approach
      if (bestContourIndex < 0) {
        console.log(
          'Edge detection approach failed, trying intensity-based approach...'
        );

        // The gray drape region has intensity between dark disk and light fabric
        // Use multi-level thresholding

        // First, find the intensity range of the image
        let minMax = cv.minMaxLoc(gray);
        console.log(
          'Image intensity range:',
          minMax.minVal,
          'to',
          minMax.maxVal
        );

        // The drape region is typically in the middle intensity range
        // Dark disk: < 30% of range
        // Gray drape: 30-60% of range
        // Light fabric: > 60% of range
        let range = minMax.maxVal - minMax.minVal;
        let lowerThresh = minMax.minVal + range * 0.25;
        let upperThresh = minMax.minVal + range * 0.65;

        console.log(
          'Threshold range for drape:',
          lowerThresh.toFixed(0),
          'to',
          upperThresh.toFixed(0)
        );

        // Create binary mask for gray drape region
        let lowerMask = new cv.Mat();
        let upperMask = new cv.Mat();
        let drapeMask = new cv.Mat();

        cv.threshold(blurred, lowerMask, lowerThresh, 255, cv.THRESH_BINARY);
        cv.threshold(
          blurred,
          upperMask,
          upperThresh,
          255,
          cv.THRESH_BINARY_INV
        );
        cv.bitwise_and(lowerMask, upperMask, drapeMask);

        // Clean up the mask
        let morphKernel = cv.getStructuringElement(
          cv.MORPH_ELLIPSE,
          new cv.Size(7, 7)
        );
        cv.morphologyEx(drapeMask, drapeMask, cv.MORPH_CLOSE, morphKernel);
        cv.morphologyEx(drapeMask, drapeMask, cv.MORPH_OPEN, morphKernel);

        // Find contours in the drape mask
        let drapeContours = new cv.MatVector();
        let drapeHierarchy = new cv.Mat();
        cv.findContours(
          drapeMask,
          drapeContours,
          drapeHierarchy,
          cv.RETR_EXTERNAL,
          cv.CHAIN_APPROX_SIMPLE
        );

        console.log(
          'Found',
          drapeContours.size(),
          'contours from intensity-based approach'
        );

        // Find the largest contour in the expected range
        for (let i = 0; i < drapeContours.size(); i++) {
          let contour = drapeContours.get(i);
          let area = cv.contourArea(contour);

          if (area > 1000 && area > bestContourArea) {
            // For this approach, get the convex hull to get the outer boundary
            let hull = new cv.Mat();
            cv.convexHull(contour, hull);
            let hullArea = cv.contourArea(hull);

            console.log(
              `Intensity contour ${i}: area=${area.toFixed(
                0
              )}, hull area=${hullArea.toFixed(0)}`
            );

            if (hullArea > minDrapeArea && hullArea < maxDrapeArea) {
              bestContourArea = hullArea;
              bestContourIndex = i;
              // Replace contours with drape contours for drawing
              contours.delete();
              contours = drapeContours;
              hierarchy.delete();
              hierarchy = drapeHierarchy;
            }
            hull.delete();
          }
        }

        // Clean up intensity-based mats (only if we didn't use the contours)
        if (bestContourIndex < 0) {
          drapeContours.delete();
          drapeHierarchy.delete();
        }
        lowerMask.delete();
        upperMask.delete();
        drapeMask.delete();
        morphKernel.delete();
      }

      if (bestContourIndex >= 0) {
        // Calculate drape area in cm²
        // Build a filled mask for the detected shadow contour (this is Ad in pixels)
        let shadowMask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
        cv.drawContours(shadowMask, contours, bestContourIndex, new cv.Scalar(255), -1);

        // Total shadow pixel area INCLUDING disk (Ad)
        const totalShadowPixelArea = cv.countNonZero(shadowMask);
        AppState.drapePixelAreaTotal = totalShadowPixelArea;

        // Detect the support disk circle and remove it from the green mask
        const expectedDiskRadiusPx = (AppState.diskDiameter / 2) * AppState.scaleFactor;
        const diskCircle = detectSupportDiskCircle(blurred, expectedDiskRadiusPx);
        AppState.detectedDiskCircle = diskCircle;

        let diskPixelAreaInShadow = 0;
        let fabricShadowPixelArea = totalShadowPixelArea;

        if (diskCircle) {
            let diskMask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
            cv.circle(
              diskMask,
              new cv.Point(diskCircle.x, diskCircle.y),
              Math.round(diskCircle.radius),
              new cv.Scalar(255),
              -1
            );

            // Only count disk pixels that are inside the detected shadow region
            let diskInShadow = new cv.Mat();
            cv.bitwise_and(shadowMask, diskMask, diskInShadow);
            diskPixelAreaInShadow = cv.countNonZero(diskInShadow);

            // Fabric-only (green) pixels = shadowMask minus disk region
            let diskMaskInv = new cv.Mat();
            cv.bitwise_not(diskMask, diskMaskInv);
            let fabricMask = new cv.Mat();
            cv.bitwise_and(shadowMask, diskMaskInv, fabricMask);
            fabricShadowPixelArea = cv.countNonZero(fabricMask);

            // Store both values
            AppState.drapePixelAreaTotal = totalShadowPixelArea; // Total shadow including disk
            AppState.drapePixelArea = fabricShadowPixelArea; // Fabric-only shadow
            
            // Also store the detected disk circle for later use
            AppState.detectedDiskCircle = diskCircle;
            AppState.diskPixelAreaInShadow = diskPixelAreaInShadow;

            diskMask.delete();
            diskInShadow.delete();
            diskMaskInv.delete();
            fabricMask.delete();
            shadowMask.delete();
          }
           else 
            {
            console.warn('Support disk circle not detected; using estimated disk area');
  
          // If disk not detected, estimate based on scale factor
            AppState.drapePixelAreaTotal = totalShadowPixelArea;
            
            // Estimate disk pixel area based on scale factor
            const diskAreaCm2 = Math.PI * Math.pow(18.0 / 2, 2); // 254.47 cm²
            const expectedDiskPixelArea = diskAreaCm2 * Math.pow(AppState.scaleFactor, 2);
            AppState.drapePixelArea = Math.max(0, totalShadowPixelArea - expectedDiskPixelArea);
            
            // Store for later use
            AppState.detectedDiskCircle = null;
            AppState.diskPixelAreaInShadow = 0;
          }

        AppState.drapePixelArea = fabricShadowPixelArea;

        // Convert px² to cm² using (px/cm)²
        const totalAreaCm2 =
          totalShadowPixelArea /
          (AppState.scaleFactor * AppState.scaleFactor);
        const fabricOnlyAreaCm2 =
          fabricShadowPixelArea /
          (AppState.scaleFactor * AppState.scaleFactor);

        // Store total area for coefficient and fabric-only for display
        AppState.drapeAreaTotal = totalAreaCm2;
        AppState.drapeArea = fabricOnlyAreaCm2;

        console.log('=== DRAPE AREA DETECTED ===');
        console.log(
          'Total shadow pixel area:',
          totalShadowPixelArea.toFixed(0),
          'px²'
        );
        console.log(
          'Disk pixel area inside shadow:',
          diskPixelAreaInShadow.toFixed(0),
          'px²'
        );
        console.log(
          'Fabric-only shadow pixel area:',
          fabricShadowPixelArea.toFixed(0),
          'px²'
        );
        console.log(
          'Total shadow area (cm²):',
          totalAreaCm2.toFixed(2),
          'cm²'
        );
        console.log(
          'Fabric-only shadow area (cm²):',
          fabricOnlyAreaCm2.toFixed(2),
          'cm²'
        );
        console.log('Circularity:', bestCircularity.toFixed(3));

        // Update UI
        document.getElementById('actualArea').textContent =
          fabricOnlyAreaCm2.toFixed(2);
        const pixelAreaEl = document.getElementById('pixelAreaValue');
        if (pixelAreaEl) {
          pixelAreaEl.textContent = fabricShadowPixelArea.toFixed(0);
        }

        // Draw processed image
        drawProcessedImage(src, contours, bestContourIndex, diskCircle);

        // Update area displays (coin vs shape) now that drape area is known
        updateTargetAreaDisplays();

        // Calculate drape coefficient
        calculateDrapeCoefficient();

        // Enable save button
        document.getElementById('saveImage').disabled = false;

        updateStatus('Drape area processed successfully');
        UIUtils.showToast('Drape area processed successfully', 'success');
      } else {
        console.log('=== DRAPE DETECTION FAILED ===');
        console.log('Could not find contour in expected size range');
        console.log('Tips:');
        console.log('- Ensure fabric drapes beyond the support disk');
        console.log('- Check that disk/fabric diameters are set correctly');
        console.log(
          '- Ensure good contrast between drape shadow and background'
        );

        updateStatus(
          'Could not detect drape area. Check disk/fabric diameter settings.'
        );
        UIUtils.showToast(
          'Could not detect drape area. Verify diameter settings.',
          'error'
        );
      }

        // Clean up
        
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      dilateKernel.delete();
      contours.delete();
      hierarchy.delete();
    } catch (error) {
      console.error('Drape processing error:', error);
      updateStatus('Error processing drape area');
      UIUtils.showToast(
        'Error processing drape area: ' + error.message,
        'error'
      );
    } finally {
      AppState.isProcessing = false;
    }
  }, 100);
}

// Draw processed image with drape contour
function drawProcessedImage(src, contours, contourIndex) {
  try {
    // Create processed image with original colors
    let processed = src.clone();

    // Create a mask for the drape area
    let mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    cv.drawContours(mask, contours, contourIndex, new cv.Scalar(255), -1);

    // Optional: disk circle mask to exclude disk from green overlay
    let diskMask = null;
    if (arguments.length >= 4 && arguments[3]) {
      const diskCircle = arguments[3];
      diskMask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
      cv.circle(
        diskMask,
        new cv.Point(diskCircle.x, diskCircle.y),
        Math.round(diskCircle.radius),
        new cv.Scalar(255),
        -1
      );
    }

    // Apply green overlay to fabric-only shadow area using mask (excluding disk)
    for (let y = 0; y < src.rows; y++) {
      for (let x = 0; x < src.cols; x++) {
        const inShadow = mask.ucharAt(y, x) === 255;
        const inDisk = diskMask ? diskMask.ucharAt(y, x) === 255 : false;

        if (inShadow && !inDisk) {
          let idx = (y * src.cols + x) * 4;
          // Blend green with original
          processed.data[idx] = Math.round(processed.data[idx] * 0.5 + 0 * 0.5); // R
          processed.data[idx + 1] = Math.round(
            processed.data[idx + 1] * 0.5 + 255 * 0.5
          ); // G
          processed.data[idx + 2] = Math.round(
            processed.data[idx + 2] * 0.5 + 0 * 0.5
          ); // B
        }
      }
    }

    // Fill disk area in red (so it is clearly excluded from green)
    if (diskMask) {
      for (let y = 0; y < src.rows; y++) {
        for (let x = 0; x < src.cols; x++) {
          if (diskMask.ucharAt(y, x) === 255) {
            let idx = (y * src.cols + x) * 4;
            processed.data[idx] = Math.round(processed.data[idx] * 0.4 + 255 * 0.6); // R
            processed.data[idx + 1] = Math.round(processed.data[idx + 1] * 0.4 + 0 * 0.6); // G
            processed.data[idx + 2] = Math.round(processed.data[idx + 2] * 0.4 + 0 * 0.6); // B
          }
        }
      }
    }

    // Draw contour outline
    cv.drawContours(
      processed,
      contours,
      contourIndex,
      new cv.Scalar(0, 200, 0, 255),
      3
    );

    // Display processed image
    cv.imshow(AppState.processedCanvas, processed);

    // Clean up
    mask.delete();
    if (diskMask) {
      diskMask.delete();
    }
    processed.delete();
  } catch (error) {
    console.error('Error drawing processed image:', error);
  }
}

// Calculate Drape Coefficient
// Calculate Drape Coefficient
// Calculate Drape Coefficient
function calculateDrapeCoefficient() {
  if (
    !AppState.detectedCoin ||
    !AppState.scaleFactor ||
    AppState.scaleFactor <= 0
  ) {
    updateStatus('Need coin reference first');
    return;
  }

  console.log('=== CALCULATING DRAPE COEFFICIENT ===');
  
  // Fixed physical dimensions
  const coinDiameterCm = 2.5; // Reference coin diameter
  const diskDiameterCm = 18.0; // Support disk diameter
  const fabricDiameterCm = 30.0; // Fabric diameter

  // Calculate physical areas
  const coinAreaCm2 = Math.PI * Math.pow(coinDiameterCm / 2, 2); // 4.91 cm²
  const diskAreaCm2 = Math.PI * Math.pow(diskDiameterCm / 2, 2); // 254.47 cm²
  const fabricAreaCm2 = Math.PI * Math.pow(fabricDiameterCm / 2, 2); // 706.86 cm²
  const ringAreaCm2 = fabricAreaCm2 - diskAreaCm2; // 452.39 cm²

  console.log('Physical dimensions:');
  console.log(`- Coin diameter: ${coinDiameterCm} cm (area: ${coinAreaCm2.toFixed(2)} cm²)`);
  console.log(`- Disk diameter: ${diskDiameterCm} cm (area: ${diskAreaCm2.toFixed(2)} cm²)`);
  console.log(`- Fabric diameter: ${fabricDiameterCm} cm (area: ${fabricAreaCm2.toFixed(2)} cm²)`);
  console.log(`- Ring area: ${ringAreaCm2.toFixed(2)} cm²`);

  // Get pixel measurements
  const totalShadowPixelArea = AppState.drapePixelAreaTotal || 0; // Total shadow including disk (px²)
  const fabricOnlyPixelArea = AppState.drapePixelArea || 0; // Fabric-only shadow (px²)
  
  console.log('Pixel measurements:');
  console.log(`- Total shadow pixel area: ${totalShadowPixelArea} px²`);
  console.log(`- Fabric-only shadow pixel area: ${fabricOnlyPixelArea} px²`);
  console.log(`- Scale factor: ${AppState.scaleFactor.toFixed(2)} px/cm`);

  // Calculate expected disk pixel area based on physical size and scale
  const expectedDiskPixelArea = diskAreaCm2 * Math.pow(AppState.scaleFactor, 2);
  
  console.log(`- Expected disk pixel area: ${expectedDiskPixelArea.toFixed(0)} px²`);

  // If we don't have fabric-only area from detection, calculate it
  let fabricShadowPixelArea = fabricOnlyPixelArea;
  if (fabricShadowPixelArea === 0 && totalShadowPixelArea > 0) {
    // Estimate fabric shadow by subtracting expected disk area
    fabricShadowPixelArea = Math.max(0, totalShadowPixelArea - expectedDiskPixelArea);
    console.log(`- Estimated fabric shadow pixel area: ${fabricShadowPixelArea} px²`);
  }

  // Convert to cm²
  const pixelsPerCm2 = Math.pow(AppState.scaleFactor, 2);
  const fabricShadowAreaCm2 = fabricShadowPixelArea / pixelsPerCm2;
  
  console.log(`- Pixels per cm²: ${pixelsPerCm2.toFixed(0)}`);
  console.log(`- Fabric shadow area: ${fabricShadowAreaCm2.toFixed(2)} cm²`);

  // Calculate drape coefficient using the standard formula:
  // DC = (Fabric shadow area) / (Ring area) × 100%
  // Where ring area = total fabric area - disk area
  
  // Calculate drape coefficient using the standard formula:
// DC = (Fabric shadow area) / (Ring area) × 100%

let drapeCoefficient = (fabricShadowAreaCm2 / ringAreaCm2) * 100;

// Clamp to reasonable range (0-100%)
drapeCoefficient = Math.max(0, Math.min(100, drapeCoefficient));

// Apply correction factor: divide by 2 as requested
drapeCoefficient = drapeCoefficient / 2;

console.log(`- Ring area: ${ringAreaCm2.toFixed(2)} cm²`);
console.log(`- Drape coefficient (corrected): ${drapeCoefficient.toFixed(2)}%`);

// Get fabric properties based on corrected coefficient
const fabricProps = getFabricProperties(drapeCoefficient);
  // Update UI
  document.getElementById('drapeCoefficient').textContent = `${drapeCoefficient.toFixed(2)}%`;
  document.getElementById('fabricProperty').textContent = fabricProps;
  
  // Also update the area displays
  document.getElementById('actualArea').textContent = fabricShadowAreaCm2.toFixed(2);
  
  const pixelAreaEl = document.getElementById('pixelAreaValue');
  if (pixelAreaEl) {
    pixelAreaEl.textContent = fabricShadowPixelArea.toFixed(0);
  }

  // Add to history
  addToHistory(fabricShadowAreaCm2, drapeCoefficient, fabricProps);

  updateStatus(`Drape: ${drapeCoefficient.toFixed(2)}% - ${fabricProps}`);
  UIUtils.showToast(
    `Drape coefficient: ${drapeCoefficient.toFixed(2)}% (${fabricProps})`,
    'success'
  );

  return drapeCoefficient;
}

// Helper function to determine fabric properties
function getFabricProperties(coefficient) {
  if (coefficient < 30) return 'Very Stiff';
  if (coefficient < 50) return 'Stiff';
  if (coefficient < 70) return 'Medium';
  if (coefficient < 85) return 'Flexible';
  return 'Very Flexible';
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
    const imageData = tempCtx.getImageData(
      0,
      0,
      tempCanvas.width,
      tempCanvas.height
    );

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

    updateStatus('Image captured. STEP 1: Click on the coin...');
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
  AppState.detectedDisk = null;
  AppState.scaleFactor = null;
  AppState.drapeArea = 0;
  AppState.drapePixelArea = 0;
  AppState.coinPixelArea = 0;
  AppState.coinAreaCm2 = 0;
  AppState.referencePixelArea = 0;
  AppState.referenceAreaCm2 = 0;
  AppState.workflowStep = 'coin'; // Reset workflow to coin detection

  // Reset UI
  document.getElementById('detectionStatus').textContent = 'Not detected';
  document.getElementById('detectionStatus').className = '';
  document.getElementById('pixelDistance').textContent = '--';
  document.getElementById('scaleFactor').textContent = '--';
  const coinAreaEl = document.getElementById('coinAreaCm2');
  if (coinAreaEl) {
    coinAreaEl.textContent = '--';
  }
  const shapeAreaEl = document.getElementById('shapeAreaValue');
  if (shapeAreaEl) {
    shapeAreaEl.textContent = '--';
  }
  document.getElementById('actualArea').textContent = '--';
  const pixelAreaEl = document.getElementById('pixelAreaValue');
  if (pixelAreaEl) {
    pixelAreaEl.textContent = '--';
  }
  document.getElementById('drapeCoefficient').textContent = '--';
  document.getElementById('fabricProperty').textContent = '--';

  document.getElementById('clearReference').disabled = true;
  document.getElementById('saveImage').disabled = true;

  // Clear processed canvas
  AppState.processedCtx.clearRect(
    0,
    0,
    AppState.processedCanvas.width,
    AppState.processedCanvas.height
  );

  updateStatus('Reference cleared. Click on the coin to start the workflow.');
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
    tracks.forEach((track) => {
      track.stop();
      stream.removeTrack(track);
    });
    AppState.video.srcObject = null;
    AppState.isCameraActive = false;
    AppState.video.style.display = 'none';
  }

  // Hide camera overlays
  hideCameraOverlays();

  // Show click instruction when camera stops
  const clickInstruction = document.querySelector('.click-instruction');
  if (clickInstruction) {
    clickInstruction.style.display = '';
  }

  document.getElementById('startCamera').disabled = false;
  document.getElementById('uploadImage').disabled = false;

  console.log('Camera stopped');
}

function resetApp() {
  console.log('Resetting app...');

  stopCamera();

  // Clear canvases
  const canvases = [
    AppState.mainCanvas,
    AppState.outputCanvas,
    AppState.processedCanvas,
  ];
  canvases.forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Reset OpenCV mats
  if (AppState.originalImage) {
    AppState.originalImage.delete();
    AppState.originalImage = null;
  }

  if (
    AppState.capturedImage &&
    AppState.capturedImage !== AppState.originalImage
  ) {
    AppState.capturedImage.delete();
    AppState.capturedImage = null;
  }

  // Reset state
  clearReference();

  AppState.zoomLevel = 1.0;
  AppState.panOffset = { x: 0, y: 0 };

  // Reset UI
  document.getElementById('capture').disabled = true;
  document.getElementById('saveImage').disabled = true;
  document.getElementById('reset').disabled = true;

  updateStatus('App reset. Ready to start again.');
  UIUtils.showToast('App reset successfully', 'info');
}

function addToHistory(area, coefficient, property) {
  const historyBody = document.getElementById('historyBody');
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

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
    property: property,
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

  AppState.measurements.forEach((m) => {
    const timeStr = m.time.toLocaleString();
    csv += `"${timeStr}",${m.area.toFixed(2)},${m.coefficient.toFixed(2)},${
      m.property
    }\n`;
  });

  // Create download link
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `drape-measurements-${
    new Date().toISOString().split('T')[0]
  }.csv`;
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
      tempCtx.arc(
        AppState.detectedCoin.x,
        AppState.detectedCoin.y,
        AppState.detectedCoin.radius,
        0,
        Math.PI * 2
      );
      tempCtx.strokeStyle = '#e74c3c';
      tempCtx.lineWidth = 3;
      tempCtx.stroke();

      tempCtx.beginPath();
      tempCtx.arc(
        AppState.detectedCoin.x,
        AppState.detectedCoin.y,
        5,
        0,
        Math.PI * 2
      );
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

    const drapePxText =
      AppState.drapePixelArea && AppState.drapePixelArea > 0
        ? `${AppState.drapePixelArea.toFixed(0)} px²`
        : '-- px²';

    ctx.fillText(
      `Drape area: ${AppState.drapeArea.toFixed(2)} cm² (${drapePxText})`,
      10,
      385
    );

    const drapeCoeffText =
      document.getElementById('drapeCoefficient').textContent || '--';
    ctx.fillText(`Drape: ${drapeCoeffText}`, 410, 385);

    // Optional shape area summary
    if (AppState.shapeArea && AppState.shapeArea > 0) {
      ctx.fillText(
        `Shape area: ${AppState.shapeArea.toFixed(2)} cm² (L=${AppState.shapeLength.toFixed(
          2
        )} cm, W=${AppState.shapeWidth.toFixed(2)} cm)`,
        10,
        400
      );
    }

    // Add timestamp
    ctx.textAlign = 'right';
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    const now = new Date();
    ctx.fillText(now.toLocaleString(), 790, 390);

    // Save image
    FileUtils.saveImage(
      combinedCanvas,
      `drape-measurement-${now.getTime()}.png`
    );

    updateStatus('Result image saved');
    UIUtils.showToast('Result image saved successfully', 'success');
  } catch (error) {
    console.error('Error saving result image:', error);
    UIUtils.showToast('Error saving image: ' + error.message, 'error');
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
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
