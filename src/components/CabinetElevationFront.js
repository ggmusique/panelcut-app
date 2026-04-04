import React from 'react';

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalizeModules(cabinet) {
  const raw = Array.isArray(cabinet?.modules) ? cabinet.modules : [];
  const detailed = raw.filter(m => typeof m === 'object' && m !== null);

  if (detailed.length > 0) {
    return detailed.map((m, i) => ({
      id: i + 1,
      width: Math.max(0, toNum(m.width ?? m.w ?? m.largeur, 0)),
      shelves: Math.max(0, parseInt(m.shelves ?? m.nb_shelves ?? 0, 10) || 0),
      drawers: Math.max(0, parseInt(m.drawers ?? m.nb_drawers ?? 0, 10) || 0),
      doors: Math.max(0, parseInt(m.doors ?? m.nb_doors ?? 0, 10) || 0),
      rod: Boolean(m.rod ?? m.tringle ?? m.hanging ?? m.penderie ?? false),
    })).filter(m => m.width > 0);
  }

  const W = Math.max(0, toNum(cabinet?.width, 0));
  const nb = Math.max(1, parseInt(cabinet?.nb_dividers ?? 4, 10) + 1);
  const mw = W > 0 ? W / nb : 0;
  return Array.from({ length: nb }, (_, i) => ({
    id: i + 1,
    width: mw,
    shelves: Math.max(0, parseInt(cabinet?.nb_shelves ?? 0, 10) || 0),
    drawers: Math.max(0, parseInt(cabinet?.nb_drawers ?? 0, 10) || 0),
    doors: 1,
    rod: false,
  }));
}

function DimH({ x1, x2, y, label }) {
  const m = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#c2410c" strokeWidth="1" markerStart="url(#arrL)" markerEnd="url(#arrR)" />
      <line x1={x1} y1={y - 5} x2={x1} y2={y + 5} stroke="#c2410c" strokeWidth="1" />
      <line x1={x2} y1={y - 5} x2={x2} y2={y + 5} stroke="#c2410c" strokeWidth="1" />
      <text x={m} y={y - 7} textAnchor="middle" fontSize="11" fill="#b45309" fontWeight="700">{label}</text>
    </g>
  );
}

function DimV({ x, y1, y2, label }) {
  const m = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="#c2410c" strokeWidth="1" markerStart="url(#arrU)" markerEnd="url(#arrD)" />
      <line x1={x - 5} y1={y1} x2={x + 5} y2={y1} stroke="#c2410c" strokeWidth="1" />
      <line x1={x - 5} y1={y2} x2={x + 5} y2={y2} stroke="#c2410c" strokeWidth="1" />
      <text x={x + 14} y={m} transform={`rotate(90 ${x + 14} ${m})`} textAnchor="middle" fontSize="11" fill="#b45309" fontWeight="700">{label}</text>
    </g>
  );
}

export default function CabinetElevationFront({ cabinet, name = 'Meuble' }) {
  if (!cabinet?.width || !cabinet?.height) {
    return <div className="text-center py-8 text-slate-500">Dimensions indisponibles.</div>;
  }

  const modules = normalizeModules(cabinet);
  const W = toNum(cabinet.width, 0);
  const H = toNum(cabinet.height, 0);
  const PL = Math.max(0, toNum(cabinet.plinth, 0));
  const PAD = 56;
  const DRAW_W = 860;
  const DRAW_H = 430;
  const sx = DRAW_W / Math.max(1, W);
  const sy = DRAW_H / Math.max(1, H);

  const ox = PAD;
  const oy = PAD + 30;

  let cursor = 0;
  const moduleRects = modules.map((m) => {
    const x = ox + cursor * sx;
    const w = m.width * sx;
    cursor += m.width;
    return { ...m, x, w };
  });

  const svgW = PAD * 2 + DRAW_W + 30;
  const svgH = PAD * 2 + DRAW_H + 120;

  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600/20 to-blue-600/20 rounded-xl blur-lg" />
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="relative w-full h-auto bg-white rounded-xl border border-slate-200 shadow-xl">
        <defs>
          <marker id="arrR" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0L6 3L0 6Z" fill="#c2410c" />
          </marker>
          <marker id="arrL" viewBox="0 0 6 6" refX="1" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M6 0L0 3L6 6Z" fill="#c2410c" />
          </marker>
          <marker id="arrU" viewBox="0 0 6 6" refX="3" refY="1" markerWidth="6" markerHeight="6" orient="270">
            <path d="M0 0L6 3L0 6Z" fill="#c2410c" />
          </marker>
          <marker id="arrD" viewBox="0 0 6 6" refX="3" refY="5" markerWidth="6" markerHeight="6" orient="90">
            <path d="M0 0L6 3L0 6Z" fill="#c2410c" />
          </marker>
        </defs>

        <text x={svgW / 2} y={26} textAnchor="middle" fontSize="15" fontWeight="700" fill="#334155">
          Élévation façade — {(name || 'MEUBLE').toUpperCase()}
        </text>

        <rect x={ox} y={oy} width={DRAW_W} height={DRAW_H} fill="#f8fafc" stroke="#475569" strokeWidth="2" />

        {moduleRects.map((m, idx) => {
          const yBottom = oy + DRAW_H;
          const top = oy;
          const usefulTop = oy;
          const usefulBottom = yBottom - PL * sy;

          return (
            <g key={idx}>
              <rect x={m.x} y={top} width={m.w} height={DRAW_H} fill="none" stroke="#64748b" strokeWidth="1" />

              {m.doors > 0 && (
                <rect
                  x={m.x + 6}
                  y={usefulTop + 6}
                  width={Math.max(8, m.w - 12)}
                  height={Math.max(8, usefulBottom - usefulTop - 12)}
                  fill="rgba(59,130,246,0.05)"
                  stroke="#2563eb"
                  strokeWidth="1.4"
                />
              )}

              {m.rod && (
                <line
                  x1={m.x + m.w * 0.12}
                  y1={usefulTop + (usefulBottom - usefulTop) * 0.2}
                  x2={m.x + m.w * 0.88}
                  y2={usefulTop + (usefulBottom - usefulTop) * 0.2}
                  stroke="#334155"
                  strokeWidth="2"
                />
              )}

              {m.shelves > 0 && Array.from({ length: m.shelves }, (_, s) => {
                const yy = usefulTop + ((s + 1) * (usefulBottom - usefulTop)) / (m.shelves + 1);
                return <line key={s} x1={m.x + 6} y1={yy} x2={m.x + m.w - 6} y2={yy} stroke="#0f766e" strokeWidth="1.2" />;
              })}

              {m.drawers > 0 && Array.from({ length: m.drawers }, (_, d) => {
                const zoneTop = usefulBottom - (usefulBottom - usefulTop) * 0.36;
                const dh = ((usefulBottom - zoneTop) / m.drawers);
                const yy = zoneTop + d * dh;
                return (
                  <g key={d}>
                    <rect x={m.x + 6} y={yy + 1} width={Math.max(8, m.w - 12)} height={Math.max(8, dh - 2)} fill="rgba(168,85,247,0.08)" stroke="#7e22ce" strokeWidth="1" />
                    <line x1={m.x + m.w * 0.35} y1={yy + dh * 0.5} x2={m.x + m.w * 0.65} y2={yy + dh * 0.5} stroke="#6b7280" strokeWidth="1.4" />
                  </g>
                );
              })}

              <circle cx={m.x + m.w / 2} cy={oy + DRAW_H * 0.5} r="14" fill="none" stroke="#b91c1c" strokeWidth="1.4" />
              <text x={m.x + m.w / 2} y={oy + DRAW_H * 0.5 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#b91c1c">{m.id}</text>

              <DimH x1={m.x} x2={m.x + m.w} y={oy + DRAW_H + 32} label={`${m.width.toFixed(2)} cm`} />
            </g>
          );
        })}

        <DimH x1={ox} x2={ox + DRAW_W} y={oy - 16} label={`${W} cm`} />
        <DimV x={ox + DRAW_W + 22} y1={oy} y2={oy + DRAW_H} label={`${H} cm`} />
        {PL > 0 && <DimV x={ox + DRAW_W + 38} y1={oy + DRAW_H - PL * sy} y2={oy + DRAW_H} label={`${PL} cm plinthe`} />}
      </svg>
    </div>
  );
}
