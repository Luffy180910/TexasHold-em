const express = require('express');
const router = express.Router();
const { listRooms, getRoomInfo } = require('../game/roomManager');

// GET /api/rooms - 获取大厅房间列表
router.get('/', (req, res) => {
  res.json(listRooms());
});

// GET /api/rooms/:id - 获取单个房间信息
router.get('/:id', (req, res) => {
  const room = getRoomInfo(req.params.id);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  res.json(room);
});

module.exports = router;
