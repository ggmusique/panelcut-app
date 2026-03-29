import { useMemo } from 'react';

const toMmLabel = (cm) => `${Math.round((Number(cm) || 0) * 10)} mm`;

function Arrow({ x, y, direction = 'left' }) {
  const size = 5;
  if (direction === 'left') {
    return <polyline points={`${x + size},${y - size} ${x},${y} ${x + size},${y + size}`} fill="none" stroke="currentColor" strokeWidth="1.5" />;
  }
  if (direction === 'right') {
    return <polyline points={`${x - size},${y - size} ${x},${y} ${x - size},${y + size}`} fill="none" stroke="currentColor" strokeWidth="1.5" />;
  }
  if (direction === 'up') {
    return <polyline points={`${x - size},${y + size} ${x},${y} ${x + size},${y + size}`} fill="none" stroke="currentColor" strokeWidth="1.5" />;
  }
  return <polyline points={`${x - size},${y - size} ${x},${y} ${x + size},${y - size}`} fill="none" stroke="currentColor" strokeWidth="1.5" />;
}

function HorizontalDimension({ x1, x2, y, label, color = '#0f172a' }) {
  return (
    <g style={{ color }}>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="currentColor" strokeWidth="1.5" />
      <Arrow x={x1} y={y} direction="right" />
      <Arrow x={x2} y={y} direction="left" />
      <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="currentColor">{label}</text>
    </g>
  );
}

function VerticalDimension({ x, y1, y2, label, color = '#0f172a' }) {
  return (
    <g style={{ color }}>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="currentColor" strokeWidth="1.5" />
      <Arrow x={x} y={y1} direction="down" />
      <Arrow x={x} y={y2} direction="up" />
      <text x={x + 8} y={(y1 + y2) / 2} fontSize="11" fill="currentColor">{label}</text>
    </g>
  );
}

export default function CabinetPlan2D({ model }) {
  const drawing = useMemo(() => {
    if (!model) return null;

    const width = Number(model?.dimensions?.width) || 0;
    const height = Number(model?.dimensions?.height) || 0;
    const depth = Number(model?.dimensions?.depth) || 0;
    const panelThickness = Number(model?.material?.panelThickness) || 0;
    const backThickness = Number(model?.material?.backThickness) || 0;
    const internalHeight = Number(model?.structure?.usefulHeight) || 0;
    const modules = Array.isArray(model?.structure?.modules) ? model.structure.modules : [];

    const maxForScale = Math.max(width, height, depth, 1);
    const scale = 180 / maxForScale;

    const front = {
      originX: 70,
      originY: 280,
      w: width * scale,
      h: height * scale,
      t: panelThickness * scale,
    };

    const side = {
      originX: 510,
      originY: 280,
      w: depth * scale,
      h: height * scale,
      t: panelThickness * scale,
      bt: backThickness * scale,
    };

    return {
      width,
      height,
      depth,
      panelThickness,
      backThickness,
      internalHeight,
      modules,
      scale,
      front,
      side,
    };
  }, [model]);

  if (!drawing) return null;

  const { front, side } = drawing;

  return (
    <div className="rounded-xl border border-slate-400 bg-white p-3 text-slate-900">
      <svg viewBox="0 0 860 360" className="w-full" role="img" aria-label="Plan technique du meuble">
        {/* FRONT VIEW (orthographic): true width x height rectangle */}
        <text x={front.originX} y={25} fontSize="12" fontWeight="700">Vue de face (L × H)</text>
        <rect
          x={front.originX}
          y={front.originY - front.h}
          width={front.w}
          height={front.h}
          fill="none"
          stroke="#0f172a"
          strokeWidth="2"
        />

        {/* Side panels + top/bottom panel thickness from model source of truth */}
        <line x1={front.originX + front.t} y1={front.originY - front.h} x2={front.originX + front.t} y2={front.originY} stroke="#475569" strokeWidth="1.5" />
        <line x1={front.originX + front.w - front.t} y1={front.originY - front.h} x2={front.originX + front.w - front.t} y2={front.originY} stroke="#475569" strokeWidth="1.5" />
        <line x1={front.originX} y1={front.originY - front.h + front.t} x2={front.originX + front.w} y2={front.originY - front.h + front.t} stroke="#475569" strokeWidth="1.5" />
        <line x1={front.originX} y1={front.originY - front.t} x2={front.originX + front.w} y2={front.originY - front.t} stroke="#475569" strokeWidth="1.5" />

        {/* Internal vertical separators from module widths without recalculation */}
        {(() => {
          let cursorCm = drawing.panelThickness;
          return drawing.modules.slice(0, -1).map((moduleWidth, index) => {
            cursorCm += Number(moduleWidth) || 0;
            const x = front.originX + cursorCm * drawing.scale;
            cursorCm += drawing.panelThickness;
            return <line key={`front-sep-${index}`} x1={x} y1={front.originY - front.h + front.t} x2={x} y2={front.originY - front.t} stroke="#0f172a" strokeWidth="1.2" />;
          });
        })()}

        {/* Global front dimensions in mm */}
        <HorizontalDimension x1={front.originX} x2={front.originX + front.w} y={front.originY + 26} label={`Largeur totale ${toMmLabel(drawing.width)}`} />
        <VerticalDimension x={front.originX - 28} y1={front.originY - front.h} y2={front.originY} label={`Hauteur totale ${toMmLabel(drawing.height)}`} />

        {/* Module widths chain dimensions in mm */}
        {(() => {
          let xCursor = front.originX + front.t;
          return drawing.modules.map((moduleWidth, index) => {
            const span = (Number(moduleWidth) || 0) * drawing.scale;
            const start = xCursor;
            const end = xCursor + span;
            xCursor = end + front.t;
            return (
              <HorizontalDimension
                key={`module-dim-${index}`}
                x1={start}
                x2={end}
                y={front.originY - front.h - 20 - index * 14}
                label={`M${index + 1} ${toMmLabel(moduleWidth)}`}
                color="#1d4ed8"
              />
            );
          });
        })()}

        {/* Internal useful height (same for each module in this model) */}
        <VerticalDimension
          x={front.originX + front.w + 22}
          y1={front.originY - front.h + front.t}
          y2={front.originY - front.t}
          label={`Hauteur int. ${toMmLabel(drawing.internalHeight)}`}
          color="#1d4ed8"
        />

        {/* SIDE VIEW (orthographic): true depth x height rectangle */}
        <text x={side.originX} y={25} fontSize="12" fontWeight="700">Vue de côté (P × H)</text>
        <rect
          x={side.originX}
          y={side.originY - side.h}
          width={side.w}
          height={side.h}
          fill="none"
          stroke="#0f172a"
          strokeWidth="2"
        />

        {/* Top/bottom thickness and back panel thickness from model material */}
        <line x1={side.originX} y1={side.originY - side.h + side.t} x2={side.originX + side.w} y2={side.originY - side.h + side.t} stroke="#475569" strokeWidth="1.5" />
        <line x1={side.originX} y1={side.originY - side.t} x2={side.originX + side.w} y2={side.originY - side.t} stroke="#475569" strokeWidth="1.5" />
        <line x1={side.originX + side.w - side.bt} y1={side.originY - side.h} x2={side.originX + side.w - side.bt} y2={side.originY} stroke="#475569" strokeWidth="1.5" />

        <HorizontalDimension x1={side.originX} x2={side.originX + side.w} y={side.originY + 26} label={`Profondeur totale ${toMmLabel(drawing.depth)}`} />
        <VerticalDimension x={side.originX - 28} y1={side.originY - side.h} y2={side.originY} label={`Hauteur totale ${toMmLabel(drawing.height)}`} />

        {/* Explicit panel thickness dimensions in mm */}
        <HorizontalDimension
          x1={side.originX + side.w - side.bt}
          x2={side.originX + side.w}
          y={side.originY - side.h - 18}
          label={`Fond ${toMmLabel(drawing.backThickness)}`}
          color="#b45309"
        />
        <VerticalDimension
          x={side.originX + side.w + 22}
          y1={side.originY - side.h}
          y2={side.originY - side.h + side.t}
          label={`Dessus ${toMmLabel(drawing.panelThickness)}`}
          color="#b45309"
        />
        <VerticalDimension
          x={side.originX + side.w + 54}
          y1={side.originY - side.t}
          y2={side.originY}
          label={`Dessous ${toMmLabel(drawing.panelThickness)}`}
          color="#b45309"
        />
      </svg>
    </div>
  );
}
