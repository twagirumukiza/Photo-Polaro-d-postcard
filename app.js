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
const embedBtn = document.getElementById("embedBtn");
const embedModal = document.getElementById("embedModal");
const embedCode = document.getElementById("embedCode");
const closeModal = document.getElementById("closeModal");
const copyEmbedBtn = document.getElementById("copyEmbedBtn");
const ctx = canvas.getContext("2d");

if (!ctx) {
  alert("Votre navigateur ne supporte pas l'élément <canvas>. Essayez avec une version récente de Chrome, Firefox ou Edge.");
}

let images = [];           // HTMLImageElement[]
let transforms = [];       // { offsetX, offsetY, rotation }[]
let currentOrientation = "vertical";
let currentBg = "#f5f0e8";
let lastCollageSize = { width: 0, height: 0 }; // dimensions naturelles (CSS px) du dernier collage généré

// ---------- Helpers ----------
function getOrientation() {
  return document.querySelector('input[name="orientation"]:checked').value;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error(`« ${file.name} » n'est pas une image valide (type détecté : ${file.type || "inconnu"}).`));
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossible de charger l'image « ${file.name} ». Le fichier est peut-être corrompu ou dans un format non supporté (ex. HEIC).`));
    img.src = objectUrl;
  });
}

function drawPolaroid(ctx, img, x, y, width, height, rotationDeg = 0, crop = { zoom: 1, offsetX: 0, offsetY: 0 }) {
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

  // Photo (cover crop, ajustable : zoom + recadrage manuel)
  const zoom = Math.max(1, crop.zoom || 1);
  const baseScale = Math.max(width / img.width, height / img.height) * zoom;
  const sw = Math.min(img.width, width / baseScale);
  const sh = Math.min(img.height, height / baseScale);

  // Marge disponible pour déplacer le cadrage dans l'image source
  const slackX = (img.width - sw) / 2;
  const slackY = (img.height - sh) / 2;
  const offsetX = Math.max(-1, Math.min(1, (crop.offsetX || 0) / 100));
  const offsetY = Math.max(-1, Math.min(1, (crop.offsetY || 0) / 100));
  const sx = slackX * (1 + offsetX);
  const sy = slackY * (1 + offsetY);

  ctx.save();
  ctx.beginPath();
  ctx.rect(borderSide, borderTop, width, height);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, borderSide, borderTop, width, height);
  ctx.restore();

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
        t.rotation,
        { zoom: t.cropZoom / 100, offsetX: t.cropOffsetX, offsetY: t.cropOffsetY }
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
        t.rotation,
        { zoom: t.cropZoom / 100, offsetX: t.cropOffsetX, offsetY: t.cropOffsetY }
      );
      x += frameW - overlap;
    });
  }

  placeholder.style.display = "none";
  canvas.style.display = "block";
  downloadBtn.disabled = false;
  embedBtn.disabled = false;
  lastCollageSize = { width: totalW, height: totalH };
}

// ---------- Build adjusters UI ----------
const ORDINAL_SUFFIX_FR = (n) => (n === 1 ? "er" : "e");

function buildAdjusters() {
  photoAdjusters.innerHTML = "";

  images.forEach((_, i) => {
    const t = transforms[i];
    const div = document.createElement("div");
    div.className = "photo-adjuster" + (t.collapsed ? " is-collapsed" : "");

    const positionOptions = images
      .map((__, p) => `<option value="${p}" ${p === i ? "selected" : ""}>${p + 1}${ORDINAL_SUFFIX_FR(p + 1)}</option>`)
      .join("");

    div.innerHTML = `
      <div class="adjuster-header">
        <button type="button" class="adjuster-toggle" data-index="${i}" aria-expanded="${!t.collapsed}">
          <span class="chevron">▸</span>
          <span class="title">Photo ${i + 1}</span>
        </button>
        <label class="position-select-label">
          Position
          <select class="position-select" data-index="${i}">
            ${positionOptions}
          </select>
        </label>
      </div>
      <div class="adjuster-body">
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
        <div class="crop-subtitle">Recadrage de la photo</div>
        <div class="slider-row">
          <label>Zoom</label>
          <input type="range" min="100" max="300" step="5" value="${t.cropZoom}" data-index="${i}" data-prop="cropZoom" />
          <span class="value">${(t.cropZoom / 100).toFixed(2)}×</span>
        </div>
        <div class="slider-row">
          <label>Cadrage X</label>
          <input type="range" min="-100" max="100" value="${t.cropOffsetX}" data-index="${i}" data-prop="cropOffsetX" />
          <span class="value">${t.cropOffsetX}</span>
        </div>
        <div class="slider-row">
          <label>Cadrage Y</label>
          <input type="range" min="-100" max="100" value="${t.cropOffsetY}" data-index="${i}" data-prop="cropOffsetY" />
          <span class="value">${t.cropOffsetY}</span>
        </div>
        <button type="button" class="btn ghost crop-reset-btn" data-index="${i}">Réinitialiser le recadrage</button>
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
      if (prop === "rotation") {
        valueSpan.textContent = value + "°";
      } else if (prop === "cropZoom") {
        valueSpan.textContent = (value / 100).toFixed(2) + "×";
      } else {
        valueSpan.textContent = value;
      }

      renderCollage();
    });
  });

  // Reset crop per photo
  photoAdjusters.querySelectorAll(".crop-reset-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.target.dataset.index, 10);
      transforms[index].cropZoom = 100;
      transforms[index].cropOffsetX = 0;
      transforms[index].cropOffsetY = 0;
      buildAdjusters();
      renderCollage();
    });
  });

  // Panneaux rétractables : replier/déplier sans tout reconstruire
  photoAdjusters.querySelectorAll(".adjuster-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(btn.dataset.index, 10);
      const collapsed = !transforms[index].collapsed;
      transforms[index].collapsed = collapsed;
      const card = btn.closest(".photo-adjuster");
      card.classList.toggle("is-collapsed", collapsed);
      btn.setAttribute("aria-expanded", (!collapsed).toString());
    });
  });

  // Choix de la position (1re, 2e, 3e...) de chaque polaroid
  photoAdjusters.querySelectorAll(".position-select").forEach((select) => {
    select.addEventListener("change", (e) => {
      const fromIndex = parseInt(e.target.dataset.index, 10);
      const toIndex = parseInt(e.target.value, 10);
      movePhotoToPosition(fromIndex, toIndex);
      renderCollage();
      buildAdjusters();
    });
  });

  positionControls.style.display = "block";
}

// Déplace une photo (et ses réglages) d'une position à une autre dans l'ordre du collage
function movePhotoToPosition(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [img] = images.splice(fromIndex, 1);
  const [t] = transforms.splice(fromIndex, 1);
  images.splice(toIndex, 0, img);
  transforms.splice(toIndex, 0, t);
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
    cropZoom: 100,    // 100 = cadrage automatique (cover), jusqu'à 300 = zoom x3
    cropOffsetX: 0,   // -100 (gauche) à 100 (droite)
    cropOffsetY: 0,   // -100 (haut) à 100 (bas)
    collapsed: false, // état replié/déplié du panneau de réglages
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
      alert(
        "Erreur lors du chargement des images.\n\n" +
          "Détail : " + (err && err.message ? err.message : err) +
          "\n\nOuvrez la console du navigateur (F12) pour plus de détails."
      );
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
  embedBtn.disabled = true;
  photoCountSelect.value = "3";
  document.querySelector('input[name="orientation"][value="vertical"]').checked = true;
  bgColorInput.value = "#f5f0e8";
});

// ---------- Embed / HTML code ----------
embedBtn.addEventListener("click", () => {
  if (!canvas.width) return;

  // Largeur naturelle du collage (en CSS px) : sert de plafond pour éviter
  // un agrandissement flou de l'image sur les grands écrans.
  const naturalWidth = Math.round(lastCollageSize.width) || 640;
  const naturalHeight = Math.round(lastCollageSize.height) || 640;
  const ratio = (naturalWidth / naturalHeight).toFixed(4);

  const html = `<!-- Polaroid Postcard – by twagirumukiza -->
<!-- Responsive : occupe le plus de place possible sans jamais dépasser
     la résolution naturelle de l'image (évite le flou d'agrandissement). -->
<figure class="polaroid-postcard" style="
  width: 100%;
  max-width: min(92vw, ${naturalWidth}px);
  aspect-ratio: ${ratio};
  margin: 2rem auto;
  text-align: center;
  font-family: system-ui, sans-serif;
">
  <img
    src="VOTRE-IMAGE.png"
    alt="Collage polaroid"
    width="${naturalWidth}"
    height="${naturalHeight}"
    style="
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      border-radius: 4px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
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

async function copyEmbedCodeToClipboard() {
  const text = embedCode.value;

  // Sélection visible (utile sur mobile + fallback execCommand)
  embedCode.focus();
  embedCode.setSelectionRange(0, text.length);

  // 1) API moderne, si disponible et autorisée
  if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText a échoué, tentative de repli :", err);
    }
  }

  // 2) Repli pour Safari iOS / navigateurs restreints
  try {
    return document.execCommand("copy");
  } catch (err) {
    console.error("execCommand('copy') a échoué :", err);
    return false;
  }
}

copyEmbedBtn.addEventListener("click", async () => {
  const originalLabel = "Copier le code";
  let success = false;
  try {
    success = await copyEmbedCodeToClipboard();
  } catch (err) {
    console.error("Erreur inattendue lors de la copie :", err);
    success = false;
  }

  copyEmbedBtn.textContent = success
    ? "Copié !"
    : "Copie impossible — sélectionnez et copiez (Cmd/Ctrl+C)";

  setTimeout(() => {
    copyEmbedBtn.textContent = originalLabel;
  }, success ? 1800 : 3000);
});
