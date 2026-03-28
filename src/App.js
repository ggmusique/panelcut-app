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

  const startNew = (devisNum = '') => { setProject({ ...DEFAULT_PROJECT, devisNum }); setResults(null); setScreen(SCREENS.FORM); };
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
      const res = optimise(project.pieces, project.panel, { kerf: project.kerf, tolerance: project.tolerance });
      setResults(res); setComputing(false); setScreen(SCREENS.RESULTS);
      if (user) {
        setSaving(true);
        await saveProject(project, res);
        setSaving(false); setSaveMsg('✓ OK'); setTimeout(() => setSaveMsg(''), 2000);
      }
    }, 50);
  }, [project, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await saveProject(project, results);
    setSaving(false); setSaveMsg('✓ OK'); setTimeout(() => setSaveMsg(''), 2000);
  };

  const handleSignOut = async () => { await signOut(); setUser(null); setScreen(SCREENS.AUTH); };
  const toggleLang = () => setLangOverride(l => l === 'fr' ? 'en' : 'fr');
  const devisNum = 'DV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  
  const showBack = [SCREENS.FORM, SCREENS.PIECES, SCREENS.RESULTS].includes(screen);
  const showSave = user && [SCREENS.PIECES, SCREENS.RESULTS].includes(screen);

  let headerTitle = "PanelCut Pro", headerSubtitle = "", steps = [];
  if (screen === SCREENS.PROJECTS) { headerTitle = "Dashboard"; headerSubtitle = user?.email || "Guest"; }
  else if (screen === SCREENS.FORM) { headerTitle = tr.newProject || "New Project"; steps = [{ label: tr.panel, active: true }, { label: tr.pieces, active: false }, { label: tr.results, active: false }]; }
  else if (screen === SCREENS.PIECES) { headerTitle = project.name || tr.newProject; steps = [{ label: tr.panel, active: true }, { label: tr.pieces, active: true }, { label: tr.results, active: false }]; }
  else if (screen === SCREENS.RESULTS) { headerTitle = tr.results || "Results"; steps = [{ label: tr.panel, active: true }, { label: tr.pieces, active: true }, { label: tr.results, active: true }]; }

  const hasHeader = screen !== SCREENS.AUTH;

  return (
    <div className="app min-h-screen bg-[#050505] text-slate-200 font-sans">
      {hasHeader && (
        <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10 shadow-lg h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-3 flex-1">
            {showBack && <button onClick={goBack} className="p-2 -ml-2 text-slate-400 hover:text-white"><ChevronLeft className="w-6 h-6"/></button>}
            <div>
              <h1 className="text-base font-bold text-white">{headerTitle}</h1>
              {headerSubtitle && <p className="text-[10px] text-slate-500 uppercase">{headerSubtitle}</p>}
            </div>
          </div>
          {steps.length > 0 && (
            <div className="hidden md:flex items-center gap-2 bg-[#111] px-3 py-1 rounded-full border border-white/5">
              {steps.map((s, i) => (<span key={i} className={`text-[10px] font-bold uppercase ${s.active?'text-orange-500':'text-slate-600'}`}>{i+1}. {s.label} {i<steps.length-1?'|':''}</span>))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-1 justify-end">
            {showSave && !saving && <button onClick={handleSave} className="p-2 text-slate-400 hover:text-green-400"><Disc className="w-5 h-5"/></button>}
            <button onClick={toggleLang} className="p-2 text-slate-400 hover:text-white font-bold text-xs border border-white/10 rounded">{langOverride==='fr'?'EN':'FR'}</button>
            {user && <button onClick={handleSignOut} className="p-2 text-slate-400 hover:text-red-400"><LogOut className="w-5 h-5"/></button>}
          </div>
        </header>
      )}
      <main className={`max-w-5xl mx-auto px-4 w-full ${hasHeader?'mt-20':'mt-0'} mb-20 transition-all duration-300`}>
        {screen === SCREENS.AUTH && <AuthScreen onSkip={()=>setScreen(SCREENS.PROJECTS)}/>}
        {screen === SCREENS.PROJECTS && <ProjectsScreen user={user} onNew={()=>startNew(devisNum)} onLoad={handleLoadProject}/>}
        {screen === SCREENS.FORM && <ProjectForm t={tr} project={project} onChange={setProject} onNext={()=>setScreen(SCREENS.PIECES)}/>}
        {screen === SCREENS.PIECES && <PiecesList t={tr} project={project} onChange={setProject} onOptimize={handleOptimize} computing={computing}/>}
        {screen === SCREENS.RESULTS && results && <Results t={tr} results={results} project={project}/>}
      </main>
    </div>
  );
}
