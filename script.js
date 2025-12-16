// Drape Area Calculator – fixed reference & drape segmentation version

// Global state
let stream = null;
let streaming = false;
let capturedImage = null;
let referencePoint = null;
let canvasDisplayWidth = 0;
let canvasDisplayHeight = 0;
let canvasActualWidth = 0;
let canvasActualHeight = 0;
let measurementHistory = [];
let openCvReady = false;

// Called from opencv.js onload
function onOpenCvReady() {
  console.log("OpenCV.js is ready");
  openCvReady = true;
  initializeEventListeners();
  loadHistory();
  setupDeviceOrientation();
}

// -------------- Event wiring --------------

function initializeEventListeners() {
  document.getElementById("startCamera")
    .addEventListener("click", startCamera);

  document.getElementById("uploadImage")
    .addEventListener("click", () => document.getElementById("fileInput").click());

  document.getElementById("fileInput")
    .addEventListener("change", handleImageUpload);

  document.getElementById("capture")
    .addEventListener("click", captureImage);

  document.getElementById("reset")
    .addEventListener("click", resetApp);

  document.getElementById("refType")
    .addEventListener("change", function () {
      const customRef = document.getElementById("customRefGroup");
      customRef.style.display = this.value === "custom" ? "block" : "none";
    });

  document.getElementById("calculateDrape")
    .addEventListener("click", calculateDrapePercentage);

  document.getElementById("exportData")
    .addEventListener("click", exportToCSV);

  document.getElementById("clearHistory")
    .addEventListener("click", clearHistory);
}

// -------------- Camera handling --------------
async function startCamera() {
  const video = document.getElementById("video");
  const status = document.getElementById("status");
  const container = document.querySelector(".camera-container");

  status.textContent = "Starting camera...";

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  try {
    const constraints = {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      streaming = true;

      // keep container height proportional to video
      const aspect = video.videoHeight / video.videoWidth || 9 / 16;
      const widthPx = container.clientWidth;
      container.style.height = widthPx * aspect + "px";

      document.getElementById("startCamera").disabled = true;
      document.getElementById("capture").disabled = true; // stays disabled until enough frames
      document.getElementById("reset").disabled = false;
      document.getElementById("uploadImage").disabled = true;

      status.textContent = "Camera ready - keep drape inside the dashed circle.";
    };
    // fill container without black borders
    video.style.objectFit = "cover";
  } catch (err) {
    console.error("Error accessing camera", err);
    status.textContent = "Error accessing camera: " + err.message;
    alert("Unable to access camera. Please ensure camera permissions are granted.");
  }
}

function captureImage() {
  if (!streaming) return;

  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const outputCanvas = document.getElementById("outputCanvas");
  const status = document.getElementById("status");

  status.textContent = "Capturing image...";

  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width = w;
  canvas.height = h;
  outputCanvas.width = w;
  outputCanvas.height = h;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  capturedImage = ctx.getImageData(0, 0, w, h);

  const outCtx = outputCanvas.getContext("2d");
  outCtx.putImageData(capturedImage, 0, 0);

  video.style.display = "none";
  outputCanvas.style.display = "block";

  document.getElementById("capture").disabled = true;
  document.getElementById("startCamera").disabled = true;
  document.getElementById("uploadImage").disabled = true;

  canvasDisplayWidth = outputCanvas.offsetWidth;
  canvasDisplayHeight = outputCanvas.offsetHeight;
  canvasActualWidth = outputCanvas.width;
  canvasActualHeight = outputCanvas.height;

  referencePoint = null;
  document.getElementById("pixelArea").textContent = "--";
  document.getElementById("actualArea").textContent = "--";
  document.getElementById("drapeCoefficient").textContent = "--";
  document.getElementById("calculateDrape").disabled = true;

  outputCanvas.style.cursor = "crosshair";
  outputCanvas.addEventListener("click", handleCanvasClick);

  status.textContent = "Click on reference coin in image (near its centre).";
}

// -------------- Image upload --------------

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById("status");
  status.textContent = "Loading image...";

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById("canvas");
      const outputCanvas = document.getElementById("outputCanvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      capturedImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const outCtx = outputCanvas.getContext("2d");
      outputCanvas.width = img.width;
      outputCanvas.height = img.height;
      outCtx.drawImage(img, 0, 0);

      const video = document.getElementById("video");
      video.style.display = "none";
      outputCanvas.style.display = "block";

      document.getElementById("capture").disabled = true;
      document.getElementById("startCamera").disabled = true;
      document.getElementById("uploadImage").disabled = true;
      document.getElementById("reset").disabled = false;

      canvasDisplayWidth = outputCanvas.offsetWidth;
      canvasDisplayHeight = outputCanvas.offsetHeight;
      canvasActualWidth = outputCanvas.width;
      canvasActualHeight = outputCanvas.height;

      referencePoint = null;
      document.getElementById("pixelArea").textContent = "--";
      document.getElementById("actualArea").textContent = "--";
      document.getElementById("drapeCoefficient").textContent = "--";
      document.getElementById("calculateDrape").disabled = true;

      outputCanvas.style.cursor = "crosshair";
      outputCanvas.addEventListener("click", handleCanvasClick);

      status.textContent = "Click on reference coin in image (near its centre).";
    };
    img.onerror = () => {
      status.textContent = "Failed to load image.";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// -------------- Reference click --------------

function handleCanvasClick(event) {
  if (!capturedImage) return;

  const canvas = event.target;
  const rect = canvas.getBoundingClientRect();

  const scaleX = canvasActualWidth / canvasDisplayWidth;
  const scaleY = canvasActualHeight / canvasDisplayHeight;

  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  referencePoint = {
    x: Math.round(x),
    y: Math.round(y),
    displayX: event.clientX - rect.left,
    displayY: event.clientY - rect.top
  };

  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.beginPath();
  ctx.arc(referencePoint.displayX, referencePoint.displayY, 8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,0,0,0.8)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(referencePoint.displayX - 15, referencePoint.displayY);
  ctx.lineTo(referencePoint.displayX + 15, referencePoint.displayY);
  ctx.moveTo(referencePoint.displayX, referencePoint.displayY - 15);
  ctx.lineTo(referencePoint.displayX, referencePoint.displayY + 15);
  ctx.stroke();
  ctx.restore();

  canvas.style.cursor = "default";
  canvas.removeEventListener("click", handleCanvasClick);

  processImageWithReference();
}

// -------------- Core OpenCV processing --------------

function processImageWithReference() {
  const status = document.getElementById("status");
  if (!capturedImage || !referencePoint) return;

  if (!openCvReady) {
    status.textContent = "OpenCV not loaded yet. Please wait...";
    return;
  }

  try {
    const src = cv.matFromImageData(capturedImage);
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const edges = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 50, 150);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let drapeContour = null;
    let refContour = null;
    let drapeAreaPx = 0;
    let refRect = null;
    let minRefDistance = Infinity;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area < 500) continue; // ignore tiny noise

      const rect = cv.boundingRect(contour);
      const perimeter = cv.arcLength(contour, true);
      const circularity = DrapeCalculatorUtils.calculateCircularity(area, perimeter); // 0–1
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;

      const dx = centerX - referencePoint.x;
      const dy = centerY - referencePoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // coin: small-ish, close to click, fairly circular
      if (dist < 150 && circularity > 0.78 && rect.width > 15 && rect.width < 350) {
        if (dist < minRefDistance) {
          minRefDistance = dist;
          refContour = contour;
          refRect = rect;
        }
      }

      // drape: largest remaining contour (non-coin)
      if (area > drapeAreaPx) {
        drapeAreaPx = area;
        drapeContour = contour;
      }
    }

    if (!drapeContour || drapeAreaPx <= 0) {
      status.textContent = "No drape contour found.";
      cleanupMats();
      return;
    }

    if (!refContour || !refRect) {
      status.textContent = "Reference coin not found near click point.";
      cleanupMats();
      return;
    }

    // reference diameter in pixels = average of width/height
    const referencePixelDiameter = (refRect.width + refRect.height) / 2;
    document.getElementById("pixelArea").textContent = drapeAreaPx.toFixed(0);

    const refType = document.getElementById("refType").value;
    let refDiameterCm;
    if (refType === "custom") {
      refDiameterCm = parseFloat(document.getElementById("refDiameter").value) || 2.5;
    } else {
      refDiameterCm = parseFloat(refType);
    }

    const pixelToCm = DrapeCalculatorUtils.calculatePixelToCmRatio(
      referencePixelDiameter,
      refDiameterCm
    ); // cm per pixel

    const actualArea = DrapeCalculatorUtils.convertPixelAreaToCm(
      drapeAreaPx,
      pixelToCm
    ); // cm²

    document.getElementById("actualArea").textContent =
      DrapeCalculatorUtils.formatNumber(actualArea, 2);

    displayProcessedImage(src, contours, drapeContour, refContour);
    document.getElementById("calculateDrape").disabled = false;
    status.textContent = "Analysis complete. Enter diameters and click Calculate Drape.";

    src.delete(); gray.delete(); blur.delete(); edges.delete();
    contours.delete(); hierarchy.delete();

    function cleanupMats() {
      src.delete(); gray.delete(); blur.delete(); edges.delete();
      contours.delete(); hierarchy.delete();
    }
  } catch (error) {
    console.error("Error processing image", error);
    status.textContent = "Error processing image.";
  }
}

function displayProcessedImage(src, contours, drapeContour, refContour) {
  const processedCanvas = document.getElementById("processedCanvas");
  const originalCanvas = document.getElementById("originalCanvas");

  processedCanvas.width = capturedImage.width;
  processedCanvas.height = capturedImage.height;
  originalCanvas.width = capturedImage.width;
  originalCanvas.height = capturedImage.height;

  const octx = originalCanvas.getContext("2d");
  octx.putImageData(capturedImage, 0, 0);

  const drawing = src.clone();

  // all contours in light green
  cv.drawContours(drawing, contours, -1, new cv.Scalar(0, 200, 0, 255), 1);

  // drape in blue
  const drapeVec = new cv.MatVector();
  drapeVec.push_back(drapeContour);
  cv.drawContours(drawing, drapeVec, 0, new cv.Scalar(0, 0, 255, 255), 3);
  drapeVec.delete();

  // coin in yellow
  const refVec = new cv.MatVector();
  refVec.push_back(refContour);
  cv.drawContours(drawing, refVec, 0, new cv.Scalar(255, 255, 0, 255), 2);
  refVec.delete();

  // reference click point
  cv.circle(
    drawing,
    new cv.Point(referencePoint.x, referencePoint.y),
    10,
    new cv.Scalar(255, 0, 0, 255),
    3
  );

  cv.imshow(processedCanvas, drawing);
  drawing.delete();
}

// -------------- Drape coefficient --------------

function calculateDrapePercentage() {
  const measuredAreaText = document.getElementById("actualArea").textContent;
  const status = document.getElementById("status");

  if (measuredAreaText === "--") {
    alert("Please capture and analyze an image first.");
    return;
  }

  const measuredArea = parseFloat(measuredAreaText);
  if (isNaN(measuredArea) || measuredArea <= 0) {
    alert("Invalid area measurement. Please analyze image again.");
    return;
  }

  const diskDiameter = parseFloat(document.getElementById("diskDiameter").value);
  const fabricDiameter = parseFloat(document.getElementById("fabricDiameter").value);

  if (isNaN(diskDiameter) || diskDiameter <= 0) {
    alert("Please enter a valid support disk diameter.");
    return;
  }
  if (isNaN(fabricDiameter) || fabricDiameter <= 0) {
    alert("Please enter a valid fabric diameter.");
    return;
  }
  if (fabricDiameter <= diskDiameter) {
    alert("Fabric diameter must be larger than support disk diameter.");
    return;
  }

  const drapeCoefficient = DrapeCalculatorUtils.calculateDrapeCoefficient(
    measuredArea,
    diskDiameter,
    fabricDiameter
  );

  document.getElementById("drapeCoefficient").textContent =
    drapeCoefficient.toFixed(2);

  if (drapeCoefficient < 0 || drapeCoefficient > 100) {
    status.textContent = "Warning: Drape coefficient out of range (0–100).";
  } else {
    status.textContent = "Calculation complete.";
  }

  addToHistory(measuredArea, drapeCoefficient);
}

// -------------- History (unchanged logic, fixed to match utils) --------------

function addToHistory(area, drapePercent) {
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateString = now.toLocaleDateString();

  const measurement = {
    id: Date.now(),
    date: dateString,
    time: timeString,
    area: area.toFixed(2),
    drapePercent: Math.min(100, Math.max(0, drapePercent)).toFixed(2),
    timestamp: now.toISOString()
  };

  measurementHistory.unshift(measurement);
  if (measurementHistory.length > 20) measurementHistory.pop();
  updateHistoryTable();
  saveHistory();
}

function updateHistoryTable() {
  const historyBody = document.getElementById("historyBody");
  historyBody.innerHTML = "";
  measurementHistory.forEach(m => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${m.time}<br><small>${m.date}</small></td>
      <td>${m.area} cm²</td>
      <td>${m.drapePercent}</td>
      <td><button class="btn-small" data-id="${m.id}"><i class="fas fa-trash"></i></button></td>
    `;
    row.querySelector("button").addEventListener("click", () => deleteMeasurement(m.id));
    historyBody.appendChild(row);
  });
}

function deleteMeasurement(id) {
  measurementHistory = measurementHistory.filter(m => m.id !== id);
  updateHistoryTable();
  saveHistory();
}

function clearHistory() {
  if (!confirm("Are you sure you want to clear all measurement history?")) return;
  measurementHistory = [];
  updateHistoryTable();
  saveHistory();
}

function saveHistory() {
  try {
    localStorage.setItem("drapeMeasurements", JSON.stringify(measurementHistory));
  } catch (e) {
    console.error("Error saving history", e);
  }
}

function loadHistory() {
  try {
    const saved = localStorage.getItem("drapeMeasurements");
    if (saved) measurementHistory = JSON.parse(saved);
    updateHistoryTable();
  } catch (e) {
    console.error("Error loading history", e);
  }
}

function exportToCSV() {
  if (!measurementHistory.length) {
    alert("No measurements to export.");
    return;
  }

  let csv = "Date,Time,Area (cm²),Drape Coefficient (%)\n";
  measurementHistory.forEach(m => {
    csv += `${m.date},${m.time},${m.area},${m.drapePercent}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "drape-measurements.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// -------------- Level indicator (unchanged) --------------

function setupDeviceOrientation() {
  if (typeof DeviceOrientationEvent === "undefined") return;

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then(state => {
        if (state === "granted") {
          window.addEventListener("deviceorientation", handleDeviceOrientation);
        }
      })
      .catch(console.error);
  } else {
    window.addEventListener("deviceorientation", handleDeviceOrientation);
  }
}

function handleDeviceOrientation(event) {
  const bubbleCenter = document.querySelector(".bubble-center");
  const levelStatus = document.getElementById("levelStatus");
  if (!bubbleCenter || !levelStatus) return;

  const beta = event.beta || 0;
  const gamma = event.gamma || 0;

  const angle = Math.min(Math.abs(beta), Math.abs(gamma));
  levelStatus.textContent = angle.toFixed(1);

  const maxTilt = 45;
  const maxMove = 18;
  const normX = Math.max(Math.min(gamma / maxTilt, 1), -1);
  const normY = Math.max(Math.min(beta / maxTilt, 1), -1);
  const posX = normX * maxMove;
  const posY = normY * maxMove;

  bubbleCenter.style.transform =
    `translate(-50%, -50%) translate(${posX}px, ${posY}px)`;

  if (angle < 2) {
    bubbleCenter.style.background = "#00ff00";
    levelStatus.style.color = "#00ff00";
  } else if (angle < 5) {
    bubbleCenter.style.background = "#ffff00";
    levelStatus.style.color = "#ffff00";
  } else {
    bubbleCenter.style.background = "#ff0000";
    levelStatus.style.color = "#ff0000";
  }
}

// -------------- Reset --------------

function resetApp() {
  const video = document.getElementById("video");
  const outputCanvas = document.getElementById("outputCanvas");
  const processedCanvas = document.getElementById("processedCanvas");
  const originalCanvas = document.getElementById("originalCanvas");
  const status = document.getElementById("status");

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  streaming = false;

  video.style.display = "block";
  outputCanvas.style.display = "none";

  outputCanvas.getContext("2d").clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  processedCanvas.getContext("2d").clearRect(0, 0, processedCanvas.width, processedCanvas.height);
  originalCanvas.getContext("2d").clearRect(0, 0, originalCanvas.width, originalCanvas.height);

  document.getElementById("pixelArea").textContent = "--";
  document.getElementById("actualArea").textContent = "--";
  document.getElementById("drapeCoefficient").textContent = "--";
  document.getElementById("calculateDrape").disabled = true;

  document.getElementById("capture").disabled = true;
  document.getElementById("reset").disabled = true;
  document.getElementById("startCamera").disabled = false;
  document.getElementById("uploadImage").disabled = false;

  capturedImage = null;
  referencePoint = null;

  outputCanvas.style.cursor = "default";
  outputCanvas.removeEventListener("click", handleCanvasClick);
  document.getElementById("fileInput").value = "";

  status.textContent = "Ready";
}

// -------------- Init if OpenCV already present --------------

document.addEventListener("DOMContentLoaded", () => {
  console.log("Drape Area Calculator initialized");
  document.getElementById("diskDiameter").value = 18.0;
  document.getElementById("fabricDiameter").value = 30.0;
  document.getElementById("refDiameter").value = 2.5;

  if (typeof cv !== "undefined") {
    // if opencv.js loaded before DOM
    onOpenCvReady();
  }
});
