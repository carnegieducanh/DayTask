import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const MIN_HEIGHT = 40;

/**
 * Drop-in replacement for <textarea resize="vertical">. Native CSS resize
 * silently stops working when the textarea sits inside an overflow-y:auto
 * container whose content overflows (common in modal bodies) — the resize
 * grip's hit-test breaks right at the scrollport's clipped edge. This drives
 * the resize entirely from JS (mousedown/mousemove on a custom grip), which
 * doesn't depend on the browser's native resize-handle hit-testing.
 */
const ResizableTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement, []);

    const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

    useEffect(() => {
      function onMouseMove(e: MouseEvent) {
        const drag = dragRef.current;
        const el = innerRef.current;
        if (!drag || !el) return;
        const next = Math.max(MIN_HEIGHT, drag.startHeight + (e.clientY - drag.startY));
        el.style.height = `${next}px`;
      }
      function onMouseUp() {
        dragRef.current = null;
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      return () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    }, []);

    function handleGripMouseDown(e: React.MouseEvent) {
      e.preventDefault();
      const el = innerRef.current;
      if (!el) return;
      dragRef.current = { startY: e.clientY, startHeight: el.offsetHeight };
    }

    const { style, ...rest } = props;

    return (
      <div className="resizable-textarea-wrap">
        <textarea {...rest} ref={innerRef} style={{ ...style, resize: 'none' }} />
        <div className="resizable-textarea-grip" onMouseDown={handleGripMouseDown} />
      </div>
    );
  }
);

ResizableTextarea.displayName = 'ResizableTextarea';

export default ResizableTextarea;
