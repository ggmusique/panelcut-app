import { computeAllPieces } from '../../utils/cabinetCalculator';

const ROLE_LABELS = {
  side:          'Montant',
  top:           'Traverse haute',
  bottom:        'Traverse basse',
  back:          'Fond caisse',
  shelf:         'Étagère',
  rod:           'Tringle',
  door:          'Porte',
  drawer_face:   'Face tiroir',
  drawer_front:  'Avant caisse',
  drawer_back:   'Arrière caisse',
  drawer_side:   'Flanc',
  drawer_bottom: 'Fond tiroir',
};

const ROLE_COLORS = {
  side:          'text-amber-300',
  top:           'text-amber-200',
  bottom:        'text-amber-200',
  back:          'text-slate-300',
  shelf:         'text-green-400',
  rod:           'text-pink-400',
  door:          'text-sky-400',
  drawer_face:   'text-blue-300',
  drawer_front:  'text-blue-200',
  drawer_back:   'text-blue-200',
  drawer_side:   'text-blue-100',
  drawer_bottom: 'text-slate-300',
};

/**
 * PiecesList — grouped table of all computed pieces.
 */
export default function CabinetPiecesList({ cabinet }) {
  if (!cabinet) return null;

  const pieces = computeAllPieces(cabinet);
  const modules = cabinet.modules || [];

  // Group by moduleId
  const byModule = {};
  pieces.forEach(p => {
    const key = p.moduleId || 'global';
    if (!byModule[key]) byModule[key] = [];
    byModule[key].push(p);
  });

  const woodPieces = pieces.filter(p => !p.isRod);
  const rodPieces  = pieces.filter(p => p.isRod);
  const totalArea  = woodPieces.reduce((s, p) => s + p.length * p.height * p.qty, 0); // cm²
  const panelArea  = 244 * 122; // standard panel cm²
  const nbPanels   = Math.ceil(totalArea / (panelArea * 0.8)); // ~80% utilization

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold">
          {pieces.length} pièces total
        </span>
        <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
          {woodPieces.length} pièces bois
        </span>
        {rodPieces.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 font-bold">
            {rodPieces.length} tringle(s)
          </span>
        )}
        <span className="px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-300 border border-white/10 font-bold">
          ≈ {nbPanels} panneaux 244×122
        </span>
        <span className="px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-300 border border-white/10 font-bold">
          Surface: {(totalArea / 10000).toFixed(2)} m²
        </span>
      </div>

      {/* Grouped tables */}
      {modules.map((mod, i) => {
        const modPieces = byModule[mod.id] || [];
        if (modPieces.length === 0) return null;
        return (
          <div key={mod.id || i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500 text-black text-xs font-black flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-sm font-bold text-slate-200">Module {i + 1}</span>
              <span className="text-xs text-slate-500">({mod.width?.toFixed(1)} cm net)</span>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-white/10">
                  <th className="text-left py-1 pr-2 font-medium">Pièce</th>
                  <th className="text-left py-1 pr-2 font-medium">Rôle</th>
                  <th className="text-right py-1 pr-2 font-medium">L (cm)</th>
                  <th className="text-right py-1 pr-2 font-medium">H (cm)</th>
                  <th className="text-right py-1 font-medium">Qté</th>
                </tr>
              </thead>
              <tbody>
                {modPieces.map(p => (
                  <tr key={p.id} className={`border-b border-white/5 hover:bg-white/5 ${p.isRod ? 'opacity-60' : ''}`}>
                    <td className="py-1 pr-2 text-slate-200 truncate max-w-[160px]" title={p.name}>
                      {p.name.replace(`Module ${i + 1} — `, '')}
                      {p.isBiais && <span className="ml-1 text-amber-400 text-[10px]">↗biais</span>}
                      {p.isRod && <span className="ml-1 text-pink-400 text-[10px]">🔧</span>}
                    </td>
                    <td className={`py-1 pr-2 ${ROLE_COLORS[p.role] || 'text-slate-400'}`}>
                      {ROLE_LABELS[p.role] || p.role}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono text-slate-200">{p.length.toFixed(1)}</td>
                    <td className="py-1 pr-2 text-right font-mono text-slate-200">{p.height.toFixed(1)}</td>
                    <td className="py-1 text-right font-mono text-slate-400">{p.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {modPieces.some(p => p.notes) && (
              <div className="space-y-0.5 pl-2">
                {modPieces.filter(p => p.notes).map(p => (
                  <p key={p.id + '-note'} className="text-[10px] text-slate-500">
                    ℹ️ {p.name.replace(`Module ${i + 1} — `, '')} : {p.notes}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
