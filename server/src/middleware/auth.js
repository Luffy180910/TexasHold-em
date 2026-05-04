const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'texas-holdem-dev-secret';

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Express 中间件
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    return res.status(401).json({ error: 'token 无效或已过期' });
  }
  req.user = payload;
  next();
}

module.exports = { signToken, verifyToken, authMiddleware, JWT_SECRET };
