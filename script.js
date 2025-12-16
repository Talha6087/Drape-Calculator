// Main Application State
const AppState = {
    video: null,
    canvas: null,
    outputCanvas: null,
    processedCanvas: null,
    isCameraActive: false,
    capturedImage: null,
    referencePoint: null,
    referenceDiameter: 2.5, // Default: 1 Rupee coin
    diskDiameter: 18.0,
    fabricDiameter: 30.0,
    measurements: [],
    isProcessing: false
};

// OpenCV Ready Handler
function onOpenCvReady() {
    console.log('OpenCV loaded, version:', cv.getBuildInformation());
    updateStatus('OpenCV loaded successfully');
    
    // Initialize elements
    AppState.video = document.getElementById('video');
    AppState.canvas = document.getElementById('canvas');
    AppState.outputCanvas = document.getElementById('outputCanvas');
    AppState.processedCanvas = document.getElementById('processedCanvas');
    
    // Initialize canvases context
    AppState.outputCtx = AppState.outputCanvas.getContext('2d');
    AppState.processedCtx = AppState.processedCanvas.getContext('2d');
    
    // Set canvas dimensions
    const setCanvasSize = (canvas) => {
        canvas.width = 400;
        canvas.height = 400;
    };
    
    setCanvasSize(AppState.outputCanvas);
    setCanvasSize(AppState.processedCanvas);
    AppState.canvas.width = 640;
    AppState.canvas.height = 480;
    
    // Initialize event listeners
    initializeEventListeners();
    
    updateStatus('Ready to start camera');
}

// Initialize all event listeners
function initializeEventListeners() {
    // Camera controls
    document.getElementById('startCamera').addEventListener('click', startCamera);
    document.getElementById('capture').addEventListener('click', captureImage);
    document.getElementById('reset').addEventListener('click', resetApp);
    
    // Reference object selection
    document.getElementById('refType').addEventListener('change', function() {
        const customRefDiv = document.getElementById('customRef');
        if (this.value === 'custom') {
            customRefDiv.style.display = 'block';
        } else {
            customRefDiv.style.display = 'none';
            // Set predefined diameters
            const diameters = {
                'coin': 2.5,  // 1 Rupee
                'coin2': 2.7, // 2 Rupee
                'coin5': 2.5  // 5 Rupee
            };
            AppState.referenceDiameter = diameters[this.value] || 2.5;
        }
    });
    
    // Custom diameter input
    document.getElementById('refDiameter').addEventListener('input', function() {
        AppState.referenceDiameter = parseFloat(this.value) || 2.5;
    });
    
    // Drape tester settings
    document.getElementById('diskDiameter').addEventListener('input', function() {
        AppState.diskDiameter = parseFloat(this.value) || 18.0;
    });
    
    document.getElementById('fabricDiameter').addEventListener('input', function() {
        AppState.fabricDiameter = parseFloat(this.value) || 30.0;
    });
    
    document.getElementById('calculateDrape').addEventListener('click', calculateDrapeCoefficient);
    
    // Export data
    document.getElementById('exportData').addEventListener('click', exportToCSV);
    
    // Canvas click for reference point selection
    AppState.outputCanvas.addEventListener('click', function(event) {
        if (!AppState.capturedImage) return;
        
        const rect = this.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Scale coordinates from display to original image size
        const scaleX = AppState.capturedImage.cols / this.width;
        const scaleY = AppState.capturedImage.rows / this.height;
        
        AppState.referencePoint = {
            x: Math.floor(x * scaleX),
            y: Math.floor(y * scaleY)
        };
        
        // Draw reference point on image
        drawReferencePoint();
        updateStatus('Reference point selected. Click "Calculate Drape %"');
    });
}

// Start Camera Function
async function startCamera() {
    try {
        updateStatus('Accessing camera...');
        
        const constraints = {
            video: {
                facingMode: 'environment', // Use rear camera
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        AppState.video.srcObject = stream;
        AppState.isCameraActive = true;
        
        // Enable/disable buttons
        document.getElementById('startCamera').disabled = true;
        document.getElementById('capture').disabled = false;
        document.getElementById('reset').disabled = false;
        
        updateStatus('Camera active. Position drape in circle and tap "Capture"');
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        updateStatus('Error: Could not access camera. Check permissions.');
        alert('Camera access denied. Please allow camera permissions and refresh.');
    }
}

// Capture Image Function
function captureImage() {
    if (!AppState.isCameraActive) {
        updateStatus('Start camera first');
        return;
    }
    
    updateStatus('Capturing image...');
    
    // Draw video frame to canvas
    const ctx = AppState.canvas.getContext('2d');
    ctx.drawImage(AppState.video, 0, 0, AppState.canvas.width, AppState.canvas.height);
    
    // Convert canvas to OpenCV Mat
    const imageData = ctx.getImageData(0, 0, AppState.canvas.width, AppState.canvas.height);
    AppState.capturedImage = cv.matFromImageData(imageData);
    
    // Display captured image
    cv.imshow(AppState.outputCanvas, AppState.capturedImage);
    
    updateStatus('Image captured. Select reference point (coin) in the image above.');
    
    // Stop camera to save battery
    stopCamera();
}

// Process Image for Drape Area
function processImage() {
    if (!AppState.capturedImage || AppState.isProcessing) return;
    
    AppState.isProcessing = true;
    updateStatus('Processing image...');
    
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
            
            // Draw the contour on processed image
            let processed = new cv.Mat(src.rows, src.cols, cv.CV_8UC3, [255, 255, 255, 255]);
            cv.drawContours(processed, contours, maxContourIndex, [0, 255, 0, 255], 2);
            
            // Display processed image
            cv.imshow(AppState.processedCanvas, processed);
            
            // Calculate actual area if reference is available
            if (AppState.referencePoint) {
                calculateActualArea(largestContour);
            }
            
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
    }
    
    AppState.isProcessing = false;
}

// Calculate Actual Area from Pixel Area
function calculateActualArea(drapeContour) {
    if (!AppState.referencePoint) {
        updateStatus('Select reference point first');
        return;
    }
    
    // For now, we'll use a simplified approach
    // In a complete implementation, you'd detect the reference object automatically
    
    // Simplified: Assume reference is at selected point
    // Calculate pixels per cm from reference diameter
    const referenceRadiusPixels = detectReferenceSize(); // This would be implemented
    
    // For this example, we'll use a fixed conversion
    // In real app, you'd calculate this from reference detection
    const pixelsPerCm = 50; // Example: 50 pixels = 1 cm
    
    // Calculate area in cm²
    const actualAreaCm2 = AppState.pixelArea / (pixelsPerCm * pixelsPerCm);
    
    // Update UI
    document.getElementById('pixelArea').textContent = AppState.pixelArea.toFixed(0);
    document.getElementById('actualArea').textContent = actualAreaCm2.toFixed(2);
    
    // Store for drape calculation
    AppState.drapeArea = actualAreaCm2;
    
    updateStatus('Area calculated. Click "Calculate Drape %"');
}

// Calculate Drape Coefficient
function calculateDrapeCoefficient() {
    if (!AppState.drapeArea) {
        updateStatus('Capture and process image first');
        return;
    }
    
    // Get drape tester dimensions
    const diskRadius = AppState.diskDiameter / 2;
    const fabricRadius = AppState.fabricDiameter / 2;
    
    // Calculate areas
    const diskArea = Math.PI * diskRadius * diskRadius;
    const fabricArea = Math.PI * fabricRadius * fabricRadius;
    const drapeArea = AppState.drapeArea;
    
    // Calculate drape coefficient (standard formula)
    const drapeCoefficient = ((drapeArea - diskArea) / (fabricArea - diskArea)) * 100;
    
    // Update UI
    document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
    
    // Add to history
    addToHistory(drapeArea, drapeCoefficient);
    
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
    }
}

function resetApp() {
    stopCamera();
    
    // Clear canvases
    const contexts = [
        AppState.outputCtx,
        AppState.processedCtx,
        AppState.canvas.getContext('2d')
    ];
    
    contexts.forEach(ctx => {
        if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    });
    
    // Reset state
    AppState.capturedImage = null;
    AppState.referencePoint = null;
    AppState.drapeArea = null;
    
    // Reset UI
    document.getElementById('pixelArea').textContent = '--';
    document.getElementById('actualArea').textContent = '--';
    document.getElementById('drapeCoefficient').textContent = '--';
    
    document.getElementById('startCamera').disabled = false;
    document.getElementById('capture').disabled = true;
    
    updateStatus('App reset. Ready to start again.');
}

function drawReferencePoint() {
    if (!AppState.referencePoint || !AppState.outputCtx) return;
    
    const ctx = AppState.outputCtx;
    const scaleX = AppState.outputCanvas.width / AppState.capturedImage.cols;
    const scaleY = AppState.outputCanvas.height / AppState.capturedImage.rows;
    
    const x = AppState.referencePoint.x * scaleX;
    const y = AppState.referencePoint.y * scaleY;
    
    // Draw circle at reference point
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(x - 15, y);
    ctx.lineTo(x + 15, y);
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x, y + 15);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
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

// This would be implemented for automatic reference detection
function detectReferenceSize() {
    // TODO: Implement automatic coin/reference detection
    // This would use Hough Circle Transform or template matching
    return 25; // Example: 25 pixel radius
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if OpenCV is already loaded (in case DOM loads after OpenCV)
    if (typeof cv !== 'undefined' && cv.getBuildInformation) {
        onOpenCvReady();
    }
});