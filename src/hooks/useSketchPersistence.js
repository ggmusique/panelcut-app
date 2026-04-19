import { useRef, useState, useCallback, useEffect, useMemo } from 'react';

const LS_SKETCH_KEY               = 'pc_sketch_editor';
const REMOTE_AUTOSAVE_INTERVAL_MS = 30000;

/**
 * Gère la persistence locale (localStorage) et la sauvegarde distante (onSave).
 *
 * @param {Object} params
 * @param {Array}    params.elements
 * @param {Object}   params.cabinetDims
 * @param {Array}    params.facadeModules
 * @param {Array}    params.facadeItems
 * @param {Array}    params.moduleDetails
 * @param {string}   params.generalNotes
 * @param {Array}    params.joints
 * @param {Object}   params.globalSliding
 * @param {string}   params.sketchFingerprint
 * @param {Function} params.onSave
 * @param {Function} params.onDraftChange
 * @param {Object}   params.currentCabinet
 *
 * @returns {{ triggerRemoteSave: Function, autoSaveBackoffMs: number }}
 */
export function useSketchPersistence({
  elements,
  cabinetDims,
  facadeModules,
  facadeItems,
  moduleDetails,
  generalNotes,
  joints,
  globalSliding,
  sketchFingerprint,
  onSave,
  onDraftChange,
  currentCabinet,
}) {
  const onDraftChangeRef = useRef(onDraftChange);
  useEffect(() => { onDraftChangeRef.current = onDraftChange; }, [onDraftChange]);

  const facadeItemsRef = useRef(facadeItems);
  useEffect(() => { facadeItemsRef.current = facadeItems; }, [facadeItems]);

  // Sauvegarde automatique vers localStorage + onDraftChange à chaque changement d'état
  useEffect(() => {
    const payload = {
      fingerprint: sketchFingerprint,
      state: {
        elements,
        cabinetDims,
        facadeModules,
        facadeItems: facadeItemsRef.current,
        moduleDetails,
        generalNotes,
        joints,
        globalSliding,
      },
    };
    try {
      localStorage.setItem(LS_SKETCH_KEY, JSON.stringify(payload));
      if (onDraftChangeRef.current) onDraftChangeRef.current(payload);
    } catch {}
  }, [
    elements,
    cabinetDims,
    facadeModules,
    facadeItems,
    moduleDetails,
    generalNotes,
    joints,
    globalSliding,
    sketchFingerprint,
  ]);

  const saveToStorage = useCallback(() => {
    const payload = {
      fingerprint: sketchFingerprint,
      state: {
        elements, cabinetDims, facadeModules, facadeItems, moduleDetails, generalNotes, joints,
        globalSliding,
      },
    };
    localStorage.setItem(LS_SKETCH_KEY, JSON.stringify(payload));
    if (onDraftChangeRef.current) onDraftChangeRef.current(payload);
  }, [elements, cabinetDims, facadeModules, facadeItems, moduleDetails, generalNotes, joints, globalSliding, sketchFingerprint]);

  const remoteSaveSnapshot = useMemo(() => JSON.stringify({
    cabinetDims,
    facadeModules,
    facadeItems,
    moduleDetails,
    generalNotes,
    joints,
    globalSliding,
  }), [cabinetDims, facadeModules, facadeItems, moduleDetails, generalNotes, joints, globalSliding]);

  const lastAutoSavedSnapshotRef = useRef('');
  const autoSavingRef            = useRef(false);
  const [autoSaveBackoffMs, setAutoSaveBackoffMs] = useState(REMOTE_AUTOSAVE_INTERVAL_MS);

  const triggerRemoteSave = useCallback(async () => {
    saveToStorage();
    if (!onSave || !currentCabinet || autoSavingRef.current) return;
    autoSavingRef.current = true;
    try {
      await onSave(currentCabinet);
      lastAutoSavedSnapshotRef.current = remoteSaveSnapshot;
      setAutoSaveBackoffMs(REMOTE_AUTOSAVE_INTERVAL_MS);
    } catch {
      setAutoSaveBackoffMs((v) => Math.min(120000, Math.max(REMOTE_AUTOSAVE_INTERVAL_MS, v * 2)));
    } finally {
      autoSavingRef.current = false;
    }
  }, [saveToStorage, onSave, currentCabinet, remoteSaveSnapshot]);

  // Autosave distante avec backoff
  useEffect(() => {
    if (!onSave) return;
    const timer = window.setTimeout(() => {
      if (remoteSaveSnapshot === lastAutoSavedSnapshotRef.current) return;
      void triggerRemoteSave();
    }, autoSaveBackoffMs);
    return () => window.clearTimeout(timer);
  }, [onSave, remoteSaveSnapshot, triggerRemoteSave, autoSaveBackoffMs]);

  return { triggerRemoteSave, autoSaveBackoffMs };
}
