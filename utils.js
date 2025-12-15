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
    
    // Draw measurement overlay
    drawMeasurementOverlay: function(ctx, area, unit = 'cm²') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 200, 80);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Measurement Results', 20, 35);
        
        ctx.font = '14px Arial';
        ctx.fillText(`Area: ${area.toFixed(2)} ${unit}`, 20, 60);
        ctx.fillText('Click to select reference', 20, 80);
    },
    
    // Calculate distance between two points
    distance: function(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    
    // Calculate angle from accelerometer data
    calculateAngleFromAcceleration: function(acceleration) {
        if (!acceleration || !acceleration.x || !acceleration.y || !acceleration.z) {
            return 0;
        }
        
        const x = acceleration.x;
        const y = acceleration.y;
        const z = acceleration.z;
        
        // Calculate tilt angle using simple formula
        const angle = Math.atan2(Math.sqrt(x*x + y*y), Math.abs(z)) * (180 / Math.PI);
        return Math.min(angle, 90); // Cap at 90 degrees
    },
    
    // Calculate bubble position from angles
    calculateBubblePosition: function(beta, gamma) {
        // beta: front-to-back tilt (-180 to 180)
        // gamma: left-to-right tilt (-90 to 90)
        
        // Normalize angles to -1 to 1 range
        const maxTilt = 45; // Maximum tilt for full bubble movement
        
        // Clamp values
        const normX = Math.max(Math.min(gamma / maxTilt, 1), -1);
        const normY = Math.max(Math.min(beta / maxTilt, 1), -1);
        
        // Calculate movement (max 18px in any direction for 50px bubble)
        const maxMovement = 18;
        
        return {
            x: normX * maxMovement,
            y: normY * maxMovement
        };
    },
    
    // Calculate precise canvas click coordinates
    calculateCanvasClick: function(event, canvas, actualWidth, actualHeight) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // Get click position
        const clickX = (event.clientX - rect.left) * scaleX;
        const clickY = (event.clientY - rect.top) * scaleY;
        
        // Calculate actual coordinates
        const actualX = Math.round(clickX);
        const actualY = Math.round(clickY);
        
        return {
            clickX: clickX,
            clickY: clickY,
            actualX: Math.max(0, Math.min(actualX, actualWidth - 1)),
            actualY: Math.max(0, Math.min(actualY, actualHeight - 1)),
            scaleX: scaleX,
            scaleY: scaleY,
            isWithinCanvas: (
                clickX >= 0 && clickX <= canvas.width &&
                clickY >= 0 && clickY <= canvas.height
            )
        };
    },
    
    // Enhanced reference point detection
    detectReferenceAtPoint: function(imageData, x, y, radius = 50) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        
        // Get pixel color at click point
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Sample surrounding area
        let sampleCount = 0;
        let totalR = 0, totalG = 0, totalB = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const sampleX = x + dx;
                const sampleY = y + dy;
                
                if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
                    const sampleIndex = (sampleY * width + sampleX) * 4;
                    totalR += data[sampleIndex];
                    totalG += data[sampleIndex + 1];
                    totalB += data[sampleIndex + 2];
                    sampleCount++;
                }
            }
        }
        
        const avgR = totalR / sampleCount;
        const avgG = totalG / sampleCount;
        const avgB = totalB / sampleCount;
        
        // Calculate color difference
        const colorDiff = Math.sqrt(
            Math.pow(r - avgR, 2) +
            Math.pow(g - avgG, 2) +
            Math.pow(b - avgB, 2)
        );
        
        return {
            color: { r, g, b },
            averageColor: { r: avgR, g: avgG, b: avgB },
            colorDifference: colorDiff,
            isDistinct: colorDiff > 30 // Threshold for distinct color
        };
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
    },
    
    validateDrapeInputs: function(diskDiameter, fabricDiameter) {
        const diskValidation = this.validateDiameter(diskDiameter);
        if (!diskValidation.valid) return diskValidation;
        
        const fabricValidation = this.validateDiameter(fabricDiameter);
        if (!fabricValidation.valid) return fabricValidation;
        
        if (fabricDiameter <= diskDiameter) {
            return { valid: false, error: 'Fabric diameter must be larger than disk diameter' };
        }
        
        return { valid: true };
    },
    
    validateReferencePoint: function(point, imageWidth, imageHeight) {
        if (!point) {
            return { valid: false, error: 'No reference point selected' };
        }
        
        if (point.x < 0 || point.x >= imageWidth || 
            point.y < 0 || point.y >= imageHeight) {
            return { valid: false, error: 'Reference point is outside image bounds' };
        }
        
        return { valid: true };
    }
};

// File utilities
const FileUtils = {
    saveImage: function(canvas, filename = 'drape-measurement.png') {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    },
    
    loadImage: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    resolve(img);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    saveCSV: function(data, filename = 'drape-data.csv') {
        // Convert data to CSV format
        let csv = 'Date,Time,Area (cm²),Drape Coefficient (%),Fabric Drape Status\n';
        
        data.forEach(item => {
            csv += `"${item.date}","${item.time}","${item.area}","${item.drapePercent}","${item.status || ''}"\n`;
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    },
    
    saveProcessedImage: function(originalCanvas, processedCanvas, filename = 'drape-analysis.png') {
        // Create a combined canvas
        const combinedCanvas = document.createElement('canvas');
        const ctx = combinedCanvas.getContext('2d');
        
        // Set dimensions
        combinedCanvas.width = originalCanvas.width + processedCanvas.width + 20;
        combinedCanvas.height = Math.max(originalCanvas.height, processedCanvas.height) + 100;
        
        // Draw background
        ctx.fillStyle = '#f5f7fa';
        ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
        
        // Draw original image
        ctx.drawImage(originalCanvas, 10, 10);
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#333';
        ctx.fillText('Original Image', 10, originalCanvas.height + 30);
        
        // Draw processed image
        ctx.drawImage(processedCanvas, originalCanvas.width + 20, 10);
        ctx.fillText('Processed Image', originalCanvas.width + 20, processedCanvas.height + 30);
        
        // Add results
        ctx.font = '14px Arial';
        ctx.fillText(`Analysis Date: ${new Date().toLocaleDateString()}`, 10, combinedCanvas.height - 60);
        ctx.fillText(`Area: ${document.getElementById('actualArea').textContent}`, 10, combinedCanvas.height - 40);
        ctx.fillText(`Drape Coefficient: ${document.getElementById('drapeCoefficient').textContent}`, 10, combinedCanvas.height - 20);
        
        // Save the combined image
        this.saveImage(combinedCanvas, filename);
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
    },
    
    // Calculate pixel to cm ratio
    pixelToCmRatio: function(referencePixelDiameter, referenceActualDiameter) {
        if (referencePixelDiameter <= 0) return 1;
        return referenceActualDiameter / referencePixelDiameter;
    },
    
    // Get reference diameter based on type
    getReferenceDiameter: function(refType, customDiameter = 2.5) {
        switch(refType) {
            case 'coin2':
                return 2.5; // Indian 2 Rupee Coin
            case 'coin10':
                return 2.7; // Indian 10 Rupee Coin
            case 'custom':
                return customDiameter;
            default:
                return 2.5; // Default to 2 Rupee coin
        }
    },
    
    // Calculate actual area from pixel area
    calculateActualArea: function(pixelArea, pixelToCmRatio) {
        return pixelArea * pixelToCmRatio * pixelToCmRatio;
    }
};

// UI utilities
const UIUtils = {
    showToast: function(message, type = 'info', duration = 3000) {
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
            padding: 15px 25px;
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : type === 'warning' ? '#f39c12' : '#3498db'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(toast);
        
        // Remove toast after duration
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    },
    
    showLoading: function(show = true, message = 'Processing...') {
        let loader = document.getElementById('global-loader');
        
        if (show && !loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.innerHTML = `<div class="loader"></div><p>${message}</p>`;
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
                backdrop-filter: blur(3px);
            `;
            document.body.appendChild(loader);
        } else if (!show && loader) {
            loader.remove();
        }
    },
    
    updateButtonState: function(buttonId, enabled, text = null) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        button.disabled = !enabled;
        if (text !== null) {
            button.innerHTML = text;
        }
    },
    
    // Enhanced level indicator update
    updateLevelIndicator: function(angle, beta = 0, gamma = 0) {
        const bubbleCenter = document.querySelector('.bubble-center');
        const levelStatus = document.getElementById('levelStatus');
        
        if (!bubbleCenter || !levelStatus) return;
        
        // Update angle display
        levelStatus.textContent = angle.toFixed(1);
        
        // Calculate bubble position
        const maxTilt = 45;
        const maxMovement = 18;
        
        const normX = Math.max(Math.min(gamma / maxTilt, 1), -1);
        const normY = Math.max(Math.min(beta / maxTilt, 1), -1);
        
        const posX = normX * maxMovement;
        const posY = normY * maxMovement;
        
        bubbleCenter.style.transform = `translate(-50%, -50%) translate(${posX}px, ${posY}px)`;
        
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
    },
    
    // Reset level indicator
    resetLevelIndicator: function() {
        const bubbleCenter = document.querySelector('.bubble-center');
        const levelStatus = document.getElementById('levelStatus');
        
        if (bubbleCenter) {
            bubbleCenter.style.transform = 'translate(-50%, -50%) translate(0px, 0px)';
            bubbleCenter.style.background = '#00ff00';
            bubbleCenter.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.7)';
        }
        
        if (levelStatus) {
            levelStatus.textContent = '0.0';
            levelStatus.style.color = '#00ff00';
        }
    },
    
    // Enhanced precision mode
    enablePrecisionMode: function(canvasId, enable = true) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        if (enable) {
            canvas.classList.add('precision-mode');
            canvas.style.cursor = 'crosshair';
            
            // Add grid overlay
            let grid = canvas.nextElementSibling;
            if (!grid || !grid.classList.contains('canvas-grid-overlay')) {
                grid = document.createElement('div');
                grid.className = 'canvas-grid-overlay';
                grid.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-image: 
                        linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
                    background-size: 20px 20px;
                    pointer-events: none;
                    opacity: 0.3;
                    z-index: 5;
                `;
                canvas.parentNode.insertBefore(grid, canvas.nextSibling);
            }
            grid.style.display = 'block';
        } else {
            canvas.classList.remove('precision-mode');
            canvas.style.cursor = 'default';
            
            // Hide grid overlay
            const grid = canvas.nextElementSibling;
            if (grid && grid.classList.contains('canvas-grid-overlay')) {
                grid.style.display = 'none';
            }
        }
    },
    
    // Show reference marker
    showReferenceMarker: function(x, y, label = 'REF') {
        // Remove existing marker
        this.hideReferenceMarker();
        
        const marker = document.createElement('div');
        marker.className = 'reference-marker';
        marker.id = 'reference-marker';
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';
        marker.innerHTML = label;
        
        const cameraContainer = document.querySelector('.camera-container');
        if (cameraContainer) {
            cameraContainer.appendChild(marker);
        }
    },
    
    // Hide reference marker
    hideReferenceMarker: function() {
        const marker = document.getElementById('reference-marker');
        if (marker) {
            marker.remove();
        }
    }
};

// Device utilities
const DeviceUtils = {
    isMobile: function() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    hasAccelerometer: function() {
        return 'DeviceOrientationEvent' in window || 
               'DeviceMotionEvent' in window ||
               (window.DeviceOrientationEvent !== undefined);
    },
    
    hasCamera: function() {
        return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    },
    
    requestAccelerometerPermission: function() {
        return new Promise((resolve) => {
            if (typeof DeviceOrientationEvent !== 'undefined' && 
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                // iOS 13+ devices
                DeviceOrientationEvent.requestPermission()
                    .then(permissionState => {
                        if (permissionState === 'granted') {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    })
                    .catch(() => resolve(false));
            } else {
                // Other devices
                resolve(true);
            }
        });
    },
    
    requestCameraPermission: function() {
        return new Promise((resolve) => {
            if (!this.hasCamera()) {
                resolve(false);
                return;
            }
            
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    // Stop the stream immediately after permission is granted
                    stream.getTracks().forEach(track => track.stop());
                    resolve(true);
                })
                .catch(error => {
                    console.error('Camera permission denied:', error);
                    resolve(false);
                });
        });
    },
    
    // Enhanced device orientation handling
    setupDeviceOrientation: function(callback) {
        if (!this.hasAccelerometer()) {
            console.log('Device orientation not supported');
            return false;
        }
        
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ devices need permission
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', callback);
                        return true;
                    } else {
                        console.log('Device orientation permission denied');
                        return false;
                    }
                })
                .catch(console.error);
        } else {
            // Android and other devices
            window.addEventListener('deviceorientation', callback);
            return true;
        }
        
        return false;
    }
};

// Camera utilities
const CameraUtils = {
    stream: null,
    videoElement: null,
    canvasElement: null,
    
    // Initialize camera
    initCamera: function(videoId = 'cameraVideo', canvasId = 'cameraCanvas') {
        this.videoElement = document.getElementById(videoId);
        this.canvasElement = document.getElementById(canvasId);
        
        if (!this.videoElement) {
            console.error('Video element not found');
            return Promise.reject('Video element not found');
        }
        
        if (!this.canvasElement) {
            console.error('Canvas element not found');
            return Promise.reject('Canvas element not found');
        }
        
        return this.startCamera();
    },
    
    // Start camera stream
    startCamera: function() {
        return new Promise((resolve, reject) => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                reject('Camera not supported on this device');
                return;
            }
            
            // Stop existing stream if any
            if (this.stream) {
                this.stopCamera();
            }
            
            const constraints = {
                video: {
                    facingMode: 'environment', // Prefer rear camera
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            
            navigator.mediaDevices.getUserMedia(constraints)
                .then(stream => {
                    this.stream = stream;
                    this.videoElement.srcObject = stream;
                    
                    this.videoElement.onloadedmetadata = () => {
                        // Set canvas dimensions to match video
                        this.canvasElement.width = this.videoElement.videoWidth;
                        this.canvasElement.height = this.videoElement.videoHeight;
                        
                        // Start video playback
                        this.videoElement.play()
                            .then(() => {
                                resolve({
                                    width: this.videoElement.videoWidth,
                                    height: this.videoElement.videoHeight
                                });
                            })
                            .catch(reject);
                    };
                })
                .catch(error => {
                    console.error('Error accessing camera:', error);
                    
                    // Try with less restrictive constraints
                    const fallbackConstraints = { video: true };
                    
                    navigator.mediaDevices.getUserMedia(fallbackConstraints)
                        .then(stream => {
                            this.stream = stream;
                            this.videoElement.srcObject = stream;
                            
                            this.videoElement.onloadedmetadata = () => {
                                this.canvasElement.width = this.videoElement.videoWidth;
                                this.canvasElement.height = this.videoElement.videoHeight;
                                
                                this.videoElement.play()
                                    .then(() => {
                                        resolve({
                                            width: this.videoElement.videoWidth,
                                            height: this.videoElement.videoHeight
                                        });
                                    })
                                    .catch(reject);
                            };
                        })
                        .catch(fallbackError => {
                            reject(`Camera access denied: ${fallbackError.message}`);
                        });
                });
        });
    },
    
    // Stop camera stream
    stopCamera: function() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }
        
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
    },
    
    // Capture photo from camera
    capturePhoto: function() {
        return new Promise((resolve, reject) => {
            if (!this.canvasElement || !this.videoElement) {
                reject('Camera not initialized');
                return;
            }
            
            const ctx = this.canvasElement.getContext('2d');
            
            // Draw video frame to canvas
            ctx.drawImage(
                this.videoElement, 
                0, 0, 
                this.canvasElement.width, 
                this.canvasElement.height
            );
            
            // Create an image from the canvas
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject('Failed to create image from canvas');
            image.src = this.canvasElement.toDataURL('image/png');
        });
    },
    
    // Get camera status
    isCameraActive: function() {
        return this.stream !== null && this.stream.active;
    },
    
    // Switch camera (front/back)
    switchCamera: function() {
        if (!this.stream) return Promise.reject('No active camera stream');
        
        const currentTrack = this.stream.getVideoTracks()[0];
        if (!currentTrack) return Promise.reject('No video track found');
        
        const currentFacingMode = currentTrack.getSettings().facingMode;
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        this.stopCamera();
        
        const constraints = {
            video: {
                facingMode: newFacingMode,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };
        
        return this.startCamera(constraints);
    }
};

// Image analysis utilities
const ImageAnalysis = {
    // Enhanced edge detection
    detectEdges: function(imageMat) {
        let gray = new cv.Mat();
        let edges = new cv.Mat();
        
        // Convert to grayscale
        cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
        
        // Apply Gaussian blur
        cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0);
        
        // Detect edges using Canny
        cv.Canny(gray, edges, 50, 150);
        
        // Clean up
        gray.delete();
        
        return edges;
    },
    
    // Detect circles (for coin reference)
    detectCircles: function(imageMat, minRadius = 10, maxRadius = 100) {
        let gray = new cv.Mat();
        let circles = new cv.Mat();
        
        // Convert to grayscale
        cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
        
        // Apply Gaussian blur
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
        
        // Detect circles using Hough Transform
        cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 
            1, // dp
            20, // minDist
            100, // param1
            30, // param2
            minRadius, // minRadius
            maxRadius // maxRadius
        );
        
        // Convert circles to array
        const circleArray = [];
        for (let i = 0; i < circles.cols; i++) {
            const circle = circles.data32F.slice(i * 3, (i + 1) * 3);
            circleArray.push({
                x: circle[0],
                y: circle[1],
                radius: circle[2]
            });
        }
        
        // Clean up
        gray.delete();
        circles.delete();
        
        return circleArray;
    },
    
    // Find closest circle to point
    findClosestCircle: function(circles, pointX, pointY) {
        let closestCircle = null;
        let minDistance = Infinity;
        
        circles.forEach(circle => {
            const distance = Math.sqrt(
                Math.pow(circle.x - pointX, 2) + 
                Math.pow(circle.y - pointY, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestCircle = circle;
            }
        });
        
        return {
            circle: closestCircle,
            distance: minDistance
        };
    },
    
    // Detect dark areas (drape shadow)
    detectDarkAreas: function(imageMat, threshold = 100) {
        let gray = new cv.Mat();
        let binary = new cv.Mat();
        
        // Convert to grayscale
        cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
        
        // Apply threshold
        cv.threshold(gray, binary, threshold, 255, cv.THRESH_BINARY_INV);
        
        // Find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(binary, contours, hierarchy, 
            cv.RETR_EXTERNAL, 
            cv.CHAIN_APPROX_SIMPLE
        );
        
        // Clean up
        gray.delete();
        binary.delete();
        hierarchy.delete();
        
        return contours;
    },
    
    // Calculate area of largest contour
    calculateLargestArea: function(contours) {
        let maxArea = 0;
        let largestContour = null;
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            if (area > maxArea) {
                maxArea = area;
                largestContour = contour;
            }
        }
        
        return {
            area: maxArea,
            contour: largestContour
        };
    }
};

// Export all utilities
window.ImageUtils = ImageUtils;
window.Validation = Validation;
window.FileUtils = FileUtils;
window.DrapeFormulas = DrapeFormulas;
window.UIUtils = UIUtils;
window.DeviceUtils = DeviceUtils;
window.CameraUtils = CameraUtils;
window.ImageAnalysis = ImageAnalysis;
