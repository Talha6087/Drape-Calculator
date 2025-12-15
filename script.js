/* ================================
   script.js — FIXED & STABLE
   ================================ */
/* ================================
   CAMERA + UPLOAD RESTORE LAYER
   ================================ */

let videoStream = null;

/* ---- Start Camera ---- */
document.getElementById("startCamera").addEventListener("click", async () => {
  const video = document.getElementById("cameraVideo");

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    video.srcObject = videoStream;
    video.play();

    document.getElementById("capture").disabled = false;
    document.getElementById("status").textContent =
      "Camera started. Capture image when ready.";

  } catch (err) {
    alert("Camera access failed: " + err.message);
  }
});

/* ---- Capture Frame ---- */
document.getElementById("capture").addEventListener("click", () => {
  const video = document.getElementById("cameraVideo");
  const tempCanvas = document.createElement("canvas");

  tempCanvas.width = video.videoWidth;
  tempCanvas.height = video.videoHeight;

  const ctx = tempCanvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const img = new Image();
  img.onload = () => processUploadedImage(img);
  img.src = tempCanvas.toDataURL("image/png");

  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
});

/* ---- Upload Image ---- */
document.getElementById("uploadImage").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => processUploadedImage(img);
  img.src = URL.createObjectURL(file);
});

let originalMat = null;
let imgW = 0, imgH = 0;
let refPoint = null;

/* ---------- OpenCV ---------- */
function onOpenCvReady() {
  console.log("OpenCV ready");
}

/* ---------- Image Load ---------- */
function processUploadedImage(img) {
  const canvas = document.getElementById("originalCanvas");
  const ctx = canvas.getContext("2d");

  imgW = img.width;
  imgH = img.height;

  canvas.width = imgW;
  canvas.height = imgH;
  ctx.drawImage(img, 0, 0);

  originalMat = cv.imread(canvas);

  document.getElementById("status").textContent =
    "Image loaded. Click on coin.";
}

/* ---------- Click ---------- */
document.getElementById("originalCanvas").addEventListener("click", e => {
  if (!originalMat) return;

  refPoint = Geometry.canvasToImageCoords(
    e,
    e.target,
    imgW,
    imgH
  );

  drawMarker(e.target, refPoint.x, refPoint.y);
  document.getElementById("status").textContent =
    "Reference selected. Calculating…";

  setTimeout(calculateDrape, 200);
});

/* ---------- Marker ---------- */
function drawMarker(canvas, x, y) {
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.stroke();
}

/* ---------- Core Calculation ---------- */
function calculateDrape() {
  if (!refPoint || !originalMat) return;

  const refType = document.getElementById("refType").value;
  const custom = parseFloat(document.getElementById("refDiameter").value) || 2.5;
  const refD = refType === "coin10" ? 2.7 : refType === "custom" ? custom : 2.5;

  const rPx = ReferenceUtils.detectCoinRadius(
    originalMat,
    refPoint.x,
    refPoint.y
  );

  if (rPx <= 0) {
    alert("Coin not detected. Click center of coin.");
    return;
  }

  const pxToCm = refD / (2 * rPx);

  const drapePxArea = DrapeSegmentation.extractDrapeArea(originalMat);
  const drapeCmArea = drapePxArea * pxToCm * pxToCm;

  const diskD = parseFloat(document.getElementById("diskDiameter").value);
  const fabricD = parseFloat(document.getElementById("fabricDiameter").value);

  const dc = DrapeMath.drapeCoefficient(drapeCmArea, diskD, fabricD);

  document.getElementById("pixelArea").textContent = drapePxArea.toFixed(0);
  document.getElementById("actualArea").textContent = drapeCmArea.toFixed(2);
  document.getElementById("drapeCoefficient").textContent = dc.toFixed(2) + "%";
  document.getElementById("status").textContent = "Done";
}
