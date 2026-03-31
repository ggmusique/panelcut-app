import { useMemo, useRef } from 'react';

const clampPositive = (value) => Math.max(0, Number(value) || 0);
const f1 = (value) => Number(value || 0).toFixed(1);

const projectIso = (x, y, z, originX, originY, scale, depthTilt) => {
  const sx = originX + (x - z) * scale;
  const sy = originY - y * scale + (x + z) * depthTilt;
  return [sx, sy];
};

const pointsToSvg = (points) =>
  points.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');

export default function CabinetPreview3D({ model, onSave }) {
  const svgRef = useRef(null);

  const view = useMemo(() => {
    if (!model) return null;

    const width = clampPositive(model?.dimensions?.width);
    const height = clampPositive(model?.dimensions?.height);
    const depth = clampPositive(model?.dimensions?.depth);
    const panelThickness = clampPositive(model?.material?.panelThickness);
    const modules = Array.isArray(model?.structure?.modules)
      ? model.structure.modules
      : [];

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
      const moduleWidth =
        typeof mod === 'number' ? mod : clampPositive(mod?.width || mod);

      cursor += moduleWidth;

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
      leftFace: [p000, p00D, p0HD, p0H0],
      bottomFace: [p000, pW00, pW0D, p00D],
      shadowCenter: projectIso(width / 2, 0, depth / 2, originX, originY, scale, depthTilt),
      shadowRx: Math.max(60, (width + depth) * scale * 0.42),
      shadowRy: Math.max(18, (width + depth) * scale * 0.1),
      edges: [
        [p000, pW00],
        [pW00, pWH0],
        [pWH0, p0H0],
        [p0H0, p000],
        [pW00, pW0D],
        [pW0D, pWHD],
        [pWHD, pWH0],
        [p000, p00D],
        [p00D, p0HD],
        [p0HD, p0H0],
      ],
      separators,
    };
  }, [model]);

  const handleSave = () => {
    if (!onSave || !svgRef.current || !view) return;
    onSave({
      svgData: svgRef.current.outerHTML,
      title: `Vue 3D ${view.width}x${view.height}x${view.depth}`,
      type: '3d',
      metadata: {
        dimensions: view,
      },
    });
  };

  if (!view) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
      <svg ref={svgRef} viewBox="0 0 560 340" className="w-full rounded-lg bg-slate-900/80">
        <defs>
          <linearGradient id="cab-top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          <linearGradient id="cab-side" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient id="cab-front" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#cbd5f5" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>

        {/* Ombre améliorée */}
        <ellipse
          cx={f1(view.shadowCenter[0])}
          cy={f1(view.shadowCenter[1] + 40)}
          rx={f1(view.shadowRx)}
          ry={f1(view.shadowRy)}
          fill="#000000"
          opacity="0.25"
        />

        {/* Faces */}
        <polygon points={pointsToSvg(view.bottomFace)} fill="#0f172a" opacity="0.4" />
        <polygon points={pointsToSvg(view.leftFace)} fill="#1e293b" opacity="0.6" />
        <polygon points={pointsToSvg(view.topFace)} fill="url(#cab-top)" opacity="1" />
        <polygon points={pointsToSvg(view.sideFace)} fill="url(#cab-side)" opacity="0.85" />
        <polygon points={pointsToSvg(view.frontFace)} fill="url(#cab-front)" opacity="0.92" />

        {/* Séparateurs */}
        {view.separators.map((separator, index) => (
          <g key={index}>
            <polygon points={pointsToSvg(separator.top)} fill="#fb923c" opacity="0.25" />
            <polygon points={pointsToSvg(separator.front)} fill="#f59e0b" opacity="0.5" />
          </g>
        ))}

        {/* Edges plus subtils */}
        {view.edges.map((line, index) => (
          <line
            key={index}
            x1={f1(line[0][0])}
            y1={f1(line[0][1])}
            x2={f1(line[1][0])}
            y2={f1(line[1][1])}
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.6"
          />
        ))}

        {/* Outline léger */}
        <polygon
          points={pointsToSvg(view.frontFace)}
          fill="none"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
      </svg>

      {onSave && (
        <button
          onClick={handleSave}
          className="mt-3 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-500"
        >
          💾 Sauvegarder
        </button>
      )}
    </div>
  );
}
