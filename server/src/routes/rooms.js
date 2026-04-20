const express = require('express');
const router = express.Router();
const { listRooms, getRoomInfo } = require('../game/roomManager');

// GET /api/rooms - 获取大厅房间列表
router.get('/', async (req, res) => {
  try {
    res.json(await listRooms());
  } catch (err) {
    res.status(500).json({ error: '获取房间列表失败' });
  }
});

// GET /api/rooms/:id - 获取单个房间信息
router.get('/:id', async (req, res) => {
  try {
    const room = await getRoomInfo(req.params.id);
    if (!room) return res.status(404).json({ error: '房间不存在' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: '获取房间信息失败' });
  }
});

module.exports = router;
