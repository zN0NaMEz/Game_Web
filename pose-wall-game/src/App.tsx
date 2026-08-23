import { useState } from 'react';
import HomePage from './HomePage';
import PoseWallGame from './PoseWallGame';

type View = 'home' | 'game';

function App() {
  const [view, setView] = useState<View>('home');

  if (view === 'game') {
    return <PoseWallGame onExit={() => setView('home')} />;
  }

  return <HomePage onStart={() => setView('game')} />;
}

export default App;
