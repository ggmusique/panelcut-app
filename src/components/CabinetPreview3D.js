import { useEffect, useRef } from 'react';

const clampPositive = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js';
const ORBIT_CDN = 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/controls/OrbitControls.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Erreur chargement: ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-src', src);
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () => reject(new Error(`Erreur chargement: ${src}`));
    document.head.appendChild(script);
  });
}

export default function CabinetPreview3D({ model }) {
  const hostRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let animationFrame = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let controls = null;
    let rootGroup = null;
    const materials = [];
    const geometries = [];

    const init = async () => {
      try {
        await loadScript(THREE_CDN);
        await loadScript(ORBIT_CDN);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        return;
      }

      if (disposed || !hostRef.current || !window.THREE || !window.THREE.OrbitControls) return;

      const THREE = window.THREE;
      const host = hostRef.current;

      const width = clampPositive(model?.dimensions?.width, 200) / 100;
      const height = clampPositive(model?.dimensions?.height, 220) / 100;
      const depth = clampPositive(model?.dimensions?.depth, 60) / 100;
      const panelThickness = Math.min(clampPositive(model?.material?.panelThickness, 1.8) / 100, width / 4, depth / 4);
      const modules = Array.isArray(model?.structure?.modules) ? model.structure.modules : [];

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#0b0f14');
      scene.fog = new THREE.Fog('#0b0f14', 6, 14);

      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.innerHTML = '';
      host.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight('#ffffff', 0.55);
      scene.add(ambient);

      const keyLight = new THREE.DirectionalLight('#fff5e8', 1.05);
      keyLight.position.set(3.8, 4.5, 2.7);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 20;
      keyLight.shadow.camera.left = -5;
      keyLight.shadow.camera.right = 5;
      keyLight.shadow.camera.top = 5;
      keyLight.shadow.camera.bottom = -5;
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight('#cfe3ff', 0.35);
      fillLight.position.set(-2, 2, -3);
      scene.add(fillLight);

      const floorGeo = new THREE.PlaneGeometry(18, 18);
      const floorMat = new THREE.MeshStandardMaterial({ color: '#151a22', roughness: 0.95, metalness: 0.02 });
      materials.push(floorMat);
      geometries.push(floorGeo);
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      floor.receiveShadow = true;
      scene.add(floor);

      const cabinetMat = new THREE.MeshStandardMaterial({
        color: '#d8d2c6',
        roughness: 0.72,
        metalness: 0.03,
      });
      materials.push(cabinetMat);

      const accentMat = new THREE.MeshStandardMaterial({
        color: '#a8adb7',
        roughness: 0.65,
        metalness: 0.05,
      });
      materials.push(accentMat);

      const createPanel = (sizeX, sizeY, sizeZ, posX, posY, posZ, material = cabinetMat) => {
        const g = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
        geometries.push(g);
        const mesh = new THREE.Mesh(g, material);
        mesh.position.set(posX, posY, posZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        rootGroup.add(mesh);
      };

      rootGroup = new THREE.Group();
      scene.add(rootGroup);

      const yCenter = height / 2 + 0.02;
      createPanel(panelThickness, height, depth, -width / 2 + panelThickness / 2, yCenter, 0, accentMat);
      createPanel(panelThickness, height, depth, width / 2 - panelThickness / 2, yCenter, 0, accentMat);
      createPanel(width, panelThickness, depth, 0, yCenter + height / 2 - panelThickness / 2, 0);
      createPanel(width, panelThickness, depth, 0, yCenter - height / 2 + panelThickness / 2, 0);

      let cursor = -width / 2 + panelThickness;
      modules.slice(0, -1).forEach((moduleDef, index) => {
        const moduleWidth = typeof moduleDef === 'number' ? moduleDef : moduleDef?.width;
        cursor += clampPositive(moduleWidth, 0) / 100;
        if (cursor >= width / 2 - panelThickness) return;
        createPanel(panelThickness, height - panelThickness * 2, depth - panelThickness * 0.5, cursor + panelThickness / 2, yCenter, 0, index % 2 === 0 ? cabinetMat : accentMat);
        cursor += panelThickness;
      });

      const bbox = new THREE.Box3().setFromObject(rootGroup);
      const center = bbox.getCenter(new THREE.Vector3());
      rootGroup.position.sub(center);
      rootGroup.position.y += bbox.getSize(new THREE.Vector3()).y / 2 + 0.02;

      const size = bbox.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z, 0.6);
      const distance = maxSize * 2.1;

      camera.position.set(distance, distance * 0.85, distance);
      camera.lookAt(0, size.y * 0.25, 0);

      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = Math.max(0.8, maxSize * 0.8);
      controls.maxDistance = Math.max(5, maxSize * 4.5);
      controls.target.set(0, size.y * 0.25, 0);
      controls.update();

      const resize = () => {
        if (!host || !renderer || !camera) return;
        const w = Math.max(280, host.clientWidth || 560);
        const h = Math.max(260, Math.round(w * 0.62));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };

      resize();
      window.addEventListener('resize', resize);

      const tick = () => {
        if (disposed || !renderer || !scene || !camera) return;
        controls?.update();
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(tick);
      };
      tick();

      host.__cleanupThree = () => {
        window.removeEventListener('resize', resize);
      };
    };

    init();

    return () => {
      disposed = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (hostRef.current?.__cleanupThree) hostRef.current.__cleanupThree();
      controls?.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      if (scene) {
        scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.geometry?.dispose?.();
            if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat.dispose?.());
            else obj.material?.dispose?.();
          }
        });
      }
      renderer?.dispose();
      if (renderer?.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [model]);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
      <div ref={hostRef} className="w-full overflow-hidden rounded-lg bg-slate-900/80" style={{ minHeight: 300 }} />
    </div>
  );
}
