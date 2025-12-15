/* ================================
   utils.js — FIXED & STABLE
   ================================ */

/* ---------- Geometry ---------- */
const Geometry = {
  canvasToImageCoords(event, canvas, imgW, imgH) {
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const cx = (event.clientX - rect.left) * scaleX;
    const cy = (event.clientY - rect.top) * scaleY;

    return {
      x: Math.max(0, Math.min(Math.round(cx), imgW - 1)),
      y: Math.max(0, Math.min(Math.round(cy), imgH - 1))
    };
  }
};

/* ---------- Math ---------- */
const DrapeMath = {
  circleArea(d) {
    return Math.PI * Math.pow(d / 2, 2);
  },

  drapeCoefficient(drapeArea, diskD, fabricD) {
    const Ad = this.circleArea(diskD);
    const Af = this.circleArea(fabricD);

    if (Af <= Ad) return 0;

    const dc = ((drapeArea - Ad) / (Af - Ad)) * 100;
    return Math.max(0, Math.min(dc, 100)); // HARD PHYSICAL CLAMP
  }
};

/* ---------- Reference ---------- */
const ReferenceUtils = {
  detectCoinRadius(mat, cx, cy) {
    let gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGB2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(9, 9), 2);

    let circles = new cv.Mat();
    cv.HoughCircles(
      gray,
      circles,
      cv.HOUGH_GRADIENT,
      1,
      100,
      120,
      30,
      15,
      80
    );

    let bestR = -1;
    let minDist = 1e9;

    for (let i = 0; i < circles.cols; i++) {
      const x = circles.data32F[i * 3];
      const y = circles.data32F[i * 3 + 1];
      const r = circles.data32F[i * 3 + 2];

      const d = Math.hypot(x - cx, y - cy);
      if (d < minDist && d < 120) {
        minDist = d;
        bestR = r;
      }
    }

    gray.delete();
    circles.delete();
    return bestR;
  }
};

/* ---------- Drape Area ---------- */
const DrapeSegmentation = {
  extractDrapeArea(mat) {
    let hsv = new cv.Mat();
    cv.cvtColor(mat, hsv, cv.COLOR_RGB2HSV);

    let mask = new cv.Mat();
    let low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 0, 0]);
    let high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 160, 255]);

    cv.inRange(hsv, low, high, mask);

    cv.morphologyEx(
      mask,
      mask,
      cv.MORPH_CLOSE,
      cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9))
    );

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const a = cv.contourArea(contours.get(i));
      if (a > maxArea) maxArea = a;
    }

    hsv.delete(); mask.delete(); low.delete(); high.delete();
    contours.delete(); hierarchy.delete();

    return maxArea;
  }
};
