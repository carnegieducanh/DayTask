// Counter-clockwise undo arrow: a 270° arc with a solid triangular head at the top.
// Colored by currentColor, so .tws-block-drawer's hover colors apply as with Tabler icons.
export function UndoArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.8 13.3A7.2 7.2 0 1 0 12 6.1" stroke="currentColor" strokeWidth={2.9} />
      <path d="M12 1.9V10.3L6 6.1Z" fill="currentColor" />
    </svg>
  );
}
