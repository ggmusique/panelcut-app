import React, { useMemo, useState } from 'react';
import useSketchState from './sketchpro/useSketchState';
import SketchToolbar from './sketchpro/SketchToolbar';
import SketchCanvasPro from './sketchpro/SketchCanvasPro';
import ModuleInspector from './sketchpro/ModuleInspector';
import ObjectsPanel from './sketchpro/ObjectsPanel';
import AnnotationsPanel from './sketchpro/AnnotationsPanel';
import JsonPreviewModal from './sketchpro/JsonPreviewModal';
import RefineBar from './sketchpro/RefineBar';

export default function SketchEditorPro({ image, initialResult, apiKey, draft, onDraftChange, onComplete, onCancel, onSave }) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [viewMode, setViewMode] = useState('split');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  const state = useSketchState({ image, initialResult, draft, onDraftChange, onComplete, onSave, apiKey });

  const projectName = useMemo(() => {
    const c = state.cabinetPreview || {};
    return `Meuble ${c.width || '?'}\u00d7${c.height || '?'} cm`;
  }, [state.cabinetPreview]);

  const inspector = (
    <aside className={isMobile
      ? `fixed left-0 right-0 bottom-14 z-40 bg-[#0f1620]/97 border-t border-slate-700 rounded-t-2xl backdrop-blur transition-transform ${mobileInspectorOpen ? 'translate-y-0' : 'translate-y-[82%]'}`
      : 'w-[360px] border-l border-slate-800 bg-slate-900/40 p-3 overflow-auto'}>
      {isMobile && (
        <button onClick={() => setMobileInspectorOpen((v) => !v)} className="w-full py-2 text-xs text-slate-300 border-b border-slate-700">
          {mobileInspectorOpen ? 'Masquer inspecteur' : 'Afficher inspecteur'}
        </button>
      )}
      <div className="space-y-3 p-3">
        <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
          <h3 className="text-sm font-semibold text-slate-100 mb-2">Cabinet</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['width', 'Largeur'],
              ['height', 'Hauteur'],
              ['depth', 'Profondeur'],
              ['thickness', '\u00c9paisseur'],
            ].map(([k, label]) => (
              <label key={k} className="text-slate-300">{label}
                <input value={state.draftState.cabinetDims[k]} onChange={(e) => state.setCabinetField(k, e.target.value)} className="mt-1 w-full px-2 py-1 rounded bg-slate-950 border border-slate-700" />
              </label>
            ))}
            <label className="text-slate-300 col-span-2">Nb modules
              <input value={state.draftState.facadeModules.length} onChange={(e) => state.setCabinetField('modulesCount', e.target.value)} className="mt-1 w-full px-2 py-1 rounded bg-slate-950 border border-slate-700" />
            </label>
          </div>
        </section>

        <ModuleInspector
          draftState={state.draftState}
          selectedModuleId={state.selectedModuleId}
          setSelectedModuleId={state.setSelectedModuleId}
          setModuleWidth={state.setModuleWidth}
        />

        <ObjectsPanel
          selectedModuleDetail={state.selectedModuleDetail}
          selectedModuleId={state.selectedModuleId}
          updateModuleObject={state.updateModuleObject}
          removeModuleObject={state.removeModuleObject}
        />

        <AnnotationsPanel
          annotations={state.draftState.facadeItems}
          selectedAnnotationId={state.selectedAnnotationId}
          setSelectedAnnotationId={state.setSelectedAnnotationId}
          updateFacadeAnnotation={state.updateFacadeAnnotation}
          removeFacadeAnnotation={state.removeFacadeAnnotation}
        />

        <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
          <h3 className="text-sm font-semibold text-slate-100 mb-2">Alertes</h3>
          {state.alerts.critical.map((a) => <p key={a} className="text-xs text-red-300">CRITIQUE: {a}</p>)}
          {state.alerts.warnings.map((a) => <p key={a} className="text-xs text-amber-300">AVERTISSEMENT: {a}</p>)}
          {state.alerts.ok && <p className="text-xs text-emerald-300">OK</p>}
        </section>

        <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
          <h3 className="text-sm font-semibold text-slate-100 mb-2">Corrections textuelles</h3>
          <textarea value={state.extraNotes} onChange={(e) => state.setExtraNotes(e.target.value)} className="w-full h-20 px-2 py-2 rounded bg-slate-950 border border-slate-700 text-xs" />
        </section>

        <details className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
          <summary className="cursor-pointer text-sm text-slate-100">Pr\u00e9visualisation JSON</summary>
          <pre className="text-[10px] text-slate-300 mt-2 overflow-auto max-h-56">{JSON.stringify(state.jsonPreview, null, 2)}</pre>
        </details>
      </div>
    </aside>
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#0f1620] text-slate-100 flex">
      {!isMobile && (
        <SketchToolbar
          tool={state.tool}
          setTool={state.setTool}
          zoomIn={() => state.setZoom((z) => Math.min(3, z + 0.1))}
          zoomOut={() => state.setZoom((z) => Math.max(0.35, z - 0.1))}
          fit={() => { state.setZoom(1); state.setPan({ x: 0, y: 0 }); }}
          reset={() => { state.setZoom(1); state.setPan({ x: 0, y: 0 }); state.setTool('select'); }}
        />
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/40 backdrop-blur">
          <div>
            <h2 className="text-sm font-semibold">SketchEditor Pro \u00b7 {projectName}</h2>
            <p className="text-[11px] text-slate-400">Brouillon synchronis\u00e9 \u00b7 API key {apiKey ? 'ok' : 'vide'}</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/60 p-1 text-xs">
            {[
              { id: 'scan',   label: '\ud83d\udcf7 Scan' },
              { id: 'split',  label: '\u2b1c Split' },
              { id: 'facade', label: '\ud83d\udcd0 Fa\u00e7ade' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  viewMode === id
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="p-3 border-b border-slate-800">
          <RefineBar
            alerts={state.alerts}
            isSending={state.isSending}
            sendError={state.sendError}
            onSave={state.saveCurrentCabinet}
            onPreview={() => setJsonOpen(true)}
            onSend={state.sendToClaude}
            onCancel={onCancel}
          />
        </div>

        <div className="flex-1 min-h-0 flex">
          <section className="flex-1 p-3 min-w-0">
            <SketchCanvasPro
              viewMode={viewMode}
              image={image}
              tool={state.tool}
              zoom={state.zoom}
              pan={state.pan}
              setPan={state.setPan}
              setZoom={state.setZoom}
              draftState={state.draftState}
              selectedModuleId={state.selectedModuleId}
              setSelectedModuleId={state.setSelectedModuleId}
              selectedAnnotationId={state.selectedAnnotationId}
              setSelectedAnnotationId={state.setSelectedAnnotationId}
              addFacadeAnnotation={state.addFacadeAnnotation}
              updateFacadeAnnotation={state.updateFacadeAnnotation}
              addModuleObject={state.addModuleObject}
              removeFacadeAnnotation={state.removeFacadeAnnotation}
            />
          </section>
          {!isMobile && inspector}
        </div>
      </main>

      {isMobile && (
        <SketchToolbar
          tool={state.tool}
          setTool={state.setTool}
          zoomIn={() => state.setZoom((z) => Math.min(3, z + 0.1))}
          zoomOut={() => state.setZoom((z) => Math.max(0.35, z - 0.1))}
          fit={() => { state.setZoom(1); state.setPan({ x: 0, y: 0 }); }}
          reset={() => { state.setZoom(1); state.setPan({ x: 0, y: 0 }); state.setTool('select'); }}
          mobile
        />
      )}

      {isMobile && inspector}

      <JsonPreviewModal open={jsonOpen} onClose={() => setJsonOpen(false)} payload={state.jsonPreview} />
    </div>
  );
}
