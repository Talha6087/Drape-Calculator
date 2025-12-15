// Drape Area Calculator - Simplified Working Version

// Global variables
let stream = null;
let streaming = false;
let capturedImage = null;
let referencePoint = null;
let measurementHistory = [];
let isProcessing = false;

// OpenCV ready handler
function onOpenCvReady() {
    console.log('OpenCV.js is ready');
    initializeApp();
}

// Initialize the application
function initializeApp() {
    console.log('Initializing Drape Calculator...');
    
    // Set up all event listeners
    setupEventListeners();
    
    // Load history from localStorage
    loadHistory();
    
    // Update UI state
    updateUIState();
    
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
    
    // Canvas click for reference selection
    const originalCanvas = document.getElementById('originalCanvas');
    if (originalCanvas) {
        originalCanvas.addEventListener('click', handleCanvasClick);
        console.log('Canvas click listener added');
    }
    
    console.log('All event listeners set up');
}

// Update UI state based on current status
function updateUIState() {
    const captureBtn = document.getElementById('capture');
    const resetBtn = document.getElementById('reset');
    const startCameraBtn = document.getElementById('startCamera');
    const uploadImageBtn = document.getElementById('uploadImage');
    
    if (capturedImage) {
        // Image is captured/uploaded
        if (captureBtn) captureBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = false;
        if (startCameraBtn) startCameraBtn.disabled = true;
        if (uploadImageBtn) uploadImageBtn.disabled = false;
    } else if (streaming) {
        // Camera is streaming
        if (captureBtn) captureBtn.disabled = false;
        if (resetBtn) resetBtn.disabled = false;
        if (startCameraBtn) startCameraBtn.disabled = true;
        if (uploadImageBtn) uploadImageBtn.disabled = true;
    } else {
        // Initial state
        if (captureBtn) captureBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = true;
        if (startCameraBtn) startCameraBtn.disabled = false;
        if (uploadImageBtn) uploadImageBtn.disabled = false;
    }
}

// Start camera function - SIMPLIFIED
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

// Handle image upload - SIMPLIFIED
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
            const video = document.getElementById('video');
            const canvas = document.getElementById('canvas');
            const originalCanvas = document.getElementById('originalCanvas');
            
            // Hide video
            video.style.display = 'none';
            
            // Store actual dimensions
            const actualWidth = img.width;
            const actualHeight = img.height;
            
            // Set canvas dimensions
            canvas.width = actualWidth;
            canvas.height = actualHeight;
            
            // For display, calculate size that fits
            const maxWidth = 800;
            const maxHeight = 600;
            
            let displayWidth = actualWidth;
            let displayHeight = actualHeight;
            
            if (displayWidth > maxWidth || displayHeight > maxHeight) {
                const ratio = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
                displayWidth = Math.floor(displayWidth * ratio);
                displayHeight = Math.floor(displayHeight * ratio);
            }
            
            originalCanvas.width = displayWidth;
            originalCanvas.height = displayHeight;
            
            // Draw to processing canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, actualWidth, actualHeight);
            
            // Store image data
            capturedImage = ctx.getImageData(0, 0, actualWidth, actualHeight);
            
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
    const actualWidth = video.videoWidth;
    const actualHeight = video.videoHeight;
    
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    // Calculate display dimensions
    const maxWidth = 800;
    const maxHeight = 600;
    
    let displayWidth = actualWidth;
    let displayHeight = actualHeight;
    
    if (displayWidth > maxWidth || displayHeight > maxHeight) {
        const ratio = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
        displayWidth = Math.floor(displayWidth * ratio);
        displayHeight = Math.floor(displayHeight * ratio);
    }
    
    originalCanvas.width = displayWidth;
    originalCanvas.height = displayHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, actualWidth, actualHeight);
    
    // Store image data
    capturedImage = ctx.getImageData(0, 0, actualWidth, actualHeight);
    
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

// Handle canvas click for reference selection
function handleCanvasClick(event) {
    if (!capturedImage) return;
    
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate click position relative to canvas
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Calculate scale factors
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Calculate actual coordinates
    const actualX = Math.round(clickX * scaleX);
    const actualY = Math.round(clickY * scaleY);
    
    // Store reference point
    referencePoint = {
        x: actualX,
        y: actualY,
        displayX: clickX,
        displayY: clickY
    };
    
    console.log('Reference point selected:', referencePoint);
    
    // Draw marker
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(clickX, clickY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Update status
    document.getElementById('status').textContent = 'Reference selected. Processing image...';
    
    // Process image
    setTimeout(() => {
        processImageWithReference();
    }, 500);
}

// Process image with reference
async function processImageWithReference() {
    if (!capturedImage || !referencePoint || isProcessing) return;
    
    isProcessing = true;
    document.getElementById('status').textContent = 'Processing image...';
    
    try {
        // Simple area calculation (for demo)
        // In real app, you would use OpenCV here
        
        const mockPixelArea = 50000; // Mock value
        const mockActualArea = 150.25; // Mock value in cm²
        
        document.getElementById('pixelArea').textContent = mockPixelArea.toFixed(0);
        document.getElementById('actualArea').textContent = mockActualArea.toFixed(2);
        
        // Calculate drape coefficient
        const drapeCoefficient = calculateDrapeCoefficient(mockActualArea);
        if (drapeCoefficient !== null) {
            document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
            addToHistory(mockActualArea, drapeCoefficient);
        }
        
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
    if (!capturedImage) {
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
    
    // Clear stored data
    capturedImage = null;
    referencePoint = null;
    streaming = false;
    isProcessing = false;
    
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
