/**
 * Returns true when a piece is a rod/tringle (not cut from wood panels).
 * Tringles are identified by the isRod flag, the type field, or the piece name.
 */
export function isRodPiece(p) {
  return (
    p.isRod === true ||
    p.type === 'rod' ||
    /tringle/i.test(String(p.name || ''))
  );
}

export default isRodPiece;
