import { useState } from 'react';
import { PANEL_CATALOG, MATERIAL_COLORS } from '../catalog';

export default function PanelSelector({ t, project, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customPanel, setCustomPanel] = useState({
    name: '', material: 'Personnalisé', thickness: 18,
    w: 244, h: 122, price: 0
  });

  const selected = project.selectedPanel || null;

  const selectPanel = (panel) => {
    onChange({
      ...project,
      selectedPanel: panel,
      panel: { w: panel.w, h: panel.h },
      pricePerPanel: panel.price,
    });
  };

  const addCustom = () => {
    if (!customPanel.name || !customPanel.w || !customPanel.h) return;
    selectPanel({ ...customPanel, id: 'custom-' + Date.now() });
    setShowCustom(false);
  };

  // Groupe par matière
  const materials = [...new Set(PANEL_CATALOG.map(p => p.material))];

  return (
    <div className="panel-selector">

      {/* Panneau sélectionné */}
      {selected && (
        <div className="selected-panel">
          <div
            className="selected-panel-color"
            style={{ background: MATERIAL_COLORS[selected.material] || '#607D8B' }}
          />
          <div className="selected-panel-info">
            <div className="selected-panel-name">{selected.name}</div>
            <div className="selected-panel-dims">
              {selected.w}×{selected.h}cm · {selected.price.toFixed(2)}€
            </div>
          </div>
          <button className="change-btn" onClick={() => onChange({ ...project, selectedPanel: null })}>
            Changer
          </button>
        </div>
      )}

      {/* Catalogue */}
      {!selected && (
        <div className="catalog">
          {materials.map(mat => (
            <div key={mat} className="catalog-group">
              <div className="catalog-group-title">
                <div
                  className="mat-dot"
                  style={{ background: MATERIAL_COLORS[mat] || '#607D8B' }}
                />
                {mat}
              </div>
              <div className="catalog-items">
                {PANEL_CATALOG.filter(p => p.material === mat).map(panel => (
                  <button
                    key={panel.id}
                    className="catalog-item"
                    onClick={() => selectPanel(panel)}
                  >
                    <div className="catalog-item-name">{panel.name}</div>
                    <div className="catalog-item-info">
                      {panel.w}×{panel.h}cm
                    </div>
                    <div className="catalog-item-price">{panel.price.toFixed(2)}€</div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Panneau personnalisé */}
          <div className="catalog-group">
            <div className="catalog-group-title">
              <div className="mat-dot" style={{ background: '#607D8B' }} />
              Personnalisé
            </div>
            {!showCustom ? (
              <button
                className="catalog-item catalog-item--custom"
                onClick={() => setShowCustom(true)}
              >
                + Ajouter un panneau personnalisé
              </button>
            ) : (
              <div className="custom-form">
                <input
                  className="input" type="text"
                  placeholder="Nom (ex: Merisier 18mm)"
                  value={customPanel.name}
                  onChange={e => setCustomPanel(p => ({ ...p, name: e.target.value }))}
                />
                <div className="custom-row">
                  <div className="form-field">
                    <label className="label">Longueur (cm)</label>
                    <input className="input input--num" type="number"
                      value={customPanel.w}
                      onChange={e => setCustomPanel(p => ({ ...p, w: parseFloat(e.target.value) || 244 }))}
                    />
                  </div>
                  <div className="form-field">
                    <label className="label">Largeur (cm)</label>
                    <input className="input input--num" type="number"
                      value={customPanel.h}
                      onChange={e => setCustomPanel(p => ({ ...p, h: parseFloat(e.target.value) || 122 }))}
                    />
                  </div>
                  <div className="form-field">
                    <label className="label">Prix (€)</label>
                    <input className="input input--num" type="number"
                      value={customPanel.price}
                      step="0.1"
                      onChange={e => setCustomPanel(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--ghost" onClick={() => setShowCustom(false)}>Annuler</button>
                  <button className="btn btn--primary" onClick={addCustom}>Ajouter</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prix modifiable si panneau sélectionné */}
      {selected && (
        <div className="price-row">
          <label className="label">Prix unitaire (€) — modifiable</label>
          <input
            className="input input--num"
            type="number" step="0.1" min="0"
            value={project.pricePerPanel}
            style={{ width: 100 }}
            onChange={e => onChange({ ...project, pricePerPanel: parseFloat(e.target.value) || 0 })}
          />
        </div>
      )}
    </div>
  );
}
