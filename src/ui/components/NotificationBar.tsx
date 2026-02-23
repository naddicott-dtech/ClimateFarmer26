import { notifications, handleDismissNotification } from '../../adapter/signals.ts';
import styles from '../styles/NotificationBar.module.css';

export function NotificationBar() {
  const notifs = notifications.value;

  // Show newest notification (last in array)
  const latest = notifs.length > 0 ? notifs[notifs.length - 1] : null;

  return (
    <div
      class={styles.bar}
      data-testid="notify-bar"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      {latest ? (
        <>
          <span class={styles.message}>{latest.message}</span>
          {notifs.length > 1 && (
            <span class={styles.count}>+{notifs.length - 1} more</span>
          )}
          <button
            data-testid="notify-dismiss"
            class={styles.dismissBtn}
            onClick={() => handleDismissNotification(latest.id)}
            aria-label="Dismiss notification"
          >
            Dismiss
          </button>
        </>
      ) : (
        <span class={styles.empty}>&nbsp;</span>
      )}
    </div>
  );
}
