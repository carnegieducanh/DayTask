import { useEffect, useState } from 'react';
import './DeleteToast.css';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';

const TOAST_VISIBLE_MS = 2200;

// Toast phản hồi cho Ctrl+Z: khác với DeleteToast (có nút "Hoàn tác" chờ user bấm),
// toast này chỉ xác nhận NGẮN rằng một thao tác vừa được hoàn tác xong, không có action.
export default function UndoToast() {
  const t = useT();
  const { undoneLabel, undoneToken } = useAppStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (undoneToken === 0) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), TOAST_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [undoneToken]);

  if (!visible) return null;

  return (
    <div className="delete-toast undo-toast" role="status">
      <span className="delete-toast-msg">{t.toast.undone(undoneLabel ?? '')}</span>
    </div>
  );
}
