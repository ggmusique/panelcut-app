import { useState, useCallback, useEffect } from 'react';
import { optimise } from './engineV2';
import { I18N, useLang } from './i18n';
import { supabase, saveProject, loadProject, signOut } from './supabase';
import ProjectForm from './components/ProjectForm';
import PiecesList from './components/PiecesList';
import Results from './components/Results';
import AuthScreen from './components/AuthScreen';
import ProjectsScreen from './components/ProjectsScreen';
import Scanner from './components/Scanner';
import PlansScreen from './components/PlansScreen';
import { ChevronLeft, ChevronRight, LogOut, Disc } from 'lucide-react';
import './App.css';

const SCREENS = { AUTH: 'auth', PROJECTS: 'projects', FORM: 'form', PIECES: 'pieces', RESULTS: 'results', SCAN: 'scan', PLANS: 'plans' };
const DEFAULT_PROJECT = { name: '', client: '', company: '', panel: { w: 244, h: 122 }, kerf: 3, tolerance: 10, pricePerPanel: 39.8, pieces: [], furniture: [], devisNum: '', supabaseId: null, furnitureHeight: 220, furnitureDepth: 60 };

const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';
const GIT_HASH   = process.env.REACT_APP_GIT_HASH  || 'dev';

const LS_SCREEN  = 'pc_screen';
const LS_PROJECT = 'pc_project';
const LS_RESULTS = 'pc_results';

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function lsClear() {
  [LS_SCREEN, LS_PROJECT, LS_RESULTS].forEach(k => localStorage.removeItem(k));
}

export default function App() {
  const lang = useLang();
  const [langOverride, setLangOverride] = useState(lang);
  const tr = I18N[langOverride] || I18N['fr'];

  const [screen,  setScreenRaw]  = useState(() => lsGet(LS_SCREEN,  SCREENS.AUTH));
  const [project, setProjectRaw] = useState(() => lsGet(LS_PROJECT, { ...DEFAULT_PROJECT }));
  const [results, setResultsRaw] = useState(() => lsGet(LS_RESULTS, null));

  const [user,      setUser]      = useState(null);
  const [computing, setComputing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState('');

  const setScreen  = (s) => { setScreenRaw(s);  lsSet(LS_SCREEN,  s); };
  const setProject = (p) => { setProjectRaw(p); lsSet(LS_PROJECT, p); };
  const setResults = (r) => { setResultsRaw(r); lsSet(LS_RESULTS, r); };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const savedScreen = lsGet(LS_SCREEN, SCREENS.AUTH);
        if (savedScreen === SCREENS.AUTH) setScreen(SCREENS.PROJECTS);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        if (_event === 'SIGNED_IN') {
          const savedScreen = lsGet(LS_SCREEN, SCREENS.AUTH);
          if (savedScreen === SCREENS.AUTH) setScreen(SCREENS.PROJECTS);
        }
      } else {
        setUser(null);
        lsClear();
        setScreenRaw(SCREENS.AUTH);
        setProjectRaw({ ...DEFAULT_PROJECT });
        setResultsRaw(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const startNew = (devisNum = '') => {
    const p = { ...DEFAULT_PROJECT, devisNum };
    setProject(p);
    setResults(null);
    setScreen(SCREENS.FORM);
  };

  const goBack = () => {
    if (screen === SCREENS.RESULTS) setScreen(SCREENS.PIECES);
    else if (screen === SCREENS.PIECES) setScreen(SCREENS.FORM);
    else if (screen === SCREENS.FORM) setScreen(user ? SCREENS.PROJECTS : SCREENS.AUTH);
    else setScreen(SCREENS.AUTH);
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

  const canGoNext =
    (screen === SCREENS.FORM   && project.name?.trim().length > 0) ||
    (screen === SCREENS.PIECES && project.pieces.length > 0 && !computing);
  const showNext = [SCREENS.FORM, SCREENS.PIECES].includes(screen);

  const goNext = () => {
    if (screen === SCREENS.FORM)   setScreen(SCREENS.PIECES);
    if (screen === SCREENS.PIECES) handleOptimize();
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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await saveProject(project, results);
    setSaving(false); setSaveMsg('OK'); setTimeout(() => setSaveMsg(''), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    lsClear();
    setScreenRaw(SCREENS.AUTH);
    setProjectRaw({ ...DEFAULT_PROJECT });
    setResultsRaw(null);
  };

  const toggleLang = () => setLangOverride(l => l === 'fr' ? 'en' : 'fr');
  const [devisNum] = useState(() => 'DV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000));

  const showBack = [SCREENS.FORM, SCREENS.PIECES, SCREENS.RESULTS, SCREENS.SCAN, SCREENS.PLANS].includes(screen);
  const showSave = user && [SCREENS.PIECES, SCREENS.RESULTS].includes(screen);

  let headerTitle = 'PanelCut Pro', headerSubtitle = '', steps = [];
  if (screen === SCREENS.PROJECTS) { headerTitle = 'Dashboard'; headerSubtitle = user?.email || 'Guest'; }
  else if (screen === SCREENS.SCAN)    { headerTitle = tr.scan || 'Scanner'; }
  else if (screen === SCREENS.PLANS)   { headerTitle = tr.plansTitle || 'Plans sauvegardés'; }
  else if (screen === SCREENS.FORM)    { headerTitle = tr.newProject || 'Nouveau projet'; steps = [{ label: tr.panel, active: true }, { label: tr.pieces, active: false }, { label: tr.results, active: false }]; }
  else if (screen === SCREENS.PIECES)  { headerTitle = project.name || tr.newProject;    steps = [{ label: tr.panel, active: true }, { label: tr.pieces, active: true  }, { label: tr.results, active: false }]; }
  else if (screen === SCREENS.RESULTS) { headerTitle = tr.results || 'Resultats';         steps = [{ label: tr.panel, active: true }, { label: tr.pieces, active: true  }, { label: tr.results, active: true  }]; }

  const hasHeader = screen !== SCREENS.AUTH;
  const hasSteps  = steps.length > 0;

  return (
    <div className="app min-h-screen bg-[#0f1620] text-slate-200 font-sans">
      {hasHeader && (
        <header className="sticky top-0 z-40 bg-[#0f1620]/95 backdrop-blur-md border-b border-white/10 shadow-lg h-16 flex items-center justify-between px-4 md:px-8 gap-2">

          {/* LEFT: ‹ title › */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {showBack && (
              <button onClick={goBack} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <div className="flex flex-col mx-1">
              <h1 className={'font-bold text-white ' + (hasSteps ? 'hidden md:block text-sm md:text-base' : 'text-sm md:text-base')}>
                {headerTitle}
              </h1>
              <span className="text-[11px] font-mono font-black text-orange-400" style={{textShadow:'0 0 8px #f97316'}}>
                v{APP_VERSION} · {GIT_HASH}
              </span>
            </div>

            {/* Bouton NEXT — toujours visible, orange si actif, gris clair si pas encore possible */}
            {showNext && (
              <button
                onClick={canGoNext ? goNext : undefined}
                className={'p-1.5 rounded-lg transition-colors ' +
                  (canGoNext
                    ? 'text-orange-400 hover:text-white hover:bg-orange-500/20 cursor-pointer'
                    : 'text-slate-500 cursor-not-allowed opacity-40')}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {headerSubtitle && <p className="text-[10px] text-slate-500 uppercase truncate hidden sm:block ml-1">{headerSubtitle}</p>}
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
        {screen === SCREENS.PROJECTS && (
          <ProjectsScreen
            user={user}
            onNew={() => startNew(devisNum)}
            onLoad={handleLoadProject}
            onScanComplete={handleScanComplete}
            onPlans={() => setScreen(SCREENS.PLANS)}
          />
        )}
        {screen === SCREENS.SCAN     && (
          <Scanner
            t={tr}
            onClose={() => setScreen(SCREENS.PROJECTS)}
            onPiecesDetected={(pieces) => {
              const projectName = 'Plan du ' + new Date().toLocaleDateString('fr-FR');
              const dNum = 'DV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
              setProject({ ...DEFAULT_PROJECT, name: projectName, devisNum: dNum, pieces });
              setResults(null);
              setScreen(SCREENS.PIECES);
            }}
          />
        )}
        {screen === SCREENS.PLANS    && (
          <PlansScreen
            project={project}
            session={{ user }}
            supabase={supabase}
            t={tr}
            onBack={() => setScreen(SCREENS.PROJECTS)}
            onScan={() => setScreen(SCREENS.SCAN)}
          />
        )}
        {screen === SCREENS.FORM     && <ProjectForm t={tr} project={project} onChange={setProject} onNext={() => setScreen(SCREENS.PIECES)} />}
        {screen === SCREENS.PIECES   && <PiecesList t={tr} project={project} onChange={setProject} onOptimize={handleOptimize} computing={computing} />}
        {screen === SCREENS.RESULTS  && results && (
          <Results
            t={tr}
            results={results}
            project={project}
            onSave={({ svgData, title, type, metadata }) => {
              if (!project?.id || !user?.id) return;
              supabase.from('plans').insert({
                project_id: project?.id,
                user_id: user?.id,
                svg_data: svgData,
                title,
                type,
                metadata,
              });
            }}
          />
        )}
      </main>
    </div>
  );
}