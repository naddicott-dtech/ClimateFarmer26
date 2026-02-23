import { useEffect } from 'preact/hooks';
import { startGameLoop, stopGameLoop, tutorialStep } from '../../adapter/signals.ts';
import { TopBar } from './TopBar.tsx';
import { FarmGrid } from './FarmGrid.tsx';
import { SidePanel } from './SidePanel.tsx';
import { NotificationBar } from './NotificationBar.tsx';
import { AutoPausePanel } from './AutoPausePanel.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { Tutorial } from './Tutorial.tsx';
import styles from '../styles/GameScreen.module.css';

export function GameScreen() {
  // Start/stop the game loop when this screen mounts/unmounts
  useEffect(() => {
    startGameLoop();
    return () => stopGameLoop();
  }, []);

  const showTutorial = tutorialStep.value >= 0;

  return (
    <div class={styles.layout}>
      <TopBar />
      <div class={styles.main}>
        <FarmGrid />
        <SidePanel />
      </div>
      <NotificationBar />
      <AutoPausePanel />
      <ConfirmDialog />
      {showTutorial && <Tutorial />}
    </div>
  );
}
