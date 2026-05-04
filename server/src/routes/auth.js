const express = require('express');
const router = express.Router();
const { createUser, findUser, getUserById } = require('../db/users');
const { signToken, authMiddleware } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度 2-20 字符' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '密码至少 4 位' });
  }

  const user = await createUser(username.trim(), password);
  if (!user) {
    return res.status(409).json({ error: '用户名已被注册' });
  }

  const token = signToken(user);
  res.json({ user, token });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = await findUser(username.trim(), password);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = signToken(user);
  res.json({ user, token });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  const user = await getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json({ user });
});

module.exports = router;
