import { useMemo } from 'react';

const mm = (cmValue) => Math.round((Number(cmValue) || 0) * 10);

const readNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toModule = (entry, fallbackHeight, fallbackDepth) => {
  if (typeof entry === 'number') {
    return { width: readNumber(entry), height: fallbackHeight, depth: fallbackDepth, shelves: 0, type: 'module' };
  }

  return {
    width: readNumber(entry?.width),
    height: readNumber(entry?.height, fallbackHeight),
    depth: readNumber(entry?.depth, fallbackDepth),
    shelves: Math.max(0, Math.round(readNumber(entry?.shelves, 0))),
    type: entry?.type || 'module',
  };
};

function DimArrow({ x, y, dir }) {
  const s = 4;
  if (dir === 'l') return <polyline points={`${x + s},${y - s} ${x},${y} ${x + s},${y + s}`} fill="none" stroke="currentColor" strokeWidth="1.2" />;
  if (dir === 'r') return <polyline points={`${x - s},${y - s} ${x},${y} ${x - s},${y + s}`} fill="none" stroke="currentColor" strokeWidth="1.2" />;
  if (dir === 'u') return <polyline points={`${x - s},${y + s} ${x},${y} ${x + s},${y + s}`} fill="none" stroke="currentColor" strokeWidth="1.2" />;
  return <polyline points={`${x - s},${y - s} ${x},${y} ${x + s},${y - s}`} fill="none" stroke="currentColor" strokeWidth="1.2" />;
}

function HorizontalDim({ x1, x2, y, label }) {
  return (
    <g style={{ color: '#1e293b' }}>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="currentColor" strokeWidth="1.2" />
      <DimArrow x={x1} y={y} dir="r" />
      <DimArrow x={x2} y={y} dir="l" />
      <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="currentColor">{label}</text>
    </g>
  );
}

function VerticalDim({ x, y1, y2, label }) {
  return (
    <g style={{ color: '#1e293b' }}>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="currentColor" strokeWidth="1.2" />
      <DimArrow x={x} y={y1} dir="d" />
      <DimArrow x={x} y={y2} dir="u" />
      <text x={x + 7} y={(y1 + y2) / 2} fontSize="10" fill="currentColor">{label}</text>
    </g>
  );
}

export default function CabinetPlan2D({ model }) {
  const view = useMemo(() => {
    if (!model) return null;

    const widthCm = readNumber(model?.dimensions?.width, readNumber(model?.width));
    const heightCm = readNumber(model?.dimensions?.height, readNumber(model?.height));
    const depthCm = readNumber(model?.dimensions?.depth, readNumber(model?.depth));
    const plinthCm = readNumber(model?.dimensions?.plinth, readNumber(model?.plinth));
    const thicknessCm = readNumber(model?.material?.panelThickness, readNumber(model?.thickness, 1.8));

    const rawModules = model?.modules ?? model?.structure?.modules ?? [];
    const fallbackInternalHeight = readNumber(model?.structure?.usefulHeight, Math.max(0, heightCm - plinthCm - 2 * thicknessCm));
    const modules = Array.isArray(rawModules)
      ? rawModules.map((entry) => toModule(entry, fallbackInternalHeight, depthCm)).filter((entry) => entry.width > 0)
      : [];

    if (widthCm <= 0 || heightCm <= 0) return null;

    const scale = 360 / Math.max(widthCm, heightCm, 1);
    const originX = 90;
    const originY = 300;
    const w = widthCm * scale;
    const h = heightCm * scale;
    const t = Math.max(1.2, thicknessCm * scale);
    const svgW = Math.max(680, originX + w + 210);
    const svgH = Math.max(420, originY + 90);
    const title = model?.name || 'Meuble';
    const internalHeight = Math.max(0, heightCm - plinthCm - thicknessCm * 2);

    return { widthCm, heightCm, depthCm, plinthCm, thicknessCm, modules, scale, originX, originY, w, h, t, svgW, svgH, title, internalHeight };
  }, [model]);

  if (!view) return null;

  let moduleCursorCm = view.t / view.scale;

  return (
    <div className="rounded-xl border border-slate-400 bg-white p-3 text-slate-900 shadow-sm">
      <svg viewBox={`0 0 ${view.svgW} ${view.svgH}`} className="w-full cabinet-plan-svg" role="img" aria-label="Plan atelier 2D coté du meuble">
        <text x={view.originX} y={24} fontSize="12" fontWeight="700">Plan atelier — vue de face</text>
        <text x={view.originX} y={40} fontSize="9" fill="#64748b">Façade cotée avec modules et dimensions utiles</text>

        <rect
          x={view.originX}
          y={view.originY - view.h}
          width={view.w}
          height={view.h}
          fill="none"
          stroke="#0f172a"
          strokeWidth="2"
        />

        <line x1={view.originX + view.t} y1={view.originY - view.h} x2={view.originX + view.t} y2={view.originY} stroke="#475569" strokeWidth="1.2" />
        <line x1={view.originX + view.w - view.t} y1={view.originY - view.h} x2={view.originX + view.w - view.t} y2={view.originY} stroke="#475569" strokeWidth="1.2" />
        <line x1={view.originX} y1={view.originY - view.h + view.t} x2={view.originX + view.w} y2={view.originY - view.h + view.t} stroke="#475569" strokeWidth="1.2" />
        <line x1={view.originX} y1={view.originY - view.t} x2={view.originX + view.w} y2={view.originY - view.t} stroke="#475569" strokeWidth="1.2" />

        {view.modules.slice(0, -1).map((module, index) => {
          moduleCursorCm += module.width;
          const x = view.originX + moduleCursorCm * view.scale;
          moduleCursorCm += view.t / view.scale;
          return (
            <line
              key={`sep-${index}`}
              x1={x}
              y1={view.originY - view.h + view.t}
              x2={x}
              y2={view.originY - view.t}
              stroke="#0f172a"
              strokeWidth="1.2"
            />
          );
        })}

        {view.modules.map((module, index) => {
          if (!module.shelves) return null;
          const shelfAreaHeight = Math.max(0, module.height - (view.t / view.scale) * 2) * view.scale;
          const gap = shelfAreaHeight / (module.shelves + 1);

          const startCm = view.modules.slice(0, index).reduce((sum, m) => sum + m.width, 0) + index * (view.t / view.scale);
          const xStart = view.originX + view.t + startCm * view.scale;
          const xEnd = xStart + module.width * view.scale;

          return Array.from({ length: module.shelves }).map((_, shelfIndex) => {
            const y = view.originY - view.t - gap * (shelfIndex + 1);
            return <line key={`shelf-${index}-${shelfIndex}`} x1={xStart} y1={y} x2={xEnd} y2={y} stroke="#64748b" strokeWidth="1" />;
          });
        })}

        <HorizontalDim x1={view.originX} x2={view.originX + view.w} y={view.originY + 26} label={`Largeur totale ${mm(view.widthCm)} mm`} />
        <VerticalDim x={view.originX - 26} y1={view.originY - view.h} y2={view.originY} label={`Hauteur totale ${mm(view.heightCm)} mm`} />
        <VerticalDim x={view.originX + view.w + 30} y1={view.originY - view.h + view.t} y2={view.originY - view.t} label={`Hauteur utile ${mm(view.internalHeight)} mm`} />
        <HorizontalDim x1={view.originX + view.w + 20} x2={view.originX + view.w + 20 + view.depthCm * view.scale * 0.6} y={view.originY - view.h + 36} label={`Prof. ${mm(view.depthCm)} mm`} />

        {(() => {
          let cursor = view.originX + view.t;
          return view.modules.map((module, index) => {
            const w = module.width * view.scale;
            const x1 = cursor;
            const x2 = cursor + w;
            cursor = x2 + view.t;

            return (
              <HorizontalDim
                key={`mod-dim-${index}`}
                x1={x1}
                x2={x2}
                y={view.originY - view.h - 16 - index * 13}
                label={`Module ${index + 1} ${mm(module.width)} mm`}
              />
            );
          });
        })()}

        <rect x={view.svgW - 185} y={view.svgH - 64} width={170} height={48} fill="#f8fafc" stroke="#0f172a" strokeWidth="1" />
        <line x1={view.svgW - 185} y1={view.svgH - 46} x2={view.svgW - 15} y2={view.svgH - 46} stroke="#0f172a" strokeWidth="1" />
        <line x1={view.svgW - 120} y1={view.svgH - 64} x2={view.svgW - 120} y2={view.svgH - 16} stroke="#0f172a" strokeWidth="1" />
        <text x={view.svgW - 177} y={view.svgH - 52} fontSize="8" fill="#64748b">PROJET</text>
        <text x={view.svgW - 177} y={view.svgH - 33} fontSize="10" fontWeight="700" fill="#0f172a">{view.title}</text>
        <text x={view.svgW - 112} y={view.svgH - 52} fontSize="8" fill="#64748b">ÉCHELLE</text>
        <text x={view.svgW - 112} y={view.svgH - 33} fontSize="10" fontWeight="700" fill="#0f172a">1:{Math.max(1, Math.round(100 / view.scale))}</text>
        <text x={view.svgW - 70} y={view.svgH - 52} fontSize="8" fill="#64748b">DATE</text>
        <text x={view.svgW - 70} y={view.svgH - 33} fontSize="9" fontWeight="700" fill="#0f172a">{new Date().toLocaleDateString('fr-FR')}</text>
      </svg>
    </div>
  );
}
