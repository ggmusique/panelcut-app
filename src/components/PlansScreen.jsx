import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileImage, X } from 'lucide-react';

const TYPE_LABELS = {
  '2d': '2D',
  '3d': '3D',
  scan: 'SCAN',
};

function PlanCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-white/5 bg-[#111] p-4">
      <div className="mb-3 h-36 rounded-lg bg-slate-800/60" />
      <div className="mb-2 h-4 w-3/5 rounded bg-slate-700/60" />
      <div className="mb-4 h-3 w-2/5 rounded bg-slate-800/60" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-8 rounded bg-slate-800/60" />
        <div className="h-8 rounded bg-slate-800/60" />
        <div className="h-8 rounded bg-slate-800/60" />
      </div>
    </div>
  );
}

export default function PlansScreen({ project, session, supabase, onBack, onScan, t }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openedPlan, setOpenedPlan] = useState(null);

  const loadPlans = useCallback(async () => {
    if (!project?.id) {
      setPlans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('plans')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
    setPlans(data || []);
    setLoading(false);
  }, [project?.id, supabase]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('fr-BE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const badgeClass = useMemo(() => ({
    '2d': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    '3d': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    scan: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  }), []);

  const downloadPlan = (plan) => {
    const blob = new Blob([plan.svg_data || ''], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(plan.title || 'plan').replace(/\s+/g, '-').toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deletePlan = async (planId) => {
    const shouldDelete = window.confirm('Supprimer ce plan ?');
    if (!shouldDelete) return;
    await supabase.from('plans').delete().eq('id', planId);
    await loadPlans();
  };

  return (
    <div className="min-h-screen bg-[#050505] pb-20 text-slate-200">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">{t?.plansTitle || 'Plans sauvegardés'}</h2>
            <p className="text-sm text-slate-400">{project?.name || 'Projet en cours'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-white/10 bg-[#111] px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
            >
              {t?.backToProjects || 'Retour projets'}
            </button>
            <button
              type="button"
              onClick={() => {
                onBack?.();
                onScan?.();
              }}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-500"
            >
              + Nouveau plan (scan)
            </button>
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PlanCardSkeleton />
            <PlanCardSkeleton />
            <PlanCardSkeleton />
          </div>
        )}

        {!loading && plans.length === 0 && (
          <div className="rounded-xl border border-white/5 bg-[#111] py-14 text-center">
            <FileImage className="mx-auto mb-4 h-10 w-10 text-slate-500" />
            <p className="text-slate-300">Aucun plan sauvegardé pour ce projet.</p>
          </div>
        )}

        {!loading && plans.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-white/5 bg-[#111] p-4">
                <div
                  className="mb-3 h-40 overflow-hidden rounded-lg border border-white/10 bg-slate-900/80"
                  dangerouslySetInnerHTML={{ __html: plan.svg_data || '' }}
                />
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-bold text-white">{plan.title || 'Plan sans titre'}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass[plan.type] || 'bg-slate-700/50 text-slate-200 border-white/10'}`}>
                    {TYPE_LABELS[plan.type] || String(plan.type || '').toUpperCase()}
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-400">{formatDate(plan.created_at)}</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenedPlan(plan)}
                    className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-2 text-xs font-semibold hover:bg-slate-800"
                  >
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPlan(plan)}
                    className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-2 text-xs font-semibold hover:bg-slate-800"
                  >
                    Export SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePlan(plan.id)}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl border border-white/10 bg-[#111] p-4">
            <button
              type="button"
              onClick={() => setOpenedPlan(null)}
              className="absolute right-3 top-3 rounded-lg border border-white/10 bg-slate-900/80 p-2 text-slate-300 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="mb-4 pr-10 text-lg font-bold text-white">{openedPlan.title || 'Plan sans titre'}</h3>
            <div className="rounded-lg border border-white/10 bg-slate-900/80 p-3" dangerouslySetInnerHTML={{ __html: openedPlan.svg_data || '' }} />
          </div>
        </div>
      )}
    </div>
  );
}
