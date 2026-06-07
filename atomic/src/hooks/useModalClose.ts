import { useRef } from 'react';

export function useModalClose(onClose: () => void) {
  const mouseDownOnOverlay = useRef(false);
  return {
    onMouseDown: (e: React.MouseEvent) => {
      mouseDownOnOverlay.current = e.target === e.currentTarget;
    },
    onClick: (e: React.MouseEvent) => {
      if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose();
    },
  };
}
