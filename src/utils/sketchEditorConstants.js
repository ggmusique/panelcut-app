export const LS_SKETCH_KEY = 'pc_sketch_editor';

export const uid = () => Math.random().toString(36).slice(2, 9);

export const defaultDrawerParts = () => ({
  front: true,
  back: true,
  left: true,
  right: true,
  bottom: true,
});
