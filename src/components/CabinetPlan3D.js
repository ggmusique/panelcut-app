/**
 * CabinetPlan3D.js — Vue 3D interactive Three.js (orbit souris + touch)
 * Fix: canvas size via ResizeObserver (offsetWidth/Height) car clientWidth=0 au mount.
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

// ─ Charge Three.js depuis CDN une seule fois ──────────────────────────────────
let threeP = null;
function loadThree() {
  if (threeP) return threeP;
  threeP = new Promise((resolve, reject) => {
    if (window.THREE) { resolve(window.THREE); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload  = () => resolve(window.THREE);
    s.onerror = () => reject(new Error('Three.js CDN unreachable'));
    document.head.appendChild(s);
  });
  return threeP;
}

export default function CabinetPlan3D({ cabinet, name = 'Meuble' }) {
  const wrapRef   = useRef(null);   // div conteneur (pour mesurer les dimensions)
  const canvasRef = useRef(null);
  const rendRef   = useRef(null);
  const sceneRef  = useRef(null);
  const camRef    = useRef(null);
  const frameRef  = useRef(null);
  const builtRef  = useRef(false);
  const orbitRef  = useRef({ theta: 0.6, phi: 1.1, radius: 2.2,
                             dragging: false, lastX: 0, lastY: 0, target: null });
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error' | 'nodims'
  const [errMsg, setErrMsg] = useState('');

  // ─ Construit la scène THREE une seule fois ────────────────────────────────
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
      plinth:    cabinet.plinth    || 0,
      panels:    cabinet.panels    || [],
    };
    const m = v => v / 100;  // cm → m
    const W = m(cab.width), H = m(cab.height), D = m(cab.depth), T = m(cab.thickness);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W_PX, H_PX, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendRef.current = renderer;

    // Scène
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04090f);
    sceneRef.current = scene;

    // Caméra
    const camera = new THREE.PerspectiveCamera(45, W_PX / H_PX, 0.01, 100);
    camRef.current = camera;
    const maxDim = Math.max(W, H, D);
    orbitRef.current.radius = maxDim * 2.8;
    orbitRef.current.target = new THREE.Vector3(0, H / 2, 0);

    // Grille sol
    const grid = new THREE.GridHelper(4, 40, 0x0f2040, 0x0a1830);
    grid.position.y = -0.001;
    scene.add(grid);

    // Lumières
    scene.add(new THREE.AmbientLight(0x8ab4d4, 0.45));
    const dir = new THREE.DirectionalLight(0xffffff, 1.3);
    dir.position.set(3, 5, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x3b82f6, 0.35);
    fill.position.set(-4, 2, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xf97316, 0.2);
    rim.position.set(0, -3, -4);
    scene.add(rim);

    // Sol recevant ombres
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshPhongMaterial({ color: 0x050a14, transparent: true, opacity: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ─ Ajout des panneaux ─────────────────────────────────────────────────
    const addPanel = (bw, bh, bd, bx, by, bz, role) => {
      const mat  = matFor(role);
      const geo  = new THREE.BoxGeometry(
        Math.max(bw, 0.001),
        Math.max(bh, 0.001),
        Math.max(bd, 0.001)
      );
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color:       mat.color,
        emissive:    mat.emissive,
        specular:    0x224466,
        shininess:   40,
        transparent: mat.opacity < 1,
        opacity:     mat.opacity,
        depthWrite:  mat.opacity >= 0.9,
        side:        mat.opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
      }));
      mesh.position.set(bx - W/2, by, bz - D/2);
      mesh.castShadow    = true;
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
        const px   = m(p.x ?? 0);
        const py   = m(p.y ?? 0);
        const pw   = m(p.w ?? cab.width);
        const ph   = m(p.h ?? cab.height);

        if (['side','divider'].includes(role)) {
          // Panneau vertical : épaisseur sur X, pleine profondeur
          addPanel(T, ph, D, px + T/2, py + ph/2, D/2, role);
        } else if (['top','bottom','shelf'].includes(role)) {
          // Panneau horizontal : pleine largeur, épaisseur sur Y
          addPanel(pw, T, D, px + pw/2, py + T/2, D/2, role);
        } else if (role === 'back') {
          // Fond arrière : épaisseur sur Z
          addPanel(pw, ph, T, px + pw/2, py + ph/2, D - T/2, role);
        } else if (['door','drawer_front'].includes(role)) {
          // Porte / tiroir : plan avant, épaisseur sur Z
          addPanel(pw, ph, T, px + pw/2, py + ph/2, T/2, role);
        } else {
          // Fallback générique
          addPanel(pw, ph, T, px + pw/2, py + ph/2, D/2, role);
        }
      }
    } else {
      // Fallback : boîte filaire si pas de panels
      const geo   = new THREE.BoxGeometry(W, H, D);
      const solid = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color: 0x1e3a5f, emissive: 0x0a1628, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
      }));
      solid.position.set(0, H/2, 0);
      scene.add(solid);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x60a5fa })
      );
      edges.position.set(0, H/2, 0);
      scene.add(edges);
    }

    setStatus('ok');
  }, [cabinet]);

  // ─ Boucle de rendu ────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    frameRef.current = requestAnimationFrame(loop);
    if (!rendRef.current || !sceneRef.current || !camRef.current) return;
    const o = orbitRef.current;
    const t = o.target || { x: 0, y: 0, z: 0 };
    const r = o.radius;
    camRef.current.position.set(
      t.x + r * Math.sin(o.phi) * Math.sin(o.theta),
      t.y + r * Math.cos(o.phi),
      t.z + r * Math.sin(o.phi) * Math.cos(o.theta)
    );
    camRef.current.lookAt(t.x, t.y, t.z);
    rendRef.current.render(sceneRef.current, camRef.current);
  }, []);

  // ─ Init : attend que le wrapper soit dimensionné (ResizeObserver) ──────────────
  useEffect(() => {
    if (!cabinet?.width || !cabinet?.height) { setStatus('nodims'); return; }
    let alive = true;
    let ro = null;

    const tryInit = (THREE) => {
      if (!alive || builtRef.current) return;
      const wrap = wrapRef.current;
      if (!wrap || wrap.offsetWidth === 0) return; // pas encore layout
      buildScene(THREE);
      if (alive) loop();
    };

    loadThree()
      .then(THREE => {
        if (!alive) return;
        // Essai immédiat
        tryInit(THREE);
        // Fallback : ResizeObserver sur le wrapper
        if (!builtRef.current && wrapRef.current) {
          ro = new ResizeObserver(() => { tryInit(THREE); if (builtRef.current && ro) { ro.disconnect(); ro = null; } });
          ro.observe(wrapRef.current);
        }
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

  // ─ Resize fenêtre ───────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => {
      const wrap = wrapRef.current;
      if (!wrap || !rendRef.current || !camRef.current) return;
      const w = wrap.offsetWidth, h = wrap.offsetHeight;
      if (w === 0 || h === 0) return;
      camRef.current.aspect = w / h;
      camRef.current.updateProjectionMatrix();
      rendRef.current.setSize(w, h, false);
    };
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // ─ Contrôles souris + touch ─────────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const o = orbitRef.current;
    let lastDist = null;

    const down  = e => { o.dragging = true;  o.lastX = e.clientX; o.lastY = e.clientY; };
    const up    = ()  => { o.dragging = false; };
    const move  = e => {
      if (!o.dragging) return;
      o.theta -= (e.clientX - o.lastX) * 0.008;
      o.phi    = Math.max(0.08, Math.min(Math.PI - 0.08, o.phi + (e.clientY - o.lastY) * 0.008));
      o.lastX  = e.clientX; o.lastY = e.clientY;
    };
    const wheel = e => {
      e.preventDefault();
      o.radius = Math.max(0.2, Math.min(10, o.radius + e.deltaY * 0.002));
    };
    const tstart = e => {
      if (e.touches.length === 1) { o.dragging = true; o.lastX = e.touches[0].clientX; o.lastY = e.touches[0].clientY; }
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
        o.radius = Math.max(0.2, Math.min(10, o.radius * (lastDist / d)));
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
    el.addEventListener('touchmove',  tmove,  { passive: false });
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

  // ─ Cas : pas de dimensions ──────────────────────────────────────────────────
  if (!cabinet?.width || !cabinet?.height) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="text-4xl">📦</div>
        <p className="text-white font-bold">Vue 3D non disponible</p>
        <p className="text-sm text-slate-400 max-w-xs">Les dimensions du meuble sont introuvables. Relancez un scan IA pour les obtenir.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Conteneur canvas — hauteur fixe pour que offsetWidth/Height soient non-zéro */}
      <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#04090f]"
        style={{ width: '100%', height: '360px' }}
        ref={wrapRef}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block',
                   cursor: status === 'ok' ? 'grab' : 'default' }}
        />

        {/* Loading */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#04090f]">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Chargement Three.js…</p>
          </div>
        )}

        {/* Erreur */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#04090f]">
            <p className="text-red-400 font-bold">⚠️ Erreur 3D</p>
            <p className="text-slate-500 text-xs max-w-xs text-center">{errMsg}</p>
          </div>
        )}

        {/* Badges */}
        {status === 'ok' && (
          <>
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 pointer-events-none">
              <span className="text-[10px] font-bold text-orange-400 tracking-widest">VUE 3D • {(name||'MEUBLE').toUpperCase()}</span>
            </div>
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 pointer-events-none">
              <span className="text-[10px] font-mono text-slate-300">
                {cabinet.width}×{cabinet.height}×{cabinet.depth||60} cm
              </span>
            </div>
          </>
        )}
      </div>

      {/* Boutons vues rapides */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { label: '🔄 Face',    t: Math.PI,   p: Math.PI/2 },
          { label: '↗ Iso',     t: 0.6,       p: 1.1 },
          { label: '⬆ Dessus',  t: 0.6,       p: 0.05 },
          { label: '➡ Côté',    t: Math.PI/2, p: Math.PI/2 },
          { label: '↙ Arrière', t: 0,         p: 1.1 },
        ].map(v => (
          <button key={v.label} onClick={() => snap(v.t, v.p)}
            className="py-2 text-[10px] font-bold text-slate-400 hover:text-white bg-[#0a0f1a] hover:bg-[#111827] border border-white/5 rounded-lg transition-all">
            {v.label}
          </button>
        ))}
      </div>

      {/* Aide + légende */}
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
