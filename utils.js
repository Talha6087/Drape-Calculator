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
    
    // Calculate angle from accelerometer data (SIMPLIFIED)
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
    
    // Calculate bubble position from angles (SIMPLIFIED & CORRECTED)
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
    
    // CORRECTED: Update level indicator with proper bubble movement
    updateLevelIndicator: function(angle, beta = 0, gamma = 0) {
        const bubbleCenter = document.querySelector('.bubble-center');
        const levelStatus = document.getElementById('levelStatus');
        
        if (!bubbleCenter || !levelStatus) return;
        
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
        
        // Calculate bubble position from tilt angles
        const pos = ImageUtils.calculateBubblePosition(beta, gamma);
        
        // Apply transform - CORRECTED: Use proper transform
        bubbleCenter.style.transform = `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`;
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
    }
};

const ImageUtils = {
    // ... existing functions ...
    
    // Calculate precise canvas click coordinates
    calculateCanvasClick: function(event, canvas, actualWidth, actualHeight) {
        const rect = canvas.getBoundingClientRect();
        const offsetX = parseFloat(canvas.dataset.offsetX) || 0;
        const offsetY = parseFloat(canvas.dataset.offsetY) || 0;
        const renderedWidth = parseFloat(canvas.dataset.renderedWidth) || rect.width;
        const renderedHeight = parseFloat(canvas.dataset.renderedHeight) || rect.height;
        
        // Get click position
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Calculate position within rendered image
        const renderedX = clickX - offsetX;
        const renderedY = clickY - offsetY;
        
        // Calculate scale factors
        const scaleX = actualWidth / renderedWidth;
        const scaleY = actualHeight / renderedHeight;
        
        // Calculate actual coordinates
        const actualX = Math.round(renderedX * scaleX);
        const actualY = Math.round(renderedY * scaleY);
        
        // Clamp to canvas bounds
        const clampedX = Math.max(0, Math.min(actualX, actualWidth - 1));
        const clampedY = Math.max(0, Math.min(actualY, actualHeight - 1));
        
        return {
            clickX: clickX,
            clickY: clickY,
            renderedX: renderedX,
            renderedY: renderedY,
            actualX: clampedX,
            actualY: clampedY,
            scaleX: scaleX,
            scaleY: scaleY,
            offsetX: offsetX,
            offsetY: offsetY,
            isWithinImage: (
                renderedX >= 0 && renderedX <= renderedWidth &&
                renderedY >= 0 && renderedY <= renderedHeight
            )
        };
    },
    
  
};

// Export all utilities
window.ImageUtils = ImageUtils;
window.Validation = Validation;
window.FileUtils = FileUtils;
window.DrapeFormulas = DrapeFormulas;
window.UIUtils = UIUtils;
window.DeviceUtils = DeviceUtils;
