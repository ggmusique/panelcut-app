import { useEffect, useRef } from 'react';

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
const ORBIT_CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-3d-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load',  () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(src)), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-3d-src', src);
    s.onload  = () => { s.dataset.loaded = 'true'; resolve(); };
    s.onerror = () => reject(new Error(`Cannot load: ${src}`));
    document.head.appendChild(s);
  });
}

const safe = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : fallback; };

export default function CabinetPreview3D({ model }) {
  const hostRef = useRef(null);

  useEffect(() => {
    let disposed = false, raf = null, renderer = null;
    const toDispose = { geo: [], mat: [] };

    async function init() {
      try {
        await loadScript(THREE_CDN);
        await loadScript(ORBIT_CDN);
      } catch (e) { console.error('[3D]', e); return; }

      if (disposed) return;
      const THREE = window.THREE;
      if (!THREE?.OrbitControls) { console.error('[3D] OrbitControls manquant'); return; }
      const host = hostRef.current;
      if (!host) return;

      // ── Dimensions (mètres) ──────────────────────────────────────────────
      const W  = safe(model?.dimensions?.width,  200) / 100;
      const H  = safe(model?.dimensions?.height, 220) / 100;
      const D  = safe(model?.dimensions?.depth,   60) / 100;
      const T  = Math.min(safe(model?.material?.panelThickness, 1.8) / 100, W / 8, D / 5);
      const BT = safe(model?.material?.backThickness, 0.3) / 100;
      const PL = safe(model?.dimensions?.plinth, 0) / 100;  // socle

      const struct  = model?.structure || {};
      const bodies  = Array.isArray(struct.bodies) && struct.bodies.length > 0
        ? struct.bodies
        : [{ width: (W * 100) - T * 200, shelves: struct.nbShelves ?? 2, drawers: struct.nbDrawers ?? 0, rod: struct.hasRod ?? false }];

      // ── Scène ────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b0f14);
      scene.fog = new THREE.FogExp2(0x0b0f14, 0.14);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.innerHTML = '';
      host.appendChild(renderer.domElement);

      // ── Lumières ─────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xfff5e8, 1.2);
      key.position.set(5, 7, 4); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024); scene.add(key);
      const fill = new THREE.DirectionalLight(0xcfe3ff, 0.35);
      fill.position.set(-3, 3, -4); scene.add(fill);
      const back = new THREE.DirectionalLight(0xffffff, 0.15);
      back.position.set(0, 2, -5); scene.add(back);

      // ── Sol ──────────────────────────────────────────────────────────────
      const flG = new THREE.PlaneGeometry(30, 30); toDispose.geo.push(flG);
      const flM = new THREE.MeshStandardMaterial({ color: 0x141920, roughness: 0.96 }); toDispose.mat.push(flM);
      const fl = new THREE.Mesh(flG, flM); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true;
      scene.add(fl);

      // ── Matériaux ────────────────────────────────────────────────────────
      const mkMat = (color, roughness = 0.68, metalness = 0.04, opacity = 1) => {
        const m = new THREE.MeshStandardMaterial({
          color, roughness, metalness,
          transparent: opacity < 1, opacity,
        });
        toDispose.mat.push(m);
        return m;
      };

      const MAT = {
        side:    mkMat(0xd8d2c6, 0.72, 0.03),      // joues extérieures — beige clair
        div:     mkMat(0xbbc2c9, 0.65, 0.05),      // séparateurs — gris bleu
        shelf:   mkMat(0xcfd4cb, 0.70, 0.03),      // tablettes — gris vert
        back:    mkMat(0x8a8f96, 0.80, 0.02),      // fond arrière — gris foncé
        plinth:  mkMat(0x60666d, 0.85, 0.02),      // socle
        drawer:  mkMat(0x4a9eff, 0.30, 0.40, 0.82),// tiroir — bleu translucide
        handle:  mkMat(0xdddddd, 0.20, 0.80),      // poignée — chrome
        rod:     mkMat(0xc0c8d0, 0.25, 0.70),      // tringle — métal
        top:     mkMat(0xe8e4dc, 0.65, 0.04),      // tablette haut/bas
      };

      // ── Helper box ───────────────────────────────────────────────────────
      const group = new THREE.Group();
      scene.add(group);

      function box(sx, sy, sz, px, py, pz, mat) {
        const g = new THREE.BoxGeometry(sx, sy, sz); toDispose.geo.push(g);
        const m = new THREE.Mesh(g, mat); m.position.set(px, py, pz);
        m.castShadow = true; m.receiveShadow = true;
        group.add(m);
        return m;
      }

      // ── Caisse extérieure ────────────────────────────────────────────────
      const floorY = PL;                    // Y du bas du caisson
      const cy     = floorY + H / 2;        // centre Y du caisson

      // Socle
      if (PL > 0.01) box(W, PL, D * 0.85, 0, PL / 2, 0, MAT.plinth);

      // Joues gauche / droite
      box(T, H, D, -W / 2 + T / 2, cy, 0, MAT.side);
      box(T, H, D,  W / 2 - T / 2, cy, 0, MAT.side);

      // Tablette haut et bas
      box(W - T * 2, T, D, 0, floorY + T / 2,     0, MAT.top);
      box(W - T * 2, T, D, 0, floorY + H - T / 2, 0, MAT.top);

      // Fond arrière
      box(W - T * 2, H - T * 2, BT, 0, cy, -D / 2 + BT / 2, MAT.back);

      // ── Corps intérieurs ─────────────────────────────────────────────────
      const nbBodies   = bodies.length;
      const innerW     = W - T * 2;       // largeur intérieure totale
      const innerH     = H - T * 2;       // hauteur intérieure totale
      const innerD     = D - BT;          // profondeur intérieure
      const bodyX0     = -W / 2 + T;      // X bord gauche intérieur

      // Largeur de chaque corps (distribué équitablement si pas définie précisément)
      const bodyWidths = bodies.map(b => {
        const bw = safe(b?.width, 0) / 100;
        return bw > 0.01 ? bw : innerW / nbBodies;
      });
      // Renormaliser si total ≠ innerW
      const totalBW = bodyWidths.reduce((a, c) => a + c, 0);
      const scale   = totalBW > 0.001 ? innerW / totalBW : 1;
      const scaledW = bodyWidths.map(w => w * scale);

      let cursorX = bodyX0;

      scaledW.forEach((bw, idx) => {
        const body  = bodies[idx];
        const bCx   = cursorX + bw / 2;   // centre X du corps
        const bFloor = floorY + T;         // bas intérieur du corps
        const bTop   = floorY + H - T;     // haut intérieur du corps
        const bH     = bTop - bFloor;      // hauteur intérieure du corps
        const bCy    = bFloor + bH / 2;    // centre Y intérieur

        const nbShelves = Math.max(0, parseInt(body?.shelves ?? 2, 10));
        const nbDrawers = Math.max(0, parseInt(body?.drawers ?? 0, 10));
        const hasRod    = Boolean(body?.rod ?? false);

        // Séparateur vertical (sauf premier corps)
        if (idx > 0) {
          box(T, innerH, innerD, cursorX - T / 2, bCy, -BT / 2, MAT.div);
        }

        const drawerH    = bH * 0.18;           // hauteur d'un tiroir
        const drawerZone = nbDrawers > 0 ? nbDrawers * drawerH + T : 0;
        const shelfZone  = bH - drawerZone;
        const shelfStep  = nbShelves > 0 ? shelfZone / (nbShelves + 1) : 0;

        // ── Tablettes ────────────────────────────────────────────────────
        for (let s = 1; s <= nbShelves; s++) {
          const sy2 = bFloor + drawerZone + shelfStep * s;
          box(bw - T * 0.1, T, innerD, bCx, sy2, -BT / 2, MAT.shelf);
        }

        // ── Tiroirs ───────────────────────────────────────────────────────
        for (let dr = 0; dr < nbDrawers; dr++) {
          const drY = bFloor + drawerH * dr + drawerH / 2;
          // Façade tiroir (légèrement en avant de la façade)
          box(bw - T * 0.15, drawerH * 0.88, T * 0.6, bCx, drY, D / 2, MAT.drawer);
          // Poignée
          box(bw * 0.25, T * 0.4, T * 0.5, bCx, drY, D / 2 + T * 0.55, MAT.handle);
        }

        // ── Tringle penderie ──────────────────────────────────────────────
        if (hasRod) {
          const rodY   = bFloor + drawerZone + shelfZone * 0.80;
          const rodR   = T * 0.18;
          // Barre
          const rodGeo = new THREE.CylinderGeometry(rodR, rodR, bw - T * 0.3, 12);
          toDispose.geo.push(rodGeo);
          const rodMesh = new THREE.Mesh(rodGeo, MAT.rod);
          rodMesh.rotation.z = Math.PI / 2;
          rodMesh.position.set(bCx, rodY, -D * 0.15);
          rodMesh.castShadow = true;
          group.add(rodMesh);
          // Supports gauche / droite
          const supW = T * 0.25;
          box(supW, bH * 0.06, supW, bCx - bw / 2 + T * 0.2, rodY, -D * 0.15, MAT.rod);
          box(supW, bH * 0.06, supW, bCx + bw / 2 - T * 0.2, rodY, -D * 0.15, MAT.rod);
        }

        cursorX += bw;
      });

      // ── Axes de dimension ────────────────────────────────────────────────
      const mkLine = (pts, color) => {
        const g = new THREE.BufferGeometry().setFromPoints(pts); toDispose.geo.push(g);
        const m = new THREE.LineBasicMaterial({ color }); toDispose.mat.push(m);
        scene.add(new THREE.Line(g, m));
      };
      mkLine([new THREE.Vector3(W / 2, 0, 0), new THREE.Vector3(W / 2 + 0.3, 0, 0)], 0xff6600);
      mkLine([new THREE.Vector3(W / 2 + 0.3, 0, 0), new THREE.Vector3(W / 2 + 0.3, 0, -W)], 0xff6600);
      mkLine([new THREE.Vector3(W / 2, H + PL, 0), new THREE.Vector3(W / 2 + 0.15, H + PL + 0.15, 0)], 0x44ff88);
      mkLine([new THREE.Vector3(W / 2 + 0.15, PL, 0), new THREE.Vector3(W / 2 + 0.15, H + PL, 0)], 0x44ff88);

      // ── Labels ───────────────────────────────────────────────────────────
      function addLabel(text, position, color = '#ffffff') {
        const canvas  = document.createElement('canvas');
        canvas.width  = 256; canvas.height = 64;
        const ctx2 = canvas.getContext('2d');
        ctx2.fillStyle    = 'transparent';
        ctx2.clearRect(0, 0, 256, 64);
        ctx2.font         = 'bold 28px monospace';
        ctx2.fillStyle    = color;
        ctx2.textAlign    = 'center';
        ctx2.fillText(text, 128, 44);
        const tex = new THREE.CanvasTexture(canvas);
        const spriteM = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite  = new THREE.Sprite(spriteM);
        sprite.scale.set(0.6, 0.15, 1);
        sprite.position.copy(position);
        scene.add(sprite);
      }
      addLabel(`${Math.round(model?.dimensions?.width  || W * 100)} cm`, new THREE.Vector3(W / 2 + 0.45, 0.05, -W / 2), '#ff8844');
      addLabel(`${Math.round(model?.dimensions?.height || H * 100)} cm`, new THREE.Vector3(W / 2 + 0.45, H / 2 + PL, 0), '#44ff88');
      addLabel(`${nbBodies}× corps`, new THREE.Vector3(0, H + PL + 0.25, D / 2), '#88ccff');

      // ── Centrer & caméra ─────────────────────────────────────────────────
      const bbox = new THREE.Box3().setFromObject(group);
      const center = bbox.getCenter(new THREE.Vector3());
      group.position.sub(center);
      group.position.y += bbox.getSize(new THREE.Vector3()).y / 2 + 0.005;

      const sz   = bbox.getSize(new THREE.Vector3());
      const dist = Math.max(sz.x, sz.y, sz.z) * 2.4;
      camera.position.set(dist * 0.85, dist * 0.75, dist);
      camera.lookAt(0, sz.y * 0.3, 0);

      const controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.07;
      controls.minDistance   = Math.max(0.5, dist * 0.35);
      controls.maxDistance   = dist * 6;
      controls.target.set(0, sz.y * 0.3, 0);
      controls.update();

      // ── Resize ───────────────────────────────────────────────────────────
      function resize() {
        if (!host || !renderer) return;
        const w = Math.max(280, host.clientWidth || 560);
        const h = Math.max(260, Math.round(w * 0.62));
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      resize();
      window.addEventListener('resize', resize);
      host.__threeCleanup = () => window.removeEventListener('resize', resize);

      // ── Boucle ───────────────────────────────────────────────────────────
      function tick() {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      }
      tick();
    }

    init();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (hostRef.current?.__threeCleanup) hostRef.current.__threeCleanup();
      toDispose.geo.forEach(g => g.dispose());
      toDispose.mat.forEach(m => m.dispose());
      renderer?.dispose();
      if (renderer?.domElement?.parentNode)
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [model]);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 p-2">
      <div
        ref={hostRef}
        className="w-full overflow-hidden rounded-lg"
        style={{ minHeight: 340, background: '#0b0f14' }}
      />
    </div>
  );
}
