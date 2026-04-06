import { useState, useCallback, useEffect, useRef } from 'react';
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

const LS_SKETCH_KEY = 'pc_sketch_editor';

const DEFAULT_PROJECT = {
  name: '', client: '', company: '', devisNum: '',
  panel: { w: 244, h: 122, thickness: 1.8, label: 'MDF 18mm' },
  kerf: 3, tolerance: 10, pricePerPanel: 39.8,
  pieces: [], furniture: [], supabaseId: null, cabinet: null,
  scanImage: null, scanResult: null,
};

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
  [LS_SCREEN, LS_PROJECT, LS_RESULTS, LS_SKETCH_KEY].forEach(k => localStorage.removeItem(k));
}

// ─── Constantes SVG façade ────────────────────────────────────────────
const WOOD_FILL   = '#f5ede0';
const WOOD_STROKE = '#8b6914';
const DIM_COLOR   = '#dc2626';
const DOUBLE_COLOR = '#d97706';
const MARGIN      = { l: 65, r: 52, t: 55, b: 65 };
const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

function computeMRects(facadeModules, joints, thPx, drawW, drawH, mL, mT, plPx) {
  const innerH     = drawH - plPx;
  const totalSepPx = joints.reduce((acc, j) => acc + (j ? 2 * thPx : thPx), 0) + 2 * thPx;
  const avail      = drawW - totalSepPx;
  const totalModW  = facadeModules.reduce((a, m) => a + m.width, 0);
  const scale      = avail / Math.max(1, totalModW);
  let xCur = mL + thPx;
  return facadeModules.map((m, i) => {
    const wPx = m.width * scale;
    const r = {
      x: xCur, w: wPx, m, i,
      intTop:    mT + thPx,
      intBottom: mT + innerH - thPx,
      intH:      innerH - 2 * thPx,
      innerH,
    };
    xCur += wPx + (i < facadeModules.length - 1 ? (joints[i] ? 2 * thPx : thPx) : 0);
    return r;
  });
}

function FacadeCroquisView({ editorState, cabinet }) {
  const svgW = 1100;
  const svgH = 650;

  const facadeModules = editorState?.facadeModules;
  const facadeItems   = editorState?.facadeItems   || [];
  const joints        = editorState?.joints        || [];
  const cabinetDims   = editorState?.cabinetDims   || {
    width:  toNum(cabinet?.width,  200),
    height: toNum(cabinet?.height, 240),
    plinth: toNum(cabinet?.plinth,   0),
  };

  if (!facadeModules || facadeModules.length === 0) {
    return <CabinetElevationFront cabinet={cabinet} name="Meuble" />;
  }

  const cabW  = cabinetDims.width;
  const cabH  = cabinetDims.height;
  const plinth = cabinetDims.plinth;
  const thick  = toNum(cabinet?.thickness ?? cabinet?.panel_thickness, 1.8);

  const drawW = svgW - MARGIN.l - MARGIN.r;
  const drawH = svgH - MARGIN.t  - MARGIN.b;
  const thPx  = thick * (drawW / Math.max(1, cabW));
  const plPx  = plinth * (drawH / Math.max(1, cabH));
  const innerH = drawH - plPx;
  const mL = MARGIN.l;
  const mT = MARGIN.t;
  const mRects = computeMRects(facadeModules, joints, thPx, drawW, drawH, mL, mT, plPx);

  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600/20 to-blue-600/20 rounded-xl blur-lg" />
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="relative w-full h-auto bg-white rounded-xl border border-slate-200 shadow-xl"
      >
        <defs>
          <linearGradient id="fcGW" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#dcc89a"/>
            <stop offset="45%"  stopColor="#f5ede0"/>
            <stop offset="100%" stopColor="#dcc89a"/>
          </linearGradient>
          <linearGradient id="fcGT" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#c4a87a"/>
            <stop offset="100%" stopColor="#e8d5b0"/>
          </linearGradient>
          <linearGradient id="fcGDoor" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#e8dcc8" stopOpacity="0.75"/>
            <stop offset="50%"  stopColor="#f8f0e4" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#ddd0ba" stopOpacity="0.75"/>
          </linearGradient>
          <linearGradient id="fcGDouble" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#dcc89a"/>
            <stop offset="48%"  stopColor="#e8d5b0"/>
            <stop offset="52%"  stopColor="#c9b068"/>
            <stop offset="100%" stopColor="#dcc89a"/>
          </linearGradient>
          <marker id="fcArrR" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0L8 4L0 8Z" fill="#dc2626" />
          </marker>
          <marker id="fcArrL" viewBox="0 0 8 8" refX="1" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M8 0L0 4L8 8Z" fill="#dc2626" />
          </marker>
          <marker id="fcArrU" viewBox="0 0 8 8" refX="4" refY="1" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 8L4 0L8 8Z" fill="#dc2626" />
          </marker>
          <marker id="fcArrD" viewBox="0 0 8 8" refX="4" refY="7" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0L4 8L8 0Z" fill="#dc2626" />
          </marker>
        </defs>

        <text x={svgW/2} y={22} textAnchor="middle" fontSize={13} fontWeight="700" fill="#334155">
          {cabW} × {cabH} cm{plinth > 0 ? ` + ${plinth} cm plinthe` : ''}
        </text>

        <rect x={mL} y={mT} width={drawW} height={drawH} fill="url(#fcGW)" stroke={WOOD_STROKE} strokeWidth="2.5"/>
        <rect x={mL+thPx} y={mT+thPx} width={drawW-2*thPx} height={innerH-thPx} fill="#ede4d3"/>
        {plPx > 2 && (
          <g>
            <rect x={mL} y={mT+innerH} width={drawW} height={plPx} fill="#c8b07c" stroke={WOOD_STROKE} strokeWidth="1.5"/>
            <line x1={mL} y1={mT+innerH} x2={mL+drawW} y2={mT+innerH} stroke={WOOD_STROKE} strokeWidth="2"/>
          </g>
        )}
        <rect x={mL}             y={mT} width={thPx}  height={innerH} fill="url(#fcGW)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
        <rect x={mL+drawW-thPx}  y={mT} width={thPx}  height={innerH} fill="url(#fcGW)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
        <rect x={mL} y={mT}              width={drawW}  height={thPx}  fill="url(#fcGT)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
        <rect x={mL} y={mT+innerH-thPx}  width={drawW}  height={thPx}  fill="url(#fcGT)" stroke={WOOD_STROKE} strokeWidth="1.5"/>

        {mRects.map(({ x, w, i }) => {
          if (i >= facadeModules.length - 1) return null;
          const isDouble = joints[i];
          const sepX = x + w;
          return isDouble ? (
            <g key={`sep-${i}`}>
              <rect x={sepX}      y={mT} width={thPx} height={innerH} fill="url(#fcGDouble)" stroke={WOOD_STROKE} strokeWidth="1"/>
              <rect x={sepX+thPx} y={mT} width={thPx} height={innerH} fill="url(#fcGDouble)" stroke={WOOD_STROKE} strokeWidth="1"/>
              <line x1={sepX+thPx} y1={mT+2} x2={sepX+thPx} y2={mT+innerH-2}
                stroke={DOUBLE_COLOR} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9"/>
            </g>
          ) : (
            <rect key={`sep-${i}`} x={sepX} y={mT} width={thPx} height={innerH}
              fill="url(#fcGW)" stroke={WOOD_STROKE} strokeWidth="1"/>
          );
        })}

        {mRects.map(({ x, w, m, i, intTop, intBottom, intH: iH }) => {
          const nbD     = m.drawers || 0;
          const drawerH = Math.min(iH * 0.15, 46);
          const drawPx  = nbD * drawerH;
          const nbDoors = m.doors || 0;
          const numY    = intTop + Math.max(30, (iH - drawPx) * 0.45);

          const tiroirs = Array.from({ length: nbD }, (_, di) => {
            const dy = intBottom - drawPx + di * drawerH;
            return (
              <g key={`dr-${i}-${di}`}>
                <rect x={x+2} y={dy+1} width={w-4} height={drawerH-2} fill="rgba(139,92,246,0.08)" stroke="#6d28d9" strokeWidth="1.3" rx="1"/>
                <rect x={x+w/2-14} y={dy+drawerH/2-3.5} width="28" height="7" fill="none" stroke="#4c1d95" strokeWidth="1.8" rx="3"/>
              </g>
            );
          });

          const nd     = Math.min(nbDoors, 2);
          const portes = Array.from({ length: nd }, (_, di) => {
            const dw  = nd === 2 ? w / 2 : w;
            const dx  = nd === 2 && di === 1 ? x + w / 2 : x;
            const pad = Math.max(8, dw * 0.08);
            const hx2 = di === 0 ? dx + dw - 14 : dx + 10;
            return (
              <g key={`door-${i}-${di}`}>
                <rect x={dx+2} y={intTop+2} width={dw-4} height={iH-4} fill="url(#fcGDoor)" stroke={WOOD_STROKE} strokeWidth="1.5" rx="1"/>
                <rect x={dx+pad} y={intTop+pad} width={dw-2*pad} height={iH-2*pad} fill="none" stroke={WOOD_STROKE} strokeWidth="0.8" opacity="0.5"/>
                <rect x={hx2-4} y={intTop+iH/2-10} width="8" height="20" fill="#a0a0a0" stroke="#666" strokeWidth="0.8" rx="3"/>
              </g>
            );
          });

          return (
            <g key={`mod-${i}`}>
              <rect x={x} y={intTop} width={w} height={iH} fill="#faf5ed" stroke={WOOD_STROKE} strokeWidth="0.7"/>
              {tiroirs}
              {portes}
              <circle cx={x+w/2} cy={numY} r="20" fill="none" stroke={DIM_COLOR} strokeWidth="2"/>
              <text x={x+w/2} y={numY+6} textAnchor="middle" fill={DIM_COLOR} fontWeight="700" fontSize="17">{i+1}</text>
              <line x1={x}   y1={mT+drawH+10} x2={x+w} y2={mT+drawH+10} stroke="#b45309" strokeWidth="1"
                markerStart="url(#fcArrL)" markerEnd="url(#fcArrR)"/>
              <line x1={x}   y1={mT+drawH+6}  x2={x}   y2={mT+drawH+14} stroke="#b45309" strokeWidth="1"/>
              <line x1={x+w} y1={mT+drawH+6}  x2={x+w} y2={mT+drawH+14} stroke="#b45309" strokeWidth="1"/>
              <text x={x+w/2} y={mT+drawH+28} textAnchor="middle" fill="#b45309" fontWeight="700" fontSize="11">{m.width.toFixed(2)} cm</text>
            </g>
          );
        })}

        {facadeItems.map(item => {
          const mr = mRects[item.modIdx];
          if (!mr) return null;
          const { x, w, intTop, intH: iH } = mr;
          const ey = intTop + item.yRatio * iH;
          if (item.type === 'shelf') {
            return (
              <g key={item.id}>
                <rect x={x} y={ey-3.5} width={w} height={6.5} fill={WOOD_FILL} stroke={WOOD_STROKE} strokeWidth="1"/>
                <circle cx={x+9}   cy={ey} r="2.5" fill={WOOD_STROKE}/>
                <circle cx={x+w-9} cy={ey} r="2.5" fill={WOOD_STROKE}/>
              </g>
            );
          }
          if (item.type === 'rod') {
            return (
              <g key={item.id}>
                <rect x={x+8}    y={ey-10} width="7"  height="18" fill="#6b7280" rx="2"/>
                <rect x={x+w-15} y={ey-10} width="7"  height="18" fill="#6b7280" rx="2"/>
                <line x1={x+16} y1={ey} x2={x+w-15} y2={ey} stroke="#4b5563" strokeWidth="6" strokeLinecap="round"/>
                <line x1={x+16} y1={ey-2} x2={x+w-15} y2={ey-2} stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
              </g>
            );
          }
          return null;
        })}

        <line x1={mL} y1={mT-26} x2={mL+drawW} y2={mT-26} stroke={DIM_COLOR} strokeWidth="1.5"
          markerStart="url(#fcArrL)" markerEnd="url(#fcArrR)"/>
        <line x1={mL}       y1={mT-32} x2={mL}       y2={mT-20} stroke={DIM_COLOR} strokeWidth="1.5"/>
        <line x1={mL+drawW} y1={mT-32} x2={mL+drawW} y2={mT-20} stroke={DIM_COLOR} strokeWidth="1.5"/>
        <text x={mL+drawW/2} y={mT-30} textAnchor="middle" fill={DIM_COLOR} fontSize="13" fontWeight="700">{cabW} cm</text>
        <line x1={mL+drawW+24} y1={mT}       x2={mL+drawW+24} y2={mT+drawH} stroke={DIM_COLOR} strokeWidth="1.5"
          markerStart="url(#fcArrU)" markerEnd="url(#fcArrD)"/>
        <line x1={mL+drawW+18} y1={mT}       x2={mL+drawW+30} y2={mT}       stroke={DIM_COLOR} strokeWidth="1.5"/>
        <line x1={mL+drawW+18} y1={mT+drawH} x2={mL+drawW+30} y2={mT+drawH} stroke={DIM_COLOR} strokeWidth="1.5"/>
        <text x={mL+drawW+40} y={mT+drawH/2} textAnchor="middle" fill={DIM_COLOR} fontSize="13" fontWeight="700"
          transform={`rotate(90 ${mL+drawW+40} ${mT+drawH/2})`}>{cabH} cm</text>
      </svg>

      <div className="mt-2 flex justify-center">
        <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          ✏️ Plan depuis l'éditeur intelligent — modifiez-le pour mettre à jour cette vue
        </span>
      </div>
    </div>
  );
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

  const sketchCalledFrom = useRef(SCREENS.WIZARD);
  const [editorState, setEditorState] = useState(null);

  useEffect(() => {
    if (screen === SCREENS.FACADE) {
      const state = lsGet(LS_SKETCH_KEY, null);
      setEditorState(state);
    }
  }, [screen]);

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
    localStorage.removeItem(LS_SKETCH_KEY);
    setEditorState(null);
    setProject({ ...DEFAULT_PROJECT, devisNum });
    setResults(null);
    setScreen(SCREENS.WIZARD);
  };

  const openEditorFromFacade = () => {
    sketchCalledFrom.current = SCREENS.FACADE;
    setScreen(SCREENS.SKETCH);
  };

  const goBack = () => {
    if      (screen === SCREENS.FACADE_REALISTIC) setScreen(SCREENS.FACADE);
    else if (screen === SCREENS.FACADE)           setScreen(SCREENS.RESULTS);
    else if (screen === SCREENS.WIZARD)           setScreen(SCREENS.LANDING);
    else if (screen === SCREENS.SKETCH) {
      setScreen(sketchCalledFrom.current || SCREENS.WIZARD);
      sketchCalledFrom.current = SCREENS.WIZARD;
    }
    else if (screen === SCREENS.PIECES)           setScreen(SCREENS.WIZARD);
    else if (screen === SCREENS.RESULTS)          setScreen(SCREENS.PIECES);
    else if (screen === SCREENS.HISTORY)          setScreen(SCREENS.LANDING);
    else if (screen === SCREENS.AUTH)             setScreen(SCREENS.LANDING);
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

  const canGoNext = screen === SCREENS.PIECES && project.pieces.length > 0 && !computing;
  const showNext = screen === SCREENS.PIECES;

  const goNext = () => {
    if (screen === SCREENS.PIECES) handleOptimize();
  };

  const handleLoadProject = async (id) => {
    const { data, error } = await loadProject(id);
    if (error || !data) return;
    localStorage.removeItem(LS_SKETCH_KEY);
    setEditorState(null);
    const p = { ...data.project_data, supabaseId: data.id };
    setProject(p);
    if (data.results_data) { setResults(data.results_data); setScreen(SCREENS.RESULTS); }
    else setScreen(SCREENS.PIECES);
  };

  const handleScanComplete = (scanResult, scanImageBase64) => {
    const pieces = (scanResult.pieces || []).map(p => ({
      name:   String(p.name   || 'Pièce').trim(),
      length: Math.abs(parseFloat(p.length) || 0),
      height: Math.abs(parseFloat(p.height) || 0),
      qty:    Math.max(1, parseInt(p.qty, 10) || 1),
    })).filter(p => p.length > 0 && p.height > 0);

    const cabinet = scanResult.cabinet || null;

    localStorage.removeItem(LS_SKETCH_KEY);
    setEditorState(null);

    setProject(prev => ({
      ...prev,
      pieces,
      cabinet,
      scanImage:  scanImageBase64 || null,
      scanResult: scanResult,
    }));
    setResults(null);
    sketchCalledFrom.current = SCREENS.WIZARD;
    setScreen(SCREENS.SKETCH);
  };

  // ─── Retour depuis l'éditeur intelligent ("Relancer Claude") ────────────────────
  // On fusionne intelligemment le cabinet :
  //   - Si Claude retourne un cabinet avec width>0 ET height>0 → on l'utilise
  //   - Sinon on garde le cabinet existant du projet (évite hasCabinet=false)
  const handleRefinementComplete = (newScanResult) => {
    const rawPieces = newScanResult.pieces || [];
    const newPieces = rawPieces
      .map(p => ({
        name:   String(p.name   || 'Pièce').trim(),
        length: Math.abs(parseFloat(p.length) || 0),
        height: Math.abs(parseFloat(p.height) || 0),
        qty:    Math.max(1, parseInt(p.qty, 10) || 1),
      }))
      .filter(p => p.length > 0 && p.height > 0);

    // ── Cabinet : ne prendre le nouveau que si width>0 ET height>0
    const newCab = newScanResult.cabinet;
    const newCabValid = newCab && Number(newCab.width) > 0 && Number(newCab.height) > 0;
    const cabinet = newCabValid ? newCab : project.cabinet;

    // ── Pièces : si Claude ne renvoie pas de pièces, on garde celles du projet
    const piecesToUse = newPieces.length > 0 ? newPieces : project.pieces;

    setProject(p => ({ ...p, pieces: piecesToUse, cabinet, scanResult: newScanResult }));

    const dest = sketchCalledFrom.current === SCREENS.FACADE ? SCREENS.FACADE : SCREENS.PIECES;
    sketchCalledFrom.current = SCREENS.WIZARD;
    setScreen(dest);
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
    headerTitle = screen === SCREENS.FACADE ? '📐 Façade — Plan éditeur' : '🖼️ Vue Réaliste Client';
    steps = [{ label: 'Panneau', active: true }, { label: 'Pièces', active: true }, { label: 'Façade', active: true }]; 
  }

  const hasHeader = ![SCREENS.AUTH, SCREENS.SKETCH, SCREENS.LANDING, SCREENS.WIZARD, SCREENS.HISTORY].includes(screen);
  const hasSteps  = steps.length > 0;

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
          onCancel={goBack}
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
                    onClick={() => { sketchCalledFrom.current = SCREENS.PIECES; setScreen(SCREENS.SKETCH); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600/30 hover:text-cyan-300 transition-all"
                    title="Annoter le croquis et relancer Claude">
                    ✏️ <span className="hidden sm:inline">Annoter</span>
                  </button>
                )}

                {screen === SCREENS.FACADE && (
                  <button
                    onClick={openEditorFromFacade}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30 hover:text-orange-300 transition-all"
                    title="Modifier dans l'éditeur intelligent">
                    ✏️ <span className="hidden sm:inline">Modifier</span>
                  </button>
                )}
                
                {(screen === SCREENS.FACADE || screen === SCREENS.FACADE_REALISTIC) && (
                  <button
                    onClick={() => setScreen(screen === SCREENS.FACADE ? SCREENS.FACADE_REALISTIC : SCREENS.FACADE)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 transition-all"
                  >
                    {screen === SCREENS.FACADE ? '🖼️ Vue Client' : '📐 Façade'}
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
              <div className="max-w-5xl mx-auto">
                <FacadeCroquisView
                  editorState={editorState}
                  cabinet={project.cabinet}
                />
                <div className="mt-6 flex flex-wrap justify-center gap-4">
                  <button
                    onClick={openEditorFromFacade}
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
                  >
                    ✏️ Modifier dans l'éditeur intelligent
                  </button>
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
