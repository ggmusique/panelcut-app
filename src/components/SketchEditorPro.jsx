import React, { useMemo, useState } from 'react';
import { Eye, Save, SendHorizonal } from 'lucide-react';
import useSketchState from './sketchpro/useSketchState';
import ToolbarLeft from './sketchpro/ToolbarLeft';
import CanvasArea from './sketchpro/CanvasArea';
import InspectorPanel from './sketchpro/InspectorPanel';
import JsonPreviewModal from './sketchpro/JsonPreviewModal';

export default function SketchEditorPro({ image, initialResult, apiKey, draft, onDraftChange, onComplete, onCancel, onSave }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  const state = useSketchState({ image, initialResult, draft, onDraftChange, onComplete, onSave, apiKey });

  const statusText = useMemo(() => {
    if (state.alerts.critical.length) return 'Bloqué';
    if (state.alerts.warning.length) return 'À vérifier';
    return 'Prêt';
  }, [state.alerts]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0f1620] text-slate-200 flex">
      {!isMobile && (
        <ToolbarLeft tool={state.tool} setTool={state.setTool} zoom={state.zoom} setZoom={state.setZoom} setPan={state.setPan} />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-4 border-b border-slate-800 bg-[#0f1620]/95 backdrop-blur flex items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Sketch Editor Pro</h2>
            <p className="text-[11px] text-slate-400">Statut: <span className="text-orange-400">{statusText}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={state.saveDraft} className="px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 inline-flex items-center gap-1"><Save size={14} /> Sauver brouillon</button>
            <button onClick={() => state.setJsonPreview(true)} className="px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 inline-flex items-center gap-1"><Eye size={14} /> Prévisualiser JSON</button>
            <button
              onClick={state.sendToClaude}
              disabled={state.alerts.critical.length > 0 || state.isSending}
              className="px-3 py-2 text-xs rounded-xl bg-orange-500 text-black font-semibold disabled:opacity-40 inline-flex items-center gap-1"
            >
              <SendHorizonal size={14} /> {state.isSending ? 'Envoi...' : 'Envoyer à Claude'}
            </button>
            <button onClick={onCancel} className="px-3 py-2 text-xs rounded-xl bg-slate-700 hover:bg-slate-600">Retour</button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex">
          <section className="flex-1 p-3 min-w-0">
            <CanvasArea
              image={image}
              tool={state.tool}
              annotations={state.annotations}
              selectedId={state.selectedId}
              setSelectedId={state.setSelectedId}
              addAnnotation={state.addAnnotation}
              removeAnnotation={state.removeAnnotation}
              updateAnnotation={state.updateAnnotation}
              openObjectPopover={state.openObjectPopover}
              objectPopover={state.objectPopover}
              confirmObjectPopover={state.confirmObjectPopover}
              setObjectPopover={state.setObjectPopover}
              zoom={state.zoom}
              pan={state.pan}
              setPan={state.setPan}
              setMousePos={state.setMousePos}
            />
            <div className="mt-2 rounded-xl border border-slate-800 bg-[#0b1119] px-3 py-2 text-xs text-slate-400 flex flex-wrap gap-3">
              <span>Outil actif: <span className="text-slate-200">{state.tool}</span></span>
              <span>Annotations: <span className="text-slate-200">{state.annotations.length}</span></span>
              <span>Zoom: <span className="text-slate-200">{Math.round(state.zoom * 100)}%</span></span>
              <span>Coord: <span className="text-slate-200">{state.mousePos.x}, {state.mousePos.y}</span></span>
            </div>
          </section>

          <InspectorPanel
            cabinetDims={state.cabinetDims}
            setCabinetDims={state.setCabinetDims}
            moduleIndex={state.moduleIndex}
            setModuleIndex={state.setModuleIndex}
            moduleObjects={state.moduleObjects}
            annotations={state.annotations}
            updateAnnotation={state.updateAnnotation}
            removeAnnotation={state.removeAnnotation}
            alerts={state.alerts}
            extraNotes={state.extraNotes}
            setExtraNotes={state.setExtraNotes}
            resultJson={state.resultJson}
            mobile={isMobile}
            open={mobileInspectorOpen}
            setOpen={setMobileInspectorOpen}
          />
        </div>
      </main>

      {isMobile && (
        <ToolbarLeft tool={state.tool} setTool={state.setTool} zoom={state.zoom} setZoom={state.setZoom} setPan={state.setPan} mobile />
      )}

      <JsonPreviewModal open={state.jsonPreview} onClose={() => state.setJsonPreview(false)} data={state.resultJson} />
    </div>
  );
}
