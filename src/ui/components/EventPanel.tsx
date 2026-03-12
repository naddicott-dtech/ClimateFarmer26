import { useEffect, useRef } from 'preact/hooks';
import { gameState, dispatch, handleDismissAutoPause, pendingFollowUp } from '../../adapter/signals.ts';
import { STORYLETS } from '../../data/events.ts';
import type { ActiveEvent, Choice } from '../../engine/events/types.ts';
import styles from '../styles/Overlay.module.css';

/** Advisor character info keyed by advisorId */
const ADVISOR_CHARACTERS: Record<string, { portrait: string; name: string; role: string; subtitle?: string }> = {
  'extension-agent': {
    portrait: `${import.meta.env.BASE_URL}assets/advisors/extension-agent_128x128.jpeg`,
    name: 'Dr. Maria Santos',
    role: 'County Extension Agent',
  },
  'weather-service': {
    portrait: `${import.meta.env.BASE_URL}assets/advisors/weather-service_128x128.jpeg`,
    name: 'NWS Fresno',
    role: 'National Weather Service — Fresno Office',
    subtitle: 'Forecast accuracy varies by timeframe',
  },
  'farm-credit': {
    portrait: `${import.meta.env.BASE_URL}assets/advisors/farm-credit_128x128.jpeg`,
    name: 'Marcus Chen',
    role: 'Valley Farm Credit — Agricultural Lender',
    subtitle: 'Focused on returns and financial growth',
  },
  'growers-forum': {
    portrait: `${import.meta.env.BASE_URL}assets/advisors/growers-forum_128x128.jpeg`,
    name: 'Valley Growers Forum',
    role: 'Local Farming Community',
    subtitle: 'Word-of-mouth from neighboring farms',
  },
};

/**
 * EventPanel renders the event/advisor choice UI when an activeEvent exists.
 * Replaces the generic auto-pause overlay for 'event' and 'advisor' reasons.
 *
 * Flow: player sees title + description + choices → picks one → RESPOND_EVENT
 * dispatched → activeEvent cleared → auto-pause dismissed.
 *
 * Follow-up beat (6a): If the chosen option has followUpText, a second panel
 * shows the educational explanation before dismissing. This keeps teaching
 * content center-screen instead of burying it in a notification toast.
 * Follow-up state lives in the pendingFollowUp signal (adapter layer) so it
 * survives the activeEvent clearing that happens during processRespondEvent.
 */
export function EventPanel({ event, isAdvisor }: { event: ActiveEvent | null; isAdvisor: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const state = gameState.value;
  const cash = state?.economy.cash ?? 0;
  const flags = state?.flags ?? {};
  const followUp = pendingFollowUp.value;

  useEffect(() => {
    const first = panelRef.current?.querySelector('button') as HTMLElement;
    first?.focus();
  }, [event?.storyletId, followUp]);

  function handleChoice(choice: Choice) {
    if (!event) return;

    // Capture advisor info BEFORE dispatch — processRespondEvent clears activeEvent
    const storyletDef = STORYLETS.find(s => s.id === event.storyletId);
    const advId = storyletDef?.advisorId ?? 'extension-agent';
    const eventTitle = event.title;
    const followUpText = choice.followUpText;

    const result = dispatch({
      type: 'RESPOND_EVENT',
      eventId: event.storyletId,
      choiceId: choice.id,
    });

    if (result.success) {
      if (followUpText) {
        // Show follow-up beat instead of immediately dismissing
        pendingFollowUp.value = { advisorId: advId, title: eventTitle, text: followUpText };
      } else {
        handleDismissAutoPause();
      }
    }
    // If not successful (e.g. can't afford), stay on panel — the button
    // should already be disabled via requiresCash/requiresFlag checks below
  }

  function handleFollowUpDismiss() {
    pendingFollowUp.value = null;
    handleDismissAutoPause();
  }

  // Determine which advisor to display
  const advisorId = followUp
    ? followUp.advisorId
    : (STORYLETS.find(s => s.id === event?.storyletId)?.advisorId ?? 'extension-agent');
  const advisor = ADVISOR_CHARACTERS[advisorId] ?? ADVISOR_CHARACTERS['extension-agent'];

  const panelTestId = isAdvisor ? 'advisor-panel' : 'event-panel';

  // Follow-up beat: educational explanation after choice
  if (followUp) {
    return (
      <div class={styles.overlay} data-testid="follow-up-panel" role="alertdialog" aria-label={followUp.title}>
        <div class={styles.panel} ref={panelRef}>
          <div class={styles.advisorHeader}>
            <img
              class={styles.advisorPortrait}
              data-testid="advisor-portrait"
              src={advisor.portrait}
              alt={advisor.name}
              width="64"
              height="64"
            />
            <div>
              <div class={styles.advisorName} data-testid="advisor-name">{advisor.name}</div>
              <div class={styles.advisorRole} data-testid="advisor-role">{advisor.role}</div>
            </div>
          </div>

          <h2 class={styles.title} data-testid="event-title">{followUp.title}</h2>
          <div class={styles.message} data-testid="follow-up-text">{followUp.text}</div>

          <div class={styles.choiceList}>
            <button
              data-testid="follow-up-dismiss"
              class={styles.choiceBtn}
              onClick={handleFollowUpDismiss}
            >
              <div class={styles.choiceLabel}>OK</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No event data and no follow-up — shouldn't happen but safe
  if (!event) return null;

  // Filter choices: hide those requiring a flag the player doesn't have
  const visibleChoices = event.choices.filter(
    c => !c.requiresFlag || flags[c.requiresFlag]
  );

  return (
    <div class={styles.overlay} data-testid={panelTestId} role="alertdialog" aria-label={event.title}>
      <div class={styles.panel} ref={panelRef}>
        {isAdvisor && (
          <div class={styles.advisorHeader}>
            <img
              class={styles.advisorPortrait}
              data-testid="advisor-portrait"
              src={advisor.portrait}
              alt={advisor.name}
              width="64"
              height="64"
            />
            <div>
              <div class={styles.advisorName} data-testid="advisor-name">{advisor.name}</div>
              <div class={styles.advisorRole} data-testid="advisor-role">{advisor.role}</div>
              {advisor.subtitle && (
                <div class={styles.advisorSubtitle} data-testid="advisor-subtitle">{advisor.subtitle}</div>
              )}
            </div>
          </div>
        )}

        <h2 class={styles.title} data-testid="event-title">{event.title}</h2>
        <div class={styles.message} data-testid="event-description">{event.description}</div>

        <div class={styles.choiceList}>
          {visibleChoices.map(choice => {
            const canAfford = choice.requiresCash === undefined || cash >= choice.requiresCash;

            return (
              <button
                key={choice.id}
                data-testid={`${isAdvisor ? 'advisor' : 'event'}-choice-${choice.id}`}
                class={`${styles.choiceBtn} ${!canAfford ? styles.choiceBtnDisabled : ''}`}
                onClick={() => handleChoice(choice)}
                disabled={!canAfford}
                aria-label={`${choice.label}${choice.cost ? ` — costs $${choice.cost}` : ''}${!canAfford ? ' (not enough cash)' : ''}`}
              >
                <div class={styles.choiceLabel}>{choice.label}</div>
                <div class={styles.choiceDesc}>{choice.description}</div>
                {choice.cost !== undefined && choice.cost > 0 && (
                  <div
                    class={`${styles.choiceCost} ${!canAfford ? styles.choiceCostUnaffordable : ''}`}
                    data-testid={`${isAdvisor ? 'advisor' : 'event'}-choice-cost-${choice.id}`}
                  >
                    ${choice.cost.toLocaleString()}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
