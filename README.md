# ♠ Texas Hold'em — React + Node.js + Socket.io

4人实时联机德州扑克，本地多人版。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 18 + Vite | UI 组件 + 热更新 |
| 状态管理 | Zustand | 全局游戏状态 |
| 实时通信 | Socket.io-client | WebSocket 客户端 |
| 后端 | Node.js + Express | HTTP API + 静态服务 |
| 实时服务 | Socket.io | 事件广播 |

## 目录结构

```
texas-holdem/
├── package.json              ← 根目录，concurrently 同时启动前后端
├── server/
│   └── src/
│       ├── index.js          ← 服务器入口
│       ├── game/
│       │   ├── engine.js     ← 核心游戏逻辑（牌型/下注/状态机）
│       │   └── roomManager.js← 房间管理
│       ├── socket/
│       │   └── handlers.js   ← Socket 事件处理器
│       └── routes/
│           └── rooms.js      ← REST API
└── client/
    └── src/
        ├── App.jsx           ← 根组件（大厅/等待室/游戏 路由）
        ├── store/
        │   └── gameStore.js  ← Zustand store + socket 监听
        ├── utils/
        │   ├── socket.js     ← Socket 单例
        │   └── handUtils.js  ← 胜率估算（蒙特卡洛）
        ├── hooks/
        │   └── useSocket.js  ← useSocketEvent / useSocketEmit
        └── components/
            ├── ui/
            │   ├── LobbyPage.jsx   ← 大厅
            │   └── RoomPage.jsx    ← 等待室
            └── game/
                ├── GamePage.jsx    ← 主游戏界面
                ├── Card.jsx        ← 扑克牌
                ├── PlayerSeat.jsx  ← 玩家席位
                ├── ActionPanel.jsx ← 操作按钮（含键盘快捷键）
                └── WinRateDisplay.jsx ← 胜率估算显示
```

## 快速启动

```bash
# 1. 安装所有依赖（根目录 + server + client）
npm run install:all

# 2. 同时启动前端和后端
npm run dev

# 前端: http://localhost:5173
# 后端: http://localhost:3001

# 可选：指定前端连接的 Socket 地址（默认按当前页面主机推断到 :3001）
# VITE_SOCKET_URL=http://localhost:3001

# 可选：指定服务端允许的跨域来源（逗号分隔）
# CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

## Socket 事件表

### 客户端 → 服务端

| 事件 | 数据 | 说明 |
|------|------|------|
| `room:create` | `{ playerName }` | 创建房间 |
| `room:join` | `{ roomId, playerName }` | 加入房间 |
| `room:leave` | — | 离开房间 |
| `game:start` | — | 开始游戏（仅房主） |
| `player:action` | `{ action, amount }` | 玩家操作 |
| `game:nextRound` | — | 开始下一局 |

### 服务端 → 客户端

| 事件 | 数据 | 说明 |
|------|------|------|
| `room:updated` | `RoomInfo` | 房间状态变更 |
| `game:state` | `GameState` | 游戏状态（每人专属，隐藏他人手牌） |
| `game:showdown` | `{ winner, players }` | 摊牌结果 |
| `game:error` | `string` | 错误信息 |
| `rooms:list` | `Room[]` | 大厅房间列表 |

## 行为说明（最小修复版）

- `game:start` 仅允许房主触发；非房主会收到 `game:error`。
- 摊牌支持并列胜者：同牌型且平局时，底池按人数平分（余数按顺序分配）。
- 房间创建、加入、离开（以及开局导致房间进入 playing）后，服务端会广播最新 `rooms:list`，大厅列表实时同步。

## 游戏操作快捷键

| 键 | 操作 |
|----|------|
| `F` | 弃牌 |
| `C` | 过牌 / 跟注 |
| `R` | 加注（展开输入框）|
| `A` | 全押 |
| `Enter` | 确认加注 |

## 扩展建议

- **持久化**：将 `roomManager.js` 的内存存储替换为 Redis
- **认证**：加入 JWT 登录，记录用户战绩
- **旁观者模式**：Socket 加入房间但不参与游戏
- **断线重连**：保存 socket.id → playerId 映射，重连时恢复座位
- **边池**：多人全押时计算 side pot（engine.js 中 `sidePots` 字段已预留）
