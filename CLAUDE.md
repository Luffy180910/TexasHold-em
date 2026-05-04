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
│       ├── index.js              入口：创建 HTTP 服务器，挂载 Socket.io 和 REST 路由
│       ├── game/engine.js        核心游戏引擎（PokerGame 类）
│       ├── game/roomManager.js   房间管理（内存 Map，生产可替换 Redis）
│       ├── socket/handlers.js    Socket 事件注册和路由
│       └── routes/rooms.js       REST API（房间列表查询）
└── client/          React 18 + Vite 前端
    └── src/
        ├── App.jsx               根组件：根据 page 状态切换 lobby/room/game 三个页面
        ├── store/gameStore.js    Zustand 全局状态（状态 + socket 监听 + 动作）
        ├── utils/socket.js       Socket.io 客户端单例
        ├── utils/handUtils.js    蒙特卡洛胜率估算
        ├── hooks/useSocket.js    useSocketEvent / useSocketEmit
        └── components/
            ├── ui/               LobbyPage（大厅）, RoomPage（等待室）
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

- **开发环境**：前端 Vite dev server (:5173) + 后端 nodemon (:3001)，通过 Vite proxy 转发 `/api`，Socket 通过 `VITE_SOCKET_URL` 连接后端。
- **生产环境**：`npm run build` 将前端构建为 `client/dist/`，Express 托管静态文件 + SPA fallback。前后端同源，Socket 通过 `window.location.origin` 自动连接。CORS 可配置 `CORS_ORIGIN` 限制允许的域名。
- 服务端口通过 `PORT` 环境变量配置（默认 3001）。
- 房间数据存储在内存 Map 中，重启丢失。扩展时可将 `roomManager.js` 替换为 Redis。
