import NumInput from './NumInput';

const PIECE_LABELS = {
  face:          'Face (façade visible)',
  avanCaisse:    'Avant caisse',
  arriereCaisse: 'Arrière caisse',
  flancGauche:   'Flanc gauche',
  flancDroit:    'Flanc droit',
  fond:          'Fond tiroir',
};

const PIECE_KEYS = ['face', 'avanCaisse', 'arriereCaisse', 'flancGauche', 'flancDroit', 'fond'];

/**
 * DrawerDetail — UI for a single drawer with its 6 toggleable pieces.
 */
export default function DrawerDetail({ drawer, onChange, onDelete, moduleNetWidth, depth, thickness }) {
  const netW = moduleNetWidth || 60;
  const d    = depth          || 58;
  const th   = thickness      || 1.8;

  const drawerH     = drawer.height     ?? 18;
  const yFromBottom = drawer.yFromBottom ?? 0;
  const pieces      = drawer.pieces     || {};

  const innerNetW = netW - 2 * th;
  const caisseH   = drawerH - th;
  const flancL    = d - th;

  const dims = {
    face:          { w: netW,       h: drawerH },
    avanCaisse:    { w: innerNetW,  h: caisseH },
    arriereCaisse: { w: innerNetW,  h: caisseH },
    flancGauche:   { w: flancL,     h: caisseH },
    flancDroit:    { w: flancL,     h: caisseH },
    fond:          { w: innerNetW,  h: d - th  },
  };

  const handlePieceToggle = (key) => {
    onChange({ ...drawer, pieces: { ...pieces, [key]: !(pieces[key] !== false) } });
  };

  return (
    <div className="border border-white/10 rounded-lg bg-white/5 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-orange-400">Tiroir</span>
        <NumInput
          label="H"
          value={drawerH}
          onChange={v => onChange({ ...drawer, height: v })}
          min={5}
          inputClassName="w-14"
        />
        <NumInput
          label="Pos."
          value={yFromBottom}
          onChange={v => onChange({ ...drawer, yFromBottom: v })}
          min={0}
          inputClassName="w-14"
        />
        <button
          onClick={onDelete}
          className="ml-auto text-red-400 hover:text-red-300 text-xs px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors"
        >
          ✕
        </button>
      </div>

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
