// utils.js
// Drape Calculator Utilities - Complete & Fixed Version

/**
 * Utility functions for Drape Area Calculator
 * Version: 1.0.0
 * Last Updated: 2024
 */

// Main utilities object
const DrapeCalculatorUtils = {
    
    // ============================================
    // 1. CORE CALCULATIONS
    // ============================================
    
    /**
     * Calculate area of a circle
     * @param {number} diameter - Diameter in cm
     * @returns {number} Area in cm²
     */
    calculateCircleArea: function(diameter) {
        if (isNaN(diameter) || diameter <= 0) return 0;
        const radius = diameter / 2;
        return Math.PI * radius * radius;
    },
    
    /**
     * Calculate drape coefficient percentage
     * @param {number} drapedArea - Measured draped area in cm²
     * @param {number} diskDiameter - Support disk diameter in cm
     * @param {number} fabricDiameter - Original fabric diameter in cm
     * @returns {number} Drape coefficient (0-100%)
     */
    calculateDrapeCoefficient: function(drapedArea, diskDiameter, fabricDiameter) {
        // Validate inputs
        if (isNaN(drapedArea) || drapedArea <= 0) return 0;
        if (isNaN(diskDiameter) || diskDiameter <= 0) return 0;
        if (isNaN(fabricDiameter) || fabricDiameter <= 0) return 0;
        
        const diskArea = this.calculateCircleArea(diskDiameter);
        const fabricArea = this.calculateCircleArea(fabricDiameter);
        
        // Prevent division by zero
        if (fabricArea <= diskArea) return 0;
        
        // Calculate coefficient
        const coefficient = ((drapedArea - diskArea) / (fabricArea - diskArea)) * 100;
        
        // Clamp between 0-100%
        return Math.max(0, Math.min(100, coefficient));
    },
    
    /**
     * Get reference object diameter based on selection
     * @param {string} refType - Reference type ('2.5', '2.7', 'custom')
     * @param {string|number} customValue - Custom diameter value
     * @returns {number} Diameter in cm
     */
    getReferenceDiameter: function(refType, customValue) {
        switch(refType) {
            case '2.5':
                return 2.5; // Indian 2 Rupee Coin
            case '2.7':
                return 2.7; // Indian 10 Rupee Coin
            case 'custom':
                const custom = parseFloat(customValue);
                return isNaN(custom) || custom <= 0 ? 2.5 : custom;
            default:
                return 2.5;
        }
    },
    
    /**
     * Calculate pixel to cm conversion ratio
     * @param {number} referencePixelSize - Reference size in pixels
     * @param {number} referenceActualSize - Reference size in cm
     * @returns {number} Pixels per cm
     */
    calculatePixelToCmRatio: function(referencePixelSize, referenceActualSize) {
        if (referencePixelSize <= 0 || referenceActualSize <= 0) return 1;
        return referenceActualSize / referencePixelSize;
    },
    
    /**
     * Convert pixel area to actual area
     * @param {number} pixelArea - Area in pixels
     * @param {number} pixelToCmRatio - Conversion ratio
     * @returns {number} Area in cm²
     */
    convertPixelAreaToCm: function(pixelArea, pixelToCmRatio) {
        return pixelArea * Math.pow(pixelToCmRatio, 2);
    },
    
    // ============================================
    // 2. VALIDATION FUNCTIONS
    // ============================================
    
    /**
     * Validate drape tester inputs
     * @param {number} diskDiameter - Support disk diameter
     * @param {number} fabricDiameter - Fabric diameter
     * @returns {object} Validation result
     */
    validateInputs: function(diskDiameter, fabricDiameter) {
        const errors = [];
        
        if (isNaN(diskDiameter) || diskDiameter <= 0) {
            errors.push('Support disk diameter must be a positive number');
        }
        
        if (isNaN(fabricDiameter) || fabricDiameter <= 0) {
            errors.push('Fabric diameter must be a positive number');
        }
        
        if (fabricDiameter <= diskDiameter) {
            errors.push('Fabric diameter must be larger than support disk diameter');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    /**
     * Validate image data
     * @param {ImageData} imageData - Image data to validate
     * @returns {boolean} Whether image data is valid
     */
    validateImageData: function(imageData) {
        return !!(imageData && 
                 imageData.data && 
                 imageData.width > 0 && 
                 imageData.height > 0);
    },
    
    /**
     * Validate reference point
     * @param {object} point - Reference point coordinates
     * @param {number} imageWidth - Image width
     * @param {number} imageHeight - Image height
     * @returns {boolean} Whether point is valid
     */
    validateReferencePoint: function(point, imageWidth, imageHeight) {
        return !!(point && 
                 point.x >= 0 && point.x < imageWidth &&
                 point.y >= 0 && point.y < imageHeight);
    },
    
    // ============================================
    // 3. COORDINATE & GEOMETRY FUNCTIONS
    // ============================================
    
    /**
     * Convert click coordinates to image coordinates
     * @param {MouseEvent|TouchEvent} event - Click/touch event
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {number} actualWidth - Actual image width
     * @param {number} actualHeight - Actual image height
     * @returns {object} Coordinate information
     */
    convertClickToImageCoordinates: function(event, canvas, actualWidth, actualHeight) {
        if (!canvas || !actualWidth || !actualHeight) {
            return { imageX: 0, imageY: 0, displayX: 0, displayY: 0 };
        }
        
        const rect = canvas.getBoundingClientRect();
        
        // Get click position (handle touch events)
        let clientX, clientY;
        if (event.touches && event.touches[0]) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        const displayX = clientX - rect.left;
        const displayY = clientY - rect.top;
        
        // Calculate scale factors
        const displayWidth = canvas.offsetWidth || rect.width;
        const displayHeight = canvas.offsetHeight || rect.height;
        
        const scaleX = actualWidth / displayWidth;
        const scaleY = actualHeight / displayHeight;
        
        // Convert to image coordinates
        const imageX = Math.round(displayX * scaleX);
        const imageY = Math.round(displayY * scaleY);
        
        // Ensure within bounds
        const boundedX = Math.max(0, Math.min(imageX, actualWidth - 1));
        const boundedY = Math.max(0, Math.min(imageY, actualHeight - 1));
        
        return {
            displayX: displayX,
            displayY: displayY,
            imageX: boundedX,
            imageY: boundedY,
            scaleX: scaleX,
            scaleY: scaleY,
            withinBounds: (displayX >= 0 && displayX <= displayWidth && 
                          displayY >= 0 && displayY <= displayHeight)
        };
    },
    
    /**
     * Calculate distance between two points
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Distance
     */
    calculateDistance: function(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    
    /**
     * Calculate contour circularity
     * @param {number} area - Contour area
     * @param {number} perimeter - Contour perimeter
     * @returns {number} Circularity (0-1)
     */
    calculateCircularity: function(area, perimeter) {
        if (perimeter === 0) return 0;
        return (4 * Math.PI * area) / Math.pow(perimeter, 2);
    },
    
    // ============================================
    // 4. FILE & IMAGE HANDLING
    // ============================================
    
    /**
     * Load image from file
     * @param {File} file - Image file
     * @returns {Promise} Promise resolving to image data
     */
    loadImageFile: function(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject('No file selected');
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                reject('Please select a valid image file (JPEG, PNG, etc.)');
                return;
            }
            
            // Check file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                reject('Image file is too large (max 10MB)');
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    resolve({
                        image: img,
                        width: img.width,
                        height: img.height,
                        dataURL: e.target.result,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type
                    });
                };
                img.onerror = function() {
                    reject('Failed to load image. The file may be corrupted.');
                };
                img.src = e.target.result;
            };
            
            reader.onerror = function() {
                reject('Failed to read file. Please try again.');
            };
            
            reader.readAsDataURL(file);
        });
    },
    
    /**
     * Create ImageData from canvas
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @returns {ImageData} Image data
     */
    createImageDataFromCanvas: function(canvas) {
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    },
    
    /**
     * Draw image to canvas
     * @param {HTMLImageElement|ImageData} image - Image to draw
     * @param {HTMLCanvasElement} canvas - Target canvas
     * @returns {ImageData} Resulting image data
     */
    drawImageToCanvas: function(image, canvas) {
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        
        if (image instanceof HTMLImageElement) {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
        } else if (image instanceof ImageData) {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.putImageData(image, 0, 0);
        }
        
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    },
    
    /**
     * Resize image while maintaining aspect ratio
     * @param {HTMLImageElement} image - Source image
     * @param {number} maxWidth - Maximum width
     * @param {number} maxHeight - Maximum height
     * @returns {HTMLCanvasElement} Canvas with resized image
     */
    resizeImage: function(image, maxWidth, maxHeight) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = image.width;
        let height = image.height;
        
        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw resized image
        ctx.drawImage(image, 0, 0, width, height);
        
        return canvas;
    },
    
    // ============================================
    // 5. DATA EXPORT & STORAGE
    // ============================================
    
    /**
     * Export measurements to CSV
     * @param {Array} data - Measurement data
     * @param {string} filename - Output filename
     */
    exportToCSV: function(data, filename = 'drape-measurements.csv') {
        if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('No measurement data to export');
        }
        
        // CSV header
        let csv = 'Date,Time,Area (cm²),Drape Coefficient (%),Drape Category\n';
        
        // Add data rows
        data.forEach(item => {
            const category = this.getDrapeCategory(parseFloat(item.drapePercent));
            csv += `"${item.date}","${item.time}","${item.area}","${item.drapePercent}","${category}"\n`;
        });
        
        // Create and trigger download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    },
    
    /**
     * Save data to localStorage
     * @param {string} key - Storage key
     * @param {any} data - Data to save
     * @returns {boolean} Success status
     */
    saveToLocalStorage: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            return false;
        }
    },
    
    /**
     * Load data from localStorage
     * @param {string} key - Storage key
     * @returns {any} Parsed data or null
     */
    loadFromLocalStorage: function(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            return null;
        }
    },
    
    /**
     * Clear localStorage data
     * @param {string} key - Storage key to clear
     */
    clearLocalStorage: function(key) {
        try {
            if (key) {
                localStorage.removeItem(key);
            } else {
                localStorage.clear();
            }
        } catch (e) {
            console.error('Failed to clear localStorage:', e);
        }
    },
    
    // ============================================
    // 6. UI & DISPLAY FUNCTIONS
    // ============================================
    
    /**
     * Show notification toast
     * @param {string} message - Message to display
     * @param {string} type - Toast type ('info', 'success', 'error', 'warning')
     * @param {number} duration - Display duration in ms
     * @returns {HTMLElement} Toast element
     */
    showToast: function(message, type = 'info', duration = 3000) {
        // Remove existing toast
        const existing = document.querySelector('.drape-toast');
        if (existing) existing.remove();
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `drape-toast toast-${type}`;
        toast.textContent = message;
        
        // Style the toast
        const typeColors = {
            info: '#3498db',
            success: '#2ecc71',
            error: '#e74c3c',
            warning: '#f39c12'
        };
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${typeColors[type] || typeColors.info};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            animation: toastSlideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
        `;
        
        document.body.appendChild(toast);
        
        // Add CSS animation if not already present
        if (!document.querySelector('#toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
                @keyframes toastSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes toastSlideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Auto remove after duration
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
        
        return toast;
    },
    
    /**
     * Update button state
     * @param {string} buttonId - Button element ID
     * @param {boolean} enabled - Whether button should be enabled
     * @param {string} text - Button text (optional)
     * @param {string} icon - FontAwesome icon name (optional)
     */
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
    
    /**
     * Show loading indicator
     * @param {boolean} show - Whether to show loading
     * @param {string} message - Loading message
     */
    showLoading: function(show = true, message = 'Processing...') {
        let loader = document.getElementById('global-loader');
        
        if (show && !loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.innerHTML = `
                <div class="loader"></div>
                <p style="margin-top: 10px; color: #333;">${message}</p>
            `;
            
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.95);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(3px);
            `;
            
            // Add loader styles
            if (!document.querySelector('#loader-styles')) {
                const style = document.createElement('style');
                style.id = 'loader-styles';
                style.textContent = `
                    .loader {
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #3498db;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(loader);
        } else if (!show && loader) {
            loader.remove();
        }
    },
    
    /**
     * Format number with specified decimals
     * @param {number} num - Number to format
     * @param {number} decimals - Decimal places
     * @returns {string} Formatted number
     */
    formatNumber: function(num, decimals = 2) {
        if (isNaN(num)) return '--';
        return num.toFixed(decimals);
    },
    
    // ============================================
    // 7. DEVICE & CAMERA FUNCTIONS
    // ============================================
    
    /**
     * Check if device is mobile
     * @returns {boolean} Whether device is mobile
     */
    isMobile: function() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    /**
     * Check if device has camera
     * @returns {boolean} Whether camera is available
     */
    hasCamera: function() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia &&
                 navigator.mediaDevices.enumerateDevices);
    },
    
    /**
     * Check if device supports touch
     * @returns {boolean} Whether device is touch capable
     */
    isTouchDevice: function() {
        return 'ontouchstart' in window || 
               navigator.maxTouchPoints > 0 || 
               navigator.msMaxTouchPoints > 0;
    },
    
    /**
     * Request camera permission
     * @returns {Promise<boolean>} Whether permission was granted
     */
    requestCameraPermission: function() {
        return new Promise((resolve) => {
            if (!this.hasCamera()) {
                resolve(false);
                return;
            }
            
            // Test camera access with minimal constraints
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    // Stop the stream immediately
                    stream.getTracks().forEach(track => track.stop());
                    resolve(true);
                })
                .catch(error => {
                    console.error('Camera permission denied:', error);
                    resolve(false);
                });
        });
    },
    
    // ============================================
    // 8. FABRIC ANALYSIS FUNCTIONS
    // ============================================
    
    /**
     * Categorize fabric based on drape coefficient
     * @param {number} coefficient - Drape coefficient (0-100%)
     * @returns {string} Drape category
     */
    getDrapeCategory: function(coefficient) {
        if (coefficient < 0) return 'Invalid';
        if (coefficient < 30) return 'Stiff';
        if (coefficient < 60) return 'Medium Drape';
        if (coefficient < 85) return 'Good Drape';
        if (coefficient <= 100) return 'Excellent Drape';
        return 'Very High Drape';
    },
    
    /**
     * Get fabric properties based on drape coefficient
     * @param {number} coefficient - Drape coefficient
     * @returns {object} Fabric properties
     */
    getFabricProperties: function(coefficient) {
        const category = this.getDrapeCategory(coefficient);
        
        const properties = {
            stiffness: '',
            drapeability: '',
            recommendedUse: '',
            typicalFabrics: ''
        };
        
        if (coefficient < 30) {
            properties.stiffness = 'High';
            properties.drapeability = 'Low';
            properties.recommendedUse = 'Structured garments, suits, upholstery';
            properties.typicalFabrics = 'Canvas, Denim, Heavy Wool';
        } else if (coefficient < 60) {
            properties.stiffness = 'Medium';
            properties.drapeability = 'Moderate';
            properties.recommendedUse = 'Shirts, dresses, skirts, trousers';
            properties.typicalFabrics = 'Cotton, Linen, Medium-weight Wool';
        } else if (coefficient < 85) {
            properties.stiffness = 'Low';
            properties.drapeability = 'Good';
            properties.recommendedUse = 'Draped garments, curtains, flowy designs';
            properties.typicalFabrics = 'Silk, Chiffon, Lightweight Wool';
        } else {
            properties.stiffness = 'Very Low';
            properties.drapeability = 'Excellent';
            properties.recommendedUse = 'Evening wear, lingerie, delicate designs';
            properties.typicalFabrics = 'Georgette, Voile, Organza';
        }
        
        return {
            category: category,
            ...properties
        };
    },
    
    /**
     * Calculate expected drape area for given diameters
     * @param {number} diskDiameter - Support disk diameter
     * @param {number} fabricDiameter - Fabric diameter
     * @param {number} drapeCoefficient - Expected drape coefficient
     * @returns {number} Expected draped area in cm²
     */
    calculateExpectedDrapeArea: function(diskDiameter, fabricDiameter, drapeCoefficient) {
        const diskArea = this.calculateCircleArea(diskDiameter);
        const fabricArea = this.calculateCircleArea(fabricDiameter);
        
        return diskArea + ((fabricArea - diskArea) * (drapeCoefficient / 100));
    },
    
    // ============================================
    // 9. OPENCV SPECIFIC UTILITIES
    // ============================================
    
    /**
     * Check if OpenCV is loaded and ready
     * @returns {boolean} Whether OpenCV is ready
     */
    isOpenCVReady: function() {
        return typeof cv !== 'undefined' && cv && cv.Mat;
    },
    
    /**
     * Safe OpenCV matrix cleanup
     * @param {...cv.Mat} mats - Matrices to delete
     */
    cleanupMats: function(...mats) {
        mats.forEach(mat => {
            if (mat && !mat.isDeleted && mat.delete) {
                try {
                    mat.delete();
                } catch (e) {
                    console.warn('Failed to delete OpenCV mat:', e);
                }
            }
        });
    },
    
    /**
     * Convert ImageData to OpenCV Mat
     * @param {ImageData} imageData - Image data
     * @returns {cv.Mat} OpenCV matrix
     */
    imageDataToMat: function(imageData) {
        if (!this.isOpenCVReady()) {
            throw new Error('OpenCV not loaded');
        }
        
        if (!this.validateImageData(imageData)) {
            throw new Error('Invalid image data');
        }
        
        return cv.matFromImageData(imageData);
    },
    
    /**
     * Draw OpenCV Mat to canvas
     * @param {cv.Mat} mat - OpenCV matrix
     * @param {HTMLCanvasElement} canvas - Target canvas
     */
    drawMatToCanvas: function(mat, canvas) {
        if (!this.isOpenCVReady() || !mat || mat.empty()) {
            console.error('Cannot draw: invalid matrix');
            return;
        }
        
        if (!canvas) {
            console.error('Cannot draw: invalid canvas');
            return;
        }
        
        try {
            // Convert to RGBA if needed
            let displayMat = mat;
            if (mat.channels() === 1) {
                displayMat = new cv.Mat();
                cv.cvtColor(mat, displayMat, cv.COLOR_GRAY2RGBA);
            } else if (mat.channels() === 3) {
                displayMat = new cv.Mat();
                cv.cvtColor(mat, displayMat, cv.COLOR_RGB2RGBA);
            }
            
            // Draw to canvas
            cv.imshow(canvas, displayMat);
            
            // Cleanup if we created a new matrix
            if (displayMat !== mat) {
                displayMat.delete();
            }
        } catch (error) {
            console.error('Error drawing OpenCV mat to canvas:', error);
        }
    },
    
    // ============================================
    // 10. HELPER FUNCTIONS
    // ============================================
    
    /**
     * Debounce function to limit function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    /**
     * Get current timestamp
     * @returns {object} Formatted timestamp
     */
    getTimestamp: function() {
        const now = new Date();
        return {
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            iso: now.toISOString(),
            unix: now.getTime()
        };
    },
    
    /**
     * Check if value is numeric
     * @param {any} value - Value to check
     * @returns {boolean} Whether value is numeric
     */
    isNumeric: function(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    },
    
    /**
     * Clamp value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp: function(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    /**
     * Calculate average of array
     * @param {Array} arr - Array of numbers
     * @returns {number} Average value
     */
    calculateAverage: function(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return sum / arr.length;
    }
};

// ============================================
// GLOBAL EXPORT
// ============================================

// Export as global object
window.DrapeUtils = DrapeCalculatorUtils;

// Also export individual modules for modular use
window.ImageUtils = {
    loadImageFile: DrapeCalculatorUtils.loadImageFile,
    createImageDataFromCanvas: DrapeCalculatorUtils.createImageDataFromCanvas,
    drawImageToCanvas: DrapeCalculatorUtils.drawImageToCanvas,
    resizeImage: DrapeCalculatorUtils.resizeImage,
    validateImageData: DrapeCalculatorUtils.validateImageData
};

window.CalculationUtils = {
    calculateCircleArea: DrapeCalculatorUtils.calculateCircleArea,
    calculateDrapeCoefficient: DrapeCalculatorUtils.calculateDrapeCoefficient,
    getReferenceDiameter: DrapeCalculatorUtils.getReferenceDiameter,
    calculatePixelToCmRatio: DrapeCalculatorUtils.calculatePixelToCmRatio,
    convertPixelAreaToCm: DrapeCalculatorUtils.convertPixelAreaToCm,
    getDrapeCategory: DrapeCalculatorUtils.getDrapeCategory,
    getFabricProperties: DrapeCalculatorUtils.getFabricProperties
};

window.ValidationUtils = {
    validateInputs: DrapeCalculatorUtils.validateInputs,
    validateImageData: DrapeCalculatorUtils.validateImageData,
    validateReferencePoint: DrapeCalculatorUtils.validateReferencePoint,
    isNumeric: DrapeCalculatorUtils.isNumeric
};

window.UiUtils = {
    showToast: DrapeCalculatorUtils.showToast,
    showLoading: DrapeCalculatorUtils.showLoading,
    updateButtonState: DrapeCalculatorUtils.updateButtonState,
    formatNumber: DrapeCalculatorUtils.formatNumber
};

window.StorageUtils = {
    saveToLocalStorage: DrapeCalculatorUtils.saveToLocalStorage,
    loadFromLocalStorage: DrapeCalculatorUtils.loadFromLocalStorage,
    clearLocalStorage: DrapeCalculatorUtils.clearLocalStorage,
    exportToCSV: DrapeCalculatorUtils.exportToCSV
};

// Console log for debugging
console.log('Drape Calculator Utilities v1.0.0 loaded');

// Export for module systems (if supported)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DrapeCalculatorUtils;
}
