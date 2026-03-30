import { useMemo } from 'react';

const clampPositive = (value) => Math.max(0, Number(value) || 0);

const projectIso = (x, y, z, originX, originY, scale, depthTilt) => {
  const sx = originX + (x - z) * scale;
  const sy = originY - y * scale + (x + z) * depthTilt;
  return [sx, sy];
};

const pointsToSvg = (points) => points.map(([x, y]) => `${x},${y}`).join(' ');

export default function CabinetPreview3D({ model }) {
  const view = useMemo(() => {
    if (!model) return null;

    const width = clampPositive(model?.dimensions?.width);
    const height = clampPositive(model?.dimensions?.height);
    const depth = clampPositive(model?.dimensions?.depth);
    const panelThickness = clampPositive(model?.material?.panelThickness);
    const modules = Array.isArray(model?.structure?.modules) ? model.structure.modules : [];

    const maxDim = Math.max(width, height, depth, 1);
    const scale = 240 / maxDim;
    const depthTilt = scale * 0.35;
    const originX = 290;
    const originY = 260;

    const p000 = projectIso(0, 0, 0, originX, originY, scale, depthTilt);
    const pW00 = projectIso(width, 0, 0, originX, originY, scale, depthTilt);
    const p0H0 = projectIso(0, height, 0, originX, originY, scale, depthTilt);
    const pWH0 = projectIso(width, height, 0, originX, originY, scale, depthTilt);
    const p00D = projectIso(0, 0, depth, originX, originY, scale, depthTilt);
    const pW0D = projectIso(width, 0, depth, originX, originY, scale, depthTilt);
    const p0HD = projectIso(0, height, depth, originX, originY, scale, depthTilt);
    const pWHD = projectIso(width, height, depth, originX, originY, scale, depthTilt);

    const separators = [];
    let cursor = panelThickness;
    modules.slice(0, -1).forEach((mod) => {
      const moduleWidth = typeof mod === 'number' ? mod : clampPositive(mod?.width || mod);
      cursor += clampPositive(moduleWidth);
      const xStart = cursor;
      const xEnd = xStart + panelThickness;
      separators.push({
        front: [
          projectIso(xStart, panelThickness, 0, originX, originY, scale, depthTilt),
          projectIso(xEnd, panelThickness, 0, originX, originY, scale, depthTilt),
          projectIso(xEnd, height - panelThickness, 0, originX, originY, scale, depthTilt),
          projectIso(xStart, height - panelThickness, 0, originX, originY, scale, depthTilt),
        ],
        top: [
          projectIso(xStart, height - panelThickness, 0, originX, originY, scale, depthTilt),
          projectIso(xEnd, height - panelThickness, 0, originX, originY, scale, depthTilt),
          projectIso(xEnd, height - panelThickness, depth, originX, originY, scale, depthTilt),
          projectIso(xStart, height - panelThickness, depth, originX, originY, scale, depthTilt),
        ],
      });
      cursor += panelThickness;
    });

    return {
      width,
      height,
      depth,
      frontFace: [p000, pW00, pWH0, p0H0],
      sideFace: [pW00, pW0D, pWHD, pWH0],
      topFace: [p0H0, pWH0, pWHD, p0HD],
      edges: [
        [p000, p00D],
        [p00D, pW0D],
        [pW0D, pWHD],
        [p0HD, pWHD],
        [p00D, p0HD],
      ],
      separators,
    };
  }, [model]);

  if (!view) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
      <svg viewBox="0 0 560 340" className="w-full rounded-lg bg-slate-900/80">
        <polygon points={pointsToSvg(view.topFace)} fill="#334155" opacity="0.95" />
        <polygon points={pointsToSvg(view.sideFace)} fill="#475569" opacity="0.95" />
        <polygon points={pointsToSvg(view.frontFace)} fill="#64748b" opacity="0.95" />

        {view.separators.map((separator, index) => (
          <g key={`sep-${index}`}>
            <polygon points={pointsToSvg(separator.top)} fill="#f97316" opacity="0.45" />
            <polygon points={pointsToSvg(separator.front)} fill="#fb923c" opacity="0.7" />
          </g>
        ))}

        {view.edges.map((line, index) => (
          <line
            key={`edge-${index}`}
            x1={line[0][0]}
            y1={line[0][1]}
            x2={line[1][0]}
            y2={line[1][1]}
            stroke="#cbd5e1"
            strokeWidth="1.4"
          />
        ))}
      </svg>

      <svg viewBox="0 0 560 120" className="mt-3 w-full rounded-lg bg-slate-900/80">
        <line x1="60" y1="35" x2="500" y2="35" stroke="#f59e0b" strokeWidth="2" />
        <line x1="60" y1="28" x2="60" y2="42" stroke="#f59e0b" strokeWidth="2" />
        <line x1="500" y1="28" x2="500" y2="42" stroke="#f59e0b" strokeWidth="2" />
        <text x="280" y="27" fill="#f8fafc" fontSize="13" textAnchor="middle">Largeur: {view.width} cm</text>

        <line x1="60" y1="55" x2="60" y2="105" stroke="#22c55e" strokeWidth="2" />
        <line x1="53" y1="55" x2="67" y2="55" stroke="#22c55e" strokeWidth="2" />
        <line x1="53" y1="105" x2="67" y2="105" stroke="#22c55e" strokeWidth="2" />
        <text x="80" y="83" fill="#f8fafc" fontSize="13">Hauteur: {view.height} cm</text>

        <line x1="500" y1="55" x2="525" y2="45" stroke="#38bdf8" strokeWidth="2" />
        <line x1="500" y1="105" x2="525" y2="95" stroke="#38bdf8" strokeWidth="2" />
        <line x1="525" y1="45" x2="525" y2="95" stroke="#38bdf8" strokeWidth="2" />
        <text x="540" y="74" fill="#f8fafc" fontSize="13" textAnchor="end">Profondeur: {view.depth} cm</text>
      </svg>
    </div>
  );
}
