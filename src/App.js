import { useState, useCallback, useEffect } from 'react';
import { optimise } from './engineV2';
import { I18N, useLang } from './i18n';
import { supabase, saveProject, loadProject, signOut } from './supabase';
import PiecesList from './components/PiecesList';
import Results from './components/Results';
import AuthScreen from './components/AuthScreen';
import SketchEditor from './components/SketchEditor';
import LandingScreen    from './components/LandingScreen';
import NewProjectWizard from './components/NewProjectWizard';
import HistoryScreen    from './components/HistoryScreen';
import CabinetElevationFront from './components/CabinetElevationFront';
import RealisticFacadeViewer from './visualization/RealisticFacadeViewer';
import { ChevronLeft, ChevronRight, LogOut, Disc, Moon, Sun } from 'lucide-react';
import './App.css';

const SCREENS = {
  LANDING:  'landing',
  AUTH:     'auth',
  HISTORY:  'history',
  WIZARD:   'wizard',
  SKETCH:   'sketch',
  PIECES:   'pieces',
  RESULTS:  'results',
  FACADE:   'facade',
  FACADE_REALISTIC: 'facade_realistic',
};

const DEFAULT_PROJECT = {
  name: '', client: '', company: '', devisNum: '',
  panel: { w: 244, h: 122, thickness: 1.8, label: 'MDF 18mm' },
  kerf: 3, tolerance: 10, pricePerPanel: 39.8,
  pieces: [], furniture: [], supabaseId: null, cabinet: null,
  scanImage: null, scanResult: null,
};

const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';
const GIT_HASH   = process.env.REACT_APP_GIT_HASH  || 'dev';

/** Returns true when a piece is a rod/tringle (not cut from wood panels). */
const isRodPiece = (p) =>
  p.isRod === true ||
  p.type === 'rod' ||
  /tringle/i.test(String(p.name || ''));

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
  
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('pc_darkmode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const tr = I18N[langOverride] || I18N['fr'];

  const [screen,  setScreenRaw]  = useState(() => {
    const stored = lsGet(LS_SCREEN, SCREENS.LANDING);
    return Object.values(SCREENS).includes(stored) ? stored : SCREENS.LANDING;
  });
  const [project, setProjectRaw] = useState(() => lsGet(LS_PROJECT, { ...DEFAULT_PROJECT }));
  const [results, setResultsRaw] = useState(() => lsGet(LS_RESULTS, null));

  const [user,      setUser]      = useState(null);
  const [computing, setComputing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState('');
  const [apiKey, setApiKey] = useState(
    process.env.REACT_APP_ANTHROPIC_KEY || lsGet('pc_apikey', '')
  );

  const setScreen  = (s) => { setScreenRaw(s);  lsSet(LS_SCREEN,  s); };
  const setProject = (p) => { setProjectRaw(p); lsSet(LS_PROJECT, p); };
  const setResults = (r) => { setResultsRaw(r); lsSet(LS_RESULTS, r); };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('pc_darkmode', String(isDark));
  }, [isDark]);

  const toggleDarkMode = () => setIsDark(prev => !prev);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const savedScreen = lsGet(LS_SCREEN, SCREENS.LANDING);
        if (savedScreen === SCREENS.AUTH) setScreen(SCREENS.HISTORY);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        if (_event === 'SIGNED_IN') {
          const savedScreen = lsGet(LS_SCREEN, SCREENS.LANDING);
          if (savedScreen === SCREENS.AUTH) setScreen(SCREENS.HISTORY);
        }
      } else {
        setUser(null);
        lsClear();
        setScreenRaw(SCREENS.LANDING);
        setProjectRaw({ ...DEFAULT_PROJECT });
        setResultsRaw(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const startNew = (devisNum = '') => {
    setProject({ ...DEFAULT_PROJECT, devisNum });
    setResults(null);
    setScreen(SCREENS.WIZARD);
  };

  const goBack = () => {
    if      (screen === SCREENS.FACADE_REALISTIC) setScreen(SCREENS.FACADE);
    else if (screen === SCREENS.FACADE)           setScreen(SCREENS.RESULTS);
    else if (screen === SCREENS.WIZARD)           setScreen(SCREENS.LANDING);
    else if (screen === SCREENS.SKETCH)           setScreen(SCREENS.WIZARD);
    else if (screen === SCREENS.PIECES)           setScreen(SCREENS.WIZARD);
    else if (screen === SCREENS.RESULTS)          setScreen(SCREENS.PIECES);
    else if (screen === SCREENS.HISTORY)          setScreen(SCREENS.LANDING);
    else if (screen === SCREENS.AUTH)             setScreen(SCREENS.LANDING);
  };

  const handleOptimize = useCallback(() => {
    const woodPieces = (project.pieces || []).filter(p => !isRodPiece(p));
    if (!woodPieces.length) return;
    setComputing(true);
    setTimeout(async () => {
      const res = optimise(woodPieces, project.panel, { kerf: project.kerf, tolerance: project.tolerance });
      setResults(res); setComputing(false); setScreen(SCREENS.RESULTS);
      if (user) {
        setSaving(true);
        await saveProject(project, res);
        setSaving(false); setSaveMsg('OK'); setTimeout(() => setSaveMsg(''), 2000);
      }
    }, 50);
  }, [project, user]);

  const woodPieceCount = (project.pieces || []).filter(p => !isRodPiece(p)).length;
  const canGoNext = screen === SCREENS.PIECES && woodPieceCount > 0 && !computing;
  const showNext = screen === SCREENS.PIECES;

  const goNext = () => {
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

  const handleScanComplete = (scanResult, scanImageBase64) => {
    const pieces = (scanResult.pieces || []).map(p => {
      const name  = String(p.name || 'Pièce').trim();
      const rod   = p.isRod === true || p.type === 'rod' || /tringle/i.test(name);
      return {
        name,
        length: Math.abs(parseFloat(p.length) || 0),
        height: Math.abs(parseFloat(p.height) || 0),
        qty:    Math.max(1, parseInt(p.qty, 10) || 1),
        ...(rod && { isRod: true }),
      };
    }).filter(p => p.length > 0 && p.height > 0);

    const cabinet = scanResult.cabinet || null;

    setProject(prev => ({
      ...prev,
      pieces,
      cabinet,
      scanImage:  scanImageBase64 || null,
      scanResult: scanResult,
    }));
    setResults(null);
    setScreen(SCREENS.SKETCH);
  };

  function reconstructModulesFromFlat(cabinet) {
    if (Array.isArray(cabinet?.modules) && cabinet.modules.length > 0) {
      return cabinet;
    }
    const nb = Math.max(1, parseInt(cabinet?.nb_dividers ?? 0, 10) + 1);
    const W = parseFloat(cabinet?.width) || 0;
    const T = parseFloat(cabinet?.thickness) || 1.8;
    const totalDrawers = parseInt(cabinet?.nb_drawers ?? 0, 10);
    const totalShelves = parseInt(cabinet?.nb_shelves  ?? 0, 10);
    const drawersPerSide = Math.floor(totalDrawers / 2);
    const innerCount = Math.max(1, nb - 2);
    const mw = nb > 0 ? (W - T * (nb + 1)) / nb : 0;

    const modules = Array.from({ length: nb }, (_, i) => {
      const isOuter  = i === 0 || i === nb - 1;
      const isMiddle = Math.floor(nb / 2) === i;

      if (isOuter && drawersPerSide > 0) {
        return {
          id: i + 1, width: mw,
          shelves: 0, shelfPositions: [],
          drawers: drawersPerSide, drawerItems: [],
          rods: [], doors: 0,
        };
      }
      if (!isOuter && !isMiddle) {
        return {
          id: i + 1, width: mw,
          shelves: 0, shelfPositions: [],
          drawers: 0, drawerItems: [],
          rods: [null], doors: 0,
        };
      }
      return {
        id: i + 1, width: mw,
        shelves: Math.max(0, Math.round(totalShelves / innerCount)),
        shelfPositions: [],
        drawers: 0, drawerItems: [],
        rods: [], doors: 0,
      };
    });

    return { ...cabinet, modules };
  }

  const handleRefinementComplete = (newScanResult) => {
    const pieces = (newScanResult.pieces || []).map(p => {
      const name  = String(p.name || 'Pièce').trim();
      const rod   = p.isRod === true || p.type === 'rod' || /tringle/i.test(name);
      return {
        name,
        length: Math.abs(parseFloat(p.length) || 0),
        height: Math.abs(parseFloat(p.height) || 0),
        qty:    Math.max(1, parseInt(p.qty, 10) || 1),
        ...(rod && { isRod: true }),
      };
    }).filter(p => p.length > 0 && p.height > 0);

    const rawCabinet =
      newScanResult.cabinet ||
      newScanResult.result?.cabinet ||
      project.cabinet;
    const cabinet = reconstructModulesFromFlat(rawCabinet);
    console.log('[FIX CHECK] cabinet from re-scan:', cabinet);
    setProject(p => ({ ...p, pieces, cabinet, scanResult: newScanResult }));
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
    setScreenRaw(SCREENS.LANDING);
    setProjectRaw({ ...DEFAULT_PROJECT });
    setResultsRaw(null);
  };

  const toggleLang = () => setLangOverride(l => l === 'fr' ? 'en' : 'fr');
  const [devisNum] = useState(() => 'DV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000));

  const showBack = [SCREENS.PIECES, SCREENS.RESULTS, SCREENS.FACADE, SCREENS.FACADE_REALISTIC].includes(screen);
  const showSave = user && [SCREENS.PIECES, SCREENS.RESULTS].includes(screen);
  const canAnnotate = screen === SCREENS.PIECES && !!project.scanImage;

  let headerTitle = 'PanelCut Pro', headerSubtitle = '', steps = [];
  if (screen === SCREENS.PIECES)  { headerTitle = project.name || 'Nouveau projet'; steps = [{ label: 'Panneau', active: true }, { label: 'Pièces', active: true }, { label: 'Résultats', active: false }]; }
  else if (screen === SCREENS.RESULTS) { headerTitle = 'Résultats'; steps = [{ label: 'Panneau', active: true }, { label: 'Pièces', active: true }, { label: 'Résultats', active: true }]; }
  else if (screen === SCREENS.FACADE || screen === SCREENS.FACADE_REALISTIC) { 
    headerTitle = 'Façade — ' + (screen === SCREENS.FACADE ? 'Croquis' : 'Vue Client'); 
    steps = [{ label: 'Panneau', active: true }, { label: 'Pièces', active: true }, { label: 'Façade', active: true }]; 
  }

  const hasHeader = ![SCREENS.AUTH, SCREENS.SKETCH, SCREENS.LANDING, SCREENS.WIZARD, SCREENS.HISTORY].includes(screen);
  const hasSteps  = steps.length > 0;
  
  // ← LOG CABINET (déjà présent)
  console.log('🔍 Cabinet data:', project.cabinet);

  return (
    <div className="app min-h-screen bg-[#0f1620] text-slate-200 font-sans dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">

      {screen === SCREENS.LANDING  && <LandingScreen onNew={() => startNew(devisNum)} onHistory={() => setScreen(user ? SCREENS.HISTORY : SCREENS.AUTH)} onAuth={() => setScreen(SCREENS.AUTH)} user={user} />}

      {screen === SCREENS.WIZARD   && <NewProjectWizard t={tr} project={project} onChange={setProject} onGoScan={handleScanComplete} onGoManual={() => setScreen(SCREENS.PIECES)} onCancel={() => setScreen(SCREENS.LANDING)} />}

      {screen === SCREENS.HISTORY  && <HistoryScreen user={user} onNew={() => startNew(devisNum)} onLoad={handleLoadProject} onScanComplete={handleScanComplete} onBack={() => setScreen(SCREENS.LANDING)} />}

      {screen === SCREENS.SKETCH && (
        <SketchEditor
          image={project.scanImage}
          initialResult={project.scanResult}
          apiKey={apiKey}
          onComplete={handleRefinementComplete}
          onCancel={() => setScreen(SCREENS.PIECES)}
        />
      )}

      {![SCREENS.LANDING, SCREENS.WIZARD, SCREENS.HISTORY, SCREENS.SKETCH].includes(screen) && (
        <>
          {hasHeader && (
            <header className="sticky top-0 z-40 bg-[#0f1620]/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-white/10 shadow-lg h-16 flex items-center justify-between px-4 md:px-8 gap-2 transition-colors duration-300">
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
              </div>

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

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {canAnnotate && (
                  <button
                    onClick={() => setScreen(SCREENS.SKETCH)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600/30 hover:text-cyan-300 transition-all"
                    title="Annoter le croquis et relancer Claude">
                    ✏️ <span className="hidden sm:inline">Annoter</span>
                  </button>
                )}
                
                {(screen === SCREENS.FACADE || screen === SCREENS.FACADE_REALISTIC) && (
                  <button
                    onClick={() => setScreen(screen === SCREENS.FACADE ? SCREENS.FACADE_REALISTIC : SCREENS.FACADE)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 transition-all"
                  >
                    {screen === SCREENS.FACADE ? '🖼️ Vue Client' : '📐 Croquis'}
                  </button>
                )}
                
                <button
                  onClick={toggleDarkMode}
                  title={tr.toggle_dark_mode || 'Mode sombre'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-white/10 transition-colors"
                  aria-label={tr.toggle_dark_mode || 'Toggle dark mode'}
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                
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
            {screen === SCREENS.AUTH     && <AuthScreen onSkip={() => setScreen(SCREENS.HISTORY)} />}
            {screen === SCREENS.PIECES   && <PiecesList t={tr} project={project} onChange={setProject} onOptimize={handleOptimize} computing={computing} />}
            {screen === SCREENS.RESULTS  && results && results.panels && results.panels.length > 0
              ? <Results t={tr} results={results} project={project} />
              : screen === SCREENS.RESULTS && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
                  <div className="text-5xl">⚠️</div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white mb-1">Résultats indisponibles</p>
                    <p className="text-sm text-slate-400">Les données de résultats sont manquantes ou corrompues.</p>
                  </div>
                  <button
                    onClick={() => setScreen(SCREENS.PIECES)}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-colors shadow-lg">
                    ↺ Relancer l'optimisation
                  </button>
                </div>
              )
            }
            
            {screen === SCREENS.FACADE && (
              <div className="max-w-4xl mx-auto">
                <CabinetElevationFront cabinet={project.cabinet} name={project.name || 'Meuble'} />
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setScreen(SCREENS.FACADE_REALISTIC)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
                  >
                    🖼️ Voir en vue réaliste client
                  </button>
                </div>
              </div>
            )}
            
            {screen === SCREENS.FACADE_REALISTIC && (
              <RealisticFacadeViewer cabinet={project.cabinet} projectName={project.name} />
            )}
          </main>
        </>
      )}
    </div>
  );
}