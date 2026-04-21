import { useState, useRef } from 'react';
import { defaultDrawerParts } from '../utils/sketchEditorConstants';

const TOOLS = [
  { id: 'erase',   label: 'Selection',   key: 'Esc', icon: '↖' },
  { id: 'drawer',  label: 'Tiroir',      key: 'T',   icon: '▤'  },
  { id: 'shelf',   label: 'Tablette',    key: 'S',   icon: '═'  },
  { id: 'rod',     label: 'Tringle',     key: 'R',   icon: '⊣'  },
  { id: 'door',    label: 'Porte',       key: 'P',   icon: '▭'  },
  { id: 'sliding', label: 'Coulissante', key: null,  icon: '⇄'  },
  { id: 'dim',     label: 'Cote',        key: 'C',   icon: '↔'  },
  { id: 'note',    label: 'Note',        key: 'N',   icon: '✎'  },
];

const TOOL_COLORS = {
  erase:   '#8b949e',
  drawer:  '#e3b341',
  shelf:   '#3fb950',
  rod:     '#388bfd',
  door:    '#f85149',
  sliding: '#a371f7',
  dim:     '#39c5cf',
  note:    '#fb923c',
};

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

export default function SketchToolbar({
  activeTool, onToolChange, isCompactMobile, hint, dimensionsFromWizard,
  cabinetDims, onCabinetDimsChange,
  facadeModules, widthInputs, onWidthInputChange, onCommitWidth,
  globalSliding, onGlobalSlidingChange,
  selectedModuleIdx, onSelectModuleIdx,
  moduleDetails, onModuleDetailsChange,
  onSave, onMoveModule,
  assemblyType, onAssemblyTypeChange,
}) {
  const dragSrcIdx = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  return (
    <>
      <div style={{
        width: 72, flexShrink: 0, background: '#0d1117',
        borderRight: '1px solid #21262d',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 8, paddingBottom: 8, gap: 4, overflowY: 'auto',
      }}>
        {TOOLS.map(t => {
          const active = activeTool === t.id;
          const color  = TOOL_COLORS[t.id];
          return (
            <button key={t.id}
              title={t.label + (t.key ? ' (' + t.key + ')' : '')}
              onClick={() => onToolChange(t.id)}
              style={{
                width: 56, borderRadius: 8, cursor: 'pointer',
                border:     active ? '1px solid ' + color + '60' : '1px solid #21262d',
                background: active
                  ? 'linear-gradient(135deg, ' + color + '28 0%, ' + color + '10 100%)'
                  : 'linear-gradient(135deg, #161b22 0%, #1c2128 100%)',
                color:      active ? color : '#6e7681',
                padding: '6px 4px 5px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                transition: 'all 0.15s',
                boxShadow: active ? '0 0 0 1px ' + color + '30' : 'none',
              }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1 }}>{t.label}</span>
              {t.key && <span style={{ fontSize: 8, opacity: 0.4, lineHeight: 1 }}>{t.key}</span>}
            </button>
          );
        })}
      </div>

      <div style={{
        width: 280, flexShrink: 0, background: '#0d1117',
        borderRight: '1px solid #21262d',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ padding: '10px 12px 4px', display: 'flex', gap: 6 }}>
          <KpiCard icon="⟷" label="Largeur" unit="cm" color="#388bfd"
            value={cabinetDims.width} onChange={v => onCabinetDimsChange(d => ({ ...d, width: v }))} min={20} max={600} />
          <KpiCard icon="↕" label="Hauteur" unit="cm" color="#3fb950"
            value={cabinetDims.height} onChange={v => onCabinetDimsChange(d => ({ ...d, height: v }))} min={20} max={350} />
        </div>
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <KpiCard icon="⌊" label="Plinthe" unit="cm" color="#e3b341"
            value={cabinetDims.plinth} onChange={v => onCabinetDimsChange(d => ({ ...d, plinth: v }))} min={0} max={30} />
          <div style={{
            flex: 1,
            background: 'linear-gradient(135deg, #161b22 0%, #1c2128 100%)',
            border: '1px solid #21262d', borderRadius: 8, padding: '8px 10px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <span style={{ fontSize: 9, color: '#6e7681', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Modules</span>
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#388bfd', textAlign: 'right' }}>
              {facadeModules.length}
            </span>
          </div>
        </div>

        <Section title={'MODULES (' + facadeModules.length + ')'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {facadeModules.map((m, i) => (
              <div key={m.id || i} draggable
                onDragStart={() => { dragSrcIdx.current = i; }}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverIdx(null); }}
                onDragEnd={() => { setDragOverIdx(null); dragSrcIdx.current = null; }}
                onDrop={e => {
                  e.preventDefault(); setDragOverIdx(null);
                  const from = dragSrcIdx.current; dragSrcIdx.current = null;
                  if (from !== null && from !== i) onMoveModule?.(from, i);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab',
                  borderLeft: dragOverIdx === i ? '2px solid #388bfd' : '2px solid transparent',
                  paddingLeft: dragOverIdx === i ? 2 : 4,
                }}>
                <button onClick={() => onSelectModuleIdx(i)} style={{
                  width: 26, height: 26, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  border:     selectedModuleIdx === i ? '1px solid #388bfd' : '1px solid #30363d',
                  background: selectedModuleIdx === i ? '#1f3a6e' : '#161b22',
                  color:      selectedModuleIdx === i ? '#388bfd' : '#6e7681',
                }}>M{i + 1}</button>
                <input type="number" min={5} step={0.1}
                  value={widthInputs[i] ?? m.width}
                  onChange={e => onWidthInputChange(i, e.target.value)}
                  onBlur={e => { e.target.style.borderColor = '#30363d'; onCommitWidth(i); }}
                  onKeyDown={e => { if (e.key === 'Enter') { onCommitWidth(i); e.target.blur(); } }}
                  onFocus={e => e.target.style.borderColor = '#388bfd'}
                  style={{
                    flex: 1, width: 0, height: 28, textAlign: 'right',
                    background: '#161b22', border: '1px solid #30363d',
                    borderRadius: 4, color: '#e6edf3', fontSize: 12,
                    padding: '0 6px', fontFamily: 'monospace', outline: 'none',
                  }} />
                <span style={{ fontSize: 10, color: '#484f58', flexShrink: 0 }}>cm</span>
              </div>
            ))}
          </div>
        </Section>

        {selectedModuleIdx !== null && selectedModuleIdx < facadeModules.length && (
          <Section title={'MODULE ' + (selectedModuleIdx + 1) + ' — DÉTAIL'}>
            <ModuleDetailPanel
              modIdx={selectedModuleIdx}
              module={facadeModules[selectedModuleIdx]}
              detail={moduleDetails[selectedModuleIdx]}
              onDetailChange={onModuleDetailsChange} />
          </Section>
        )}

        <Section title="ASSEMBLAGE">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, color: '#484f58', letterSpacing: '0.04em' }}>TYPE D'ASSEMBLAGE</label>
            {[
              { v: 'traverse_sur_montant', label: 'Traverses sur montants', desc: '(standard)' },
              { v: 'montant_sur_traverse', label: 'Montants sur traverses', desc: '(caisson)' },
            ].map(opt => (
              <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="assembly"
                  value={opt.v}
                  checked={(assemblyType || 'traverse_sur_montant') === opt.v}
                  onChange={() => onAssemblyTypeChange?.(opt.v)}
                  style={{ accentColor: '#1f6feb' }}
                />
                <div>
                  <div style={{ fontSize: 12, color: '#e6edf3' }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: '#484f58' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Section>

        <Section title="PORTES COULISSANTES">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={globalSliding.enabled}
                onChange={e => onGlobalSlidingChange(v => ({ ...v, enabled: e.target.checked }))}
                style={{ accentColor: '#1f6feb' }} />
              <span style={{ fontSize: 12, color: '#8b949e' }}>Activer</span>
            </label>
            {globalSliding.enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                <Field label="Vantaux">
                  <NumInput value={globalSliding.count} min={2} max={4} step={1}
                    onChange={v => onGlobalSlidingChange(d => ({ ...d, count: Math.max(2, Math.min(4, v)) }))} />
                </Field>
                <Field label="Haut. (cm)">
                  <NumInput value={globalSliding.heightCm}
                    onChange={v => onGlobalSlidingChange(d => ({ ...d, heightCm: v }))} />
                </Field>
              </div>
            )}
          </div>
        </Section>

        <div style={{ flex: 1 }} />

        <div style={{
          padding: '8px 12px', borderTop: '1px solid #21262d',
          fontSize: 11, color: '#484f58', lineHeight: 1.5,
        }}>
          {hint || 'Sélectionnez un outil'}
        </div>
      </div>
    </>
  );
}

function KpiCard({ icon, label, unit, value, onChange, min, max, step = 0.1, color = '#388bfd' }) {
  return (
    <div style={{
      flex: 1, borderRadius: 8, padding: '8px 10px',
      background: 'linear-gradient(135deg, #161b22 0%, #1c2128 100%)',
      border: '1px solid #21262d', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13, color, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 9, color: '#6e7681', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <input type="number" step={step} min={min} max={max} value={value}
          onChange={e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }}
          onFocus={e => { e.target.style.borderBottomColor = color; }}
          onBlur={e => { e.target.style.borderBottomColor = '#30363d'; }}
          style={{
            flex: 1, width: 0, background: 'transparent', border: 'none',
            borderBottom: '1.5px solid #30363d',
            color, fontSize: 18, fontWeight: 700, fontFamily: 'monospace',
            padding: '2px 0', outline: 'none', textAlign: 'right',
          }} />
        <span style={{ fontSize: 10, color: '#484f58', flexShrink: 0 }}>{unit}</span>
      </div>
    </div>
  );
}

function StatBadge({ icon, label, value, color }) {
  return (
    <div style={{
      background: color + '18', border: '1px solid ' + color + '40',
      borderRadius: 20, padding: '3px 8px',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ color, fontSize: 9 }}>{icon}</span>
      <span style={{ color: '#6e7681', fontSize: 9 }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontFamily: 'monospace', fontSize: 10 }}>{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: '1px solid #21262d' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: '#8b949e', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {title}
        <span style={{ fontSize: 10, color: '#484f58' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '4px 12px 12px' }}>{children}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, color: '#484f58', letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, min, max, step = 0.1 }) {
  return (
    <input type="number" step={step} min={min} max={max} value={value}
      onChange={e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }}
      onFocus={e => e.target.style.borderColor = '#388bfd'}
      onBlur={e => e.target.style.borderColor = '#30363d'}
      style={{
        width: '100%', height: 28, textAlign: 'right',
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 4, color: '#e6edf3', fontSize: 12,
        padding: '0 6px', fontFamily: 'monospace', outline: 'none',
      }} />
  );
}

function ModuleDetailPanel({ modIdx, module, detail, onDetailChange }) {
  const d = detail || {};
  const drawerCount = module?.drawers || 0;
  const set = changes => onDetailChange(prev => prev.map((x, i) => i === modIdx ? { ...x, ...changes } : x));
  const LABEL_ROW = { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#8b949e' }}>
        Largeur : <strong style={{ color: '#e6edf3', fontFamily: 'monospace' }}>{module?.width?.toFixed(1)} cm</strong>
      </div>
      <label style={LABEL_ROW}>
        <input type="checkbox" checked={d.hasBack !== false}
          onChange={e => set({ hasBack: e.target.checked })} style={{ accentColor: '#1f6feb' }} />
        <span style={{ fontSize: 12, color: '#8b949e' }}>Fond de module</span>
      </label>
      <label style={LABEL_ROW}>
        <input type="checkbox" checked={(d.slidingDoors || 0) > 0}
          onChange={e => set({ slidingDoors: e.target.checked ? 2 : 0 })} style={{ accentColor: '#1f6feb' }} />
        <span style={{ fontSize: 12, color: '#8b949e' }}>Portes coulissantes</span>
      </label>
      {drawerCount > 0 && (
        <>
          <div style={{ fontSize: 10, color: '#484f58', marginTop: 4, letterSpacing: '0.04em' }}>TIROIRS — PARTIES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[['front','Facade'],['back','Arriere'],['left','Cote G'],['right','Cote D'],['bottom','Fond']].map(([k, lbl]) => (
              <label key={k} style={LABEL_ROW}>
                <input type="checkbox" checked={d.drawerParts?.[k] !== false}
                  onChange={e => set({ drawerParts: { ...defaultDrawerParts(), ...(d.drawerParts || {}), [k]: e.target.checked } })}
                  style={{ accentColor: '#1f6feb' }} />
                <span style={{ fontSize: 11, color: '#8b949e' }}>{lbl}</span>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#484f58', letterSpacing: '0.04em' }}>HAUTEURS TIROIRS (cm)</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Array.from({ length: drawerCount }, (_, di) => (
              <div key={di} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#484f58' }}>#{di + 1}</span>
                <input type="number" min="5" step="0.5"
                  value={d.drawerHeights?.[di] ?? 18}
                  onChange={e => {
                    const arr = Array.from({ length: drawerCount }, (_, idx) => Math.max(5, toNum(d.drawerHeights?.[idx], 18)));
                    arr[di] = Math.max(5, toNum(e.target.value, 18));
                    set({ drawerHeights: arr });
                  }}
                  style={{
                    width: 44, height: 26, textAlign: 'right',
                    background: '#161b22', border: '1px solid #30363d',
                    borderRadius: 4, color: '#e6edf3', fontSize: 11,
                    fontFamily: 'monospace', padding: '0 4px',
                  }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}