import { useEffect } from 'react';
import useStore from './store/gameStore';
import LobbyPage from './components/ui/LobbyPage';
import RoomPage from './components/ui/RoomPage';
import GamePage from './components/game/GamePage';
import './index.css';

export default function App() {
  const { page, error, initSocket, cleanupSocket } = useStore();

  useEffect(() => {
    initSocket();
    return () => cleanupSocket();
  }, []);

  return (
    <div className="app">
      {error && <div className="error-toast">{error}</div>}
      {page === 'lobby' && <LobbyPage />}
      {page === 'room'  && <RoomPage />}
      {page === 'game'  && <GamePage />}
    </div>
  );
}
