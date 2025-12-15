// Utility functions for the Drape Calculator - COMPLETE FIXED VERSION

// Image processing utilities
const ImageUtils = {
    // Convert between coordinate systems - FIXED VERSION
    scaleCoordinates: function(x, y, fromWidth, fromHeight, toWidth, toHeight) {
        return {
            x: (x / fromWidth) * toWidth,
            y: (y / fromHeight) * toHeight
        };
    },
    
    // Calculate actual coordinates from display coordinates - NEW & IMPROVED
    calculateActualCoordinates: function(displayX, displayY, displayWidth, displayHeight, actualWidth, actualHeight) {
        const scaleX = actualWidth / displayWidth;
        const scaleY = actualHeight / displayHeight;
        
        return {
            actualX: Math.round(displayX * scaleX),
            actualY: Math.round(displayY * scaleY),
            scaleX: scaleX,
            scaleY: scaleY
        };
    },
    
    // Enhanced: Get display coordinates from actual coordinates
    calculateDisplayCoordinates: function(actualX, actualY, actualWidth, actualHeight, displayWidth, displayHeight) {
        const scaleX = displayWidth / actualWidth;
        const scaleY = displayHeight / actualHeight;
        
        return {
            displayX: Math.round(actualX * scaleX),
            displayY: Math.round(actualY * scaleY),
            scaleX: scaleX,
            scaleY: scaleY
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
    },
    
    // Calculate precise canvas click coordinates - FIXED VERSION
    calculateCanvasClick: function(event, canvas, actualWidth, actualHeight) {
        const rect = canvas.getBoundingClientRect();
        
        // Get click position relative to canvas
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Calculate scale factors - FIXED: Use canvas dimensions, not rect dimensions
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // Calculate pixel coordinates within canvas
        const canvasX = clickX * scaleX;
        const canvasY = clickY * scaleY;
        
        // Calculate actual coordinates in original image
        const actualX = Math.round((canvasX / canvas.width) * actualWidth);
        const actualY = Math.round((canvasY / canvas.height) * actualHeight);
        
        return {
            clickX: clickX,
            clickY: clickY,
            canvasX: canvasX,
            canvasY: canvasY,
            actualX: Math.max(0, Math.min(actualX, actualWidth - 1)),
            actualY: Math.max(0, Math.min(actualY, actualHeight - 1)),
            scaleX: scaleX,
            scaleY: scaleY,
            displayToActualScale: canvas.width / actualWidth,
            isWithinImage: (
                canvasX >= 0 && canvasX <= canvas.width &&
                canvasY >= 0 && canvasY <= canvas.height
            )
        };
    },
    
    // Enhanced reference point detection with color analysis
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
    },
    
    // Detect circles around a point using simple algorithm
    detectCirclesAroundPoint: function(imageData, centerX, centerY, searchRadius = 100) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        
        const circles = [];
        
        // Simple edge detection around the point
        for (let r = 20; r < Math.min(searchRadius, width/4, height/4); r += 5) {
            let edgePoints = 0;
            let totalPoints = 0;
            
            // Sample points on circle circumference
            for (let angle = 0; angle < 360; angle += 10) {
                const rad = angle * Math.PI / 180;
                const x = Math.round(centerX + r * Math.cos(rad));
                const y = Math.round(centerY + r * Math.sin(rad));
                
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    totalPoints++;
                    
                    // Check if this is an edge (significant color change from center)
                    const centerIndex = (centerY * width + centerX) * 4;
                    const pointIndex = (y * width + x) * 4;
                    
                    const centerBrightness = (data[centerIndex] + data[centerIndex+1] + data[centerIndex+2]) / 3;
                    const pointBrightness = (data[pointIndex] + data[pointIndex+1] + data[pointIndex+2]) / 3;
                    
                    if (Math.abs(centerBrightness - pointBrightness) > 50) {
                        edgePoints++;
                    }
                }
            }
            
            // If we found enough edge points, this might be a circle
            if (totalPoints > 0 && edgePoints / totalPoints > 0.6) {
                circles.push({
                    x: centerX,
                    y: centerY,
                    radius: r,
                    confidence: edgePoints / totalPoints
                });
            }
        }
        
        return circles;
    },
    
    // Enhanced: Get image brightness at point
    getBrightnessAtPoint: function(imageData, x, y, sampleRadius = 5) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        
        let totalBrightness = 0;
        let sampleCount = 0;
        
        for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
            for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
                const sampleX = x + dx;
                const sampleY = y + dy;
                
                if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
                    const index = (sampleY * width + sampleX) * 4;
                    const brightness = (data[index] + data[index+1] + data[index+2]) / 3;
                    totalBrightness += brightness;
                    sampleCount++;
                }
            }
        }
        
        return sampleCount > 0 ? totalBrightness / sampleCount : 0;
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
    },
    
    validateCanvasClick: function(clickResult, canvas, actualWidth, actualHeight) {
        if (!clickResult.isWithinImage) {
            return { valid: false, error: 'Click is outside the image area' };
        }
        
        if (clickResult.actualX < 0 || clickResult.actualX >= actualWidth ||
            clickResult.actualY < 0 || clickResult.actualY >= actualHeight) {
            return { valid: false, error: 'Calculated coordinates are invalid' };
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
    },
    
    // Enhanced: Load and validate image with dimensions
    loadAndValidateImage: function(file, maxSizeMB = 10, minWidth = 100, minHeight = 100) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject('No file selected');
                return;
            }
            
            // Check file type
            const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];
            if (!validTypes.includes(file.type)) {
                reject('Invalid file type. Please upload an image (JPEG, PNG, WebP, BMP)');
                return;
            }
            
            // Check file size
            const maxSize = maxSizeMB * 1024 * 1024;
            if (file.size > maxSize) {
                reject(`File is too large. Maximum size is ${maxSizeMB}MB`);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    // Validate dimensions
                    if (img.width < minWidth || img.height < minHeight) {
                        reject(`Image is too small. Minimum dimensions are ${minWidth}x${minHeight} pixels`);
                        return;
                    }
                    
                    resolve({
                        image: img,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        width: img.width,
                        height: img.height
                    });
                };
                img.onerror = function() {
                    reject('Failed to load image');
                };
                img.src = e.target.result;
            };
            reader.onerror = function() {
                reject('Failed to read file');
            };
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
                return parseFloat(customDiameter) || 2.5;
            default:
                return 2.5; // Default to 2 Rupee coin
        }
    },
    
    // Calculate actual area from pixel area
    calculateActualArea: function(pixelArea, pixelToCmRatio) {
        return pixelArea * pixelToCmRatio * pixelToCmRatio;
    },
    
    // Calculate pixel area from actual area
    calculatePixelArea: function(actualArea, pixelToCmRatio) {
        return actualArea / (pixelToCmRatio * pixelToCmRatio);
    },
    
    // Enhanced: Calculate multiple fabric properties
    calculateFabricProperties: function(drapeCoefficient, areaCm2) {
        const properties = {
            drapeCategory: this.fabricProperties(drapeCoefficient),
            stiffness: '',
            drapeability: '',
            recommendedUse: ''
        };
        
        if (drapeCoefficient < 30) {
            properties.stiffness = 'High';
            properties.drapeability = 'Low';
            properties.recommendedUse = 'Structured garments, suits, upholstery';
        } else if (drapeCoefficient < 60) {
            properties.stiffness = 'Medium';
            properties.drapeability = 'Moderate';
            properties.recommendedUse = 'Shirts, dresses, skirts';
        } else if (drapeCoefficient < 85) {
            properties.stiffness = 'Low';
            properties.drapeability = 'Good';
            properties.recommendedUse = 'Draped garments, curtains, flowy designs';
        } else {
            properties.stiffness = 'Very Low';
            properties.drapeability = 'Excellent';
            properties.recommendedUse = 'Evening wear, lingerie, delicate fabrics';
        }
        
        return properties;
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
        
        return toast;
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
    
    updateButtonState: function(buttonId, enabled, text = null, icon = null) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        button.disabled = !enabled;
        
        if (text !== null) {
            if (icon !== null) {
                button.innerHTML = `<i class="fas fa-${icon}"></i> ${text}`;
            } else {
                // Preserve existing icon if any
                const existingIcon = button.querySelector('i');
                if (existingIcon) {
                    button.innerHTML = existingIcon.outerHTML + ' ' + text;
                } else {
                    button.textContent = text;
                }
            }
        }
    },
    
    // Enhanced: Update level indicator with proper bubble movement
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
    },
    
    // Update status with color coding
    updateStatus: function(message, type = 'info') {
        const statusElement = document.getElementById('status');
        if (!statusElement) return;
        
        statusElement.textContent = message;
        statusElement.className = 'value ' + type;
    },
    
    // Update results display
    updateResults: function(pixelArea, actualArea, drapeCoefficient) {
        document.getElementById('pixelArea').textContent = pixelArea.toFixed(0);
        document.getElementById('actualArea').textContent = actualArea.toFixed(2);
        document.getElementById('drapeCoefficient').textContent = drapeCoefficient.toFixed(2) + '%';
    },
    
    // Create visual feedback for clicks
    createClickFeedback: function(x, y, color = 'rgba(0, 255, 0, 0.8)', size = 40) {
        const feedback = document.createElement('div');
        feedback.className = 'click-feedback';
        feedback.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border: 3px solid ${color};
            border-radius: 50%;
            pointer-events: none;
            animation: clickPulse 0.6s ease-out;
            z-index: 100;
            left: ${x - size/2}px;
            top: ${y - size/2}px;
        `;
        
        const cameraContainer = document.querySelector('.camera-container');
        if (cameraContainer) {
            cameraContainer.appendChild(feedback);
            
            // Remove after animation
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 600);
        }
        
        return feedback;
    },
    
    // Draw reference marker on canvas
    drawReferenceMarkerOnCanvas: function(canvas, x, y, label = 'REF') {
        const ctx = canvas.getContext('2d');
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
        const textWidth = ctx.measureText(label).width;
        
        // Draw text background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - textWidth/2 - 5, y - 35, textWidth + 10, 18);
        
        // Draw text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y - 25);
        
        ctx.restore();
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
    },
    
    // Get device pixel ratio
    getDevicePixelRatio: function() {
        return window.devicePixelRatio || 1;
    },
    
    // Check if device supports touch
    isTouchDevice: function() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
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
    startCamera: function(constraints = null) {
        return new Promise((resolve, reject) => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                reject('Camera not supported on this device');
                return;
            }
            
            // Stop existing stream if any
            if (this.stream) {
                this.stopCamera();
            }
            
            const defaultConstraints = {
                video: {
                    facingMode: 'environment', // Prefer rear camera
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            
            const finalConstraints = constraints || defaultConstraints;
            
            navigator.mediaDevices.getUserMedia(finalConstraints)
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
                                    height: this.videoElement.videoHeight,
                                    stream: stream
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
                                            height: this.videoElement.videoHeight,
                                            stream: stream
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
    },
    
    // Get available cameras
    getCameras: function() {
        return new Promise((resolve, reject) => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                reject('Device enumeration not supported');
                return;
            }
            
            navigator.mediaDevices.enumerateDevices()
                .then(devices => {
                    const cameras = devices.filter(device => 
                        device.kind === 'videoinput'
                    );
                    resolve(cameras);
                })
                .catch(reject);
        });
    },
    
    // Set camera by deviceId
    setCamera: function(deviceId) {
        this.stopCamera();
        
        const constraints = {
            video: {
                deviceId: { exact: deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };
        
        return this.startCamera(constraints);
    }
};

// Upload utilities
const UploadUtils = {
    // Handle file upload
    handleFileUpload: function(event, maxSizeMB = 5) {
        return new Promise((resolve, reject) => {
            const file = event.target.files[0];
            
            if (!file) {
                reject('No file selected');
                return;
            }
            
            // Check file type
            const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
            if (!validTypes.includes(file.type)) {
                reject('Invalid file type. Please upload an image (JPEG, PNG, WebP, BMP)');
                return;
            }
            
            // Check file size
            const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
            if (file.size > maxSize) {
                reject(`File is too large. Maximum size is ${maxSizeMB}MB`);
                return;
            }
            
            // Create image from file
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    resolve({
                        image: img,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        dataURL: e.target.result
                    });
                };
                img.onerror = function() {
                    reject('Failed to load image');
                };
                img.src = e.target.result;
            };
            
            reader.onerror = function() {
                reject('Failed to read file');
            };
            
            reader.readAsDataURL(file);
        });
    },
    
    // Create upload button
    createUploadButton: function(callback, accept = 'image/*', multiple = false) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;
        input.style.display = 'none';
        
        input.onchange = function(event) {
            if (callback && typeof callback === 'function') {
                callback(event);
            }
        };
        
        document.body.appendChild(input);
        return input;
    },
    
    // Trigger upload button click
    triggerUpload: function(uploadButtonId = 'uploadInput') {
        const uploadButton = document.getElementById(uploadButtonId);
        if (uploadButton) {
            uploadButton.click();
        } else {
            console.error('Upload button not found');
        }
    },
    
    // Process multiple files
    processMultipleFiles: function(files, maxSizeMB = 5) {
        return new Promise((resolve, reject) => {
            const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
            const maxSize = maxSizeMB * 1024 * 1024;
            
            const promises = Array.from(files).map(file => {
                return new Promise((fileResolve, fileReject) => {
                    // Validate file type
                    if (!validTypes.includes(file.type)) {
                        fileReject(`Invalid file type: ${file.name}`);
                        return;
                    }
                    
                    // Validate file size
                    if (file.size > maxSize) {
                        fileReject(`File too large: ${file.name}`);
                        return;
                    }
                    
                    // Read file
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const img = new Image();
                        img.onload = function() {
                            fileResolve({
                                image: img,
                                fileName: file.name,
                                fileSize: file.size,
                                fileType: file.type,
                                dataURL: e.target.result
                            });
                        };
                        img.onerror = function() {
                            fileReject(`Failed to load image: ${file.name}`);
                        };
                        img.src = e.target.result;
                    };
                    reader.onerror = function() {
                        fileReject(`Failed to read file: ${file.name}`);
                    };
                    reader.readAsDataURL(file);
                });
            });
            
            Promise.allSettled(promises)
                .then(results => {
                    const successful = results
                        .filter(result => result.status === 'fulfilled')
                        .map(result => result.value);
                    
                    const failed = results
                        .filter(result => result.status === 'rejected')
                        .map(result => result.reason);
                    
                    resolve({
                        images: successful,
                        errors: failed
                    });
                });
        });
    },
    
    // Convert image to canvas
    imageToCanvas: function(image) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        return canvas;
    },
    
    // Resize image
    resizeImage: function(image, maxWidth, maxHeight) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width = image.width;
            let height = image.height;
            
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(image, 0, 0, width, height);
            
            const resizedImage = new Image();
            resizedImage.onload = () => resolve(resizedImage);
            resizedImage.src = canvas.toDataURL('image/jpeg', 0.9);
        });
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
    },
    
    // Simple brightness analysis
    analyzeBrightness: function(imageMat) {
        let gray = new cv.Mat();
        cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
        
        const mean = cv.mean(gray);
        gray.delete();
        
        return {
            mean: mean[0],
            isDark: mean[0] < 100,
            isBright: mean[0] > 150
        };
    }
};

// Coordinate transformation utilities
const CoordinateUtils = {
    // Convert screen coordinates to canvas coordinates
    screenToCanvas: function(screenX, screenY, canvas) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: screenX - rect.left,
            y: screenY - rect.top
        };
    },
    
    // Convert canvas coordinates to image coordinates
    canvasToImage: function(canvasX, canvasY, canvas, imageWidth, imageHeight) {
        const scaleX = imageWidth / canvas.width;
        const scaleY = imageHeight / canvas.height;
        
        return {
            x: Math.round(canvasX * scaleX),
            y: Math.round(canvasY * scaleY)
        };
    },
    
    // Convert image coordinates to canvas coordinates
    imageToCanvas: function(imageX, imageY, canvas, imageWidth, imageHeight) {
        const scaleX = canvas.width / imageWidth;
        const scaleY = canvas.height / imageHeight;
        
        return {
            x: Math.round(imageX * scaleX),
            y: Math.round(imageY * scaleY)
        };
    },
    
    // Full conversion from screen to image
    screenToImage: function(screenX, screenY, canvas, imageWidth, imageHeight) {
        const canvasCoords = this.screenToCanvas(screenX, screenY, canvas);
        return this.canvasToImage(canvasCoords.x, canvasCoords.y, canvas, imageWidth, imageHeight);
    },
    
    // Full conversion from image to screen
    imageToScreen: function(imageX, imageY, canvas, imageWidth, imageHeight) {
        const canvasCoords = this.imageToCanvas(imageX, imageY, canvas, imageWidth, imageHeight);
        const rect = canvas.getBoundingClientRect();
        
        return {
            x: canvasCoords.x + rect.left,
            y: canvasCoords.y + rect.top
        };
    }
};

// Reference detection utilities
const ReferenceDetection = {
    // Enhanced reference detection
    detectReference: function(imageMat, clickX, clickY) {
        // Try multiple methods
        const methods = [
            this.detectUsingHoughCircles,
            this.detectUsingContours,
            this.detectUsingEdgeDetection
        ];
        
        let bestResult = null;
        let bestConfidence = 0;
        
        for (const method of methods) {
            try {
                const result = method(imageMat, clickX, clickY);
                if (result && result.confidence > bestConfidence) {
                    bestResult = result;
                    bestConfidence = result.confidence;
                }
            } catch (error) {
                console.warn(`Method ${method.name} failed:`, error);
            }
        }
        
        return bestResult;
    },
    
    detectUsingHoughCircles: function(imageMat, clickX, clickY) {
        let gray = new cv.Mat();
        cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
        
        // Apply Gaussian blur
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
        
        // Detect circles
        let circles = new cv.Mat();
        cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 
            1, 30, 100, 30, 20, 150
        );
        
        let closestCircle = null;
        let minDistance = Infinity;
        
        for (let i = 0; i < circles.cols; i++) {
            const circle = circles.data32F.slice(i * 3, (i + 1) * 3);
            const distance = Math.sqrt(
                Math.pow(circle[0] - clickX, 2) + 
                Math.pow(circle[1] - clickY, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestCircle = {
                    x: circle[0],
                    y: circle[1],
                    radius: circle[2],
                    distance: distance
                };
            }
        }
        
        gray.delete();
        circles.delete();
        
        if (closestCircle && minDistance < 100) {
            return {
                type: 'circle',
                ...closestCircle,
                confidence: Math.max(0, 1 - (minDistance / 100))
            };
        }
        
        return null;
    },
    
    detectUsingContours: function(imageMat, clickX, clickY) {
        let gray = new cv.Mat();
        cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
        
        // Apply threshold
        let binary = new cv.Mat();
        cv.threshold(gray, binary, 100, 255, cv.THRESH_BINARY);
        
        // Find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(binary, contours, hierarchy, 
            cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE
        );
        
        let closestContour = null;
        let minDistance = Infinity;
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const moment = cv.moments(contour);
            
            if (moment.m00 > 0) {
                const centerX = moment.m10 / moment.m00;
                const centerY = moment.m01 / moment.m00;
                
                const distance = Math.sqrt(
                    Math.pow(centerX - clickX, 2) + 
                    Math.pow(centerY - clickY, 2)
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestContour = {
                        x: centerX,
                        y: centerY,
                        area: cv.contourArea(contour),
                        distance: distance
                    };
                }
            }
        }
        
        gray.delete();
        binary.delete();
        contours.delete();
        hierarchy.delete();
        
        if (closestContour && minDistance < 100) {
            return {
                type: 'contour',
                ...closestContour,
                confidence: Math.max(0, 1 - (minDistance / 100))
            };
        }
        
        return null;
    },
    
    detectUsingEdgeDetection: function(imageMat, clickX, clickY) {
        // Simple edge-based detection
        let gray = new cv.Mat();
        cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
        
        let edges = new cv.Mat();
        cv.Canny(gray, edges, 50, 150);
        
        // Sample around click point
        const searchRadius = 50;
        let edgeCount = 0;
        let totalCount = 0;
        
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const x = clickX + dx;
                const y = clickY + dy;
                
                if (x >= 0 && x < edges.cols && y >= 0 && y < edges.rows) {
                    totalCount++;
                    if (edges.ucharPtr(y, x)[0] > 0) {
                        edgeCount++;
                    }
                }
            }
        }
        
        gray.delete();
        edges.delete();
        
        const edgeDensity = totalCount > 0 ? edgeCount / totalCount : 0;
        
        if (edgeDensity > 0.3) {
            return {
                type: 'edge_cluster',
                x: clickX,
                y: clickY,
                edgeDensity: edgeDensity,
                confidence: Math.min(1, edgeDensity * 2)
            };
        }
        
        return null;
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
window.UploadUtils = UploadUtils;
window.ImageAnalysis = ImageAnalysis;
window.CoordinateUtils = CoordinateUtils;
window.ReferenceDetection = ReferenceDetection;
window.ImageDataUtils = ImageDataUtils;
window.OpenCVUtils = OpenCVUtils;

// Also export a global helper object
window.DrapeCalculatorUtils = {
    ImageUtils,
    Validation,
    FileUtils,
    DrapeFormulas,
    UIUtils,
    DeviceUtils,
    CameraUtils,
    UploadUtils,
    ImageAnalysis,
    CoordinateUtils,
    ReferenceDetection
};
// Add these functions to your existing utils.js file

// Fixed ImageData utilities
const ImageDataUtils = {
    // FIXED: Create ImageData from OpenCV Mat with proper dimensions
    matToImageData: function(mat, targetWidth = null, targetHeight = null) {
        if (!mat || mat.empty()) {
            console.error('Invalid or empty matrix');
            return null;
        }
        
        const width = targetWidth || mat.cols;
        const height = targetHeight || mat.rows;
        
        // Ensure we have the right number of channels
        let rgbaMat = mat;
        
        // Convert to RGBA if needed
        if (mat.channels() === 1) {
            rgbaMat = new cv.Mat();
            cv.cvtColor(mat, rgbaMat, cv.COLOR_GRAY2RGBA);
        } else if (mat.channels() === 3) {
            rgbaMat = new cv.Mat();
            cv.cvtColor(mat, rgbaMat, cv.COLOR_RGB2RGBA);
        } else if (mat.channels() !== 4) {
            console.error(`Unsupported number of channels: ${mat.channels()}`);
            return null;
        }
        
        // Resize if target dimensions are different
        if ((targetWidth && targetWidth !== rgbaMat.cols) || 
            (targetHeight && targetHeight !== rgbaMat.rows)) {
            const resizedMat = new cv.Mat();
            cv.resize(rgbaMat, resizedMat, new cv.Size(width, height), 0, 0, cv.INTER_LINEAR);
            rgbaMat.delete();
            rgbaMat = resizedMat;
        }
        
        // Create ImageData
        const imageData = new ImageData(
            new Uint8ClampedArray(rgbaMat.data),
            rgbaMat.cols,
            rgbaMat.rows
        );
        
        // Clean up if we created a new matrix
        if (rgbaMat !== mat) {
            rgbaMat.delete();
        }
        
        return imageData;
    },
    
    // FIXED: Convert canvas to OpenCV Mat with proper color space
    canvasToMat: function(canvas, colorSpace = cv.COLOR_RGBA2RGB) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const mat = cv.matFromImageData(imageData);
        
        // Convert to desired color space
        if (colorSpace !== cv.COLOR_RGBA2RGBA) {
            const convertedMat = new cv.Mat();
            cv.cvtColor(mat, convertedMat, colorSpace);
            mat.delete();
            return convertedMat;
        }
        
        return mat;
    },
    
    // FIXED: Draw OpenCV Mat to canvas with proper scaling
    drawMatToCanvas: function(mat, canvas, scaleToFit = true) {
        if (!mat || mat.empty()) {
            console.error('Cannot draw: invalid matrix');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Convert to RGBA
        let rgbaMat = mat;
        if (mat.channels() !== 4) {
            rgbaMat = new cv.Mat();
            if (mat.channels() === 1) {
                cv.cvtColor(mat, rgbaMat, cv.COLOR_GRAY2RGBA);
            } else if (mat.channels() === 3) {
                cv.cvtColor(mat, rgbaMat, cv.COLOR_RGB2RGBA);
            }
        }
        
        let displayMat = rgbaMat;
        
        // Scale if needed
        if (scaleToFit && (rgbaMat.cols !== canvas.width || rgbaMat.rows !== canvas.height)) {
            displayMat = new cv.Mat();
            cv.resize(rgbaMat, displayMat, 
                new cv.Size(canvas.width, canvas.height),
                0, 0, cv.INTER_LINEAR
            );
        }
        
        // Create ImageData
        const imageData = new ImageData(
            new Uint8ClampedArray(displayMat.data),
            displayMat.cols,
            displayMat.rows
        );
        
        // Clear and draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        
        // Clean up
        if (displayMat !== rgbaMat) {
            displayMat.delete();
        }
        if (rgbaMat !== mat) {
            rgbaMat.delete();
        }
    },
    
    // FIXED: Validate ImageData dimensions
    validateImageDataCreation: function(data, width, height) {
        const expectedLength = width * height * 4;
        
        if (data.length !== expectedLength) {
            console.error(`ImageData validation failed:
                Data length: ${data.length}
                Expected: ${expectedLength}
                Width: ${width}
                Height: ${height}
                Channels: 4
            `);
            return false;
        }
        
        return true;
    },
    
    // FIXED: Create properly sized Uint8ClampedArray
    createImageDataBuffer: function(width, height) {
        const buffer = new Uint8ClampedArray(width * height * 4);
        
        // Initialize with transparent black
        for (let i = 0; i < buffer.length; i += 4) {
            buffer[i] = 0;     // R
            buffer[i + 1] = 0; // G
            buffer[i + 2] = 0; // B
            buffer[i + 3] = 0; // A (transparent)
        }
        
        return buffer;
    }
};

// Enhanced OpenCV utilities
const OpenCVUtils = {
    // FIXED: Ensure matrix has proper dimensions for display
    prepareMatForDisplay: function(mat, targetWidth, targetHeight) {
        if (!mat || mat.empty()) {
            console.error('Invalid matrix for display preparation');
            return null;
        }
        
        let displayMat = mat;
        
        // Convert to RGB if needed
        if (mat.channels() === 1) {
            displayMat = new cv.Mat();
            cv.cvtColor(mat, displayMat, cv.COLOR_GRAY2RGB);
        } else if (mat.channels() === 4) {
            displayMat = new cv.Mat();
            cv.cvtColor(mat, displayMat, cv.COLOR_RGBA2RGB);
        }
        
        // Resize if needed
        if ((targetWidth && targetWidth !== displayMat.cols) || 
            (targetHeight && targetHeight !== displayMat.rows)) {
            const resizedMat = new cv.Mat();
            cv.resize(displayMat, resizedMat, 
                new cv.Size(targetWidth, targetHeight),
                0, 0, cv.INTER_LINEAR
            );
            
            if (displayMat !== mat) {
                displayMat.delete();
            }
            displayMat = resizedMat;
        }
        
        return displayMat;
    },
    
    // FIXED: Create contour visualization
    drawContourOnMat: function(mat, contour, color = [255, 0, 0, 128], thickness = 2) {
        if (!contour || contour.empty()) return mat;
        
        const displayMat = mat.clone();
        
        // Convert color to OpenCV Scalar
        const scalar = new cv.Scalar(color[2], color[1], color[0], color[3]);
        
        // Draw contour
        cv.drawContours(displayMat, [contour], -1, scalar, thickness);
        
        // Fill contour with transparency
        if (color[3] < 255) {
            const mask = new cv.Mat.zeros(displayMat.rows, displayMat.cols, cv.CV_8UC1);
            cv.drawContours(mask, [contour], -1, new cv.Scalar(255), cv.FILLED);
            
            const fillMat = new cv.Mat(displayMat.rows, displayMat.cols, displayMat.type(), scalar);
            fillMat.copyTo(displayMat, mask);
            
            mask.delete();
            fillMat.delete();
        }
        
        return displayMat;
    },
    
    // FIXED: Safe matrix operations
    safeMatOperation: function(mat, operation) {
        if (!mat || mat.empty()) {
            console.error('Cannot perform operation on empty matrix');
            return null;
        }
        
        try {
            return operation(mat);
        } catch (error) {
            console.error('Matrix operation failed:', error);
            return null;
        }
    }
};

