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
    
    // Apply circular crop to image
    applyCircularCrop: function(srcMat, centerX, centerY, diameterPixels) {
        try {
            // Create a circular mask
            let mask = new cv.Mat.zeros(srcMat.rows, srcMat.cols, cv.CV_8UC1);
            let center = new cv.Point(centerX, centerY);
            let radius = diameterPixels / 2;
            
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
    },
    
    // Draw reference line with measurement
    drawReferenceLine: function(ctx, startX, startY, endX, endY, pixelDistance, scale) {
        // Draw line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw points
        ctx.beginPath();
        ctx.arc(startX, startY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(endX, endY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw measurement text
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${pixelDistance.toFixed(1)} px`, midX, midY - 10);
        
        if (scale) {
            ctx.fillText(`(${(pixelDistance / scale).toFixed(2)} cm)`, midX, midY + 10);
        }
        
        ctx.textAlign = 'left';
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
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        // Add animation style
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
        
        document.body.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    showLoading: function(show = true) {
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

// Export all utilities
window.ImageUtils = ImageUtils;
window.Validation = Validation;
window.FileUtils = FileUtils;
window.DrapeFormulas = DrapeFormulas;
window.UIUtils = UIUtils;
