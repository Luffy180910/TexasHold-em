const { v4: uuidv4 } = require('uuid');
const { PokerGame } = require('../game/engine');

// ── 内存中的房间存储（生产环境可换成 Redis）──
const rooms = new Map();

function createRoom(hostId, hostName) {
  const roomId = uuidv4().slice(0, 6).toUpperCase();
  rooms.set(roomId, {
    id: roomId,
    host: hostId,
    players: [{ id: hostId, name: hostName, chips: 1000, ready: false }],
    game: null,
    status: 'waiting', // waiting | playing
    maxPlayers: 4,
    createdAt: Date.now(),
  });
  return roomId;
}

function joinRoom(roomId, playerId, playerName) {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在' };
  if (room.status === 'playing') return { error: '游戏已开始' };
  if (room.players.length >= room.maxPlayers) return { error: '房间已满' };
  if (room.players.find(p => p.id === playerId)) return { error: '已在房间中' };

  room.players.push({ id: playerId, name: playerName, chips: 1000, ready: false });
  return { success: true, room: getRoomInfo(roomId) };
}

function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    rooms.delete(roomId);
  } else if (room.host === playerId) {
    room.host = room.players[0].id; // 转让房主
  }
}

function startGame(roomId) {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在' };
  if (room.players.length < 2) return { error: '至少需要2名玩家' };

  room.game = new PokerGame(roomId, room.players);
  room.status = 'playing';
  return room.game.startRound();
}

function playerAction(roomId, playerId, action, amount) {
  const room = rooms.get(roomId);
  if (!room || !room.game) return { error: '游戏未开始' };
  return room.game.playerAction(playerId, action, amount);
}

function nextRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.game) return { error: '游戏未开始' };
  return room.game.startRound();
}

function getGameStateFor(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room || !room.game) return null;
  return room.game.getStateFor(playerId);
}

function getRoomInfo(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    id: room.id,
    host: room.host,
    players: room.players,
    status: room.status,
    maxPlayers: room.maxPlayers,
  };
}

function listRooms() {
  return [...rooms.values()]
    .filter(r => r.status === 'waiting')
    .map(r => getRoomInfo(r.id));
}

module.exports = { createRoom, joinRoom, leaveRoom, startGame, playerAction, nextRound, getGameStateFor, getRoomInfo, listRooms };
