import { useEffect, useRef } from 'preact/hooks';
import {
  autoPauseQueue, handleDismissAutoPause, declineLoan,
  harvestBulk, waterBulk, returnToTitle,
  gameState, dispatch, pendingFollowUp,
} from '../../adapter/signals.ts';
import type { AutoPauseEvent } from '../../engine/types.ts';
import { EventPanel } from './EventPanel.tsx';
import { EndgamePanel } from './EndgamePanel.tsx';
import styles from '../styles/Overlay.module.css';

export function AutoPausePanel() {
  const queue = autoPauseQueue.value;
  if (queue.length === 0) return null;

  const event = queue[0];

  // Event/advisor auto-pause: render the EventPanel with choices
  // Also stay on EventPanel during follow-up beat (activeEvent is cleared but follow-up is pending)
  if (event.reason === 'event' || event.reason === 'advisor') {
    const state = gameState.value;
    if (state?.activeEvent || pendingFollowUp.value) {
      return <EventPanel event={state?.activeEvent ?? null} isAdvisor={event.reason === 'advisor'} />;
    }
    // Fallback: activeEvent already cleared (shouldn't happen, but safe)
    return <AutoPauseOverlay event={event} />;
  }

  return <AutoPauseOverlay event={event} />;
}

function AutoPauseOverlay({ event }: { event: AutoPauseEvent }) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Trap focus in overlay
  useEffect(() => {
    const first = panelRef.current?.querySelector('button') as HTMLElement;
    first?.focus();
  }, [event.reason]);

  const state = gameState.value;

  function handlePrimary() {
    switch (event.reason) {
      case 'harvest_ready':
        harvestBulk('all');
        handleDismissAutoPause();
        break;
      case 'water_stress': {
        const waterResult = waterBulk('all', undefined, { skipConfirm: true });
        if (waterResult !== 'failed') {
          handleDismissAutoPause();
        }
        break;
      }
      case 'year_end':
        handleDismissAutoPause();
        break;
      case 'bankruptcy':
        returnToTitle();
        break;
      case 'year_30':
        returnToTitle();
        break;
      case 'loan_offer':
        dispatch({ type: 'TAKE_LOAN' });
        handleDismissAutoPause();
        break;
      case 'planting_options':
        handleDismissAutoPause();
        break;
      case 'event':
      case 'advisor':
        // Should not reach here — EventPanel handles these reasons.
        // Fallback: dismiss the auto-pause (clears activeEvent via engine).
        handleDismissAutoPause();
        break;
    }
  }

  function handleSecondary() {
    if (event.reason === 'loan_offer') {
      // Declining the loan — show bankruptcy reflection before title (#88)
      declineLoan();
      return;
    }
    handleDismissAutoPause();
  }

  const config = getEventConfig(event);

  // Conditional data-testids per SPEC §11 + §14
  const panelTestId =
    event.reason === 'bankruptcy' ? 'gameover-panel' :
    event.reason === 'year_30' ? 'year30-panel' :
    event.reason === 'loan_offer' ? 'loan-panel' :
    event.reason === 'event' ? 'event-panel' :
    event.reason === 'advisor' ? 'advisor-panel' :
    'autopause-panel';

  const primaryTestId =
    event.reason === 'bankruptcy' ? 'gameover-new-game' :
    event.reason === 'year_30' ? 'year30-new-game' :
    event.reason === 'loan_offer' ? 'loan-accept' :
    'autopause-action-primary';

  const isEndgame = event.reason === 'bankruptcy' || event.reason === 'year_30';

  return (
    <div class={styles.overlay} data-testid={panelTestId} role="alertdialog" aria-label={config.title}>
      <div class={`${styles.panel} ${config.wide ? styles.panelWide : ''}`} ref={panelRef}>
        {isEndgame && state ? (
          // Endgame: delegate to EndgamePanel for full layout
          <EndgamePanel state={state} />
        ) : (
          // Non-endgame: standard layout
          <>
            <h2 class={styles.title}>{config.title}</h2>
            <div class={styles.message}>{event.message}</div>
            {config.summaryData && <YearEndTable data={config.summaryData} />}
          </>
        )}

        <div class={styles.buttonRow}>
          {config.secondaryLabel && (
            <button
              data-testid="autopause-dismiss"
              class={styles.secondaryBtn}
              onClick={handleSecondary}
            >
              {config.secondaryLabel}
            </button>
          )}
          <button
            data-testid={primaryTestId}
            class={event.reason === 'bankruptcy' ? styles.dangerBtn : styles.primaryBtn}
            onClick={handlePrimary}
          >
            {config.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface EventConfig {
  title: string;
  primaryLabel: string;
  secondaryLabel?: string;
  wide?: boolean;
  summaryData?: YearEndData;
}

interface ExpenseLineItem {
  label: string;
  amount: number;
  testId: string;
}

interface YearEndData {
  revenue: number;
  expenses: number;
  net: number;
  cash: number;
  breakdown?: ExpenseLineItem[];
  hasLoans?: boolean;
  insurancePayouts?: number;
  organicMilestone?: string;
}

function getEventConfig(event: AutoPauseEvent): EventConfig {
  const state = gameState.value;

  switch (event.reason) {
    case 'harvest_ready':
      return {
        title: 'Harvest Time!',
        primaryLabel: 'Harvest Field',
        secondaryLabel: 'Continue',
      };

    case 'water_stress':
      return {
        title: 'Water Warning',
        primaryLabel: 'Water Field',
        secondaryLabel: 'Continue without watering',
      };

    case 'year_end': {
      const data = event.data as Record<string, unknown> | undefined;
      const breakdown = data?.expenseBreakdown as Record<string, number> | undefined;
      // Canonical expense display order (maps to ExpenseBreakdown fields)
      const expenseCategories: { key: string; label: string; testId: string }[] = [
        { key: 'planting', label: 'Planting', testId: 'expense-line-planting' },
        { key: 'watering', label: 'Watering', testId: 'expense-line-watering' },
        { key: 'harvestLabor', label: 'Harvest labor', testId: 'expense-line-harvestLabor' },
        { key: 'maintenance', label: 'Maintenance', testId: 'expense-line-maintenance' },
        { key: 'coverCrops', label: 'Cover crops', testId: 'expense-line-coverCrops' },
        { key: 'annualOverhead', label: 'Annual overhead', testId: 'expense-line-annualOverhead' },
        { key: 'insurance', label: 'Crop insurance', testId: 'expense-line-insurance' },
        { key: 'organicCertification', label: 'Organic certification', testId: 'expense-line-organic' },
        { key: 'loanRepayment', label: 'Loan repayment', testId: 'expense-line-loanRepayment' },
        { key: 'eventCosts', label: 'Event costs', testId: 'expense-line-eventCosts' },
        { key: 'removal', label: 'Crop removal', testId: 'expense-line-removal' },
      ];
      const breakdownLines = breakdown
        ? expenseCategories
            .filter(cat => (breakdown[cat.key] ?? 0) > 0)
            .map(cat => ({ label: cat.label, amount: breakdown[cat.key], testId: cat.testId }))
        : undefined;
      return {
        title: `Year ${data?.year ?? '?'} Complete`,
        primaryLabel: `Continue to Year ${((data?.year as number) ?? 0) + 1}`,
        wide: true,
        summaryData: data ? {
          revenue: data.revenue as number,
          expenses: data.expenses as number,
          net: data.netProfit as number,
          cash: data.cash as number,
          breakdown: breakdownLines,
          hasLoans: (state?.economy.totalLoansReceived ?? 0) > 0,
          insurancePayouts: breakdown?.insurancePayouts as number | undefined,
          organicMilestone: data.organicMilestone as string | undefined,
        } : undefined,
      };
    }

    case 'bankruptcy':
      return {
        title: `Game Over`,
        primaryLabel: 'Start New Game',
        wide: true,
      };

    case 'year_30':
      return {
        title: 'Congratulations!',
        primaryLabel: 'Start New Game',
        wide: true,
      };

    case 'loan_offer': {
      const data = event.data as Record<string, number> | undefined;
      return {
        title: 'Emergency Loan Offer',
        primaryLabel: `Accept Loan ($${(data?.loanAmount ?? 0).toLocaleString()})`,
        secondaryLabel: 'Decline (Game Over)',
      };
    }

    case 'event':
      return {
        title: event.message || 'Event',
        primaryLabel: 'View Details',
        secondaryLabel: 'Dismiss',
      };

    case 'advisor':
      return {
        title: event.message || 'Advisor',
        primaryLabel: 'View Details',
        secondaryLabel: 'Dismiss',
      };

    case 'planting_options':
      return {
        title: 'Planting Window',
        primaryLabel: 'Continue',
      };

    default:
      return { title: 'Paused', primaryLabel: 'Continue' };
  }
}

function getOrganicBanner(milestone: string | undefined): { text: string; tone: 'success' | 'warning' | 'info' } | null {
  switch (milestone) {
    case 'certified':
      return { text: 'USDA Organic Certification earned! All harvest revenue now receives a 20% price premium.', tone: 'success' };
    case 'revoked':
      return { text: 'Organic certification revoked — synthetic inputs used. Must complete 3 new clean years to re-qualify.', tone: 'warning' };
    case 'suspended':
      return { text: 'Organic certification suspended — not enough cover crops. Must re-qualify with 3 clean years.', tone: 'warning' };
    case 'reset':
      return { text: 'Organic transition reset — synthetic inputs used. The 3-year clock restarts.', tone: 'warning' };
    case 'delayed':
      return { text: 'Organic certification delayed — need more fields with cover crops.', tone: 'info' };
    default:
      if (milestone?.startsWith('transition-')) {
        const years = milestone.slice('transition-'.length);
        return { text: `Organic transition: ${years} of 3 clean years completed.`, tone: 'info' };
      }
      return null;
  }
}

function YearEndTable({ data }: { data: YearEndData }) {
  const isProfit = data.net >= 0;
  const organicBanner = getOrganicBanner(data.organicMilestone);

  return (
    <>
      {organicBanner && (
        <div
          class={`${styles.organicBanner} ${organicBanner.tone === 'success' ? styles.organicBannerSuccess : organicBanner.tone === 'warning' ? styles.organicBannerWarning : styles.organicBannerInfo}`}
          data-testid="organic-milestone-banner"
        >
          {organicBanner.text}
        </div>
      )}
      <table class={styles.summaryTable} data-testid="year-end-summary">
      <tbody>
        <tr>
          <td>Revenue</td>
          <td class={styles.positive}>${Math.floor(data.revenue).toLocaleString()}</td>
        </tr>
        {(data.insurancePayouts ?? 0) > 0 && (
          <tr data-testid="income-line-insurance-payouts">
            <td>Insurance payouts</td>
            <td class={styles.positive}>+${Math.floor(data.insurancePayouts!).toLocaleString()}</td>
          </tr>
        )}
        <tr class={styles.expenseHeader}>
          <td>Expenses</td>
          <td class={styles.negative}>-${Math.floor(data.expenses).toLocaleString()}</td>
        </tr>
        {data.breakdown && data.breakdown.length > 0 && (
          data.breakdown.map(line => (
            <tr key={line.testId} data-testid={line.testId} class={styles.expenseLine}>
              <td class={styles.expenseIndent}>{line.label}</td>
              <td class={styles.expenseAmount}>${Math.floor(line.amount).toLocaleString()}</td>
            </tr>
          ))
        )}
        <tr class={styles.netRow}>
          <td>Net {isProfit ? 'Profit' : 'Loss'}</td>
          <td class={isProfit ? styles.positive : styles.negative}>
            {isProfit ? '+' : '-'}${Math.floor(Math.abs(data.net)).toLocaleString()}
          </td>
        </tr>
        <tr>
          <td>{data.hasLoans ? 'Cash Balance (before loan)' : 'Cash Balance'}</td>
          <td>${Math.floor(data.cash).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
    </>
  );
}
