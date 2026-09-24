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
const previewHint = document.getElementById("previewHint");
const positionControls = document.getElementById("positionControls");
const positionControlsToggle = document.getElementById("positionControlsToggle");
const photoAdjusters = document.getElementById("photoAdjusters");
const embedBtn = document.getElementById("embedBtn");
const embedManualBtn = document.getElementById("embedManualBtn");
const embedManualFields = document.getElementById("embedManualFields");
const embedManualCount = document.getElementById("embedManualCount");
const embedManualBg = document.getElementById("embedManualBg");
const embedManualUrlFields = document.getElementById("embedManualUrlFields");
const embedGeneratedHint = document.getElementById("embedGeneratedHint");
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
let photoHitboxes = [];    // zones cliquables (coordonnées CSS px du canvas) de chaque polaroid dessiné

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
  photoHitboxes = [];
  const borderSide = 18, borderTop = 18, borderBottom = 52;
  const frameWSize = photoW + borderSide * 2;
  const frameHSize = photoH + borderTop + borderBottom;

  if (orientation === "vertical") {
    const frameH = photoH + 18 + 52;
    const overlap = 70;
    let y = padding;
    const baseX = (totalW - (photoW + 36)) / 2;

    images.forEach((img, i) => {
      const t = transforms[i];
      const frameX = baseX + t.offsetX;
      const frameY = y + t.offsetY;
      drawPolaroid(
        ctx,
        img,
        frameX,
        frameY,
        photoW,
        photoH,
        t.rotation,
        { zoom: t.cropZoom / 100, offsetX: t.cropOffsetX, offsetY: t.cropOffsetY }
      );
      photoHitboxes.push({ index: i, x: frameX, y: frameY, w: frameWSize, h: frameHSize, rotation: t.rotation });
      y += frameH - overlap;
    });
  } else {
    const frameW = photoW + 36;
    const overlap = 50;
    let x = padding;
    const baseY = padding + 10;

    images.forEach((img, i) => {
      const t = transforms[i];
      const frameX = x + t.offsetX;
      const frameY = baseY + t.offsetY;
      drawPolaroid(
        ctx,
        img,
        frameX,
        frameY,
        photoW,
        photoH,
        t.rotation,
        { zoom: t.cropZoom / 100, offsetX: t.cropOffsetX, offsetY: t.cropOffsetY }
      );
      photoHitboxes.push({ index: i, x: frameX, y: frameY, w: frameWSize, h: frameHSize, rotation: t.rotation });
      x += frameW - overlap;
    });
  }

  placeholder.style.display = "none";
  canvas.style.display = "block";
  previewHint.style.display = "block";
  downloadBtn.disabled = false;
  embedBtn.disabled = false;
  lastCollageSize = { width: totalW, height: totalH };
}

// ---------- Clic sur une photo du canvas → ouvre son panneau de réglages ----------
function findPhotoAtCanvasPoint(canvasX, canvasY) {
  // Parcours du dernier dessiné (dessus) au premier (dessous)
  for (let k = photoHitboxes.length - 1; k >= 0; k--) {
    const box = photoHitboxes[k];
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const angle = (-box.rotation * Math.PI) / 180;
    const dx = canvasX - cx;
    const dy = canvasY - cy;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle) + box.w / 2;
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle) + box.h / 2;
    if (rx >= 0 && rx <= box.w && ry >= 0 && ry <= box.h) {
      return box.index;
    }
  }
  return -1;
}

canvas.addEventListener("click", (e) => {
  if (!lastCollageSize.width) return;
  const rect = canvas.getBoundingClientRect();
  // Le canvas peut être réduit par le CSS (max-width:100%) : on remet les
  // coordonnées à l'échelle CSS naturelle (celle utilisée par renderCollage).
  const scale = lastCollageSize.width / rect.width;
  const canvasX = (e.clientX - rect.left) * scale;
  const canvasY = (e.clientY - rect.top) * scale;

  const index = findPhotoAtCanvasPoint(canvasX, canvasY);
  if (index >= 0) {
    expandPhotoPanel(index, { scrollIntoView: true });
  }
});

// Ouvre le panneau de réglages d'une photo (referme les autres, façon accordéon)
function expandPhotoPanel(index, { scrollIntoView = false } = {}) {
  if (!transforms[index]) return;

  transforms.forEach((t, i) => {
    t.collapsed = i !== index;
  });

  photoAdjusters.querySelectorAll(".photo-adjuster").forEach((card) => {
    const i = parseInt(card.dataset.index, 10);
    const collapsed = i !== index;
    card.classList.toggle("is-collapsed", collapsed);
    const toggleBtn = card.querySelector(".adjuster-toggle");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", (!collapsed).toString());
  });

  if (positionControls.classList.contains("is-collapsed")) {
    positionControls.classList.remove("is-collapsed");
    if (positionControlsToggle) positionControlsToggle.setAttribute("aria-expanded", "true");
  }

  if (scrollIntoView) {
    const card = photoAdjusters.querySelector(`.photo-adjuster[data-index="${index}"]`);
    if (card && card.scrollIntoView) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

// ---------- Build adjusters UI ----------
const ORDINAL_SUFFIX_FR = (n) => (n === 1 ? "er" : "e");

function buildAdjusters() {
  photoAdjusters.innerHTML = "";

  images.forEach((_, i) => {
    const t = transforms[i];
    const div = document.createElement("div");
    div.className = "photo-adjuster" + (t.collapsed ? " is-collapsed" : "");
    div.dataset.index = i;

    const positionOptions = images
      .map((__, p) => `<option value="${p}" ${p === i ? "selected" : ""}>${p + 1}${ORDINAL_SUFFIX_FR(p + 1)}</option>`)
      .join("");

    const isFirst = i === 0;
    const isLast = i === images.length - 1;

    div.innerHTML = `
      <div class="adjuster-header">
        <button type="button" class="adjuster-toggle" data-index="${i}" aria-expanded="${!t.collapsed}">
          <span class="chevron">▸</span>
          <span class="title">Photo ${i + 1}</span>
        </button>
        <div class="adjuster-controls">
          <div class="reorder-buttons">
            <button type="button" class="reorder-btn" data-index="${i}" data-dir="up" ${isFirst ? "disabled" : ""} title="Monter" aria-label="Monter d'une position">▲</button>
            <button type="button" class="reorder-btn" data-index="${i}" data-dir="down" ${isLast ? "disabled" : ""} title="Descendre" aria-label="Descendre d'une position">▼</button>
          </div>
          <label class="position-select-label">
            Position
            <select class="position-select" data-index="${i}">
              ${positionOptions}
            </select>
          </label>
        </div>
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

  // Panneaux rétractables (façon accordéon : un seul ouvert à la fois)
  photoAdjusters.querySelectorAll(".adjuster-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(btn.dataset.index, 10);
      const wasCollapsed = transforms[index].collapsed;
      if (wasCollapsed) {
        expandPhotoPanel(index);
      } else {
        // Déjà ouvert : on referme simplement ce panneau
        transforms[index].collapsed = true;
        const card = btn.closest(".photo-adjuster");
        card.classList.add("is-collapsed");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  });

  // Monter / descendre d'une position
  photoAdjusters.querySelectorAll(".reorder-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(btn.dataset.index, 10);
      const dir = btn.dataset.dir;
      const toIndex = dir === "up" ? index - 1 : index + 1;
      if (toIndex < 0 || toIndex >= images.length) return;
      movePhotoToPosition(index, toIndex);
      renderCollage();
      buildAdjusters();
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
    collapsed: true,  // état replié/déplié du panneau de réglages (accordéon : replié par défaut)
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
  photoHitboxes = [];
  canvas.style.display = "none";
  placeholder.style.display = "block";
  previewHint.style.display = "none";
  positionControls.style.display = "none";
  photoAdjusters.innerHTML = "";
  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  embedBtn.disabled = true;
  photoCountSelect.value = "3";
  document.querySelector('input[name="orientation"][value="vertical"]').checked = true;
  bgColorInput.value = "#f5f0e8";
});

// Repli/dépli du panneau global "Ajuster chaque polaroid"
positionControlsToggle.addEventListener("click", () => {
  const collapsed = positionControls.classList.toggle("is-collapsed");
  positionControlsToggle.setAttribute("aria-expanded", (!collapsed).toString());
});

// ---------- Embed / HTML code ----------

// Bloc réutilisable "popup plein écran" (lightbox) : ouvre une photo en grand
// au clic, et referme en revenant exactement à la position de défilement de
// départ. `namespace` évite les collisions si les deux types de code générés
// (image unique + pile de photos) sont collés sur la même page.
function buildLightboxAssets(namespace) {
  return {
    html: `<div class="pp-lightbox" data-pp-lightbox="${namespace}" aria-hidden="true">
  <button type="button" class="pp-lightbox-close" aria-label="Fermer">&times;</button>
  <img src="" alt="" />
</div>`,
    css: `  .pp-lightbox[data-pp-lightbox="${namespace}"] {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 2rem;
  }
  .pp-lightbox[data-pp-lightbox="${namespace}"].is-open { display: flex; }
  .pp-lightbox[data-pp-lightbox="${namespace}"] img {
    max-width: 92vw;
    max-height: 88vh;
    border-radius: 4px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  .pp-lightbox[data-pp-lightbox="${namespace}"] .pp-lightbox-close {
    position: absolute;
    top: 1rem;
    right: 1.25rem;
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    border: none;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
  }
  .pp-lightbox[data-pp-lightbox="${namespace}"] .pp-lightbox-close:hover { background: rgba(255, 255, 255, 0.3); }
  body.pp-lightbox-open-${namespace} { overflow: hidden; }`,
    js: `    var lightbox = document.querySelector('[data-pp-lightbox="${namespace}"]');
    var lightboxImg = lightbox ? lightbox.querySelector("img") : null;
    var lightboxClose = lightbox ? lightbox.querySelector(".pp-lightbox-close") : null;
    var savedScrollY = 0;

    function openLightbox(src, alt) {
      if (!lightbox) return;
      savedScrollY = window.scrollY;
      lightboxImg.src = src;
      lightboxImg.alt = alt || "";
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("pp-lightbox-open-${namespace}");
    }
    function closeLightbox() {
      if (!lightbox) return;
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.classList.remove("pp-lightbox-open-${namespace}");
      window.scrollTo(0, savedScrollY);
    }
    if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
    if (lightbox) {
      lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox) closeLightbox();
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLightbox();
    });`,
  };
}

function buildEmbedHtml(imagePath, width, height) {
  const hasSize = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  const w = hasSize ? Math.round(width) : null;
  const h = hasSize ? Math.round(height) : null;
  const maxWidthValue = hasSize ? `${w}px` : "640px";
  const aspectRatioLine = hasSize ? `\n  aspect-ratio: ${(w / h).toFixed(4)};` : "";
  const imgSizeAttrs = hasSize ? `\n    width="${w}"\n    height="${h}"` : "";
  const imgHeightStyle = hasSize ? "100%" : "auto";
  const note = hasSize
    ? "Responsive : occupe le plus de place possible sans jamais dépasser la résolution naturelle de l'image (évite le flou d'agrandissement)."
    : "Responsive : occupe le plus de place possible. Renseignez la largeur/hauteur réelles de l'image pour éviter tout flou d'agrandissement.";
  const src = imagePath || "VOTRE-IMAGE.png";
  const lb = buildLightboxAssets("single");

  return `<!-- Polaroid Postcard – by twagirumukiza -->
<!-- ${note} -->
<!-- Cliquez sur la photo pour l'ouvrir en grand (popup) ; Échap, clic à
     l'extérieur ou le bouton de fermeture referment le popup et vous
     ramènent exactement où vous étiez sur la page. -->
<style>
${lb.css}
</style>

<figure class="polaroid-postcard" style="
  width: 100%;
  max-width: min(92vw, ${maxWidthValue});${aspectRatioLine}
  margin: 2rem auto;
  text-align: center;
  font-family: system-ui, sans-serif;
">
  <img
    src="${src}"
    alt="Collage polaroid"${imgSizeAttrs}
    data-pp-open="single"
    style="
      width: 100%;
      height: ${imgHeightStyle};
      display: block;
      object-fit: contain;
      border-radius: 4px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      cursor: zoom-in;
    "
  />
  <figcaption style="
    margin-top: 0.75rem;
    font-size: 0.85rem;
    color: #666;
  ">
    <!-- Optionnel : légende -->
  </figcaption>
</figure>

${lb.html}

<script>
  (function () {
${lb.js}

    var trigger = document.querySelector('[data-pp-open="single"]');
    if (trigger) {
      trigger.addEventListener("click", function () {
        openLightbox(trigger.src, trigger.alt);
      });
    }
  })();
</script>`;
}

// Bouton "Code HTML" : à partir du collage qui vient d'être généré
embedBtn.addEventListener("click", () => {
  if (!canvas.width) return;

  embedManualFields.style.display = "none";
  embedGeneratedHint.textContent = "Copiez ce code et collez-le dans votre site. Remplacez VOTRE-IMAGE.png par le chemin de votre fichier téléchargé.";

  const naturalWidth = Math.round(lastCollageSize.width) || 640;
  const naturalHeight = Math.round(lastCollageSize.height) || 640;
  embedCode.value = buildEmbedHtml("VOTRE-IMAGE.png", naturalWidth, naturalHeight);
  embedModal.style.display = "flex";
});

// ---------- Bouton "Code HTML (sans générer)" ----------
// Génère un bloc HTML + CSS + JS autonome qui va chercher des photos déjà en
// ligne (par leur URL/chemin) et les met en scène en polaroids empilés
// directement dans le navigateur — aucune image n'est créée ici.

let manualUrlValues = ["", "", ""]; // conserve la saisie quand on change le nombre de photos

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const MANUAL_ROTATIONS = [-5, 4, -6, 5, -4, 6];

function buildStandaloneEmbedHtml({ urls, orientation, bgColor }) {
  const isHorizontal = orientation === "horizontal";
  const items = urls.map((url, i) => {
    const src = escapeAttr((url && url.trim()) || `CHEMIN-PHOTO-${i + 1}.jpg`);
    const rot = MANUAL_ROTATIONS[i % MANUAL_ROTATIONS.length];
    return `    <div class="polaroid-item">
      <div class="polaroid-frame" data-rotate="${rot}" style="--rot: ${rot}deg;" data-pp-open="stack">
        <img src="${src}" alt="Photo ${i + 1}" loading="lazy" />
      </div>
    </div>`;
  }).join("\n");

  const lb = buildLightboxAssets("stack");

  return `<!-- Polaroid Postcard (autonome) – by twagirumukiza -->
<!-- Va chercher vos photos par leur URL/chemin et les met en scène en
     polaroids empilés, directement dans la page (aucune image pré-générée
     n'est nécessaire). Remplacez les CHEMIN-PHOTO-N.jpg par vos liens.
     Cliquez sur une photo pour l'ouvrir en grand (popup) ; Échap, clic à
     l'extérieur ou le bouton de fermeture referment le popup et vous
     ramènent exactement où vous étiez sur la page. -->
<style>
  .polaroid-stack {
    --bg: ${bgColor};
    box-sizing: border-box;
    width: 100%;
    max-width: min(92vw, ${isHorizontal ? "900px" : "420px"});
    margin: 2rem auto;
    padding: 2rem 1.25rem;
    background: var(--bg);
    border-radius: 12px;
    ${isHorizontal ? "display: flex;\n    align-items: center;\n    justify-content: center;\n    flex-wrap: nowrap;\n    overflow-x: auto;" : ""}
  }
  .polaroid-stack .polaroid-item {
    position: relative;
    ${isHorizontal
      ? "flex: 0 0 auto;\n    width: 42%;\n    margin-right: -9%;"
      : "width: 68%;\n    margin: 0 auto -14% auto;"}
  }
  .polaroid-stack .polaroid-item:last-child {
    margin-right: 0;
    margin-bottom: 0;
  }
  .polaroid-stack .polaroid-frame {
    background: #fff;
    padding: 6% 6% 18% 6%;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
    border-radius: 2px;
    cursor: zoom-in;
    transform: rotate(var(--rot, 0deg));
    transition: transform 0.2s ease;
  }
  .polaroid-stack .polaroid-frame:hover {
    transform: rotate(var(--rot, 0deg)) scale(1.04);
    z-index: 50;
  }
  .polaroid-stack .polaroid-frame img {
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 1px;
    pointer-events: none;
  }
${lb.css}
</style>

<div class="polaroid-stack${isHorizontal ? " horizontal" : ""}" data-polaroid-embed>
${items}
</div>

${lb.html}

<script>
  (function () {
    var frames = document.querySelectorAll('[data-polaroid-embed] .polaroid-frame');

${lb.js}

    frames.forEach(function (frame) {
      // Légère variation aléatoire à chaque chargement, pour un effet "pile de vraies photos"
      var base = parseFloat(frame.dataset.rotate || "0");
      var jitter = (Math.random() - 0.5) * 4;
      frame.style.setProperty("--rot", (base + jitter).toFixed(1) + "deg");

      // Clic sur une photo : l'ouvre en grand (popup)
      frame.addEventListener("click", function () {
        var img = frame.querySelector("img");
        if (img) openLightbox(img.src, img.alt);
      });
    });
  })();
</script>`;
}

function renderManualUrlInputs() {
  const count = parseInt(embedManualCount.value, 10);

  // Conserver les valeurs déjà saisies si on change le nombre de photos
  while (manualUrlValues.length < count) manualUrlValues.push("");
  manualUrlValues = manualUrlValues.slice(0, count);

  embedManualUrlFields.innerHTML = manualUrlValues
    .map((val, i) => `
      <div class="control-group">
        <label for="embedManualUrl${i}">Photo ${i + 1} — URL ou chemin</label>
        <input type="text" id="embedManualUrl${i}" class="embed-manual-url" data-index="${i}"
               placeholder="ex : images/photo${i + 1}.jpg" value="${escapeAttr(val)}" />
      </div>`)
    .join("");

  embedManualUrlFields.querySelectorAll(".embed-manual-url").forEach((input) => {
    input.addEventListener("input", (e) => {
      manualUrlValues[parseInt(e.target.dataset.index, 10)] = e.target.value;
      regenerateManualEmbedCode();
    });
  });
}

function regenerateManualEmbedCode() {
  const orientation = document.querySelector('input[name="embedManualOrientation"]:checked').value;
  embedCode.value = buildStandaloneEmbedHtml({
    urls: manualUrlValues,
    orientation,
    bgColor: embedManualBg.value,
  });
}

embedManualBtn.addEventListener("click", () => {
  embedManualFields.style.display = "block";
  embedGeneratedHint.textContent = "Le code se met à jour automatiquement au fur et à mesure que vous complétez les champs ci-dessus.";
  renderManualUrlInputs();
  regenerateManualEmbedCode();
  embedModal.style.display = "flex";
});

embedManualCount.addEventListener("change", () => {
  renderManualUrlInputs();
  regenerateManualEmbedCode();
});

document.querySelectorAll('input[name="embedManualOrientation"]').forEach((radio) => {
  radio.addEventListener("change", regenerateManualEmbedCode);
});

embedManualBg.addEventListener("input", regenerateManualEmbedCode);

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
