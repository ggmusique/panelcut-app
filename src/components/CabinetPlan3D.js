/**
 * CabinetPlan3D.js — Vue 3D interactive Three.js
 *
 * FIXES ZOOM (plan qui disparaît) :
 *  1. near plane = radius * 0.01 (dynamique) → recalculé à chaque frame, évite le clipping
 *  2. wheel delta normalisé → même comportement souris et trackpad
 *  3. renderer.setSize sans le flag false (par défaut true) → canvas CSS toujours sync
 *  4. minR = maxDim * 0.4 (était 0.25) → empêche la caméra d'entrer dans la géométrie
 *  5. ResizeObserver corrige la taille après display:none → visible
 */
import { useRef, useEffect, useState, useCallback } from 'react';

const ROLE_MAT = {
  side:         { color: 0x1e3a5f, emissive: 0x0a1628, opacity: 1    },
  top:          { color: 0x1e3a5f, emissive: 0x0a1628, opacity: 1    },
  bottom:       { color: 0x1e3a5f, emissive: 0x0a1628, opacity: 1    },
  shelf:        { color: 0x0f3050, emissive: 0x061828, opacity: 1    },
  divider:      { color: 0x0f3050, emissive: 0x061828, opacity: 1    },
  back:         { color: 0x060e1c, emissive: 0x030810, opacity: 0.7  },
  door:         { color: 0xf97316, emissive: 0x7c2d12, opacity: 0.22 },
  drawer_front: { color: 0xa855f7, emissive: 0x581c87, opacity: 0.26 },
  default:      { color: 0x1a2f4a, emissive: 0x0a1828, opacity: 1    },
};
const EDGE_COLOR = {
  side: 0x475569, top: 0x7dd3fc, bottom: 0x7dd3fc,
  shelf: 0x38bdf8, divider: 0x93c5fd, back: 0x1e3a5f,
  door: 0xf97316, drawer_front: 0xa855f7, default: 0x64748b,
};
const matFor  = r => ROLE_MAT[r]  || ROLE_MAT.default;
const edgeFor = r => EDGE_COLOR[r] || EDGE_COLOR.default;

let threeP = null;
function loadThree() {
  if (threeP) return threeP;
  threeP = new Promise((resolve, reject) => {
    if (window.THREE) { resolve(window.THREE); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload  = () => resolve(window.THREE);
    s.onerror = () => reject(new Error('Three.js CDN indisponible'));
    document.head.appendChild(s);
  });
  return threeP;
}

export default function CabinetPlan3D({ cabinet, name = 'Meuble' }) {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const rendRef   = useRef(null);
  const sceneRef  = useRef(null);
  const camRef    = useRef(null);
  const frameRef  = useRef(null);
  const builtRef  = useRef(false);
  const maxDimRef = useRef(1);
  const zoomBoundsRef = useRef({ minR: 0.4, maxR: 10 });
  const orbitRef  = useRef({
    theta: 0.6, phi: 1.1, radius: 2.2,
    dragging: false, lastX: 0, lastY: 0, target: null,
  });
  const [status, setStatus] = useState('loading');
  const [errMsg, setErrMsg] = useState('');

  const buildScene = useCallback((THREE) => {
    if (builtRef.current) return;
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;

    const W_PX = wrap.offsetWidth  || 400;
    const H_PX = wrap.offsetHeight || 300;
    builtRef.current = true;

    const cab = {
      width:     cabinet.width,
      height:    cabinet.height,
      depth:     cabinet.depth     || 60,
      thickness: cabinet.thickness || 1.8,
      panels:    cabinet.panels    || [],
    };
    const m = v => v / 100;  // cm → m
    const W = m(cab.width), H = m(cab.height), D = m(cab.depth), T = m(cab.thickness);
    const maxDim = Math.max(W, H, D);
    maxDimRef.current = maxDim;

    // ─ Renderer ──────────────────────────────────────────────────────
    // NE PAS passer false en 3e arg de setSize → sinon le canvas CSS reste à 0px
    // après un display:none → visible (bug disparition au zoom)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W_PX, H_PX);  // ← pas de false ici
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendRef.current = renderer;

    // ─ Scène ───────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04090f);
    sceneRef.current = scene;

    // ─ Caméra — near plane DYNAMIQUE recalculé à chaque frame ─────────
    // On met un near très petit ici ; il sera mis à jour dans la boucle render
    // en fonction du radius courant pour ne jamais clipper.
    const far    = maxDim * 80;
    const near   = maxDim * 0.005;  // valeur initiale conservative
    const camera = new THREE.PerspectiveCamera(45, W_PX / H_PX, near, far);
    camRef.current = camera;

    // Orbit initial
    const initR = maxDim * 2.8;
    // FIX: minR = 0.4 * maxDim (était 0.25) pour que la caméra ne pénètre jamais dans le meuble
    const minR  = maxDim * 0.40;
    const maxR  = maxDim * 10;
    orbitRef.current.radius = initR;
    orbitRef.current.target = new THREE.Vector3(0, H / 2, 0);
    zoomBoundsRef.current   = { minR, maxR };

    // ─ Grille + lumières ────────────────────────────────────────────────
    const grid = new THREE.GridHelper(maxDim * 4, 40, 0x0f2040, 0x0a1830);
    grid.position.y = -0.001;
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0x8ab4d4, 0.45));
    const dir = new THREE.DirectionalLight(0xffffff, 1.3);
    dir.position.set(maxDim * 3, maxDim * 5, maxDim * 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = near;
    dir.shadow.camera.far  = far;
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x3b82f6, 0.35);
    fill.position.set(-maxDim * 4, maxDim * 2, -maxDim * 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xf97316, 0.2);
    rim.position.set(0, -maxDim * 3, -maxDim * 4);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(maxDim * 10, maxDim * 10),
      new THREE.MeshPhongMaterial({ color: 0x050a14, transparent: true, opacity: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ─ Panneaux ──────────────────────────────────────────────────────────
    const addPanel = (bw, bh, bd, bx, by, bz, role) => {
      const mat  = matFor(role);
      const geo  = new THREE.BoxGeometry(
        Math.max(bw, 0.001), Math.max(bh, 0.001), Math.max(bd, 0.001)
      );
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color: mat.color, emissive: mat.emissive,
        specular: 0x224466, shininess: 40,
        transparent: mat.opacity < 1, opacity: mat.opacity,
        depthWrite: mat.opacity >= 0.9,
        side: mat.opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
      }));
      mesh.position.set(bx - W / 2, by, bz - D / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: edgeFor(role) })
      );
      edges.position.copy(mesh.position);
      scene.add(edges);
    };

    if (cab.panels.length > 0) {
      for (const p of cab.panels) {
        const role = p.role || 'default';
        const px = m(p.x ?? 0), py = m(p.y ?? 0);
        const pw = m(p.w ?? cab.width), ph = m(p.h ?? cab.height);
        if (['side', 'divider'].includes(role))
          addPanel(T, ph, D, px + T / 2, py + ph / 2, D / 2, role);
        else if (['top', 'bottom', 'shelf'].includes(role))
          addPanel(pw, T, D, px + pw / 2, py + T / 2, D / 2, role);
        else if (role === 'back')
          addPanel(pw, ph, T, px + pw / 2, py + ph / 2, D - T / 2, role);
        else if (['door', 'drawer_front'].includes(role))
          addPanel(pw, ph, T, px + pw / 2, py + ph / 2, T / 2, role);
        else
          addPanel(pw, ph, T, px + pw / 2, py + ph / 2, D / 2, role);
      }
    } else {
      const geo   = new THREE.BoxGeometry(W, H, D);
      const solid = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color: 0x1e3a5f, emissive: 0x0a1628, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
      }));
      solid.position.set(0, H / 2, 0);
      scene.add(solid);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x60a5fa })
      );
      edges.position.set(0, H / 2, 0);
      scene.add(edges);
    }

    setStatus('ok');
  }, [cabinet]);

  // ─ Boucle de rendu — near plane dynamique ──────────────────────────
  // FIX CLIPPING : on recalcule near = radius * 0.01 à chaque frame.
  // Ainsi quand l'utilisateur zoome (radius diminue), near diminue aussi
  // → la caméra ne clippe jamais la géométrie quelle que soit la distance.
  const loop = useCallback(() => {
    frameRef.current = requestAnimationFrame(loop);
    const ren = rendRef.current;
    const sc  = sceneRef.current;
    const cam = camRef.current;
    if (!ren || !sc || !cam) return;

    const o = orbitRef.current;
    const t = o.target || { x: 0, y: 0, z: 0 };
    const r = o.radius;

    // Near plan dynamique : toujours proportionnel à la distance caméra
    const newNear = r * 0.01;
    if (Math.abs(cam.near - newNear) > newNear * 0.1) {
      cam.near = newNear;
      cam.updateProjectionMatrix();
    }

    cam.position.set(
      t.x + r * Math.sin(o.phi) * Math.sin(o.theta),
      t.y + r * Math.cos(o.phi),
      t.z + r * Math.sin(o.phi) * Math.cos(o.theta)
    );
    cam.lookAt(t.x, t.y, t.z);
    ren.render(sc, cam);
  }, []);

  // ─ Init + ResizeObserver (corrige display:none → visible) ───────────
  useEffect(() => {
    if (!cabinet?.width || !cabinet?.height) { setStatus('nodims'); return; }
    let alive = true;
    let ro = null;

    const tryInit = (THREE) => {
      if (!alive || builtRef.current) return;
      const wrap = wrapRef.current;
      if (!wrap || wrap.offsetWidth === 0) return;
      buildScene(THREE);
      if (alive) loop();
    };

    // ResizeObserver permanent : corrige la taille quand le parent passe
    // de display:none → visible (offsetWidth revient à > 0)
    const setupRO = (THREE) => {
      if (!wrapRef.current) return;
      ro = new ResizeObserver(() => {
        // Cas 1 : scène pas encore construite
        if (!builtRef.current) { tryInit(THREE); return; }
        // Cas 2 : scène construite mais canvas à resize (retour de display:none)
        const wrap = wrapRef.current;
        if (!wrap || !rendRef.current || !camRef.current) return;
        const w = wrap.offsetWidth, h = wrap.offsetHeight;
        if (!w || !h) return;
        camRef.current.aspect = w / h;
        camRef.current.updateProjectionMatrix();
        rendRef.current.setSize(w, h);  // ← pas de false
      });
      ro.observe(wrapRef.current);
    };

    loadThree()
      .then(THREE => {
        if (!alive) return;
        tryInit(THREE);   // tente immédiatement
        setupRO(THREE);   // observe en permanence pour les resize + display:none → visible
      })
      .catch(e => { if (alive) { setStatus('error'); setErrMsg(e.message); } });

    return () => {
      alive = false;
      if (ro) ro.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendRef.current) { rendRef.current.dispose(); rendRef.current = null; }
      builtRef.current = false;
    };
  }, [cabinet, buildScene, loop]);

  // ─ Resize fenêtre ────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => {
      const wrap = wrapRef.current;
      if (!wrap || !rendRef.current || !camRef.current) return;
      const w = wrap.offsetWidth, h = wrap.offsetHeight;
      if (!w || !h) return;
      camRef.current.aspect = w / h;
      camRef.current.updateProjectionMatrix();
      rendRef.current.setSize(w, h);
    };
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // ─ Contrôles souris + touch ──────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const o = orbitRef.current;
    let lastDist = null;

    const clampR = r => {
      const { minR, maxR } = zoomBoundsRef.current;
      return Math.max(minR, Math.min(maxR, r));
    };

    const down  = e => { o.dragging = true;  o.lastX = e.clientX; o.lastY = e.clientY; };
    const up    = ()  => { o.dragging = false; };
    const move  = e => {
      if (!o.dragging) return;
      o.theta -= (e.clientX - o.lastX) * 0.008;
      o.phi    = Math.max(0.08, Math.min(Math.PI - 0.08, o.phi + (e.clientY - o.lastY) * 0.008));
      o.lastX  = e.clientX; o.lastY = e.clientY;
    };

    // FIX WHEEL : normalisation du delta pour souris et trackpad
    // deltaMode 0 = pixels (trackpad), 1 = lignes (souris), 2 = pages
    // On ramène tout en un delta "lignes" puis on applique 3% du radius par ligne.
    const wheel = e => {
      e.preventDefault();
      let lines;
      if (e.deltaMode === 1) lines = e.deltaY;            // souris : déjà en lignes
      else if (e.deltaMode === 2) lines = e.deltaY * 10;  // pages
      else lines = e.deltaY / 16;                         // pixels trackpad → ~lignes
      // 3% du radius courant par ligne → zoom naturel et linéaire
      o.radius = clampR(o.radius * (1 + lines * 0.03));
    };

    const tstart = e => {
      if (e.touches.length === 1) {
        o.dragging = true; o.lastX = e.touches[0].clientX; o.lastY = e.touches[0].clientY;
      }
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastDist = Math.hypot(dx, dy);
      }
    };
    const tend  = () => { o.dragging = false; lastDist = null; };
    const tmove = e => {
      e.preventDefault();
      if (e.touches.length === 1 && o.dragging) {
        o.theta -= (e.touches[0].clientX - o.lastX) * 0.01;
        o.phi    = Math.max(0.08, Math.min(Math.PI - 0.08, o.phi + (e.touches[0].clientY - o.lastY) * 0.01));
        o.lastX  = e.touches[0].clientX; o.lastY = e.touches[0].clientY;
      }
      if (e.touches.length === 2 && lastDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d  = Math.hypot(dx, dy);
        o.radius = clampR(o.radius * (lastDist / d));
        lastDist = d;
      }
    };

    el.addEventListener('mousedown',  down);
    el.addEventListener('mouseup',    up);
    el.addEventListener('mouseleave', up);
    el.addEventListener('mousemove',  move);
    el.addEventListener('wheel',      wheel, { passive: false });
    el.addEventListener('touchstart', tstart, { passive: false });
    el.addEventListener('touchend',   tend);
    el.addEventListener('touchmove',  tmove, { passive: false });
    return () => {
      el.removeEventListener('mousedown',  down);
      el.removeEventListener('mouseup',    up);
      el.removeEventListener('mouseleave', up);
      el.removeEventListener('mousemove',  move);
      el.removeEventListener('wheel',      wheel);
      el.removeEventListener('touchstart', tstart);
      el.removeEventListener('touchend',   tend);
      el.removeEventListener('touchmove',  tmove);
    };
  }, []);

  const snap = (theta, phi) => { orbitRef.current.theta = theta; orbitRef.current.phi = phi; };

  if (!cabinet?.width || !cabinet?.height) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="text-4xl">📦</div>
        <p className="text-white font-bold">Vue 3D non disponible</p>
        <p className="text-sm text-slate-400 max-w-xs">Dimensions manquantes — relancez un scan IA.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#04090f]"
        style={{ width: '100%', height: '360px' }}
        ref={wrapRef}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block',
                   cursor: status === 'ok' ? 'grab' : 'default' }}
        />

        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#04090f]">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Chargement Three.js…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#04090f]">
            <p className="text-red-400 font-bold">⚠️ Erreur 3D</p>
            <p className="text-slate-500 text-xs max-w-xs text-center">{errMsg}</p>
          </div>
        )}
        {status === 'ok' && (
          <>
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 pointer-events-none">
              <span className="text-[10px] font-bold text-orange-400 tracking-widest">VUE 3D • {(name || 'MEUBLE').toUpperCase()}</span>
            </div>
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 pointer-events-none">
              <span className="text-[10px] font-mono text-slate-300">
                {cabinet.width}×{cabinet.height}×{cabinet.depth || 60} cm
              </span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {[
          { label: '🔄 Face',    t: Math.PI,     p: Math.PI / 2 },
          { label: '↗ Iso',     t: 0.6,         p: 1.1 },
          { label: '⬆ Dessus',  t: 0.6,         p: 0.05 },
          { label: '➡ Côté',    t: Math.PI / 2, p: Math.PI / 2 },
          { label: '↙ Arrière', t: 0,           p: 1.1 },
        ].map(v => (
          <button key={v.label} onClick={() => snap(v.t, v.p)}
            className="py-2 text-[10px] font-bold text-slate-400 hover:text-white bg-[#0a0f1a] hover:bg-[#111827] border border-white/5 rounded-lg transition-all">
            {v.label}
          </button>
        ))}
      </div>

      <div className="bg-[#04090f] border border-white/5 rounded-xl p-3 space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[10px] text-slate-500">🖱️ <b className="text-slate-400">Glisser</b> = rotation</span>
          <span className="text-[10px] text-slate-500">🖱️ <b className="text-slate-400">Molette</b> = zoom</span>
          <span className="text-[10px] text-slate-500">👆 <b className="text-slate-400">1 doigt</b> = rotation</span>
          <span className="text-[10px] text-slate-500">🤏 <b className="text-slate-400">Pincer</b> = zoom</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { c: '#475569', l: 'Montant/Côté' }, { c: '#7dd3fc', l: 'Dessus' },
            { c: '#38bdf8', l: 'Tablette' },   { c: '#f97316', l: 'Porte' },
            { c: '#a855f7', l: 'Tiroir' },      { c: '#1e3a5f', l: 'Fond arrière' },
          ].map(({ c, l }) => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
              <span className="text-[10px] text-slate-400">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
