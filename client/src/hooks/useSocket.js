import { useEffect, useRef } from 'react';
import socket from '../utils/socket';

/**
 * 监听 socket 事件，组件卸载时自动清理
 *
 * 用法:
 *   useSocketEvent('game:state', (data) => console.log(data));
 */
export function useSocketEvent(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const fn = (...args) => handlerRef.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [event]);
}

/**
 * 发送 socket 事件的辅助 hook，返回 emit 函数
 *
 * 用法:
 *   const emit = useSocketEmit();
 *   emit('player:action', { action: 'fold' });
 */
export function useSocketEmit() {
  return (event, data) => socket.emit(event, data);
}
