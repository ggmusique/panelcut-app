import { useState, useCallback, useEffect } from 'react';
import { optimise } from './engineV2';
import { I18N, useLang } from './i18n';
import { supabase, saveProject, loadProject, signOut } from './supabase';
import ProjectForm from './components/ProjectForm';
import PiecesList from './components/PiecesList';
import Results from './components/Results';
import AuthScreen from './components/AuthScreen';
import ProjectsScreen from './components/ProjectsScreen';
import { ChevronLeft, LogOut, Disc } from 'lucide-react';
import './App.css';

const SCREENS = { AUTH: 'auth', PROJECTS: 'projects', FORM: 'form', PIECES: 'pieces', RESULTS: 'results' };
const DEFAULT_PROJECT = { name: '', client: '', company: '', panel: { w: 244, h: 122 }, kerf: 3, tolerance: 10, pricePerPanel: 39.8, pieces: [], furniture: [], devisNum: '', supabaseId: null };

export default function App() {
  const lang = useLang();
  const [langOverride, setLangOverride] = useState(lang);
  const tr = I18N[langOverride] || I18N['fr'];

  const [screen, setScreen] = useState(SCREENS.AUTH);
  const [user, setUser] = useState(null);
  const [project, setProject] = useState({ ...DEFAULT_PROJECT });
  const [results, setResults] = useState(null);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

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

  const handleScanComplete = (scanResult) => {
    const pieces = (scanResult.pieces || []).map(p => ({
      name: p.name || 'Piece',
      length: parseFloat(p.length) || 0,
      height: parseFloat(p.height) || 0,
      qty: parseInt(p.qty, 10) || 1,
    }));
    const projectName = 'Plan du ' + new Date().toLocaleDateString('fr-FR');
    const dNum = 'DV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
    setProject({ ...DEFAULT_PROJECT, name: projectName, devisNum: dNum, pieces });
    setResults(null);
    setScreen(SCREENS.PIECES);
  };

  const handleOptimize = useCallback(() => {
    if (!project.pieces.length) return;
    setComputing(true);
    setTimeout(async () => {
      const res = optimise(project.pieces, project.panel, { kerf: project.kerf, tolerance: project.tolerance });
      setResults(res); setComputing(false); setScreen(SCREENS.RESULTS);
      if (user) {
        setSaving(true);
        await saveProject(project, res);
        setSaving(false); setSaveMsg('OK'); setTimeout(() => setSaveMsg(''), 2000);
      }
    }, 50);
  }, [project, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await saveProject(project, results);
    setSaving(false); setSaveMsg('OK'); setTimeout(() => setSaveMsg(''), 2000);
  };

  const handleSignOut = async () => { await signOut(); setUser(null); setScreen(SCREENS.AUTH); };
  const toggleLang = () => setLangOverride(l => l === 'fr' ? 'en' : 'fr');
  const devisNum = 'DV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);

  const showBack = [SCREENS.FORM, SCREENS.PIECES, SCREENS.RESULTS].includes(screen);
  const showSave = user && [SCREENS.PIECES, SCREENS.RESULTS].includes(screen);

  let headerTitle = 'PanelCut Pro', headerSubtitle = '', steps = [];
  if (screen === SCREENS.PROJECTS) { headerTitle = 'Dashboard'; headerSubtitle = user?.email || 'Guest'; }
  else if (screen === SCREENS.FORM) { headerTitle = tr.newProject || 'Nouveau projet'; steps = [{ label: tr.panel, active: true }, { label: tr.pieces, active: false }, { label: tr.results, active: false }]; }
  else if (screen === SCREENS.PIECES) { headerTitle = project.name || tr.newProject; steps = [{ label: tr.panel, active: true }, { label: tr.pieces, active: true }, { label: tr.results, active: false }]; }
  else if (screen === SCREENS.RESULTS) { headerTitle = tr.results || 'Resultats'; steps = [{ label: tr.panel, active: true }, { label: tr.pieces, active: true }, { label: tr.results, active: true }]; }

  const hasHeader = screen !== SCREENS.AUTH;
  const hasSteps = steps.length > 0;

  return (
    <div className="app min-h-screen bg-[#0f1620] text-slate-200 font-sans">
      {hasHeader && (
        <header className="sticky top-0 z-40 bg-[#0f1620]/95 backdrop-blur-md border-b border-white/10 shadow-lg h-16 flex items-center justify-between px-4 md:px-8 gap-2">

          {/* LEFT: back + title (title hidden on mobile when stepper present) */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            {showBack && (
              <button onClick={goBack} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className={'font-bold text-white truncate ' + (hasSteps ? 'hidden md:block text-sm md:text-base' : 'text-sm md:text-base')}>
              {headerTitle}
            </h1>
            {headerSubtitle && <p className="text-[10px] text-slate-500 uppercase truncate hidden sm:block">{headerSubtitle}</p>}
          </div>

          {/* CENTER: stepper */}
          {hasSteps && (
            <div className="flex items-center gap-1 flex-1 justify-center">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={
                    'flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold transition-all ' +
                    (s.active ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'text-slate-600')
                  }>
                    <div className={
                      'w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ' +
                      (s.active ? 'bg-orange-500 text-black' : 'bg-slate-700 text-slate-500')
                    }>
                      {i + 1}
                    </div>
                    <span className="hidden md:inline">{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={'w-3 h-px flex-shrink-0 ' + (steps[i + 1].active ? 'bg-orange-500/50' : 'bg-slate-700')} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* RIGHT: save + lang + logout */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(saveMsg || saving) && <span className="text-[11px] text-green-400 font-medium">{saving ? '...' : saveMsg}</span>}
            {showSave && !saving && (
              <button onClick={handleSave} className="p-1.5 rounded-lg text-slate-400 hover:text-green-400 hover:bg-white/10 transition-colors">
                <Disc className="w-4 h-4" />
              </button>
            )}
            <button onClick={toggleLang} className="px-2 py-1 text-slate-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg text-[11px] font-bold transition-colors">
              {langOverride === 'fr' ? 'EN' : 'FR'}
            </button>
            {user && (
              <button onClick={handleSignOut} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>
      )}

      <main className={'w-full px-4 md:px-8 mb-20 ' + (hasHeader ? 'mt-4' : 'mt-0')}>
        {screen === SCREENS.AUTH     && <AuthScreen onSkip={() => setScreen(SCREENS.PROJECTS)} />}
        {screen === SCREENS.PROJECTS && <ProjectsScreen user={user} onNew={() => startNew(devisNum)} onLoad={handleLoadProject} onScanComplete={handleScanComplete} />}
        {screen === SCREENS.FORM     && <ProjectForm t={tr} project={project} onChange={setProject} onNext={() => setScreen(SCREENS.PIECES)} />}
        {screen === SCREENS.PIECES   && <PiecesList t={tr} project={project} onChange={setProject} onOptimize={handleOptimize} computing={computing} />}
        {screen === SCREENS.RESULTS  && results && <Results t={tr} results={results} project={project} />}
      </main>
    </div>
  );
}