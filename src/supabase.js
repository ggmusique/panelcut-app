import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth ──────────────────────────────────────────────────────────────────

export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    }
  });
  return { error };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Projects ──────────────────────────────────────────────────────────────

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

  // Upsert si le projet a déjà un id Supabase
  if (project.supabaseId) {
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', project.supabaseId)
      .eq('user_id', user.id)
      .select()
      .single();
    return { data, error };
  } else {
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single();
    return { data, error };
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

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  return { error };
}
