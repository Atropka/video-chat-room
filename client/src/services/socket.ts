import { io } from 'socket.io-client';

import type { Socket } from 'socket.io-client';

export function createSocket(): Socket {
  const url = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);
  return io(url, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket', 'polling'],
  });
}
