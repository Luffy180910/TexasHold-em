# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 安装所有依赖（根目录 + server + client）
npm run install:all

# 同时启动前后端开发服务器
npm run dev

# 仅启动后端（nodemon，端口 3001）
npm run dev --prefix server

# 仅启动前端（Vite，端口 5173）
npm run dev --prefix client

# 生产构建 + 启动
npm run build                # 构建前端到 client/dist/
npm run start                # 以生产模式启动服务端（托管前端静态文件）
```

## 架构概览

这是一个 4 人实时联机德州扑克应用，单仓库结构：

```
根目录
├── server/          Express + Socket.io 后端
│   └── src/
│       ├── index.js              入口：创建 HTTP 服务器，挂载路由，初始化 DB
│       ├── game/engine.js        核心游戏引擎（PokerGame 类，含 toJSON/fromJSON 序列化）
│       ├── game/roomManager.js   房间管理（PostgreSQL + 内存双模存储）
│       ├── socket/handlers.js    Socket 事件注册（含 JWT 认证、排行榜）
│       ├── routes/rooms.js       REST API（房间列表查询）
│       ├── routes/auth.js        认证 API（注册/登录/获取用户）
│       ├── middleware/auth.js    JWT 签发和验证中间件
│       ├── db/pool.js            PostgreSQL 连接池
│       ├── db/schema.js          数据库表结构初始化
│       ├── db/users.js           用户 CRUD + 排行榜查询
│       ├── db/history.js         游戏历史记录存储
│       └── redis/                Redis 客户端（已弃用，保留兼容）
└── client/          React 18 + Vite 前端
    └── src/
        ├── App.jsx               根组件：未登录 → LoginPage，已登录 → lobby/room/game
        ├── store/gameStore.js    Zustand 全局状态（auth + socket + 游戏动作 + API 调用）
        ├── utils/socket.js       Socket.io 客户端单例（含 JWT token 传递）
        ├── utils/handUtils.js    蒙特卡洛胜率估算
        ├── hooks/useSocket.js    useSocketEvent / useSocketEmit
        └── components/
            ├── ui/               LoginPage（登录/注册/游客）, LobbyPage（大厅+排行榜）, RoomPage（等待室）
            └── game/             GamePage（主游戏）, Card, PlayerSeat, ActionPanel, WinRateDisplay
```

### 核心数据流

1. **Socket 事件驱动**：客户端通过 `socket.emit()` 发送操作，服务端处理后通过 `socket.emit()` / `io.to(room).emit()` 返回结果。
2. **Zustand store 是客户端唯一状态源**：`initSocket()` 挂载所有 socket 监听器，收到事件后更新 store 状态，React 组件订阅 store 自动重渲染。
3. **三页面导航**通过 `page` 字段切换（`'lobby'` → `'room'` → `'game'`），由 socket 事件自动驱动（如收到 `game:state` 自动切到游戏页）。
4. **每玩家专属 game state**：服务端 `getStateFor(playerId)` 将非当前玩家的手牌替换为 `null`，防止客户端作弊。

### 游戏引擎关键设计

- **PokerGame 是状态机**：`waiting → preflop → flop → turn → river → showdown`，每阶段推进由 `_advancePhase()` 处理。
- **盲注和庄家轮转**：`dealer` 索引每局完成后 +1，小盲/大盲为 dealer 后的玩家。
- **行动轮次控制**：`actedThisRound` Set 跟踪当前轮已行动玩家，所有活跃玩家行动完毕且下注齐平后自动推进阶段。
- **摊牌判断**：`bestHand()` 从 7 张牌（2 手牌 + 5 公共牌）的 C(7,5) 组合中找出最大牌型。
- **平局处理**：底池按胜者人数平分，余数按顺序分配。

### 关键约定

- 事件名称使用 `namespace:action` 格式（如 `room:create`、`game:state`），客户端和服务端通过各自的 `EVENTS` 常量保持同步（需要手动维护一致性）。
- 玩家筹码默认 1000，小盲 5 / 大盲 10，破产后下一局自动重买至 500。
- Socket 连接通过环境变量 `VITE_SOCKET_URL`（客户端）和 `CORS_ORIGIN`（服务端）配置跨域。
- Vite dev server 将 `/api` 请求代理到 `localhost:3001`。

### 部署模式

- **开发环境**：前端 Vite dev server (:5173) + 后端 nodemon (:3001)，通过 Vite proxy 转发 `/api`，Socket 通过 `VITE_SOCKET_URL` 连接后端。不需要 PostgreSQL。
- **生产环境**：`npm run build` 构建前端，Express 托管静态文件 + SPA fallback。需要 PostgreSQL 数据库。
- 关键环境变量：`DATABASE_URL`（PG 连接串）、`JWT_SECRET`（JWT 签名密钥）、`PORT`（默认 3001）。

### 认证系统

- 用户注册/登录后获取 JWT token，存储在 localStorage。游客模式跳过认证。
- Socket 握手时通过 `auth.token` 传递 token，服务端在 `connection` 事件中验证。
- 认证用户以 `userId`（UUID）作为 player.id，游戏结果自动关联到用户战绩。
- 游客以 `socket.id` 作为 player.id，无战绩记录。
- 房间创建/加入时使用 username 显示，登录用户自动填入用户名。
- 排行榜通过 Socket `leaderboard:get` → `leaderboard:result` 获取。

### 数据库

- 表结构由 `server/src/db/schema.js` 在启动时自动创建（`CREATE TABLE IF NOT EXISTS`）。
- `rooms` 表持久化房间元数据（host、players JSONB、status），游戏实例（PokerGame 对象）始终在内存中。
- `users` 表存储账户信息，`bcrypt` 哈希密码。
- `game_rounds` + `player_rounds` 记录每局结果，摊牌时由 `saveRound()` 写入。
- PG 不可用时 roomManager 自动降级为内存 Map 存储，不会崩溃。
