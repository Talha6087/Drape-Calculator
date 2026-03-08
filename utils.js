// Utility functions for the Drape Calculator
// Image processing utilities
const ImageUtils = {
  // Convert between coordinate systems
  scaleCoordinates: function (x, y, fromWidth, fromHeight, toWidth, toHeight) {
    return {
      x: (x / fromWidth) * toWidth,
      y: (y / fromHeight) * toHeight,
    };
  },

  // Calculate distance between two points
  distance: function (x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  },

  // Apply circular crop to image
  applyCircularCrop: function (srcMat, centerX, centerY, diameterPixels) {
    try {
      // Create a circular mask
      let mask = new cv.Mat.zeros(srcMat.rows, srcMat.cols, cv.CV_8UC1);
      let center = new cv.Point(centerX, centerY);
      let radius = Math.floor(diameterPixels / 2);

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
};

// Validation utilities
const Validation = {
  isNumber: function (value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  validateDiameter: function (diameter) {
    if (!this.isNumber(diameter)) {
      return { valid: false, error: 'Diameter must be a number' };
    }
    if (diameter <= 0) {
      return { valid: false, error: 'Diameter must be positive' };
    }
    return { valid: true };
  },

  validateImage: function (imageMat) {
    if (!imageMat || imageMat.empty()) {
      return { valid: false, error: 'No image available' };
    }
    return { valid: true };
  },
};

// File utilities
const FileUtils = {
  saveImage: function (canvas, filename = 'drape-measurement.png') {
    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
      return true;
    } catch (error) {
      console.error('Error saving image:', error);
      return false;
    }
  },

  loadImage: function (file) {
    return new Promise((resolve, reject) => {
      // Check if file is provided
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      // Check if file is an image
      if (!file.type.match('image.*')) {
        reject(new Error('File is not an image'));
        return;
      }

      const reader = new FileReader();

      reader.onload = function (e) {
        const img = new Image();

        img.onload = function () {
          console.log('Image loaded successfully:', img.width, 'x', img.height);
          resolve(img);
        };

        img.onerror = function (err) {
          console.error('Error loading image:', err);
          reject(new Error('Failed to load image'));
        };

        img.src = e.target.result;
      };

      reader.onerror = function (err) {
        console.error('FileReader error:', err);
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  },

  loadImageToMat: function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          // Create canvas to convert image to Mat
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Check if OpenCV is loaded
          if (typeof cv === 'undefined') {
            reject(new Error('OpenCV not loaded'));
            return;
          }

          const mat = cv.matFromImageData(imageData);
          resolve(mat);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};

// Drape calculation formulas
// Based on Cusick Drape Tester standard
const DrapeFormulas = {
  // Calculate area from diameter
  circleArea: function (diameter) {
    const radius = diameter / 2;
    return Math.PI * radius * radius;
  },

  /**
   * Calculate Drape using the user-specified formula:
   * Drape (%) = ((Af - As) / (Ad - As)) × 100
   *
   * Where:
   * - Af = Fabric sample area (π × (fabricDiameter/2)²)
   * - As = Support disk area (π × (diskDiameter/2)²)
   * - Ad = Total projected shadow area INCLUDING the disk (green + red)
   *
   * NOTE:
   * - We pass Ad (total shadow area) into this function.
   * - The fabric-only shadow area is (Ad - As).
   */
  drapeCoefficient: function (shadowAreaTotal, diskDiameter, fabricDiameter) {
    const diskArea = this.circleArea(diskDiameter);
    const fabricArea = this.circleArea(fabricDiameter);

    console.log('Drape Calculation:', {
      shadowAreaTotal: shadowAreaTotal.toFixed(2) + ' cm²',
      diskDiameter: diskDiameter + ' cm',
      diskArea: diskArea.toFixed(2) + ' cm²',
      fabricDiameter: fabricDiameter + ' cm',
      fabricArea: fabricArea.toFixed(2) + ' cm²',
    });

    if (shadowAreaTotal <= 0) {
      console.warn('Total shadow area must be positive');
      return 0;
    }

    const denom = shadowAreaTotal - diskArea; // (Ad - As)
    const numer = fabricArea - diskArea; // (Af - As)

    if (denom <= 0 || numer <= 0) {
      console.warn('Invalid drape denominator/numerator', { denom, numer });
      return 0;
    }

    const coefficient = (numer / denom) * 100;

    // Clamp between 0 and 100
    const clampedCoefficient = Math.max(0, Math.min(100, coefficient));

    console.log('Drape Coefficient:', clampedCoefficient.toFixed(2) + '%');

    return clampedCoefficient;
  },

  // Calculate fabric properties
  fabricProperties: function (drapeCoefficient) {
    // Categorize drape based on coefficient
    if (drapeCoefficient < 30) return 'Stiff';
    if (drapeCoefficient < 60) return 'Medium Drape';
    if (drapeCoefficient < 85) return 'Good Drape';
    return 'Excellent Drape';
  },
};

// UI utilities
const UIUtils = {
  showToast: function (message, type = 'info') {
    try {
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
                padding: 12px 20px;
                background: ${
                  type === 'error'
                    ? '#e74c3c'
                    : type === 'success'
                    ? '#2ecc71'
                    : '#3498db'
                };
                color: white;
                border-radius: 6px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                animation: slideIn 0.3s ease;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                max-width: 300px;
                word-wrap: break-word;
            `;

      document.body.appendChild(toast);

      // Remove toast after 3 seconds
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 3000);
    } catch (error) {
      console.error('Error showing toast:', error);
    }
  },

  showLoading: function (show = true) {
    try {
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
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                `;
        document.body.appendChild(loader);
      } else if (!show && loader) {
        loader.remove();
      }
    } catch (error) {
      console.error('Error showing loading:', error);
    }
  },

  updateButtonState: function (buttonId, enabled, text = null) {
    try {
      const button = document.getElementById(buttonId);
      if (!button) {
        console.warn('Button not found:', buttonId);
        return;
      }

      button.disabled = !enabled;
      if (text !== null) {
        button.innerHTML = text;
      }
    } catch (error) {
      console.error('Error updating button state:', error);
    }
  },

  // Create a draggable/resizable circle for cropping
  createCropCircle: function (canvas, centerX, centerY, diameter) {
    const circle = document.createElement('div');
    circle.className = 'crop-circle';
    circle.style.cssText = `
            position: absolute;
            left: ${centerX - diameter / 2}px;
            top: ${centerY - diameter / 2}px;
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
  },
};

// Add CSS for animations
(function () {
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
})();

// Export all utilities
window.ImageUtils = ImageUtils;
window.Validation = Validation;
window.FileUtils = FileUtils;
window.DrapeFormulas = DrapeFormulas;
window.UIUtils = UIUtils;
