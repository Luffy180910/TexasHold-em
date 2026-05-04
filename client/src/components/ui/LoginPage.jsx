import { useState } from 'react';
import useStore from '../../store/gameStore';

export default function LoginPage() {
  const { login, register, loginAsGuest } = useStore();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请填写用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        await register(username.trim(), password);
      } else {
        await login(username.trim(), password);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="lobby" style={{ marginTop: 48 }}>
      <div className="lobby-title">♠ Texas Hold'em</div>

      <div className="auth-tabs" style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        <button
          className={`btn ${!isRegister ? 'btn-primary' : ''}`}
          style={{
            flex: 1,
            borderRadius: '8px 0 0 8px',
            opacity: isRegister ? 0.5 : 1,
          }}
          onClick={() => { setIsRegister(false); setError(''); }}
        >
          登录
        </button>
        <button
          className={`btn ${isRegister ? 'btn-primary' : ''}`}
          style={{
            flex: 1,
            borderRadius: '0 8px 8px 0',
            opacity: !isRegister ? 0.5 : 1,
          }}
          onClick={() => { setIsRegister(true); setError(''); }}
        >
          注册
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          className="input"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          maxLength={20}
          style={{ marginBottom: 12 }}
        />
        <input
          className="input"
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={4}
          style={{ marginBottom: 16 }}
        />

        {error && (
          <div style={{ color: '#ff8a80', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-large"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? '请稍候…' : isRegister ? '注册并进入游戏' : '登录'}
        </button>
      </form>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <span className="muted" style={{ marginRight: 8 }}>不想注册？</span>
        <button
          className="btn btn-small"
          style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.5)' }}
          onClick={loginAsGuest}
        >
          游客模式进入
        </button>
      </div>

      <p className="muted" style={{ marginTop: 24 }}>
        {isRegister ? '注册后自动登录，战绩将永久保存' : '登录后可查看战绩和排行榜'}
      </p>
    </div>
  );
}
