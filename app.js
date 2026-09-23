/**
 * Polaroid Postcard Generator
 * by twagirumukiza
 * https://www.linkedin.com/in/innocent-twagirumukiza
 */

const photoInput = document.getElementById("photoInput");
const photoCountSelect = document.getElementById("photoCount");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");
const bgColorInput = document.getElementById("bgColor");
const canvas = document.getElementById("resultCanvas");
const placeholder = document.getElementById("previewPlaceholder");
const ctx = canvas.getContext("2d");

let loadedImages = []; // Array of HTMLImageElement

// ---------- Helpers ----------
function getOrientation() {
  return document.querySelector('input[name="orientation"]:checked').value;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Draw a single polaroid frame (white border + shadow + photo)
function drawPolaroid(ctx, img, x, y, width, height, rotationDeg = 0) {
  const borderTop = 18;
  const borderSide = 18;
  const borderBottom = 52; // more space at bottom like classic polaroid
  const frameW = width + borderSide * 2;
  const frameH = height + borderTop + borderBottom;

  ctx.save();
  ctx.translate(x + frameW / 2, y + frameH / 2);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.translate(-frameW / 2, -frameH / 2);

  // Soft shadow
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 8;

  // White frame
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, frameW, frameH);

  // Reset shadow for the photo
  ctx.shadowColor = "transparent";

  // Photo (cover style, centered crop)
  const scale = Math.max(width / img.width, height / img.height);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;

  ctx.drawImage(img, sx, sy, sw, sh, borderSide, borderTop, width, height);

  // Subtle inner border
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;
  ctx.strokeRect(borderSide + 0.5, borderTop + 0.5, width - 1, height - 1);

  ctx.restore();

  return { frameW, frameH };
}

// ---------- Generate ----------
async function generateCollage() {
  const count = parseInt(photoCountSelect.value, 10);
  const files = Array.from(photoInput.files).slice(0, count);

  if (files.length === 0) {
    alert("Veuillez sélectionner au moins une photo.");
    return;
  }

  // Load images
  loadedImages = await Promise.all(files.map(loadImage));

  // Use only the selected count (if more files selected)
  const images = loadedImages.slice(0, count);
  const orientation = getOrientation();
  const bgColor = bgColorInput.value;

  // Polaroid photo area size
  const photoW = 280;
  const photoH = 280;

  // Random small rotations for natural look
  const rotations = images.map(() => (Math.random() - 0.5) * 8); // -4° to +4°

  // Calculate layout
  let totalW, totalH;
  const gap = 40; // overlap / spacing
  const padding = 60;
  const signatureSpace = 90;

  if (orientation === "vertical") {
    // Stacked vertically with slight overlap
    const frameH = photoH + 18 + 52;
    const overlap = 70;
    totalW = photoW + 36 + padding * 2 + 40;
    totalH = frameH + (images.length - 1) * (frameH - overlap) + padding * 2 + signatureSpace;
  } else {
    // Horizontal
    const frameW = photoW + 36;
    const overlap = 50;
    totalW = frameW + (images.length - 1) * (frameW - overlap) + padding * 2;
    totalH = photoH + 18 + 52 + padding * 2 + signatureSpace;
  }

  // High-DPI for crisp output
  const dpr = 2;
  canvas.width = totalW * dpr;
  canvas.height = totalH * dpr;
  canvas.style.width = totalW + "px";
  canvas.style.height = totalH + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, totalW, totalH);

  // Draw polaroids
  if (orientation === "vertical") {
    const frameH = photoH + 18 + 52;
    const overlap = 70;
    let y = padding;
    const baseX = (totalW - (photoW + 36)) / 2;

    images.forEach((img, i) => {
      // Slight horizontal offset for natural stack
      const offsetX = (i % 2 === 0 ? -8 : 12) + (Math.random() - 0.5) * 10;
      drawPolaroid(ctx, img, baseX + offsetX, y, photoW, photoH, rotations[i]);
      y += frameH - overlap;
    });
  } else {
    const frameW = photoW + 36;
    const overlap = 50;
    let x = padding;
    const baseY = padding + 10;

    images.forEach((img, i) => {
      const offsetY = (i % 2 === 0 ? -6 : 10) + (Math.random() - 0.5) * 8;
      drawPolaroid(ctx, img, x, baseY + offsetY, photoW, photoH, rotations[i]);
      x += frameW - overlap;
    });
  }

  // Signature
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "700 32px Caveat, cursive";
  ctx.textAlign = "center";
  ctx.fillText("by twagirumukiza", totalW / 2, totalH - 45);

  // LinkedIn line (as text, since canvas can't be clickable easily)
  ctx.font = "500 14px Inter, sans-serif";
  ctx.fillStyle = "#2c5f7c";
  ctx.fillText("linkedin.com/in/innocent-twagirumukiza", totalW / 2, totalH - 20);

  // Show canvas
  placeholder.style.display = "none";
  canvas.style.display = "block";
  downloadBtn.disabled = false;
}

// ---------- Events ----------
photoInput.addEventListener("change", () => {
  const count = photoInput.files.length;
  generateBtn.disabled = count === 0;
  if (count > 0) {
    // Auto-adjust select to available photos
    const max = Math.min(count, 6);
    if (parseInt(photoCountSelect.value, 10) > max) {
      photoCountSelect.value = max;
    }
  }
});

generateBtn.addEventListener("click", () => {
  generateBtn.disabled = true;
  generateBtn.textContent = "Génération…";
  generateCollage()
    .catch((err) => {
      console.error(err);
      alert("Erreur lors du chargement des images.");
    })
    .finally(() => {
      generateBtn.disabled = false;
      generateBtn.textContent = "Générer le collage";
    });
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `polaroid-postcard-twagirumukiza-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

resetBtn.addEventListener("click", () => {
  photoInput.value = "";
  loadedImages = [];
  canvas.style.display = "none";
  placeholder.style.display = "block";
  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  photoCountSelect.value = "3";
  document.querySelector('input[name="orientation"][value="vertical"]').checked = true;
  bgColorInput.value = "#f5f0e8";
});
