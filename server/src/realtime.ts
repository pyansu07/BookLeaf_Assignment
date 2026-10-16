import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "./lib/jwt";
import { env } from "./config/env";

let io: Server | undefined;

export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigin },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Unauthorized"));
    try {
      socket.data.auth = verifyToken(token);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth as { role: string; authorProfileId?: string };
    if (auth.role === "ADMIN") {
      socket.join("admins");
    } else if (auth.authorProfileId) {
      socket.join(`author:${auth.authorProfileId}`);
    }
  });

  return io;
}

/** Notify the author who owns the ticket, and all admins watching the queue. */
export function emitTicketEvent(authorProfileId: string, event: string, payload: unknown) {
  if (!io) return;
  io.to(`author:${authorProfileId}`).to("admins").emit(event, payload);
}
