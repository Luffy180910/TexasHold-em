import { useEffect } from 'react';
import useStore from './store/gameStore';
import LoginPage from './components/ui/LoginPage';
import LobbyPage from './components/ui/LobbyPage';
import RoomPage from './components/ui/RoomPage';
import GamePage from './components/game/GamePage';
import './styles/index.css';

export default function App() {
  const { page, user, token, error, initSocket, cleanupSocket, fetchMe } = useStore();
  const isLoggedIn = !!user;

  useEffect(() => {
    initSocket();
    // 尝试用存储的 token 恢复登录状态
    if (token) fetchMe();
    return () => cleanupSocket();
  }, []);

  // 未登录 → 显示登录页
  if (!isLoggedIn) {
    return (
      <div className="app">
        {error && <div className="error-toast">{error}</div>}
        <LoginPage />
      </div>
    );
  }

  return (
    <div className="app">
      {error && <div className="error-toast">{error}</div>}
      {page === 'lobby' && <LobbyPage />}
      {page === 'room'  && <RoomPage />}
      {page === 'game'  && <GamePage />}
    </div>
  );
}
