import React, { useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════
   PROCEDURAL TEXTURE GENERATORS
   ═══════════════════════════════════════════════════════════════ */

function createWoodCanvas({
  width = 1024, height = 1024,
  baseR = 205, baseG = 175, baseB = 140,
  grainR = 165, grainG = 135, grainB = 95,
  density = 90, knots = 2, noiseAmt = 12,
} = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, width, height);

  // Pixel noise
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * noiseAmt;
    d[i]   = Math.max(0, Math.min(255, d[i]   + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // Grain lines (horizontal)
  for (let i = 0; i < density; i++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${grainR},${grainG},${grainB},${0.03 + Math.random() * 0.1})`;
    ctx.lineWidth = 0.3 + Math.random() * 2.2;
    let y = Math.random() * height;
    ctx.moveTo(0, y);
    for (let x = 0; x < width; x += 6) {
      y += (Math.random() - 0.5) * 1.8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Knots (ring pattern)
  for (let k = 0; k < knots; k++) {
    const kx = 80 + Math.random() * (width - 160);
    const ky = 80 + Math.random() * (height - 160);
    const r = 5 + Math.random() * 14;
    for (let ring = r; ring > 0; ring -= 1.2) {
      ctx.beginPath();
      ctx.arc(kx, ky, ring, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${grainR - 30},${grainG - 30},${grainB - 30},${0.04 + (1 - ring / r) * 0.12})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(kx, ky, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${grainR - 40},${grainG - 40},${grainB - 40},0.3)`;
    ctx.fill();
  }
  return c;
}

function createFloorCanvas(width = 2048, height = 2048) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  const plankW = width / 8;

  for (let i = 0; i < 8; i++) {
    const x = i * plankW;
    const r = 178 + Math.random() * 28;
    const g = 148 + Math.random() * 22;
    const b = 110 + Math.random() * 18;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x + 1, 0, plankW - 2, height);

    for (let j = 0; j < 50; j++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r - 28},${g - 22},${b - 18},${0.04 + Math.random() * 0.08})`;
      ctx.lineWidth = 0.4 + Math.random() * 1.6;
      let yy = Math.random() * height;
      ctx.moveTo(x + 2, yy);
      for (let xx = x + 2; xx < x + plankW - 2; xx += 8) { yy += (Math.random() - 0.5) * 1.5; ctx.lineTo(xx, yy); }
      ctx.stroke();
    }
    // Plank gaps
    ctx.fillStyle = 'rgba(40, 32, 24, 0.55)';
    ctx.fillRect(x, 0, 1.2, height);
    ctx.fillRect(x + plankW - 1.2, 0, 1.2, height);
  }

  // Subtle noise
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    d[i]   = Math.max(0, Math.min(255, d[i]   + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function createWallCanvas(width = 512, height = 512) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f0ece6';
  ctx.fillRect(0, 0, width, height);
  // Very subtle texture
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 5;
    d[i]   = Math.max(0, Math.min(255, d[i] + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function createBumpCanvas(src) {
  const w = src.width, h = src.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
    const v = 128 + (gray - 128) * 1.6;
    d[i] = d[i+1] = d[i+2] = Math.max(0, Math.min(255, v));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE MODULES
   ═══════════════════════════════════════════════════════════════ */

function normalizeModules(cabinet) {
  const cabinetHeight = Math.max(0, Number(cabinet?.height) || 0);
  const plinthHeight = Math.max(0, Number(cabinet?.plinth) || 0);
  const interiorH = Math.max(1, cabinetHeight - plinthHeight);

  const getCount = (value, fallback = 0) => {
    if (Array.isArray(value)) return value.length;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  };

  const normalizeYList = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((v) => {
        if (typeof v === 'number') return v;
        if (v && typeof v === 'object') return Number(v.y);
        return NaN;
      })
      .filter((n) => Number.isFinite(n))
      .map((n) => Math.max(0, Math.min(interiorH, n)))
      .sort((a, b) => b - a);
  };

  const hasRod = (moduleData) => {
    if (Array.isArray(moduleData?.rods)) return moduleData.rods.length > 0;
    if (Array.isArray(moduleData?.rod)) return moduleData.rod.length > 0;
    return Boolean(
      moduleData?.rod ??
      moduleData?.rods ??
      moduleData?.tringle ??
      moduleData?.hanging ??
      moduleData?.penderie
    );
  };

  const raw = Array.isArray(cabinet?.modules) ? cabinet.modules : [];
  const detailed = raw.filter(m => typeof m === 'object' && m !== null);
  if (detailed.length > 0) {
    return detailed.map((m, i) => {
      const shelfYs = normalizeYList(m.shelves);
      const rodYs = normalizeYList(m.rods);
      const drawerItems = Array.isArray(m?.drawerItems)
        ? m.drawerItems
            .map((d) => ({
              y: Number(d?.y),
              h: Number(d?.height ?? d?.h),
            }))
            .filter((d) => Number.isFinite(d.y) && Number.isFinite(d.h) && d.h > 0)
        : [];
      const drawerParts = {
        front: m?.drawerParts?.front !== false,
        back: m?.drawerParts?.back !== false,
        left: m?.drawerParts?.left !== false,
        right: m?.drawerParts?.right !== false,
        bottom: m?.drawerParts?.bottom !== false,
      };
      return {
        id:      i + 1,
        width:   Math.max(0, Number(m.width ?? m.w ?? m.largeur) || 0),
        shelves: shelfYs.length > 0 ? shelfYs.length : getCount(m.shelves, getCount(m.nb_shelves, 0)),
        shelfYs,
        drawers: drawerItems.length > 0 ? drawerItems.length : getCount(m.drawers, getCount(m.drawerItems, getCount(m.nb_drawers, 0))),
        drawerItems,
        doors:   getCount(m.doors, getCount(m.nb_doors, 0)),
        slidingDoors: Math.max(0, parseInt(m?.slidingDoors ?? m?.nb_sliding_doors ?? 0, 10) || 0),
        rod:     rodYs.length > 0 || hasRod(m),
        rodYs,
        hasBack: m?.hasBack !== false,
        drawerParts,
      };
    }).filter(m => m.width > 0);
  }
  const W  = Math.max(0, Number(cabinet?.width) || 0);
  const nb = Math.max(1, parseInt(cabinet?.nb_dividers ?? 4, 10) + 1);
  const mw = W > 0 ? W / nb : 0;
  return Array.from({ length: nb }, (_, i) => ({
    id: i + 1, width: mw,
    shelves: Math.max(0, parseInt(cabinet?.nb_shelves ?? 0, 10) || 0),
    drawers: Math.max(0, parseInt(cabinet?.nb_drawers ?? 0, 10) || 0),
    drawerItems: [],
    doors: 1, rod: false,
    slidingDoors: 0,
    hasBack: true,
    drawerParts: { front: true, back: true, left: true, right: true, bottom: true },
  }));
}

/* ═══════════════════════════════════════════════════════════════
   MATERIALS HOOK
   ═══════════════════════════════════════════════════════════════ */

function useMaterials() {
  return useMemo(() => {
    const mkTex = (canvas, repX = 1, repY = 1) => {
      const t = new THREE.CanvasTexture(canvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repX, repY);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };

    // Main wood (light sonoma oak)
    const mainCanvas = createWoodCanvas({ baseR: 210, baseG: 180, baseB: 148, grainR: 170, grainG: 140, grainB: 100, density: 100, knots: 3 });
    const mainTex    = mkTex(mainCanvas);
    const mainBump   = mkTex(createBumpCanvas(mainCanvas));

    // Interior / shelf wood (lighter)
    const intCanvas = createWoodCanvas({ baseR: 228, baseG: 215, baseB: 198, grainR: 200, grainG: 185, grainB: 168, density: 50, knots: 0, noiseAmt: 8 });
    const intTex    = mkTex(intCanvas);

    // Back panel (light melamine gray)
    const backCanvas = createWoodCanvas({ baseR: 188, baseG: 158, baseB: 126, grainR: 150, grainG: 122, grainB: 92, density: 55, knots: 1, noiseAmt: 10 });
    const backTex    = mkTex(backCanvas);

    // Drawer front (slightly warmer)
    const drawerCanvas = createWoodCanvas({ baseR: 208, baseG: 178, baseB: 145, grainR: 168, grainG: 138, grainB: 98, density: 95, knots: 2 });
    const drawerTex    = mkTex(drawerCanvas);
    const drawerBump   = mkTex(createBumpCanvas(drawerCanvas));

    // Floor
    const floorCanvas = createFloorCanvas();
    const floorTex    = mkTex(floorCanvas, 3, 3);
    const floorBump   = mkTex(createBumpCanvas(floorCanvas), 3, 3);

    // Wall
    const wallCanvas = createWallCanvas();
    const wallTex    = mkTex(wallCanvas, 2, 2);

    return {
      wood: new THREE.MeshStandardMaterial({
        map: mainTex, bumpMap: mainBump, bumpScale: 0.0025,
        roughness: 0.58, metalness: 0.0, envMapIntensity: 0.3,
      }),
      interior: new THREE.MeshStandardMaterial({
        map: intTex, roughness: 0.50, metalness: 0.0, envMapIntensity: 0.2,
      }),
      back: new THREE.MeshStandardMaterial({
        map: backTex, roughness: 0.70, metalness: 0.0, envMapIntensity: 0.15,
      }),
      drawer: new THREE.MeshStandardMaterial({
        map: drawerTex, bumpMap: drawerBump, bumpScale: 0.002,
        roughness: 0.52, metalness: 0.02, envMapIntensity: 0.3,
      }),
      handle: new THREE.MeshStandardMaterial({
        color: '#666', roughness: 0.12, metalness: 0.88, envMapIntensity: 0.8,
      }),
      rod: new THREE.MeshStandardMaterial({
        color: '#c0c0c0', roughness: 0.08, metalness: 0.92, envMapIntensity: 0.9,
      }),
      plinth: new THREE.MeshStandardMaterial({
        color: '#888', roughness: 0.75, metalness: 0.05,
      }),
      door: new THREE.MeshStandardMaterial({
        map: mainTex, bumpMap: mainBump, bumpScale: 0.002,
        roughness: 0.50, metalness: 0.02, transparent: true, opacity: 0.92,
        envMapIntensity: 0.3,
      }),
      floor: new THREE.MeshStandardMaterial({
        map: floorTex, bumpMap: floorBump, bumpScale: 0.0015,
        roughness: 0.45, metalness: 0.02, envMapIntensity: 0.25,
      }),
      wall: new THREE.MeshStandardMaterial({
        map: wallTex, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.1,
      }),
      ceiling: new THREE.MeshStandardMaterial({
        color: '#f5f2ee', roughness: 0.95, metalness: 0.0,
      }),
      baseboard: new THREE.MeshStandardMaterial({
        color: '#e5e1da', roughness: 0.75, metalness: 0.0,
      }),
      rug: new THREE.MeshStandardMaterial({
        color: '#d8d4ce', roughness: 0.98, metalness: 0.0, envMapIntensity: 0.05,
      }),
      edgeBand: new THREE.MeshStandardMaterial({
        map: mainTex, roughness: 0.5, metalness: 0.0,
      }),
    };
  }, []);
}

/* ═══════════════════════════════════════════════════════════════
   ROOM
   ═══════════════════════════════════════════════════════════════ */

function Room({ roomW, roomH, roomD, mats }) {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={mats.floor}>
        <planeGeometry args={[roomW, roomD]} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, roomH / 2, -roomD / 2]} receiveShadow material={mats.wall}>
        <planeGeometry args={[roomW, roomH]} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-roomW / 2, roomH / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={mats.wall}>
        <planeGeometry args={[roomD, roomH]} />
      </mesh>
      {/* Right wall (subtle, further away) */}
      <mesh position={[roomW / 2, roomH / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={mats.wall}>
        <planeGeometry args={[roomD, roomH]} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, roomH, 0]} material={mats.ceiling}>
        <planeGeometry args={[roomW, roomD]} />
      </mesh>
      {/* Baseboards - back */}
      <mesh position={[0, 0.04, -roomD / 2 + 0.006]} material={mats.baseboard} castShadow>
        <boxGeometry args={[roomW, 0.08, 0.012]} />
      </mesh>
      {/* Baseboard - left */}
      <mesh position={[-roomW / 2 + 0.006, 0.04, 0]} material={mats.baseboard} castShadow>
        <boxGeometry args={[0.012, 0.08, roomD]} />
      </mesh>
      {/* Baseboard - right */}
      <mesh position={[roomW / 2 - 0.006, 0.04, 0]} material={mats.baseboard} castShadow>
        <boxGeometry args={[0.012, 0.08, roomD]} />
      </mesh>
      {/* Rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, roomD * 0.15]} receiveShadow material={mats.rug}>
        <planeGeometry args={[roomW * 0.45, roomD * 0.35]} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DRAWER HANDLE (realistic bar handle)
   ═══════════════════════════════════════════════════════════════ */

function DrawerHandle({ width, material }) {
  const hw = Math.min(width * 0.45, 0.13);
  return (
    <group position={[0, 0, 0.022]}>
      {/* Bar */}
      <mesh rotation={[0, 0, Math.PI / 2]} material={material} castShadow>
        <capsuleGeometry args={[0.005, hw, 4, 8]} />
      </mesh>
      {/* Left mounting post */}
      <mesh position={[-hw / 2, 0, -0.009]} rotation={[Math.PI / 2, 0, 0]} material={material} castShadow>
        <cylinderGeometry args={[0.0035, 0.0035, 0.018, 6]} />
      </mesh>
      {/* Right mounting post */}
      <mesh position={[hw / 2, 0, -0.009]} rotation={[Math.PI / 2, 0, 0]} material={material} castShadow>
        <cylinderGeometry args={[0.0035, 0.0035, 0.018, 6]} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROD BRACKETS
   ═══════════════════════════════════════════════════════════════ */

function RodBracket({ position, material }) {
  return (
    <group position={position}>
      <mesh material={material} castShadow>
        <cylinderGeometry args={[0.016, 0.016, 0.004, 12]} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CABINET MODULE (3D) — detailed with textures
   ═══════════════════════════════════════════════════════════════ */

function CabinetModule3D({ mod, x, cabinetH, cabinetD, plinthH, thickness, mats, isFirst, isLast, hideFrontDoors = false }) {
  const W  = mod.width / 100;
  const H  = cabinetH / 100;
  const D  = cabinetD / 100;
  const TH = thickness / 100;
  const PL = plinthH / 100;
  const bodyH = H - PL;

  const shelves = useMemo(() => {
    if (Array.isArray(mod.shelfYs) && mod.shelfYs.length > 0) {
      return mod.shelfYs
        .map((yCm) => PL + yCm / 100)
        .sort((a, b) => b - a);
    }
    if (mod.shelves <= 0) return [];
    return Array.from({ length: mod.shelves }, (_, i) =>
      PL + ((i + 1) / (mod.shelves + 1)) * bodyH
    );
  }, [mod.shelves, mod.shelfYs, mod.drawers, PL, TH, bodyH]);

  const drawers = useMemo(() => {
    if (Array.isArray(mod.drawerItems) && mod.drawerItems.length > 0) {
      return mod.drawerItems.map((d) => {
        const h = Math.max(0.05, d.h / 100);
        return {
          y: PL + (d.y + d.h / 2) / 100,
          h: Math.max(0.03, h - 0.004),
        };
      });
    }
    if (mod.drawers <= 0) return [];
    const zoneH = bodyH * Math.min(0.5, Math.max(0, mod.drawers * 0.15));
    const zoneBottom = PL;
    return Array.from({ length: mod.drawers }, (_, i) => {
      const dh = zoneH / mod.drawers;
      return { y: zoneBottom + i * dh + dh / 2, h: dh - 0.008 };
    });
  }, [mod.drawers, mod.drawerItems, PL, bodyH]);

  const rodYs = useMemo(() => {
    if (Array.isArray(mod.rodYs) && mod.rodYs.length > 0) {
      return mod.rodYs.map((yCm) => PL + yCm / 100);
    }
    return mod.rod ? [PL + bodyH * 0.78] : [];
  }, [mod.rod, mod.rodYs, PL, bodyH]);
  const innerW = W - TH * 2;
  const drawerParts = {
    front: mod?.drawerParts?.front !== false,
    back: mod?.drawerParts?.back !== false,
    left: mod?.drawerParts?.left !== false,
    right: mod?.drawerParts?.right !== false,
    bottom: mod?.drawerParts?.bottom !== false,
  };

  return (
    <group position={[x + W / 2, 0, 0]}>
      {/* Back panel (melamine) */}
      {mod.hasBack !== false && (
        <mesh position={[0, PL + bodyH / 2, -D / 2 + 0.01]} material={mats.back} castShadow receiveShadow>
          <boxGeometry args={[W - TH, bodyH, 0.012]} />
        </mesh>
      )}

      {/* Left divider */}
      {isFirst && (
        <mesh position={[-W / 2 + TH / 2, PL + bodyH / 2, 0]} material={mats.wood} castShadow receiveShadow>
          <boxGeometry args={[TH, bodyH, D]} />
        </mesh>
      )}

      {/* Right divider (always drawn — shared wall handled by positioning) */}
      <mesh position={[W / 2 - TH / 2, PL + bodyH / 2, 0]} material={mats.wood} castShadow receiveShadow>
        <boxGeometry args={[TH, bodyH, D]} />
      </mesh>

      {/* Top panel */}
      <mesh position={[0, H - TH / 2, 0]} material={mats.wood} castShadow receiveShadow>
        <boxGeometry args={[W, TH, D]} />
      </mesh>
      {/* Top front edge highlight */}
      <mesh position={[0, H - TH, D / 2 - 0.001]} material={mats.edgeBand}>
        <boxGeometry args={[W, 0.002, 0.001]} />
      </mesh>

      {/* Bottom panel */}
      <mesh position={[0, PL + TH / 2, 0]} material={mats.wood} castShadow receiveShadow>
        <boxGeometry args={[innerW, TH, D]} />
      </mesh>

      {/* Plinth (recessed) */}
      {PL > 0 && (
        <mesh position={[0, PL / 2, D / 2 - 0.025]} material={mats.plinth} castShadow>
          <boxGeometry args={[W - 0.01, PL - 0.004, 0.04]} />
        </mesh>
      )}

      {/* Shelves */}
      {shelves.map((sy, i) => (
        <group key={`sh${i}`}>
          <mesh position={[0, sy, -0.005]} material={mats.interior} castShadow receiveShadow>
            <boxGeometry args={[innerW - 0.004, TH * 0.8, D - 0.015]} />
          </mesh>
          {/* Front edge band */}
          <mesh position={[0, sy, D / 2 - 0.012]} material={mats.edgeBand}>
            <boxGeometry args={[innerW - 0.004, TH * 0.8, 0.001]} />
          </mesh>
        </group>
      ))}

      {/* Rod */}
      {rodYs.map((rodY, idx) => (
        <group key={`rod-${idx}`}>
          <mesh position={[0, rodY, -D * 0.15]} rotation={[0, 0, Math.PI / 2]} material={mats.rod} castShadow>
            <cylinderGeometry args={[0.013, 0.013, innerW - 0.01, 16]} />
          </mesh>
          <RodBracket position={[-innerW / 2 + 0.01, rodY, -D * 0.15]} material={mats.rod} />
          <RodBracket position={[innerW / 2 - 0.01, rodY, -D * 0.15]} material={mats.rod} />
        </group>
      ))}

      {/* Drawers */}
      {drawers.map((d, i) => (
        <group key={`dr${i}`} position={[0, d.y, D / 2 - 0.008]}>
          {drawerParts.front && (
            <>
              <mesh material={mats.drawer} castShadow receiveShadow>
                <boxGeometry args={[innerW - 0.006, d.h, 0.018]} />
              </mesh>
              <mesh position={[0, d.h / 2 - 0.001, 0.01]} material={mats.edgeBand}>
                <boxGeometry args={[innerW - 0.006, 0.001, 0.018]} />
              </mesh>
              <DrawerHandle width={innerW - 0.02} material={mats.handle} />
            </>
          )}
          {drawerParts.left && (
            <mesh position={[-innerW / 2 + 0.006, 0, -0.09]} material={mats.interior} castShadow receiveShadow>
              <boxGeometry args={[0.012, d.h - 0.004, 0.18]} />
            </mesh>
          )}
          {drawerParts.right && (
            <mesh position={[innerW / 2 - 0.006, 0, -0.09]} material={mats.interior} castShadow receiveShadow>
              <boxGeometry args={[0.012, d.h - 0.004, 0.18]} />
            </mesh>
          )}
          {drawerParts.back && (
            <mesh position={[0, 0, -0.18]} material={mats.interior} castShadow receiveShadow>
              <boxGeometry args={[innerW - 0.016, d.h - 0.004, 0.01]} />
            </mesh>
          )}
          {drawerParts.bottom && (
            <mesh position={[0, -d.h / 2 + 0.004, -0.09]} material={mats.interior} castShadow receiveShadow>
              <boxGeometry args={[innerW - 0.016, 0.008, 0.18]} />
            </mesh>
          )}
        </group>
      ))}

      {/* Sliding doors */}
      {!hideFrontDoors && mod.slidingDoors > 0 && (
        <group>
          <mesh position={[0, H - TH - 0.01, D / 2 - 0.01]} material={mats.handle}>
            <boxGeometry args={[W - 0.01, 0.008, 0.01]} />
          </mesh>
          <mesh position={[0, PL + 0.01, D / 2 - 0.01]} material={mats.handle}>
            <boxGeometry args={[W - 0.01, 0.008, 0.01]} />
          </mesh>
          <mesh position={[-W * 0.12, PL + bodyH / 2, D / 2 - 0.02]} material={mats.door} castShadow receiveShadow>
            <boxGeometry args={[W * 0.58, bodyH - 0.02, 0.014]} />
          </mesh>
          <mesh position={[W * 0.12, PL + bodyH / 2, D / 2 - 0.037]} material={mats.door} castShadow receiveShadow>
            <boxGeometry args={[W * 0.58, bodyH - 0.02, 0.014]} />
          </mesh>
        </group>
      )}

      {/* Doors */}
      {!hideFrontDoors && mod.slidingDoors === 0 && mod.doors > 0 && (
        <group>
          {Array.from({ length: Math.min(2, Math.max(1, mod.doors || 1)) }, (_, idx) => {
            const count = Math.min(2, Math.max(1, mod.doors || 1));
            const doorW = (W - 0.01) / count;
            const centerX = -W / 2 + doorW / 2 + idx * doorW;
            const handleX = idx === 0 ? centerX + doorW * 0.38 : centerX - doorW * 0.38;
            return (
              <group key={`door-${idx}`}>
                <mesh position={[centerX, PL + bodyH / 2, D / 2 - 0.003]} material={mats.door} castShadow receiveShadow>
                  <boxGeometry args={[doorW, bodyH - 0.005, 0.018]} />
                </mesh>
                <mesh position={[handleX, PL + bodyH / 2, D / 2 + 0.018]} material={mats.handle} castShadow>
                  <capsuleGeometry args={[0.004, 0.05, 4, 8]} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CABINET GROUP
   ═══════════════════════════════════════════════════════════════ */

function CabinetGroup({ modules, cabinetW, cabinetH, cabinetD, plinthH, thickness, mats, globalSlidingDoors }) {
  const totalW = cabinetW / 100;
  const offsetX = -totalW / 2;

  const positions = useMemo(() => {
    let cursor = 0;
    return modules.map(m => { const x = cursor; cursor += m.width / 100; return x; });
  }, [modules]);

  return (
    <group position={[0, 0, -cabinetD / 100 / 2]}>
      {globalSlidingDoors?.count > 0 && (
        <group>
          <mesh position={[0, cabinetH / 100 - thickness / 100 - 0.01, cabinetD / 100 / 2 - 0.012]} material={mats.handle}>
            <boxGeometry args={[totalW - 0.01, 0.01, 0.012]} />
          </mesh>
          <mesh position={[0, plinthH / 100 + 0.01, cabinetD / 100 / 2 - 0.012]} material={mats.handle}>
            <boxGeometry args={[totalW - 0.01, 0.01, 0.012]} />
          </mesh>
          {Array.from({ length: Math.max(2, Math.min(4, globalSlidingDoors.count || 2)) }, (_, idx) => {
            const panelW = totalW / Math.max(2, Math.min(4, globalSlidingDoors.count || 2)) * 1.22;
            const x = -totalW / 2 + panelW / 2 + idx * (totalW / Math.max(2, Math.min(4, globalSlidingDoors.count || 2)));
            const z = cabinetD / 100 / 2 - 0.025 - (idx % 2) * 0.017;
            const h = Math.max(0.5, (globalSlidingDoors.heightCm || (cabinetH - plinthH)) / 100);
            return (
              <mesh key={`global-slide-${idx}`} position={[x, plinthH / 100 + h / 2, z]} material={mats.door} castShadow receiveShadow>
                <boxGeometry args={[panelW, h, 0.014]} />
              </mesh>
            );
          })}
        </group>
      )}

      {modules.map((mod, i) => (
        <CabinetModule3D
          key={mod.id}
          mod={mod}
          x={offsetX + positions[i]}
          cabinetH={cabinetH}
          cabinetD={cabinetD}
          plinthH={plinthH}
          thickness={thickness}
          mats={mats}
          isFirst={i === 0}
          isLast={i === modules.length - 1}
          hideFrontDoors={Boolean(globalSlidingDoors?.count > 0)}
        />
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   POST-PROCESSING EFFECTS
   ═══════════════════════════════════════════════════════════════ */

function PostEffects() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO
        aoRadius={0.35}
        intensity={2.5}
        distanceFalloff={0.5}
        quality="high"
      />
      <Bloom
        intensity={0.04}
        luminanceThreshold={0.92}
        luminanceSmoothing={0.7}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.1} darkness={0.35} />
    </EffectComposer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENE
   ═══════════════════════════════════════════════════════════════ */

function Scene({ cabinet, modules }) {
  const mats = useMaterials();

  const W  = Number(cabinet.width)     || 0;
  const H  = Number(cabinet.height)    || 0;
  const D  = Number(cabinet.depth)     || 60;
  const TH = Number(cabinet.thickness) || 1.8;
  const PL = Number(cabinet.plinth)    || 0;
  const Hm = H / 100;
  const Wm = W / 100;
  const Dm = D / 100;

  const roomW = Math.max(Wm * 2, 5);
  const roomH = Math.max(Hm + 0.4, 2.7);
  const roomD = Math.max(Dm * 3.5, 3.5);
  const camDistance = Math.max(Wm, Hm) * 1.6;

  return (
    <>
      {/* ── Lighting (3-point + ambient) ── */}
      <ambientLight intensity={0.45} color="#fff5eb" />

      {/* Key light (warm, top-right) */}
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.6}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={25}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-2}
        shadow-bias={-0.00008}
        shadow-normalBias={0.02}
      />

      {/* Fill light (cool, left) */}
      <directionalLight position={[-3, 3.5, 2]} intensity={0.3} color="#e8eeff" />

      {/* Rim / back light */}
      <directionalLight position={[0, 4, -3]} intensity={0.15} color="#ffe8d0" />

      {/* Room ceiling light */}
      <pointLight position={[0, roomH - 0.08, roomD * 0.15]} intensity={0.8} color="#fff5eb" distance={roomH * 3} decay={1.5} />

      {/* Spot focused on cabinet */}
      <spotLight
        position={[0, roomH - 0.1, Dm * 2]}
        angle={0.65}
        penumbra={0.6}
        intensity={0.9}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />

      {/* Subtle warm bounce from floor */}
      <hemisphereLight skyColor="#f0ece6" groundColor="#c8a882" intensity={0.25} />

      {/* Environment reflections */}
      <Environment preset="apartment" />

      {/* Room */}
      <Room roomW={roomW} roomH={roomH} roomD={roomD} mats={mats} />

      {/* Cabinet — against back wall, offset so back panel doesn't clip */}
      <group position={[0, 0, -roomD / 2 + Dm + 0.05]}>
        <CabinetGroup
          modules={modules}
          cabinetW={W}
          cabinetH={H}
          cabinetD={D}
          plinthH={PL}
          thickness={TH}
          mats={mats}
          globalSlidingDoors={cabinet?.globalSlidingDoors || null}
        />
      </group>

      {/* Contact shadow on floor */}
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.5}
        scale={roomW}
        blur={2}
        far={5}
        color="#2a1a0a"
      />

      {/* Post-processing */}
      <PostEffects />

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        target={[0, Hm * 0.45, -roomD / 2 + Dm + 0.05]}
        minDistance={0.4}
        maxDistance={camDistance * 3}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        enablePan
        enableDamping
        dampingFactor={0.06}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════ */

export default function ProfessionalRealisticViewer({ cabinet, name }) {
  if (!cabinet || !cabinet.width || !cabinet.height) {
    return (
      <div className="w-full h-[700px] flex items-center justify-center bg-gray-100 rounded-2xl text-gray-400 text-base">
        Aucune donnée de meuble disponible
      </div>
    );
  }

  const modules = useMemo(() => normalizeModules(cabinet), [cabinet]);
  const W  = Number(cabinet.width)  || 0;
  const H  = Number(cabinet.height) || 0;
  const D  = Number(cabinet.depth)  || 60;
  const Hm = H / 100;
  const Wm = W / 100;
  const camDist = Math.max(Wm, Hm) * 1.6;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl" style={{ height: 750 }} onWheel={e => e.stopPropagation()}>
      <Canvas
        shadows
        camera={{
          position: [camDist * 0.35, Hm * 0.5, camDist * 1.1],
          fov: 40,
          near: 0.01,
          far: 100,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Scene cabinet={cabinet} name={name} modules={modules} />
        </Suspense>
      </Canvas>

      {/* UI Overlays */}
      <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl shadow-md border border-gray-100">
        <div className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          🌟 Vue Réaliste — {name || 'Meuble'} ({modules.length} modules)
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {W} × {H} × {D} cm • Tourner / zoomer avec la souris
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-20 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-gray-100 text-xs text-gray-500">
        🖱️ Clic gauche : tourner • Molette : zoom • Clic droit : déplacer
      </div>

      <div className="absolute bottom-4 left-4 z-20 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-gray-100 text-xs text-gray-500">
        Total: {(W / 100).toFixed(2)} m linéaires
      </div>
    </div>
  );
}
