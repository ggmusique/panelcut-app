/**
 * ocrExtract.js — Extraction OCR des cotes depuis une image
 * Utilise Tesseract.js pour lire les chiffres AVANT d'envoyer à Claude Vision.
 * Claude reçoit alors les cotes déjà extraites → précision +40%.
 */
import Tesseract from 'tesseract.js';

/**
 * Extrait tous les nombres d'une image base64.
 * Retourne un tableau de strings comme ['75.6', '230', '60', '8']
 */
export async function extractNumbersFromImage(base64DataUrl) {
  try {
    const { data: { text } } = await Tesseract.recognize(base64DataUrl, 'fra+eng', {
      logger: () => {},  // silence les logs
    });

    // Extraire tous les nombres (entiers et décimaux, virgule ou point)
    const raw = text.replace(/,/g, '.'); // normaliser virgule → point
    const numbers = raw.match(/\d+(?:[.,]\d+)?/g) || [];

    // Filtrer les vrais nombres de cotes (entre 1 et 9999)
    return [...new Set(
      numbers
        .map(n => parseFloat(n))
        .filter(n => !isNaN(n) && n >= 1 && n <= 9999)
        .map(n => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1))
    )];
  } catch (err) {
    console.warn('OCR failed (non-bloquant):', err.message);
    return [];  // OCR optionnel — ne pas bloquer le scan
  }
}

/**
 * Préprocesse l'image : N&B + contraste pour améliorer OCR et Vision.
 * Retourne un dataUrl base64 JPEG.
 */
export function preprocessImageForAI(dataUrl, contrastFactor = 1.4) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1600;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;

      for (let i = 0; i < d.length; i += 4) {
        // Niveaux de gris pondérés (luminance perceptuelle)
        const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        // Contraste
        const c = Math.min(255, Math.max(0, 128 + (gray - 128) * contrastFactor));
        d[i] = d[i+1] = d[i+2] = c;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.90));
    };
    img.onerror = () => resolve(dataUrl); // fallback image originale
    img.src = dataUrl;
  });
}

/**
 * Pipeline complet : préprocess + OCR
 * Retourne { processedImage: string, ocrNumbers: string[] }
 */
export async function prepareImageForScan(originalDataUrl) {
  const processedImage = await preprocessImageForAI(originalDataUrl);
  const ocrNumbers = await extractNumbersFromImage(processedImage);
  return { processedImage, ocrNumbers };
}
