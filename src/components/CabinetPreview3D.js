import { useMemo, useRef } from 'react';

const clampPositive = (value) => Math.max(0, Number(value) || 0);
const f1 = (value) => Number(value || 0).toFixed(1);

const projectIso = (x, y, z, originX, originY, scale, depthTilt) => {
  const sx = originX + (x - z) * scale;
  const sy = originY - y * scale + (x + z) * depthTilt;
  return [sx, sy];
};

const pointsToSvg = (points) => points.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');

export default function CabinetPreview3D({ model, onSave }) {
  const svgRef = useRef(null);

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
        dimensions: { width: view.width, height: view.height, depth: view.depth },
      },
    });
  };

  const handleDownloadSvg = () => {
    if (!svgRef.current || !view) return;
    const svgData = svgRef.current.outerHTML;
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-3d-${view.width}x${view.height}x${view.depth}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!view) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
      <svg ref={svgRef} viewBox="0 0 560 340" className="w-full rounded-lg bg-slate-900/80">
        <defs>
          <linearGradient id="cab-top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="cab-side" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="cab-front" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>

        <ellipse
          cx={f1(view.shadowCenter[0])}
          cy={f1(view.shadowCenter[1] + 30)}
          rx={f1(view.shadowRx)}
          ry={f1(view.shadowRy)}
          fill="#020617"
          opacity="0.55"
        />

        <polygon points={pointsToSvg(view.bottomFace)} fill="#0f172a" opacity="0.6" />
        <polygon points={pointsToSvg(view.leftFace)} fill="#1e293b" opacity="0.75" />
        <polygon points={pointsToSvg(view.topFace)} fill="url(#cab-top)" opacity="0.95" />
        <polygon points={pointsToSvg(view.sideFace)} fill="url(#cab-side)" opacity="0.95" />
        <polygon points={pointsToSvg(view.frontFace)} fill="url(#cab-front)" opacity="0.95" />

        {view.separators.map((separator, index) => (
          <g key={`sep-${index}`}>
            <polygon points={pointsToSvg(separator.top)} fill="#f97316" opacity="0.45" />
            <polygon points={pointsToSvg(separator.front)} fill="#fb923c" opacity="0.7" />
          </g>
        ))}

        {view.edges.map((line, index) => (
          <line
            key={`edge-${index}`}
            x1={f1(line[0][0])}
            y1={f1(line[0][1])}
            x2={f1(line[1][0])}
            y2={f1(line[1][1])}
            stroke="#cbd5e1"
            strokeWidth="1.4"
          />
        ))}
      </svg>

      {onSave && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-500"
          >
            Sauvegarder le plan
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-800"
          >
            ↓ SVG
          </button>
        </div>
      )}

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
