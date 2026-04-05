export const exportSvgToImage = (svgElement, scale = 3) => {
  return new Promise((resolve, reject) => {
    if (!svgElement) {
      console.error('SVG element is null');
      reject(new Error('SVG element not found'));
      return;
    }

    try {
      // Clone le SVG pour éviter de modifier l'original
      const svgClone = svgElement.cloneNode(true);
      
      // Force les dimensions
      const bbox = svgElement.getBBox();
      svgClone.setAttribute('width', bbox.width);
      svgClone.setAttribute('height', bbox.height);
      
      // Sérialise
      const svgData = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = bbox.width * scale;
        canvas.height = bbox.height * scale;
        
        const ctx = canvas.getContext('2d');
        
        // Fond blanc
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dessine l'image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Export
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        
        URL.revokeObjectURL(svgUrl);
        console.log('✅ SVG exporté avec succès:', dataUrl.length, 'caractères');
        resolve(dataUrl);
      };
      
      img.onerror = (err) => {
        console.error('❌ Erreur chargement image SVG:', err);
        URL.revokeObjectURL(svgUrl);
        reject(err);
      };
      
      img.src = svgUrl;
      
    } catch (err) {
      console.error('❌ Erreur export SVG:', err);
      reject(err);
    }
  });
};