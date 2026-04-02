/**
 * CabinetPlan3D.js — Vue 3D interactive avec Three.js (orbit à la souris & touch)
 * Chargement Three.js via CDN dans un <script> injecté dynamiquement.
 * Reçoit : cabinet { width, height, depth, thickness, plinth, panels[] }
 * Toutes les dimensions en cm (converties en m pour Three.js).
 */
import { useRef, useEffect, useState, useCallback } from 'react';

// ─── Couleurs par rôle ────────────────────────────────────────────────────────
const ROLE_MAT = {
  side:         { color: 0x1e3a5f, emissive: 0x0a1628, opacity: 1    },
  top:          { color: 0x1e3a5f, emissive: 0x0a1628, opacity: 1    },
  bottom:       { color: 0x1e3a5f, emissive: 0x0a1628, opacity: 1    },
  shelf:        { color: 0x0f3050, emissive: 0x061828, opacity: 1    },
  divider:      { color: 0x0f3050, emissive: 0x061828, opacity: 1    },
  back:         { color: 0x080f20, emissive: 0x030810, opacity: 0.85 },
  door:         { color: 0xf97316, emissive: 0x7c2d12, opacity: 0.25 },
  drawer_front: { color: 0xa855f7, emissive: 0x581c87, opacity: 0.30 },
  default:      { color: 0x1a2f4a, emissive: 0x0a1828, opacity: 1    },
};

const EDGE_COLOR = {
  side: 0x475569, top: 0x7dd3fc, bottom: 0x7dd3fc,
  shelf: 0x38bdf8, divider: 0x93c5fd, back: 0x1e3a5f,
  door: 0xf97316, drawer_front: 0xa855f7, default: 0x64748b,
};

function matFor(role) { return ROLE_MAT[role] || ROLE_MAT.default; }
function edgeFor(role) { return EDGE_COLOR[role] || EDGE_COLOR.default; }

// ─── Chargement Three.js via CDN (une seule fois) ─────────────────────────────
let threePromise = null;
function loadThree() {
  if (threePromise) return threePromise;
  threePromise = new Promise((resolve, reject) => {
    if (window.THREE) { resolve(window.THREE); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = () => resolve(window.THREE);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return threePromise;
}

// ─── Composant principal ───────────────────────────────────────────────────────
export default function CabinetPlan3D({ cabinet, name = 'Meuble' }) {
  const canvasRef  = useRef(null);
  const rendRef   = useRef(null);   // THREE.WebGLRenderer
  const sceneRef  = useRef(null);
  const camRef    = useRef(null);
  const frameRef  = useRef(null);
  const orbitRef  = useRef({ theta: 0.6, phi: 1.1, radius: 2.2, dragging: false, lastX: 0, lastY: 0 });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ─── Construire la scène ──────────────────────────────────────────────────
  const buildScene = useCallback((THREE, canvas) => {
    if (!cabinet?.width || !cabinet?.height) return;

    const cab = {
      ...cabinet,
      depth:     cabinet.depth     || 60,
      thickness: cabinet.thickness || 1.8,
      plinth:    cabinet.plinth    || 0,
      panels:    cabinet.panels    || [],
    };

    // cm → m
    const m = v => v / 100;
    const W = m(cab.width), H = m(cab.height), D = m(cab.depth), T = m(cab.thickness);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendRef.current = renderer;

    // Scène
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04090f);
    scene.fog = new THREE.FogExp2(0x04090f, 0.8);
    sceneRef.current = scene;

    // Caméra
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.01, 50);
    camRef.current = camera;

    // ─── Grille de sol ───────────────────────────────────────────────────
    const gridHelper = new THREE.GridHelper(4, 40, 0x0f2040, 0x0a1830);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // ─── Lumières ────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x8ab4d4, 0.4);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far  = 20;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.3);
    fillLight.position.set(-4, 2, -2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf97316, 0.2);
    rimLight.position.set(0, -3, -4);
    scene.add(rimLight);

    // ─── Panneaux ────────────────────────────────────────────────────────
    const hasPanels = cab.panels.length > 0;

    if (hasPanels) {
      for (const p of cab.panels) {
        const mat   = matFor(p.role);
        const eCol  = edgeFor(p.role);
        const isVertSide = p.role === 'side' || p.role === 'divider';
        const isHoriz    = ['top','bottom','shelf'].includes(p.role);
        const isBack     = p.role === 'back';
        const isDoor     = p.role === 'door' || p.role === 'drawer_front';

        let bw, bh, bd, bx, by, bz;

        if (isVertSide) {
          bw = T; bh = m(p.h); bd = D;
          bx = m(p.x) + T/2;
          by = m(p.y) + bh/2;
          bz = D/2;
        } else if (isHoriz) {
          bw = m(p.w || cab.width); bh = T; bd = D;
          bx = m(p.x || 0) + bw/2;
          by = m(p.y) + T/2;
          bz = D/2;
        } else if (isBack) {
          bw = m(p.w || cab.width); bh = m(p.h); bd = T;
          bx = bw/2;
          by = m(p.y) + bh/2;
          bz = D - T/2;
        } else if (isDoor) {
          bw = m(p.w); bh = m(p.h); bd = T;
          bx = m(p.x) + bw/2;
          by = m(p.y) + bh/2;
          bz = T/2;
        } else {
          bw = m(p.w || cab.width); bh = m(p.h); bd = T;
          bx = m(p.x || 0) + bw/2;
          by = m(p.y) + bh/2;
          bz = D/2;
        }

        const geo  = new THREE.BoxGeometry(bw, bh, bd);
        const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
          color:      mat.color,
          emissive:   mat.emissive,
          specular:   0x224466,
          shininess:  40,
          transparent: mat.opacity < 1,
          opacity:    mat.opacity,
          depthWrite: mat.opacity >= 1,
        }));
        mesh.position.set(bx - W/2, by, bz - D/2);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        // Arêtes
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: eCol, linewidth: 1 })
        );
        edges.position.copy(mesh.position);
        scene.add(edges);
      }
    } else {
      // Fallback : boîte filaire
      const wireGeo  = new THREE.BoxGeometry(W, H, D);
      const wireMesh = new THREE.Mesh(wireGeo, new THREE.MeshPhongMaterial({
        color: 0x1e3a5f, emissive: 0x0a1628, transparent: true, opacity: 0.15,
      }));
      wireMesh.position.set(0, H/2, 0);
      scene.add(wireMesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(wireGeo),
        new THREE.LineBasicMaterial({ color: 0x60a5fa })
      );
      edges.position.set(0, H/2, 0);
      scene.add(edges);
    }

    // ─── Sol (ombre) ──────────────────────────────────────────────────────
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshPhongMaterial({ color: 0x050a14, transparent: true, opacity: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ─── Radius initial de l'orbite ───────────────────────────────────────
    const maxDim = Math.max(W, H, D);
    orbitRef.current.radius = maxDim * 2.8;
    orbitRef.current.target = new THREE.Vector3(0, H / 2, 0);

    setLoading(false);
  }, [cabinet]);

  // ─── RAF loop ─────────────────────────────────────────────────────────────
  const animate = useCallback(() => {
    if (!rendRef.current || !sceneRef.current || !camRef.current) return;
    frameRef.current = requestAnimationFrame(animate);
    const { theta, phi, radius, target } = orbitRef.current;
    const THREE = window.THREE;
    const t = target || new THREE.Vector3(0, 0, 0);
    camRef.current.position.set(
      t.x + radius * Math.sin(phi) * Math.sin(theta),
      t.y + radius * Math.cos(phi),
      t.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camRef.current.lookAt(t);
    rendRef.current.render(sceneRef.current, camRef.current);
  }, []);

  // ─── Init Three.js ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    let alive = true;
    loadThree()
      .then(THREE => {
        if (!alive) return;
        buildScene(THREE, canvasRef.current);
        animate();
      })
      .catch(() => setError('Impossible de charger Three.js'));
    return () => {
      alive = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendRef.current) { rendRef.current.dispose(); rendRef.current = null; }
    };
  }, [buildScene, animate]);

  // ─── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      if (!canvasRef.current || !rendRef.current || !camRef.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      camRef.current.aspect = w / h;
      camRef.current.updateProjectionMatrix();
      rendRef.current.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ─── Contrôles souris ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const o = orbitRef.current;
    const PIH = Math.PI / 2;

    const onDown = e => { o.dragging = true; o.lastX = e.clientX; o.lastY = e.clientY; };
    const onUp   = () => { o.dragging = false; };
    const onMove = e => {
      if (!o.dragging) return;
      const dx = e.clientX - o.lastX;
      const dy = e.clientY - o.lastY;
      o.theta -= dx * 0.008;
      o.phi   = Math.max(0.12, Math.min(Math.PI - 0.12, o.phi + dy * 0.008));
      o.lastX = e.clientX; o.lastY = e.clientY;
    };
    const onWheel = e => {
      e.preventDefault();
      o.radius = Math.max(0.3, Math.min(8, o.radius + e.deltaY * 0.002));
    };

    // Touch
    let lastTouchDist = null;
    const onTouchStart = e => {
      if (e.touches.length === 1) { o.dragging = true; o.lastX = e.touches[0].clientX; o.lastY = e.touches[0].clientY; }
      else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.sqrt(dx*dx + dy*dy);
      }
    };
    const onTouchEnd = () => { o.dragging = false; lastTouchDist = null; };
    const onTouchMove = e => {
      e.preventDefault();
      if (e.touches.length === 1 && o.dragging) {
        const dx = e.touches[0].clientX - o.lastX;
        const dy = e.touches[0].clientY - o.lastY;
        o.theta -= dx * 0.01;
        o.phi   = Math.max(0.12, Math.min(Math.PI - 0.12, o.phi + dy * 0.01));
        o.lastX = e.touches[0].clientX; o.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2 && lastTouchDist) {
        const dx   = e.touches[0].clientX - e.touches[1].clientX;
        const dy   = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        o.radius   = Math.max(0.3, Math.min(8, o.radius * (lastTouchDist / dist)));
        lastTouchDist = dist;
      }
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup',   onUp);
    canvas.addEventListener('mouseleave',onUp);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('wheel',     onWheel, { passive: false });
    canvas.addEventListener('touchstart',onTouchStart, { passive: false });
    canvas.addEventListener('touchend',  onTouchEnd);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mouseup',   onUp);
      canvas.removeEventListener('mouseleave',onUp);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('wheel',     onWheel);
      canvas.removeEventListener('touchstart',onTouchStart);
      canvas.removeEventListener('touchend',  onTouchEnd);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // ─── Boutons vue rapide ───────────────────────────────────────────────────
  const snapView = (theta, phi) => {
    orbitRef.current.theta = theta;
    orbitRef.current.phi   = phi;
  };

  if (!cabinet?.width || !cabinet?.height) {
    return (
      <div className="text-center py-16 text-slate-500 text-sm">
        <p className="text-4xl mb-4">📦</p>
        <p>Dimensions du meuble non disponibles pour la vue 3D.</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-3">
      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl"
        style={{ aspectRatio: '4/3' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#04090f] rounded-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Chargement Three.js…</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#04090f] rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {/* Badge titre */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
          <span className="text-[10px] font-bold text-orange-400 tracking-widest">VUE 3D INTERACTIVE</span>
        </div>
        {/* Dimensions badge */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
          <span className="text-[10px] font-mono text-slate-300">
            {cabinet.width}×{cabinet.height}×{cabinet.depth||60} cm
          </span>
        </div>
      </div>

      {/* Contrôles vues rapides */}
      <div className="flex gap-2">
        {[
          { label: '🔄 Face',    theta: Math.PI,    phi: Math.PI/2 },
          { label: '↗ Iso',     theta: 0.6,        phi: 1.1       },
          { label: '⬆ Dessus',  theta: 0.6,        phi: 0.05      },
          { label: '➡ Côté',    theta: Math.PI/2,  phi: Math.PI/2 },
          { label: '↙ Arrière', theta: 0,          phi: 1.1       },
        ].map(v => (
          <button key={v.label} onClick={() => snapView(v.theta, v.phi)}
            className="flex-1 py-2 text-[10px] font-bold text-slate-400 hover:text-white bg-[#0a0f1a] hover:bg-[#111827] border border-white/5 rounded-lg transition-all">
            {v.label}
          </button>
        ))}
      </div>

      {/* Légende */}
      <div className="bg-[#04090f] border border-white/5 rounded-xl p-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Contrôles</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
          <span>🖱️ <strong className="text-slate-400">Clic-glisser</strong> → rotation</span>
          <span>🖱️ <strong className="text-slate-400">Molette</strong> → zoom</span>
          <span>👆 <strong className="text-slate-400">1 doigt</strong> → rotation</span>
          <span>🤏 <strong className="text-slate-400">Pincement</strong> → zoom</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { color: '#475569', label: 'Montant / Côté' },
            { color: '#7dd3fc', label: 'Dessus / Tablette' },
            { color: '#38bdf8', label: 'Tablette' },
            { color: '#f97316', label: 'Porte (transparent)' },
            { color: '#a855f7', label: 'Tiroir' },
            { color: '#1e3a5f', label: 'Fond arrière' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
