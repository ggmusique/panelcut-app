const PIECE_LABELS = {
  face:          'Face (façade visible)',
  avanCaisse:    'Avant caisse',
  arriereCaisse: 'Arrière caisse',
  flancGauche:   'Flanc gauche',
  flancDroit:    'Flanc droit',
  fond:          'Fond tiroir',
};

const PIECE_KEYS = ['face', 'avanCaisse', 'arriereCaisse', 'flancGauche', 'flancDroit', 'fond'];
const SLIDE_LENGTHS = {
  side: [25, 30, 35, 40, 45, 50],
  undermount: [27, 30, 35, 40, 45, 50],
};

/**
 * DrawerDetail — UI for a single drawer with its 6 toggleable pieces.
 */
export default function DrawerDetail({ drawer, onChange, onDelete, moduleNetWidth, depth, thickness }) {
  const netW = moduleNetWidth || 60;
  const d    = depth          || 58;
  const th   = thickness      || 1.8;

  const drawerH     = drawer.height     ?? 18;
  const yFromBottom = drawer.yFromBottom ?? 0;
  const slideType = drawer.slideType || 'side';
  const slideClearance = drawer.slideClearance ?? (slideType === 'undermount' ? 0.2 : slideType === 'none' ? 0 : 1.3);
  const backClearance = drawer.backClearance ?? (slideType === 'none' ? 0 : 2);
  const pieces      = drawer.pieces     || {};

  const innerNetW = netW - 2 * th - 2 * slideClearance;
  const caisseH   = drawerH - th;
  const usefulDepth = Math.max(0, d - th - backClearance);
  const flancL    = usefulDepth;
  const suggestedSlide = (() => {
    const arr = SLIDE_LENGTHS[slideType] || [];
    const fit = arr.filter(v => v <= usefulDepth);
    return fit.length ? fit[fit.length - 1] : 0;
  })();

  const dims = {
    face:          { w: netW,       h: drawerH },
    avanCaisse:    { w: innerNetW,  h: caisseH },
    arriereCaisse: { w: innerNetW,  h: caisseH },
    flancGauche:   { w: flancL,     h: caisseH },
    flancDroit:    { w: flancL,     h: caisseH },
    fond:          { w: innerNetW,  h: usefulDepth  },
  };

  const handlePieceToggle = (key) => {
    onChange({ ...drawer, pieces: { ...pieces, [key]: !(pieces[key] !== false) } });
  };

  return (
    <div className="border border-white/10 rounded-lg bg-white/5 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-orange-400">Tiroir</span>
        <label className="flex items-center gap-1 text-xs text-slate-300">
          H
          <input
            type="number"
            min="5"
            value={drawerH}
            onChange={e => onChange({ ...drawer, height: Math.max(5, Number(e.target.value) || 18) })}
            className="w-14 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200 text-xs"
          />
          cm
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-300">
          Pos.
          <input
            type="number"
            min="0"
            value={yFromBottom}
            onChange={e => onChange({ ...drawer, yFromBottom: Math.max(0, Number(e.target.value) || 0) })}
            className="w-14 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200 text-xs"
          />
          cm
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-300">
          Coulisse
          <select
            value={slideType}
            onChange={e => {
              const nextType = e.target.value;
              const nextClearance = nextType === 'undermount' ? 0.2 : nextType === 'none' ? 0 : 1.3;
              const nextBack = nextType === 'none' ? 0 : 2;
              onChange({ ...drawer, slideType: nextType, slideClearance: nextClearance, backClearance: nextBack });
            }}
            className="ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200 text-xs"
          >
            <option value="side">Latérale</option>
            <option value="undermount">Sous tiroir</option>
            <option value="none">Sans coulisse</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-300">
          Jeu/côté
          <input
            type="number"
            min="0"
            step="0.1"
            value={slideClearance}
            onChange={e => onChange({ ...drawer, slideClearance: Math.max(0, Number(e.target.value) || 0) })}
            className="w-14 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200 text-xs"
          />
          cm
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-300">
          Recul ar.
          <input
            type="number"
            min="0"
            step="0.1"
            value={backClearance}
            onChange={e => onChange({ ...drawer, backClearance: Math.max(0, Number(e.target.value) || 0) })}
            className="w-14 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200 text-xs"
          />
          cm
        </label>
        <button
          onClick={onDelete}
          className="ml-auto text-red-400 hover:text-red-300 text-xs px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors"
        >
          ✕
        </button>
      </div>
      <p className="text-[10px] text-slate-400">
        Profondeur utile tiroir: <span className="text-slate-200 font-mono">{usefulDepth.toFixed(1)} cm</span> ·
        Largeur intérieure utile: <span className="text-slate-200 font-mono">{Math.max(0, innerNetW).toFixed(1)} cm</span>
        {slideType !== 'none' && (
          <> · Coulisse conseillée: <span className="text-slate-200 font-mono">{suggestedSlide || 'N/A'} cm</span></>
        )}
      </p>

      <div className="grid grid-cols-2 gap-1">
        {PIECE_KEYS.map(key => {
          const enabled = pieces[key] !== false;
          const dim = dims[key];
          return (
            <label
              key={key}
              className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                enabled
                  ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                  : 'bg-slate-800/50 text-slate-500 border border-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => handlePieceToggle(key)}
                className="accent-orange-500"
              />
              <span className="flex-1">{PIECE_LABELS[key]}</span>
              {enabled && (
                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                  {dim.w.toFixed(1)}×{dim.h.toFixed(1)}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
