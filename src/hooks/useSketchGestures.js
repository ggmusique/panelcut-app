import { useRef, useState, useCallback } from 'react';
import { MARGIN, computeMRects } from '../components/FacadeCanvas';
import { LS_SKETCH_KEY, uid } from '../utils/sketchEditorConstants';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Gère toute la logique de pan/zoom/pinch et de drag sur le canvas SVG.
 *
 * @param {Object} params
 * @param {React.RefObject} params.svgRef
 * @param {{ w: number, h: number }} params.imgSize
 * @param {boolean} params.isNavMode
 * @param {string} params.baseView
 * @param {string} params.tool
 * @param {Array} params.elements
 * @param {Array} params.facadeItems
 * @param {Function} params.setElements
 * @param {Function} params.setFacadeItems
 * @param {Function} params.setEditingDimId
 * @param {string} params.sketchFingerprint
 * @param {Object} params.cabinetDims
 * @param {Array} params.facadeModules
 * @param {Array} params.moduleDetails
 * @param {string} params.generalNotes
 * @param {Array} params.joints
 * @param {Object} params.globalSliding
 * @param {number} params.thickness
 */
export function useSketchGestures({
  svgRef,
  imgSize,
  isNavMode,
  baseView,
  tool,
  elements,
  facadeItems,
  setElements,
  setFacadeItems,
  setEditingDimId,
  sketchFingerprint,
  cabinetDims,
  facadeModules,
  moduleDetails,
  generalNotes,
  joints,
  globalSliding,
  thickness,
}) {
  const drag      = useRef({ on: false, startX: 0, startY: 0, elStartX: 0, elStartY: 0 });
  const facadeDrag = useRef({ active: false, itemId: null, startY: 0, startYRatio: 0, modIdx: -1 });
  const panRef    = useRef({ active: false, startX: 0, startY: 0, vX: 0, vY: 0 });
  const pinchRef  = useRef({ active: false, dist: 0, centerX: 0, centerY: 0, base: { x: 0, y: 0, w: 0, h: 0 } });

  const [viewport,   setViewport]   = useState({ x: 0, y: 0, w: 800, h: 600 });
  const [draggingId, setDraggingId] = useState(null);
  const [resizingId, setResizingId] = useState(null);

  const getSVGCoords = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect   = svg.getBoundingClientRect();
    const scaleX = viewport.w / rect.width;
    const scaleY = viewport.h / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(imgSize.w, viewport.x + (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(imgSize.h, viewport.y + (clientY - rect.top)  * scaleY)),
    };
  }, [imgSize, viewport, svgRef]);

  const clampViewport = useCallback((next) => {
    const minW = imgSize.w * 0.35;
    const minH = imgSize.h * 0.35;
    const w = Math.max(minW, Math.min(imgSize.w, next.w));
    const h = Math.max(minH, Math.min(imgSize.h, next.h));
    const x = Math.max(0, Math.min(imgSize.w - w, next.x));
    const y = Math.max(0, Math.min(imgSize.h - h, next.y));
    return { x, y, w, h };
  }, [imgSize]);

  const resetViewport = useCallback(() => {
    setViewport({ x: 0, y: 0, w: imgSize.w, h: imgSize.h });
  }, [imgSize]);

  const getFacadeGeometry = useCallback(() => {
    const drawW = imgSize.w - MARGIN.l - MARGIN.r;
    const drawH = imgSize.h - MARGIN.t  - MARGIN.b;
    const thPx  = thickness * (drawW / Math.max(1, cabinetDims.width));
    const plPx  = cabinetDims.plinth * (drawH / Math.max(1, cabinetDims.height));
    return computeMRects(facadeModules, joints, thPx, drawW, drawH, MARGIN.l, MARGIN.t, plPx);
  }, [imgSize, thickness, cabinetDims, facadeModules, joints]);

  const handleFacadePointerDown = useCallback((e, modIdx) => {
    e.stopPropagation();
    const mRects = getFacadeGeometry();
    const mr     = mRects[modIdx];
    if (!mr) return;
    let yRatio;
    let startY = 0;
    if (e._konvaYRatio !== undefined) {
      yRatio = e._konvaYRatio;
    } else {
      const { y } = getSVGCoords(e);
      startY = y;
      yRatio = clamp((y - mr.intTop) / mr.intH, 0.02, 0.98);
    }
    const newItem = { id: uid(), type: tool, modIdx, yRatio };
    setFacadeItems(prev => [...prev, newItem]);
    setFacadeItems(prev => {
      const next = [...prev];
      setTimeout(() => {
        localStorage.setItem(LS_SKETCH_KEY, JSON.stringify({
          fingerprint: sketchFingerprint,
          state: {
            elements, cabinetDims, facadeModules, facadeItems: next,
            moduleDetails, generalNotes, joints, globalSliding,
          },
        }));
      }, 0);
      return next;
    });
    facadeDrag.current = { active: true, itemId: newItem.id, startY, startYRatio: yRatio, modIdx, intTop: mr.intTop, intH: mr.intH };
  }, [tool, getSVGCoords, getFacadeGeometry, sketchFingerprint, elements, cabinetDims, facadeModules, moduleDetails, generalNotes, joints, globalSliding, setFacadeItems]);

  const handleItemPointerDown = useCallback((e, itemId) => {
    e.stopPropagation();
    const { y } = getSVGCoords(e);
    const item   = facadeItems.find(it => it.id === itemId);
    if (!item) return;
    const mRects = getFacadeGeometry();
    const mr     = mRects[item.modIdx];
    if (!mr) return;
    facadeDrag.current = { active: true, itemId, startY: y, startYRatio: item.yRatio, modIdx: item.modIdx, intTop: mr.intTop, intH: mr.intH };
  }, [getSVGCoords, getFacadeGeometry, facadeItems]);

  const handlePointerMove = useCallback((e) => {
    if (pinchRef.current.active && e.touches && e.touches.length === 2) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const [t1, t2] = e.touches;
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (dist <= 0) return;
      const ratio = pinchRef.current.dist / dist;
      const base = pinchRef.current.base;
      const nextW = base.w * ratio;
      const nextH = base.h * ratio;
      const cxRatio = (pinchRef.current.centerX - rect.left) / Math.max(1, rect.width);
      const cyRatio = (pinchRef.current.centerY - rect.top) / Math.max(1, rect.height);
      const worldCX = base.x + cxRatio * base.w;
      const worldCY = base.y + cyRatio * base.h;
      setViewport(prev => clampViewport({
        x: worldCX - cxRatio * nextW,
        y: worldCY - cyRatio * nextH,
        w: nextW,
        h: nextH,
      }));
      return;
    }
    if (panRef.current.active) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
      const clientY = e.touches ? e.touches[0]?.clientY : e.clientY;
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return;
      const dxPx = clientX - panRef.current.startX;
      const dyPx = clientY - panRef.current.startY;
      const dxWorld = dxPx * (viewport.w / Math.max(1, rect.width));
      const dyWorld = dyPx * (viewport.h / Math.max(1, rect.height));
      setViewport(clampViewport({
        x: panRef.current.vX - dxWorld,
        y: panRef.current.vY - dyWorld,
        w: viewport.w,
        h: viewport.h,
      }));
      return;
    }
    if (facadeDrag.current.active) {
      const { y } = getSVGCoords(e);
      const { itemId, intTop, intH } = facadeDrag.current;
      const yRatio = clamp((y - intTop) / intH, 0.02, 0.98);
      setFacadeItems(prev => prev.map(it => it.id === itemId ? { ...it, yRatio } : it));
      return;
    }
    if (!resizingId && !draggingId) return;
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    if (resizingId) {
      setElements(prev => prev.map(el => {
        if (el.id !== resizingId) return el;
        if (el.type === 'dim') return { ...el, x2: x, y2: y };
        return { ...el, w: Math.max(10, x - el.x), h: Math.max(10, y - el.y) };
      }));
    } else if (draggingId) {
      setElements(prev => prev.map(el => {
        if (el.id !== draggingId) return el;
        return { ...el, x: drag.current.elStartX + (x - drag.current.startX), y: drag.current.elStartY + (y - drag.current.startY) };
      }));
    }
  }, [resizingId, draggingId, getSVGCoords, clampViewport, viewport, svgRef, setFacadeItems, setElements]);

  const handlePointerUp = useCallback(() => {
    panRef.current.active = false;
    pinchRef.current.active = false;
    if (facadeDrag.current.active) {
      facadeDrag.current.active = false;
      setFacadeItems(prev => {
        const next = [...prev];
        localStorage.setItem(LS_SKETCH_KEY, JSON.stringify({
          fingerprint: sketchFingerprint,
          state: {
            elements, cabinetDims, facadeModules, facadeItems: next,
            moduleDetails, generalNotes, joints, globalSliding,
          },
        }));
        return next;
      });
    } else {
      facadeDrag.current.active = false;
    }
    if (resizingId) {
      const el = elements.find(e => e.id === resizingId);
      if (el?.type === 'dim') {
        const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
        if (Math.sqrt(dx * dx + dy * dy) > 15) setEditingDimId(resizingId);
      }
    }
    setResizingId(null); setDraggingId(null);
  }, [resizingId, elements, sketchFingerprint, cabinetDims, facadeModules,
      moduleDetails, generalNotes, joints, globalSliding, setFacadeItems, setEditingDimId]);

  const handlePointerDown = useCallback((e) => {
    if (e.touches && e.touches.length === 2) {
      const [t1, t2] = e.touches;
      pinchRef.current = {
        active: true,
        dist: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
        centerX: (t1.clientX + t2.clientX) / 2,
        centerY: (t1.clientY + t2.clientY) / 2,
        base: { ...viewport },
      };
      return;
    }
    if (isNavMode) {
      const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
      const clientY = e.touches ? e.touches[0]?.clientY : e.clientY;
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return;
      panRef.current = { active: true, startX: clientX, startY: clientY, vX: viewport.x, vY: viewport.y };
      return;
    }
    if (baseView === 'facade' && ['shelf','rod','drawer','door','sliding','erase'].includes(tool)) return;
    if (tool === 'erase') return;
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    if (tool === 'dim') {
      const newEl = { id: uid(), type: 'dim', x1: x, y1: y, x2: x, y2: y, label: '' };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id);
    } else if (tool === 'note') {
      const text = prompt('Texte de la note :');
      if (text) setElements(prev => [...prev, { id: uid(), type: 'note', x, y, text }]);
    }
  }, [tool, getSVGCoords, baseView, isNavMode, viewport, setElements]);

  return {
    viewport,
    setViewport,
    draggingId,
    resizingId,
    setDraggingId,
    setResizingId,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getSVGCoords,
    resetViewport,
    handleFacadePointerDown,
    handleItemPointerDown,
  };
}
