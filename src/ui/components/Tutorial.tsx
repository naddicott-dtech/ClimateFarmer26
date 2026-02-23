import { useState, useEffect, useRef } from 'preact/hooks';
import { tutorialStep, advanceTutorial, skipTutorial, dismissTutorialPermanently } from '../../adapter/signals.ts';
import styles from '../styles/Overlay.module.css';

const STEPS = [
  {
    number: 1,
    title: 'Select a Plot',
    text: 'Click any plot in the field to select it. You\'ll see its soil details in the side panel.',
  },
  {
    number: 2,
    title: 'Plant a Crop',
    text: 'With a plot selected, click "Plant..." to choose a crop. Each crop has different costs and growing needs.',
  },
  {
    number: 3,
    title: 'Start Time',
    text: 'Press the Play button (\u25B6) to start the simulation. Watch your crops grow day by day!',
  },
];

export function Tutorial() {
  const step = tutorialStep.value;
  if (step < 0 || step > 2) return null;

  const [dontShow, setDontShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentStep = STEPS[step];

  useEffect(() => {
    const first = panelRef.current?.querySelector('button') as HTMLElement;
    first?.focus();
  }, [step]);

  function handleNext() {
    if (step >= 2) {
      if (dontShow) dismissTutorialPermanently(true);
      skipTutorial();
    } else {
      advanceTutorial();
    }
  }

  function handleSkip() {
    if (dontShow) dismissTutorialPermanently(true);
    skipTutorial();
  }

  return (
    <div class={styles.tutorialOverlay} data-testid="tutorial-overlay">
      <div class={styles.tooltip} ref={panelRef} role="dialog" aria-label="Tutorial" data-testid="tutorial-step">
        <div class={styles.tooltipStepNumber}>Step {currentStep.number} of 3</div>
        <div class={styles.tooltipStep}>
          <strong>{currentStep.title}</strong>
          <br />
          {currentStep.text}
        </div>
        <div class={styles.tooltipActions}>
          <label class={styles.checkboxLabel}>
            <input
              type="checkbox"
              data-testid="tutorial-dont-show"
              checked={dontShow}
              onChange={e => setDontShow((e.target as HTMLInputElement).checked)}
            />
            Don't show again
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              data-testid="tutorial-skip"
              class={styles.secondaryBtn}
              onClick={handleSkip}
            >
              Skip
            </button>
            <button
              data-testid="tutorial-next"
              class={styles.primaryBtn}
              onClick={handleNext}
            >
              {step >= 2 ? 'Got it!' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
