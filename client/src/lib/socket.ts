import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

// Same split as lib/api.ts: "/" + the Vite proxy in dev, the deployed backend origin in prod.
const socketUrl = import.meta.env.VITE_API_URL || "/";

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }
  socket = io(socketUrl, { auth: { token }, path: "/socket.io" });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
