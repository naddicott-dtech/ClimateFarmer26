import { screen } from '../../adapter/signals.ts';
import { NewGameScreen } from './NewGameScreen.tsx';
import { GameScreen } from './GameScreen.tsx';
import '../../ui/styles/global.css';

export function App() {
  const currentScreen = screen.value;

  switch (currentScreen) {
    case 'new-game':
      return <NewGameScreen />;
    case 'playing':
      return <GameScreen />;
    case 'game-over':
      // Game over returns to new-game screen via returnToTitle
      return <NewGameScreen />;
    default:
      return <NewGameScreen />;
  }
}
