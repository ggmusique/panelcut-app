import PanelSelector from './PanelSelector';

export default function ProjectForm({ t, project, onChange, onNext }) {
  const update = (key, val) => onChange({ ...project, [key]: val });
  const updatePanel = (key, val) => onChange({ ...project, panel: { ...project.panel, [key]: val } });

  return (
    <div className="form-screen">
      <div className="card">
        <div className="card-title">Informations</div>
        <div className="form-field">
          <label className="label">Nom du projet</label>
          <input
            type="text" className="input"
            placeholder="Ex: Dressing chambre parents"
            value={project.name}
            onChange={e => update('name', e.target.value)}
          />
        </div>
        <div className="form-field">
          <label className="label">Client</label>
          <input
            type="text" className="input"
            placeholder="Nom du client"
            value={project.client || ''}
            onChange={e => update('client', e.target.value)}
          />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="label">Entreprise</label>
            <input
              type="text" className="input"
              placeholder="Votre entreprise"
              value={project.company || ''}
              onChange={e => update('company', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="label">N° Devis</label>
            <input
              type="text" className="input input--num"
              value={project.devisNum || ''}
              onChange={e => update('devisNum', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Type de panneau</div>
        <PanelSelector t={t} project={project} onChange={onChange} />
      </div>

      <div className="card">
        <div className="card-title">Options de coupe</div>
        <div className="form-row">
          <div className="form-field">
            <label className="label">{t.kerf}</label>
            <input
              type="number"
              className="input input--num"
              value={project.kerf}
              min="1" max="10" step="0.5"
              onChange={e => update('kerf', parseFloat(e.target.value) || 3)}
            />
          </div>
          <div className="form-field">
            <label className="label">{t.tolerance}</label>
            <input
              type="number"
              className="input input--num"
              value={project.tolerance}
              min="0" max="30" step="1"
              onChange={e => update('tolerance', parseFloat(e.target.value) || 10)}
            />
          </div>
        </div>
      </div>

      <button className="btn btn--primary btn--large" onClick={onNext}>
        {t.pieces} →
      </button>
    </div>
  );
}
