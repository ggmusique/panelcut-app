import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mofyzotmnnjqmmudjppi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vZnl6b3Rtbm5qcW1tdWRqcHBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTgzOTUsImV4cCI6MjA4OTY3NDM5NX0.3rXz33i6wf0cBQIg4edz43mwTdgngdvoDZwoZgYEHD0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth ──────────────────────────────────────────────────────────────────

export async function signInWithEmail(email) {
  // Force OTP 6 chiffres — désactive le magic link
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: null, // null = désactive le magic link, envoie OTP uniquement
    }
  });
  return { error };
}

export async function verifyOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  return { data, error };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Projects ──────────────────────────────────────────────────────────────


export async function createProject(input = {}) {
  const user = await getUser();
  if (!user) return { data: null, error: { message: 'not_authenticated' } };

  const payload = {
    user_id: user.id,
    name: input.name || 'Sans titre',
    client: input.client || null,
    company: input.company || null,
    devis_num: input.devis_num || null,
    project_data: input.project_data || null,
    results_data: input.results_data || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select('id, name, client, company, devis_num, created_at, updated_at, results_data')
    .single();

  return { data, error };
}

export async function saveProject(project, results) {
  const user = await getUser();
  if (!user) return { error: 'not_authenticated' };

  const payload = {
    user_id:      user.id,
    name:         project.name || 'Sans titre',
    client:       project.client || null,
    company:      project.company || null,
    devis_num:    project.devisNum || null,
    project_data: project,
    results_data: results || null,
    updated_at:   new Date().toISOString(),
  };

  const buildPlanPayload = (projectId, forcedType = '2d') => {
    const payload = {
      project_id: projectId,
      user_id: user.id,
      title: `${project.name || 'Sans titre'} — Plan façade`,
      svg_data: project?.sketchDraft?.state
        ? JSON.stringify({
            cabinetDims: project.sketchDraft.state.cabinetDims || null,
            facadeModules: project.sketchDraft.state.facadeModules || [],
            facadeItems: project.sketchDraft.state.facadeItems || [],
            moduleDetails: project.sketchDraft.state.moduleDetails || [],
          })
        : null,
      metadata: {
        project_name: project.name || null,
        devis_num: project.devisNum || null,
        panel: project.panel || null,
        cabinet: project.cabinet || null,
        has_draft: Boolean(project?.sketchDraft?.state),
        updated_at: new Date().toISOString(),
      },
    };
    payload.type = forcedType || '2d';
    return payload;
  };

  const syncPlan = async (projectId) => {
    const basePlanPayload = buildPlanPayload(projectId);
    const { data: existing, error: fetchErr } = await supabase
      .from('plans')
      .select('id, type')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchErr) return { error: fetchErr };

    if (existing?.id) {
      const planPayload = buildPlanPayload(projectId, existing.type || '2d');
      const { data, error } = await supabase
        .from('plans')
        .update(planPayload)
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .select('id, project_id, type, created_at')
        .single();
      return { data, error };
    }

    const { data, error } = await supabase
      .from('plans')
      .insert(basePlanPayload)
      .select('id, project_id, type, created_at')
      .single();
    if (!error) return { data, error };
    // Fallback pour contraintes CHECK sur "type"
    if (error?.code === '23514') {
      const fallbackTypes = ['2d', 'scan', '3d'];
      for (const t of fallbackTypes) {
        const { data: d2, error: e2 } = await supabase
          .from('plans')
          .insert(buildPlanPayload(projectId, t))
          .select('id, project_id, type, created_at')
          .single();
        if (!e2) return { data: d2, error: null };
      }
    }
    return { data, error };
  };

  // Upsert si le projet a déjà un id Supabase
  if (project.supabaseId) {
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', project.supabaseId)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error || !data?.id) return { data, error };
    const { error: planError } = await syncPlan(data.id);
    return { data, error, planError };
  } else {
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single();
    if (error || !data?.id) return { data, error };
    const { error: planError } = await syncPlan(data.id);
    return { data, error, planError };
  }
}

export async function loadProjects() {
  const user = await getUser();
  if (!user) return { data: [], error: 'not_authenticated' };

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, client, company, devis_num, created_at, updated_at, results_data')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  return { data: data || [], error };
}

export async function loadProject(id) {
  const user = await getUser();
  if (!user) return { data: null, error: 'not_authenticated' };

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  return { data, error };
}

export async function deleteProject(id) {
  const user = await getUser();
  if (!user) return { error: 'not_authenticated' };

  await supabase
    .from('plans')
    .delete()
    .eq('project_id', id)
    .eq('user_id', user.id);

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  return { error };
}
