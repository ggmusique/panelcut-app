import React from 'react';
import {
  MousePointer2, Ruler, Type, ArrowUpRight, Eraser,
  Minus, LayoutPanelTop, CircleDot, DoorOpen, PanelLeft,
  ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';

const groups = [
  [
    { id: 'select', icon: MousePointer2, label: 'Sélection' },
    { id: 'dim', icon: Ruler, label: 'Cote' },
    { id: 'note', icon: Type, label: 'Texte/Note' },
    { id: 'arrow', icon: ArrowUpRight, label: 'Flèche' },
    { id: 'erase', icon: Eraser, label: 'Gomme' },
  ],
  [
    { id: 'shelf', icon: Minus, label: 'Tablette' },
    { id: 'drawer', icon: LayoutPanelTop, label: 'Tiroir' },
    { id: 'rod', icon: CircleDot, label: 'Tringle' },
    { id: 'door', icon: DoorOpen, label: 'Porte battante' },
    { id: 'sliding_door', icon: PanelLeft, label: 'Porte coulissante' },
  ],
];

export default function ToolbarLeft({ tool, setTool, zoom, setZoom, setPan, mobile = false }) {
  const wrapperCls = mobile
    ? 'fixed bottom-0 left-0 right-0 z-40 bg-[#0f1620]/95 border-t border-slate-700 backdrop-blur overflow-x-auto'
    : 'w-16 border-r border-slate-800 bg-[#0b1119] flex flex-col items-center py-3 gap-2';

  return (
    <aside className={wrapperCls}>
      <div className={mobile ? 'flex items-center gap-2 px-3 py-2 min-w-max' : 'flex flex-col items-center gap-2'}>
        {groups.map((grp, gi) => (
          <React.Fragment key={gi}>
            {grp.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                title={label}
                onClick={() => setTool(id)}
                className={`h-10 w-10 rounded-xl border flex items-center justify-center transition ${
                  tool === id ? 'bg-orange-500 text-black border-orange-300' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
            {gi !== groups.length - 1 && <div className={mobile ? 'w-px h-8 bg-slate-700 mx-1' : 'h-px w-8 bg-slate-700 my-1'} />}
          </React.Fragment>
        ))}
        <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))} className="h-10 w-10 rounded-xl border bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 flex items-center justify-center" title="Zoom +"><ZoomIn size={18} /></button>
        <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} className="h-10 w-10 rounded-xl border bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 flex items-center justify-center" title="Zoom -"><ZoomOut size={18} /></button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="h-10 w-10 rounded-xl border bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 flex items-center justify-center" title="Fit"><Maximize2 size={18} /></button>
      </div>
    </aside>
  );
}
