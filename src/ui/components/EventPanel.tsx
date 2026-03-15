import { useEffect, useRef, useState } from 'preact/hooks';
import { gameState, dispatch, handleDismissAutoPause, pendingFollowUp, pendingOrganicWarning } from '../../adapter/signals.ts';
import { STORYLETS } from '../../data/events.ts';
import type { ActiveEvent, Choice } from '../../engine/events/types.ts';
import styles from '../styles/Overlay.module.css';

/** Choice IDs that violate organic certification. */
const ORGANIC_PROHIBITED_CHOICES = new Set([
  'buy-fertilizer', 'apply-potash', 'emergency-treatment', 'aggressive-management',
]);

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

/** Parse forum text into speaker messages and narrative blocks. */
function parseForumThread(text: string): Array<{ type: 'speaker' | 'narrative'; speaker?: string; text: string }> {
  const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean);
  return paragraphs.map(para => {
    // Match patterns like "SpeakerName: "text" or SpeakerName: text
    const match = para.match(/^([A-Za-z][A-Za-z0-9_]*(?:[_ ][A-Za-z0-9_]+)*):\s*"?(.+)/s);
    if (match) {
      return { type: 'speaker' as const, speaker: match[1].replace(/_/g, ' '), text: match[2].replace(/"$/, '') };
    }
    return { type: 'narrative' as const, text: para };
  });
}

/** Render text as a forum thread with speaker/narrative formatting. */
function ForumThreadView({ text }: { text: string }) {
  const messages = parseForumThread(text);
  return (
    <div class={styles.forumThread}>
      {messages.map((msg, i) =>
        msg.type === 'speaker' ? (
          <div key={i} class={styles.forumMessage}>
            <div class={styles.forumSpeaker}>{msg.speaker}</div>
            <div class={styles.forumText}>{msg.text}</div>
          </div>
        ) : (
          <div key={i} class={styles.forumNarrative}>{msg.text}</div>
        )
      )}
    </div>
  );
}

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
  const [organicWarningChoice, setOrganicWarningChoice] = useState<Choice | null>(null);

  const isOrganic = !!(flags['organic_enrolled'] || flags['organic_certified']);

  // Sync component-local warning state to adapter signal so observer can see it
  useEffect(() => {
    pendingOrganicWarning.value = organicWarningChoice !== null;
    return () => { pendingOrganicWarning.value = false; };
  }, [organicWarningChoice]);

  useEffect(() => {
    const first = panelRef.current?.querySelector('button') as HTMLElement;
    first?.focus();
  }, [event?.storyletId, followUp, organicWarningChoice]);

  function executeChoice(choice: Choice) {
    if (!event) return;

    // Capture advisor info BEFORE dispatch — processRespondEvent clears activeEvent
    const advId = storyletDef?.advisorId ?? '';  // empty = no persona (system event)
    const eventTitle = event.title;
    const followUpText = choice.followUpText;

    const result = dispatch({
      type: 'RESPOND_EVENT',
      eventId: event.storyletId,
      choiceId: choice.id,
    });

    if (result.success) {
      setOrganicWarningChoice(null);
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

  function handleChoice(choice: Choice) {
    // Intercept prohibited choices when organic is active
    if (isOrganic && ORGANIC_PROHIBITED_CHOICES.has(choice.id)) {
      setOrganicWarningChoice(choice);
      return;
    }
    executeChoice(choice);
  }

  function handleFollowUpDismiss() {
    pendingFollowUp.value = null;
    handleDismissAutoPause();
  }

  // Look up full storylet definition for advisor info + illustration
  const storyletDef = event ? STORYLETS.find(s => s.id === event.storyletId) : undefined;

  // Determine which advisor to display (empty string = system event, no persona)
  const advisorId = followUp
    ? followUp.advisorId
    : (storyletDef?.advisorId ?? '');
  const advisor = advisorId ? (ADVISOR_CHARACTERS[advisorId] ?? null) : null;

  const panelTestId = isAdvisor ? 'advisor-panel' : 'event-panel';

  // Organic violation warning: confirm before proceeding with prohibited choice
  if (organicWarningChoice) {
    const isCertified = !!flags['organic_certified'];
    return (
      <div class={styles.overlay} data-testid="organic-warning-panel" role="alertdialog" aria-label="Organic violation warning">
        <div class={styles.panel} ref={panelRef}>
          <h2 class={styles.title} data-testid="organic-warning-title">
            {isCertified ? 'Organic Certification at Risk' : 'Organic Transition at Risk'}
          </h2>
          <div class={styles.message} data-testid="organic-warning-text">
            {isCertified
              ? 'Using synthetic inputs will revoke your organic certification. You will lose the 20% price premium and must complete 3 new clean years to re-certify.'
              : 'Using synthetic inputs will reset your organic transition. Your 3-year clock will restart from zero.'}
          </div>
          <div class={styles.choiceList}>
            <button
              data-testid="organic-warning-proceed"
              class={`${styles.choiceBtn} ${styles.choiceBtnDanger}`}
              onClick={() => executeChoice(organicWarningChoice)}
            >
              <div class={styles.choiceLabel}>Use anyway</div>
            </button>
            <button
              data-testid="organic-warning-cancel"
              class={styles.choiceBtn}
              onClick={() => setOrganicWarningChoice(null)}
            >
              <div class={styles.choiceLabel}>Cancel</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Follow-up beat: educational explanation after choice
  if (followUp) {
    return (
      <div class={styles.overlay} data-testid="follow-up-panel" role="alertdialog" aria-label={followUp.title}>
        <div class={styles.panel} ref={panelRef}>
          {advisor && (
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
          )}

          <h2 class={styles.title} data-testid="event-title">{followUp.title}</h2>
          <div class={styles.message} data-testid="follow-up-text">
            {followUp.advisorId === 'growers-forum' ? <ForumThreadView text={followUp.text} /> : followUp.text}
          </div>

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
        {isAdvisor && advisor && (
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

        {storyletDef?.illustrationId && (
          <img
            class={styles.eventIllustration}
            src={`${import.meta.env.BASE_URL}assets/events/${storyletDef.illustrationId}_480x240.jpeg`}
            alt=""
            data-testid="event-illustration"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        <h2 class={styles.title} data-testid="event-title">{event.title}</h2>
        <div class={styles.message} data-testid="event-description">
          {advisorId === 'growers-forum' ? <ForumThreadView text={event.description} /> : event.description}
        </div>

        <div class={styles.choiceList}>
          {visibleChoices.map(choice => {
            const canAfford = choice.requiresCash === undefined || cash >= choice.requiresCash;
            const isProhibited = isOrganic && ORGANIC_PROHIBITED_CHOICES.has(choice.id);

            return (
              <button
                key={choice.id}
                data-testid={`${isAdvisor ? 'advisor' : 'event'}-choice-${choice.id}`}
                class={`${styles.choiceBtn} ${!canAfford ? styles.choiceBtnDisabled : ''} ${isProhibited ? styles.choiceBtnDanger : ''}`}
                onClick={() => handleChoice(choice)}
                disabled={!canAfford}
                aria-label={`${choice.label}${choice.cost ? ` — costs $${choice.cost}` : ''}${!canAfford ? ' (not enough cash)' : ''}${isProhibited ? ' — violates organic certification' : ''}`}
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
                {isProhibited && (
                  <div class={styles.organicWarning} data-testid="organic-violation-warning">
                    Violates organic certification
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
