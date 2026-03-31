import { useEffect, useRef } from 'react';

// Three.js r128 — dernière version dont OrbitControls est dans examples/js/ ET s'attache à window.THREE
const THREE_CDN  = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
const ORBIT_CDN  = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-3d-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load',  () => resolve(),               { once: true });
      existing.addEventListener('error', () => reject(new Error(src)), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-3d-src', src);
    s.onload  = () => { s.dataset.loaded = 'true'; resolve(); };
    s.onerror = () => reject(new Error(`Impossible de charger: ${src}`));
    document.head.appendChild(s);
  });
}

function clamp(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function CabinetPreview3D({ model }) {
  const hostRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let raf = null;
    let renderer = null;
    const toDispose = { geo: [], mat: [] };

    async function init() {
      try {
        await loadScript(THREE_CDN);
        await loadScript(ORBIT_CDN);
      } catch (e) {
        console.error('[3D] Chargement scripts échoué:', e);
        return;
      }

      if (disposed) return;
      const THREE = window.THREE;
      if (!THREE || !THREE.OrbitControls) {
        console.error('[3D] THREE ou OrbitControls introuvable sur window');
        return;
      }

      const host = hostRef.current;
      if (!host) return;

      // --- Dimensions (tout en mètres pour Three.js) ---
      const W  = clamp(model?.dimensions?.width,  200) / 100;   // cm → m
      const H  = clamp(model?.dimensions?.height, 220) / 100;
      const D  = clamp(model?.dimensions?.depth,   60) / 100;
      const T  = Math.min(clamp(model?.material?.panelThickness, 1.8) / 100, W / 6, D / 4);
      const modules = Array.isArray(model?.structure?.modules) ? model.structure.modules : [];

      // --- Scène ---
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b0f14);
      scene.fog = new THREE.FogExp2(0x0b0f14, 0.18);

      // --- Caméra ---
      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);

      // --- Renderer ---
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.innerHTML = '';
      host.appendChild(renderer.domElement);

      // --- Lumières ---
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));

      const key = new THREE.DirectionalLight(0xfff5e8, 1.1);
      key.position.set(4, 5, 3);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xcfe3ff, 0.4);
      fill.position.set(-2, 2, -3);
      scene.add(fill);

      // --- Sol ---
      const floorGeo = new THREE.PlaneGeometry(20, 20);
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x151a22, roughness: 0.95 });
      toDispose.geo.push(floorGeo); toDispose.mat.push(floorMat);
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      // --- Matériaux meuble ---
      const matA = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.72, metalness: 0.03 });
      const matB = new THREE.MeshStandardMaterial({ color: 0xa8adb7, roughness: 0.65, metalness: 0.05 });
      toDispose.mat.push(matA, matB);

      const group = new THREE.Group();
      scene.add(group);

      function addPanel(sx, sy, sz, px, py, pz, mat = matA) {
        const g = new THREE.BoxGeometry(sx, sy, sz);
        toDispose.geo.push(g);
        const m = new THREE.Mesh(g, mat);
        m.position.set(px, py, pz);
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
      }

      const cy = H / 2 + 0.005;   // centre Y du meuble (posé sur le sol)

      // Joues gauche / droite
      addPanel(T, H, D, -W/2 + T/2, cy, 0, matB);
      addPanel(T, H, D,  W/2 - T/2, cy, 0, matB);
      // Tablette haut / bas
      addPanel(W, T, D, 0, cy + H/2 - T/2, 0);
      addPanel(W, T, D, 0, cy - H/2 + T/2, 0);
      // Fond (panneau arrière fin)
      addPanel(W - T*2, H - T*2, T * 0.5, 0, cy, -D/2 + T*0.25);

      // Séparations verticales (modules)
      let cursor = -W/2 + T;
      modules.slice(0, -1).forEach((mod, idx) => {
        const mw = clamp(typeof mod === 'number' ? mod : mod?.width, 0) / 100;
        cursor += mw;
        if (cursor >= W/2 - T) return;
        addPanel(T, H - T*2, D - T*0.5, cursor + T/2, cy, 0, idx % 2 === 0 ? matA : matB);
        cursor += T;
      });

      // --- Centrer le groupe ---
      const bbox = new THREE.Box3().setFromObject(group);
      const center = bbox.getCenter(new THREE.Vector3());
      group.position.sub(center);
      group.position.y += bbox.getSize(new THREE.Vector3()).y / 2 + 0.005;

      // --- Caméra + contrôles ---
      const size = bbox.getSize(new THREE.Vector3());
      const dist = Math.max(size.x, size.y, size.z) * 2.2;
      camera.position.set(dist, dist * 0.8, dist);
      camera.lookAt(0, size.y * 0.25, 0);

      const controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minDistance = Math.max(0.5, dist * 0.4);
      controls.maxDistance = dist * 5;
      controls.target.set(0, size.y * 0.25, 0);
      controls.update();

      // --- Redimensionnement ---
      function resize() {
        if (!host || !renderer) return;
        const w = Math.max(280, host.clientWidth || 560);
        const h = Math.max(260, Math.round(w * 0.62));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
      window.addEventListener('resize', resize);

      // --- Boucle de rendu ---
      function tick() {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      }
      tick();

      // Nettoyage resize stocké
      host.__threeCleanup = () => window.removeEventListener('resize', resize);
    }

    init();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (hostRef.current?.__threeCleanup) hostRef.current.__threeCleanup();
      toDispose.geo.forEach(g => g.dispose());
      toDispose.mat.forEach(m => m.dispose());
      renderer?.dispose();
      if (renderer?.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [model]);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 p-2">
      <div
        ref={hostRef}
        className="w-full overflow-hidden rounded-lg"
        style={{ minHeight: 320, background: '#0b0f14' }}
      />
    </div>
  );
}
