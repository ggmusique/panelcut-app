/**
 * Capture le SVG de la façade en image PNG.
 * html2canvas ne sait PAS rendre les SVG → on sérialise le SVG
 * directement en data URL base64, puis on le dessine sur un canvas.
 */
export const captureFacadeToImage = async (elementRef, scale = 2) => {
  if (!elementRef?.current) {
    console.log('❌ [CAPTURE] Element non trouvé');
    return null;
  }

  const svgEl = elementRef.current.querySelector('svg');
  if (!svgEl) {
    console.error('❌ [CAPTURE] Aucun <svg> trouvé dans le conteneur');
    return null;
  }

  try {
    console.log('📸 [CAPTURE] Sérialisation SVG...');

    // 1. Cloner le SVG pour ne pas modifier l'original
    const clone = svgEl.cloneNode(true);

    // 2. Garantir le namespace xmlns (obligatoire pour le rendu en <img>)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // 3. Lire les dimensions depuis le viewBox
    const vb = svgEl.viewBox?.baseVal;
    const w = vb && vb.width  > 0 ? vb.width  : svgEl.getBoundingClientRect().width  || 960;
    const h = vb && vb.height > 0 ? vb.height : svgEl.getBoundingClientRect().height || 600;
    clone.setAttribute('width',  w);
    clone.setAttribute('height', h);

    // 4. Ajouter un fond blanc (le CSS bg-white n'est pas embarqué dans le SVG)
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width',  '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill',   '#ffffff');
    clone.insertBefore(bgRect, clone.firstChild);

    // 5. Sérialiser → base64 data URL (évite les problèmes CORS des blob URL)
    const svgData = new XMLSerializer().serializeToString(clone);
    const base64  = btoa(unescape(encodeURIComponent(svgData)));
    const dataUrl = 'data:image/svg+xml;base64,' + base64;

    // 6. Charger dans un <img> puis dessiner sur un Canvas
    const imageUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas  = document.createElement('canvas');
        canvas.width  = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const png = canvas.toDataURL('image/png', 1.0);
        console.log('✅ [CAPTURE] PNG généré, taille:', png.length);
        resolve(png);
      };
      img.onerror = (err) => {
        console.error('❌ [CAPTURE] Erreur chargement image SVG:', err);
        reject(err);
      };
      img.src = dataUrl;
    });

    return imageUrl;
  } catch (err) {
    console.error('❌ [CAPTURE] Erreur:', err);
    return null;
  }
};