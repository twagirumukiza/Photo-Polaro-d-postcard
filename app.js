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
const positionControls = document.getElementById("positionControls");
const photoAdjusters = document.getElementById("photoAdjusters");
const ctx = canvas.getContext("2d");

let images = [];           // HTMLImageElement[]
let transforms = [];       // { offsetX, offsetY, rotation }[]
let currentOrientation = "vertical";
let currentBg = "#f5f0e8";

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

function drawPolaroid(ctx, img, x, y, width, height, rotationDeg = 0) {
  const borderTop = 18;
  const borderSide = 18;
  const borderBottom = 52;
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

  ctx.shadowColor = "transparent";

  // Photo (cover crop)
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
}

// ---------- Render ----------
function renderCollage() {
  if (images.length === 0) return;

  const photoW = 280;
  const photoH = 280;
  const padding = 60;
  const orientation = currentOrientation;
  const bgColor = currentBg;

  let totalW, totalH;

  if (orientation === "vertical") {
    const frameH = photoH + 18 + 52;
    const overlap = 70;
    totalW = photoW + 36 + padding * 2 + 40;
    totalH = frameH + (images.length - 1) * (frameH - overlap) + padding * 2;
  } else {
    const frameW = photoW + 36;
    const overlap = 50;
    totalW = frameW + (images.length - 1) * (frameW - overlap) + padding * 2;
    totalH = photoH + 18 + 52 + padding * 2;
  }

  // High-DPI
  const dpr = 2;
  canvas.width = totalW * dpr;
  canvas.height = totalH * dpr;
  canvas.style.width = totalW + "px";
  canvas.style.height = totalH + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, totalW, totalH);

  // Draw each polaroid with its transform
  if (orientation === "vertical") {
    const frameH = photoH + 18 + 52;
    const overlap = 70;
    let y = padding;
    const baseX = (totalW - (photoW + 36)) / 2;

    images.forEach((img, i) => {
      const t = transforms[i];
      drawPolaroid(
        ctx,
        img,
        baseX + t.offsetX,
        y + t.offsetY,
        photoW,
        photoH,
        t.rotation
      );
      y += frameH - overlap;
    });
  } else {
    const frameW = photoW + 36;
    const overlap = 50;
    let x = padding;
    const baseY = padding + 10;

    images.forEach((img, i) => {
      const t = transforms[i];
      drawPolaroid(
        ctx,
        img,
        x + t.offsetX,
        baseY + t.offsetY,
        photoW,
        photoH,
        t.rotation
      );
      x += frameW - overlap;
    });
  }

  placeholder.style.display = "none";
  canvas.style.display = "block";
  downloadBtn.disabled = false;
  if (typeof embedBtn !== "undefined") embedBtn.disabled = false;
}

// ---------- Build adjusters UI ----------
function buildAdjusters() {
  photoAdjusters.innerHTML = "";

  images.forEach((_, i) => {
    const t = transforms[i];
    const div = document.createElement("div");
    div.className = "photo-adjuster";
    div.innerHTML = `
      <div class="title">Photo ${i + 1}</div>
      <div class="slider-row">
        <label>X</label>
        <input type="range" min="-120" max="120" value="${t.offsetX}" data-index="${i}" data-prop="offsetX" />
        <span class="value">${t.offsetX}</span>
      </div>
      <div class="slider-row">
        <label>Y</label>
        <input type="range" min="-120" max="120" value="${t.offsetY}" data-index="${i}" data-prop="offsetY" />
        <span class="value">${t.offsetY}</span>
      </div>
      <div class="slider-row">
        <label>Rotation</label>
        <input type="range" min="-25" max="25" value="${t.rotation}" data-index="${i}" data-prop="rotation" />
        <span class="value">${t.rotation}°</span>
      </div>
    `;
    photoAdjusters.appendChild(div);
  });

  // Listen to all sliders
  photoAdjusters.querySelectorAll('input[type="range"]').forEach((slider) => {
    slider.addEventListener("input", (e) => {
      const index = parseInt(e.target.dataset.index, 10);
      const prop = e.target.dataset.prop;
      const value = parseInt(e.target.value, 10);
      transforms[index][prop] = value;

      // Update value display
      const valueSpan = e.target.parentElement.querySelector(".value");
      valueSpan.textContent = prop === "rotation" ? value + "°" : value;

      renderCollage();
    });
  });

  positionControls.style.display = "block";
}

// ---------- Generate ----------
async function generateCollage() {
  const count = parseInt(photoCountSelect.value, 10);
  const files = Array.from(photoInput.files).slice(0, count);

  if (files.length === 0) {
    alert("Veuillez sélectionner au moins une photo.");
    return;
  }

  images = await Promise.all(files.map(loadImage));
  currentOrientation = getOrientation();
  currentBg = bgColorInput.value;

  // Initial transforms (slight natural offset + random rotation)
  transforms = images.map((_, i) => ({
    offsetX: (i % 2 === 0 ? -8 : 12) + Math.round((Math.random() - 0.5) * 10),
    offsetY: Math.round((Math.random() - 0.5) * 8),
    rotation: Math.round((Math.random() - 0.5) * 8),
  }));

  renderCollage();
  buildAdjusters();
}

// ---------- Download ----------
downloadBtn.addEventListener("click", () => {
  if (!canvas.width || !canvas.height) {
    alert("Aucun collage à télécharger. Générez d'abord une image.");
    return;
  }

  const filename = "polaroid-postcard-" + Date.now() + ".png";

  if (canvas.toBlob) {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          triggerDownload(url, filename);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          return;
        }
        fallbackDownload(filename);
      },
      "image/png",
      1.0
    );
  } else {
    fallbackDownload(filename);
  }
});

function triggerDownload(url, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function fallbackDownload(filename) {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    triggerDownload(dataUrl, filename);
  } catch (e) {
    console.error(e);
    alert(
      "Le téléchargement automatique a échoué.\\n\\n" +
        "Astuce : faites un clic droit (ou appui long) sur le collage → « Enregistrer l'image sous… »"
    );
  }
}

// ---------- Events ----------
photoInput.addEventListener("change", () => {
  const count = photoInput.files.length;
  generateBtn.disabled = count === 0;
  if (count > 0) {
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

// Live update when orientation or bg changes (if already generated)
document.querySelectorAll('input[name="orientation"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    if (images.length > 0) {
      currentOrientation = getOrientation();
      renderCollage();
    }
  });
});

bgColorInput.addEventListener("input", () => {
  if (images.length > 0) {
    currentBg = bgColorInput.value;
    renderCollage();
  }
});

resetBtn.addEventListener("click", () => {
  photoInput.value = "";
  images = [];
  transforms = [];
  canvas.style.display = "none";
  placeholder.style.display = "block";
  positionControls.style.display = "none";
  photoAdjusters.innerHTML = "";
  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  if (typeof embedBtn !== "undefined") embedBtn.disabled = true;
  photoCountSelect.value = "3";
  document.querySelector('input[name="orientation"][value="vertical"]').checked = true;
  bgColorInput.value = "#f5f0e8";

// ---------- Embed / HTML code ----------
const embedBtn = document.getElementById("embedBtn");
const embedModal = document.getElementById("embedModal");
const embedCode = document.getElementById("embedCode");
const closeModal = document.getElementById("closeModal");
const copyEmbedBtn = document.getElementById("copyEmbedBtn");

embedBtn.addEventListener("click", () => {
  if (!canvas.width) return;

  const html = `<!-- Polaroid Postcard – by twagirumukiza -->
<figure class="polaroid-postcard" style="
  max-width: 420px;
  margin: 2rem auto;
  text-align: center;
  font-family: system-ui, sans-serif;
">
  <img
    src="VOTRE-IMAGE.png"
    alt="Collage polaroid"
    style="
      width: 100%;
      height: auto;
      border-radius: 4px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      display: block;
    "
  />
  <figcaption style="
    margin-top: 0.75rem;
    font-size: 0.85rem;
    color: #666;
  ">
    <!-- Optionnel : légende -->
  </figcaption>
</figure>`;

  embedCode.value = html;
  embedModal.style.display = "flex";
});

closeModal.addEventListener("click", () => {
  embedModal.style.display = "none";
});

embedModal.addEventListener("click", (e) => {
  if (e.target === embedModal) {
    embedModal.style.display = "none";
  }
});

copyEmbedBtn.addEventListener("click", () => {
  embedCode.select();
  navigator.clipboard.writeText(embedCode.value).then(() => {
    copyEmbedBtn.textContent = "Copié !";
    setTimeout(() => {
      copyEmbedBtn.textContent = "Copier le code";
    }, 1800);
  }).catch(() => {
    document.execCommand("copy");
    copyEmbedBtn.textContent = "Copié !";
    setTimeout(() => {
      copyEmbedBtn.textContent = "Copier le code";
    }, 1800);
  });
});
