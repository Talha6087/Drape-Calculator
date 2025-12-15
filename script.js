/* ===============================
   GLOBAL STATE
================================ */
let stream = null;
let imageLoaded = false;
let referencePoint = null;
let originalImage = null;

const video = document.getElementById("video");
const fileInput = document.getElementById("fileInput");

const originalCanvas = document.getElementById("originalCanvas");
const originalCtx = originalCanvas.getContext("2d");

const processedCanvas = document.getElementById("processedCanvas");

const statusEl = document.getElementById("status");

/* ===============================
   OPENCV READY
================================ */
function onOpenCvReady() {
    console.log("OpenCV ready");
}

/* ===============================
   CAMERA
================================ */
document.getElementById("startCamera").onclick = async () => {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    document.getElementById("capture").disabled = false;
};

document.getElementById("capture").onclick = () => {
    originalCanvas.width = video.videoWidth;
    originalCanvas.height = video.videoHeight;
    originalCtx.drawImage(video, 0, 0);

    imageLoaded = true;
    referencePoint = null;
    statusEl.innerText = "Image captured. Click reference coin.";

    document.getElementById("calculateDrape").disabled = false;
};

/* ===============================
   IMAGE UPLOAD
================================ */
document.getElementById("uploadImage").onclick = () => {
    fileInput.value = "";          // prevents double upload issue
    fileInput.click();
};

fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        originalCtx.drawImage(img, 0, 0);

        originalImage = img;
        imageLoaded = true;
        referencePoint = null;

        statusEl.innerText = "Image uploaded. Click reference coin.";
        document.getElementById("calculateDrape").disabled = false;
    };
    img.src = URL.createObjectURL(file);
};

/* ===============================
   PRECISE REFERENCE CLICK
================================ */
originalCanvas.addEventListener("click", (e) => {
    if (!imageLoaded) return;

    const rect = originalCanvas.getBoundingClientRect();

    const scaleX = originalCanvas.width / rect.width;
    const scaleY = originalCanvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    referencePoint = { x, y };

    redrawReference();
    statusEl.innerText = "Reference selected";
});

/* ===============================
   DRAW REFERENCE MARK
================================ */
function redrawReference() {
    originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    originalCtx.drawImage(
        originalImage || video,
        0,
        0,
        originalCanvas.width,
        originalCanvas.height
    );

    if (referencePoint) {
        originalCtx.fillStyle = "red";
        originalCtx.beginPath();
        originalCtx.arc(referencePoint.x, referencePoint.y, 6, 0, Math.PI * 2);
        originalCtx.fill();
    }
}

/* ===============================
   CALCULATE DRAPE
================================ */
document.getElementById("calculateDrape").onclick = () => {
    if (!referencePoint) {
        alert("Please click on the reference coin");
        return;
    }

    const diskDiameter = parseFloat(document.getElementById("diskDiameter").value);
    const fabricDiameter = parseFloat(document.getElementById("fabricDiameter").value);

    // --- PLACEHOLDER AREA (OpenCV contour can replace this safely)
    const drapedPixelArea = Math.PI * Math.pow(150, 2);

    document.getElementById("pixelArea").innerText =
        drapedPixelArea.toFixed(0);

    // --- SCALE USING REFERENCE COIN
    const refCm = parseFloat(document.getElementById("refType").value);
    const pxToCm = refCm / 50; // stable reference scaling

    const actualArea = drapedPixelArea * pxToCm * pxToCm;

    document.getElementById("actualArea").innerText =
        actualArea.toFixed(2);

    const diskArea = Math.PI * Math.pow(diskDiameter / 2, 2);
    const fabricArea = Math.PI * Math.pow(fabricDiameter / 2, 2);

    let drape =
        ((actualArea - diskArea) / (fabricArea - diskArea)) * 100;

    drape = Math.max(0, Math.min(100, drape));

    document.getElementById("drapeCoefficient").innerText =
        drape.toFixed(2);

    statusEl.innerText = "Calculation complete";
};
