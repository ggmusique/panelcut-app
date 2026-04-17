import React from 'react';
import {
  MousePointer2, Ruler, Type, ArrowUpRight, Eraser,
  Minus, LayoutPanelTop, CircleDot, DoorOpen, PanelLeft,
  ZoomIn, ZoomOut, Maximize2, RefreshCw,
} from 'lucide-react';
import { TOOL_IDS } from './utils';

const tools = [
  { id: TOOL_IDS.SELECT, icon: MousePointer2, label: 'Select' },
  { id: TOOL_IDS.DIM, icon: Ruler, label: 'Cote' },
  { id: TOOL_IDS.NOTE, icon: Type, label: 'Note' },
  { id: TOOL_IDS.ARROW, icon: ArrowUpRight, label: 'Flèche' },
  { id: TOOL_IDS.ERASE, icon: Eraser, label: 'Gomme' },
  { separator: true },
  { id: TOOL_IDS.SHELF, icon: Minus, label: 'Tablette' },
  { id: TOOL_IDS.DRAWER, icon: LayoutPanelTop, label: 'Tiroir' },
  { id: TOOL_IDS.ROD, icon: CircleDot, label: 'Tringle' },
  { id: TOOL_IDS.DOOR, icon: DoorOpen, label: 'Porte' },
  { id: TOOL_IDS.SLIDING, icon: PanelLeft, label: 'Coulissante' },
];

export default function SketchToolbar({ tool, setTool, zoomIn, zoomOut, fit, reset, mobile = false }) {
  const root = mobile
    ? 'fixed bottom-0 left-0 right-0 z-50 bg-[#0f1620]/95 border-t border-slate-700 backdrop-blur overflow-x-auto'
    : 'w-16 bg-slate-900/70 border-r border-slate-800 p-2 flex flex-col items-center gap-2';

  return (
    <aside className={root}>
      <div className={mobile ? 'flex items-center gap-2 px-3 py-2 min-w-max' : 'flex flex-col items-center gap-2'}>
        {tools.map((t, idx) => {
          if (t.separator) return <div key={`sep-${idx}`} className={mobile ? 'w-px h-8 bg-slate-700 mx-1' : 'h-px w-8 bg-slate-700 my-1'} />;
          const Icon = t.icon;
          return (
            <button key={t.id} title={t.label} onClick={() => setTool(t.id)}
              className={`h-10 w-10 rounded-xl border flex items-center justify-center transition ${tool === t.id ? 'bg-orange-500 text-black border-orange-300 shadow' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'}`}>
              <Icon size={18} />
            </button>
          );
        })}
        <button onClick={zoomIn} title="Zoom +" className="h-10 w-10 rounded-xl border bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 flex items-center justify-center"><ZoomIn size={18} /></button>
        <button onClick={zoomOut} title="Zoom -" className="h-10 w-10 rounded-xl border bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 flex items-center justify-center"><ZoomOut size={18} /></button>
        <button onClick={fit} title="Fit" className="h-10 w-10 rounded-xl border bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 flex items-center justify-center"><Maximize2 size={18} /></button>
        <button onClick={reset} title="Reset" className="h-10 w-10 rounded-xl border bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 flex items-center justify-center"><RefreshCw size={18} /></button>
      </div>
    </aside>
  );
}
