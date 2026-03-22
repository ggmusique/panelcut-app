import { useState, useCallback, useEffect } from 'react';
import { optimise } from './engine';
import { I18N, useLang } from './i18n';
import { supabase, saveProject, loadProject, signOut } from './supabase';
import ProjectForm from './components/ProjectForm';
import PiecesList from './components/PiecesList';
import Results from './components/Results';
import AuthScreen from './components/AuthScreen';
import ProjectsScreen from './components/ProjectsScreen';
import './App.css';

const SCREENS = {
  AUTH: 'auth', PROJECTS: 'projects',
  FORM: 'form', PIECES: 'pieces', RESULTS: 'results'
};

const DEFAULT_PROJECT = {
  name: '', client: '', company: '',
  panel: { w: 244, h: 122 },
  kerf: 3, tolerance: 10,
  pricePerPanel: 39.8,
  pieces: [], furniture: [],
  devisNum: '', supabaseId: null,
};

export default function App() {
  const lang = useLang();
  const [langOverride, setLangOverride] = useState(lang);
  const tr = I18N[langOverride];

  const [screen, setScreen]       = useState(SCREENS.AUTH);
  const [user, setUser]           = useState(null);
  const [project, setProject]     = useState({ ...DEFAULT_PROJECT });
  const [results, setResults]     = useState(null);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); setScreen(SCREENS.PROJECTS); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { setUser(session.user); setScreen(SCREENS.PROJECTS); }
      else { setUser(null); setScreen(SCREENS.AUTH); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const startNew = (devisNum = '') => {
    setProject({ ...DEFAULT_PROJECT, devisNum });
    setResults(null);
    setScreen(SCREENS.FORM);
  };

  const goBack = () => {
    if (screen === SCREENS.RESULTS) setScreen(SCREENS.PIECES);
    else if (screen === SCREENS.PIECES) setScreen(SCREENS.FORM);
    else if (screen === SCREENS.FORM) setScreen(user ? SCREENS.PROJECTS : SCREENS.AUTH);
    else setScreen(SCREENS.AUTH);
  };

  const handleLoadProject = async (id) => {
    const { data, error } = await loadProject(id);
    if (error || !data) return;
    const p = { ...data.project_data, supabaseId: data.id };
    setProject(p);
    if (data.results_data) { setResults(data.results_data); setScreen(SCREENS.RESULTS); }
    else setScreen(SCREENS.PIECES);
  };

  const handleOptimize = useCallback(() => {
    if (!project.pieces.length) return;
    setComputing(true);
    setTimeout(async () => {
      const res = optimise(project.pieces, project.panel, {
        kerf: project.kerf, tolerance: project.tolerance,
      });
      setResults(res);
      setComputing(false);
      setScreen(SCREENS.RESULTS);
      if (user) {
        setSaving(true);
        const { data, error } = await saveProject(project, res);
        setSaving(false);
        if (!error && data) {
          setProject(p => ({ ...p, supabaseId: data.id }));
          setSaveMsg('✓ Sauvegardé');
          setTimeout(() => setSaveMsg(''), 3000);
        }
      }
    }, 50);
  }, [project, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { data, error } = await saveProject(project, results);
    setSaving(false);
    if (!error && data) {
      setProject(p => ({ ...p, supabaseId: data.id }));
      setSaveMsg('✓ Sauvegardé');
    } else {
      setSaveMsg('✗ Erreur');
    }
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setScreen(SCREENS.AUTH);
  };

  const devisNum = 'DV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  const showBack = [SCREENS.FORM, SCREENS.PIECES, SCREENS.RESULTS].includes(screen);
  const showSave = user && [SCREENS.PIECES, SCREENS.RESULTS].includes(screen);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          {showBack && <button className="back-btn" onClick={goBack}>←</button>}
          <div className="logo" onClick={() => user && setScreen(SCREENS.PROJECTS)} style={{ cursor: user ? 'pointer' : 'default' }}>
            <span className="logo-icon">✂</span>
            <div>
              <div className="logo-name">{tr.appName}</div>
              {screen === SCREENS.PROJECTS && user && <div className="logo-sub">{user.email}</div>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(saveMsg || saving) && <span className="save-msg">{saving ? '💾...' : saveMsg}</span>}
          {showSave && !saving && <button className="save-btn" onClick={handleSave} title="Sauvegarder">💾</button>}
          {user && screen === SCREENS.PROJECTS && <button className="logout-btn" onClick={handleSignOut} title="Déconnexion">⎋</button>}
          <button className="lang-btn" onClick={() => setLangOverride(l => l === 'fr' ? 'en' : 'fr')}>
            {langOverride === 'fr' ? 'EN' : 'FR'}
          </button>
        </div>
      </header>

      {[SCREENS.FORM, SCREENS.PIECES, SCREENS.RESULTS].includes(screen) && (
        <div className="stepper">
          {[
            { key: SCREENS.FORM, label: tr.panel },
            { key: SCREENS.PIECES, label: tr.pieces },
            { key: SCREENS.RESULTS, label: tr.results },
          ].map((s, i) => {
            const order = [SCREENS.FORM, SCREENS.PIECES, SCREENS.RESULTS];
            const active = order.indexOf(s.key) <= order.indexOf(screen);
            return (
              <div key={s.key} className={`step ${active ? 'step--active' : ''}`}>
                <div className="step-dot">{i + 1}</div>
                <div className="step-label">{s.label}</div>
                {i < 2 && <div className="step-line" />}
              </div>
            );
          })}
        </div>
      )}

      <main className="app-main">
        {screen === SCREENS.AUTH     && <AuthScreen onSkip={() => setScreen(SCREENS.PROJECTS)} />}
        {screen === SCREENS.PROJECTS && <ProjectsScreen user={user} onNew={() => startNew(devisNum)} onLoad={handleLoadProject} />}
        {screen === SCREENS.FORM     && <ProjectForm t={tr} project={project} onChange={setProject} onNext={() => setScreen(SCREENS.PIECES)} />}
        {screen === SCREENS.PIECES   && <PiecesList t={tr} project={project} onChange={setProject} onOptimize={handleOptimize} computing={computing} />}
        {screen === SCREENS.RESULTS  && results && <Results t={tr} results={results} project={project} />}
      </main>
    </div>
  );
}
