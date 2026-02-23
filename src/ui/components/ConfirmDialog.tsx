import { useEffect, useRef } from 'preact/hooks';
import { confirmDialog } from '../../adapter/signals.ts';
import type { ConfirmDialogState } from '../../adapter/signals.ts';
import styles from '../styles/Overlay.module.css';

export function ConfirmDialog() {
  const dialog = confirmDialog.value;
  if (!dialog) return null;

  return <ConfirmDialogInner dialog={dialog} />;
}

function ConfirmDialogInner({ dialog }: { dialog: ConfirmDialogState }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = panelRef.current?.querySelector('button') as HTMLElement;
    first?.focus();
  }, [dialog]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dialog.onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialog]);

  return (
    <div class={styles.overlay} data-testid="confirm-dialog" role="alertdialog" aria-label="Confirm action">
      <div class={styles.panel} ref={panelRef}>
        <div data-testid="confirm-message" class={styles.message}>
          {dialog.message}
        </div>
        <div class={styles.buttonRow}>
          <button
            data-testid="confirm-cancel"
            class={styles.secondaryBtn}
            onClick={dialog.onCancel}
          >
            Cancel
          </button>
          <button
            data-testid="confirm-accept"
            class={styles.primaryBtn}
            onClick={dialog.onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
