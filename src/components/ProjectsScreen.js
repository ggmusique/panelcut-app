import { useState, useEffect } from 'react';
import { loadProjects, deleteProject } from '../supabase';

export default function ProjectsScreen({ onLoad, onNew, user }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetch();
  }, []);

  const fetch = async () => {
    setLoading(true);
    const { data } = await loadProjects();
    setProjects(data || []);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce projet ?')) return;
    setDeleting(id);
    await deleteProject(id);
    setProjects(p => p.filter(p => p.id !== id));
    setDeleting(null);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-BE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  return (
    <div className="projects-screen">

      {/* Header utilisateur */}
      <div className="user-bar">
        <div className="user-info">
          <span className="user-dot" />
          <span className="user-email">{user?.email}</span>
        </div>
      </div>

      {/* Nouveau projet */}
      <button className="btn btn--primary btn--large" onClick={onNew}>
        + Nouveau projet
      </button>

      {/* Liste projets */}
      <div className="projects-title">
        Mes projets {!loading && `(${projects.length})`}
      </div>

      {loading && (
        <div className="projects-loading">
          <div className="scan-spinner" style={{ width: 28, height: 28 }} />
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="empty-state">Aucun projet sauvegardé</div>
      )}

      {projects.map(p => (
        <div key={p.id} className="project-card">
          <div className="project-card-body" onClick={() => onLoad(p.id)}>
            <div className="project-card-name">{p.name || 'Sans titre'}</div>
            {p.client && <div className="project-card-client">👤 {p.client}</div>}
            <div className="project-card-meta">
              <span>{formatDate(p.updated_at)}</span>
              {p.devis_num && <span className="project-devis">{p.devis_num}</span>}
              {p.results_data && (
                <span className="project-panels">
                  {p.results_data.summary?.totalPanels} panneaux
                </span>
              )}
            </div>
          </div>
          <button
            className="project-delete"
            onClick={() => handleDelete(p.id)}
            disabled={deleting === p.id}
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}
