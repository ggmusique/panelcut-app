import { useState } from 'react';

// ── Module type & material options ────────────────────────────────────────────

const MODULE_TYPES = [
  { value: 'open',     label: 'Étagères ouvertes' },
  { value: 'drawers',  label: 'Tiroirs' },
  { value: 'wardrobe', label: 'Penderie' },
  { value: 'mixed',    label: 'Mixte' },
];

const MATERIALS = [
  { value: 'oak',       label: 'Chêne' },
  { value: 'white_mat', label: 'Blanc mat' },
  { value: 'walnut',    label: 'Noyer' },
  { value: 'wenge',     label: 'Wengé' },
  { value: 'mdf',       label: 'MDF brut' },
];

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const IconAlignLeft = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <line x1="2" y1="2" x2="2" y2="14" strokeWidth="2"/>
    <rect x="4" y="4" width="7" height="8" rx="1"/>
  </svg>
);

const IconAlignCenter = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <line x1="8" y1="2" x2="8" y2="14" strokeWidth="2"/>
    <rect x="3" y="4" width="10" height="8" rx="1"/>
  </svg>
);

const IconDistribute = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <line x1="2" y1="2" x2="2" y2="14" strokeWidth="1.5"/>
    <line x1="14" y1="2" x2="14" y2="14" strokeWidth="1.5"/>
    <rect x="5" y="5" width="6" height="6" rx="1"/>
  </svg>
);

const IconAlignRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <line x1="14" y1="2" x2="14" y2="14" strokeWidth="2"/>
    <rect x="5" y="4" width="7" height="8" rx="1"/>
  </svg>
);

// ── Styles (inline, matching the dark theme from App.css) ─────────────────────

const S = {
  panel: {
    width: 280,
    flexShrink: 0,
    background: 'var(--bg-card)',
    borderLeft: '0.5px solid var(--border)',
    padding: 16,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    color: 'var(--text1)',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text2)',
    marginBottom: 10,
  },
  moduleTitle: {
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 10,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  label: {
    fontSize: 11,
    color: 'var(--text2)',
  },
  select: {
    width: '100%',
    background: 'var(--bg-card2)',
    border: '1px solid var(--border2)',
    borderRadius: 6,
    color: 'var(--text1)',
    fontSize: 12,
    padding: '5px 8px',
    cursor: 'pointer',
    outline: 'none',
  },
  input: {
    width: '100%',
    background: 'var(--bg-card2)',
    border: '1px solid var(--border2)',
    borderRadius: 6,
    color: 'var(--text1)',
    fontSize: 12,
    padding: '5px 8px',
    outline: 'none',
  },
  inputReadonly: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text2)',
    fontSize: 12,
    padding: '5px 8px',
  },
  iconBtn: {
    flex: 1,
    background: 'var(--bg-card2)',
    border: '1px solid var(--border2)',
    borderRadius: 6,
    color: 'var(--text2)',
    cursor: 'pointer',
    padding: '6px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s, color 0.15s',
  },
  layerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    cursor: 'pointer',
  },
};

// ── Component ────────────────────────────────────────────────────────────────

/**
 * SketchPropertiesPanel
 *
 * Right-side properties panel (280 px) for the Sketch editor.
 * Displays and edits properties of the currently selected facade module.
 *
 * Props:
 *   selectedModuleIdx        {number|null}
 *   facadeModules            {Array}
 *   moduleDetails            {Array}
 *   cabinetDims              {{width, height, plinth}}
 *   onModuleChange           {(idx: number, changes: object) => void}
 *   onModuleDetailsChange    {(idx: number, changes: object) => void}
 *   canUndo, canRedo         {boolean}
 *   onUndo, onRedo           {() => void}
 */
export default function SketchPropertiesPanel({
  selectedModuleIdx,
  facadeModules,
  moduleDetails,
  cabinetDims,
  onModuleChange,
  onModuleDetailsChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) {
  // Calques (layer visibility).
  // These are passed up via onModuleDetailsChange when hook integration is added.
  // Currently stored locally; parent can lift to useSketchState when needed.
  const [showDims,   setShowDims]   = useState(true);
  const [showGuides, setShowGuides] = useState(true);

  // Width edit buffer (local string while the user is typing)
  const [widthBuffer, setWidthBuffer] = useState(null);

  const mod = (selectedModuleIdx !== null && selectedModuleIdx !== undefined)
    ? (facadeModules?.[selectedModuleIdx] ?? null)
    : null;

  // Cumulative X position of the selected module (sum of widths to the left)
  const moduleX = (() => {
    if (selectedModuleIdx == null || !facadeModules) return 0;
    let x = 0;
    for (let i = 0; i < selectedModuleIdx; i++) {
      x += facadeModules[i]?.width || 0;
    }
    return x;
  })();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTypeChange = (e) => {
    if (selectedModuleIdx == null) return;
    onModuleChange?.(selectedModuleIdx, { moduleType: e.target.value });
  };

  const handleMaterialChange = (e) => {
    if (selectedModuleIdx == null) return;
    onModuleChange?.(selectedModuleIdx, { material: e.target.value });
  };

  const handleWidthCommit = () => {
    if (selectedModuleIdx == null || widthBuffer === null) return;
    const val = parseFloat(widthBuffer);
    if (Number.isFinite(val) && val >= 5) {
      onModuleChange?.(selectedModuleIdx, { width: Math.round(val * 10) / 10 });
    }
    setWidthBuffer(null);
  };

  // Redistribute all modules to equal widths
  const handleEqualDistribute = () => {
    if (!facadeModules?.length) return;
    const totalW = facadeModules.reduce((s, m) => s + (m.width || 0), 0);
    const eqW    = Math.round((totalW / facadeModules.length) * 10) / 10;
    facadeModules.forEach((_, i) => onModuleChange?.(i, { width: eqW }));
  };

  // Snap selected module width to nearest 5 cm grid
  const handleSnapToGrid = () => {
    if (selectedModuleIdx == null || !mod) return;
    const snapped = Math.round((mod.width || 0) / 5) * 5;
    onModuleChange?.(selectedModuleIdx, { width: Math.max(5, snapped) });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={S.panel}>

      {/* ── PROPRIÉTÉS ── */}
      {mod && (
        <section>
          <div style={S.sectionTitle}>Propriétés</div>
          <div style={S.moduleTitle}>Module {selectedModuleIdx + 1}</div>

          <div style={S.fieldGroup}>
            {/* Type */}
            <div style={S.field}>
              <label style={S.label}>Type</label>
              <select
                style={S.select}
                value={mod.moduleType || 'open'}
                onChange={handleTypeChange}
              >
                {MODULE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Matériau */}
            <div style={S.field}>
              <label style={S.label}>Matériau</label>
              <select
                style={S.select}
                value={mod.material || 'oak'}
                onChange={handleMaterialChange}
              >
                {MATERIALS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Dimensions (read-only) */}
            <div style={S.field}>
              <label style={S.label}>Dimensions</label>
              <input
                readOnly
                style={S.inputReadonly}
                value={`${(mod.width || 0).toFixed(1)} × ${(cabinetDims?.height || 0).toFixed(1)} cm`}
              />
            </div>

            {/* Largeur éditable */}
            <div style={S.field}>
              <label style={S.label}>Largeur (cm)</label>
              <input
                type="number"
                style={S.input}
                min={5}
                step={0.5}
                value={widthBuffer !== null ? widthBuffer : (mod.width || 0).toFixed(1)}
                onChange={e => setWidthBuffer(e.target.value)}
                onBlur={handleWidthCommit}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.target.blur(); }
                  if (e.key === 'Escape') { setWidthBuffer(null); }
                }}
              />
            </div>

            {/* Position */}
            <div style={S.field}>
              <label style={S.label}>Position</label>
              <input
                readOnly
                style={S.inputReadonly}
                value={`X : ${moduleX.toFixed(1)} cm · Y : 0 cm`}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── CALQUES ── */}
      <section>
        <div style={S.sectionTitle}>Calques</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Plan principal — always visible, non-editable */}
          <label style={{ ...S.layerRow, cursor: 'default', color: 'var(--text3)' }}>
            <input
              type="checkbox"
              checked
              disabled
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 14, lineHeight: 1 }}>▦</span>
            Plan principal
          </label>

          <label style={{ ...S.layerRow, color: 'var(--text1)' }}>
            <input
              type="checkbox"
              checked={showDims}
              onChange={() => setShowDims(v => !v)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, lineHeight: 1 }}>↔</span>
            Cotes
          </label>

          <label style={{ ...S.layerRow, color: 'var(--text1)' }}>
            <input
              type="checkbox"
              checked={showGuides}
              onChange={() => setShowGuides(v => !v)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, lineHeight: 1 }}>⊹</span>
            Guides
          </label>
        </div>
      </section>

      {/* ── ALIGNEMENT ── */}
      {mod && (
        <section>
          <div style={S.sectionTitle}>Alignement</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              title="Aligner à gauche — placer le module au bord gauche du meuble"
              style={S.iconBtn}
              onClick={() => {
                // Move the selected module to position 0 by setting preceding modules' widths unchanged;
                // For now, snap its width to the nearest 5 cm grid (leftward snap)
                if (selectedModuleIdx == null || !mod) return;
                const snapped = Math.floor((mod.width || 0) / 5) * 5;
                onModuleChange?.(selectedModuleIdx, { width: Math.max(5, snapped) });
              }}
            >
              <IconAlignLeft />
            </button>
            <button
              title="Centrer — largeur arrondie au 5 cm le plus proche"
              style={S.iconBtn}
              onClick={handleSnapToGrid}
            >
              <IconAlignCenter />
            </button>
            <button
              title="Redistribuer — largeurs égales entre tous les modules"
              style={S.iconBtn}
              onClick={handleEqualDistribute}
            >
              <IconDistribute />
            </button>
            <button
              title="Aligner à droite — largeur arrondie au 5 cm supérieur"
              style={S.iconBtn}
              onClick={() => {
                if (selectedModuleIdx == null || !mod) return;
                const snapped = Math.ceil((mod.width || 0) / 5) * 5;
                onModuleChange?.(selectedModuleIdx, { width: Math.max(5, snapped) });
              }}
            >
              <IconAlignRight />
            </button>
          </div>
        </section>
      )}

      {/* ── UNDO / REDO (keyboard shortcut hints) ── */}
      <section style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            title="Annuler (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
            style={{
              ...S.iconBtn,
              flex: 'none',
              width: 36,
              opacity: canUndo ? 1 : 0.35,
              cursor: canUndo ? 'pointer' : 'default',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 9 A6 6 0 1 1 9 15" strokeLinecap="round"/>
              <polyline points="3,5 3,9 7,9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            title="Rétablir (Ctrl+Y)"
            disabled={!canRedo}
            onClick={onRedo}
            style={{
              ...S.iconBtn,
              flex: 'none',
              width: 36,
              opacity: canRedo ? 1 : 0.35,
              cursor: canRedo ? 'pointer' : 'default',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M15 9 A6 6 0 1 0 9 15" strokeLinecap="round"/>
              <polyline points="15,5 15,9 11,9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>

    </div>
  );
}

SketchPropertiesPanel.displayName = 'SketchPropertiesPanel';
