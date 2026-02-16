import { verifyToken } from "../utils/jwt.js";

/**
 * Socket.IO authentication middleware.
 * Accepts either:
 * - Agent: handshake.auth.apiKey matching AGENT_SERVICE_API_KEY (sets socket.isAgent = true).
 * - User:  JWT in handshake.auth.token or Authorization: Bearer <token> (sets socket.userId, socket.role).
 */
export function socketAuthMiddleware(socket, next) {
  const apiKey = socket.handshake.auth?.apiKey;
  const agentKey = process.env.AGENT_SERVICE_API_KEY;

  if (agentKey && apiKey && apiKey === agentKey.trim()) {
    socket.isAgent = true;
    return next();
  }

  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization?.startsWith("Bearer ")
      ? socket.handshake.headers.authorization.slice(7).trim()
      : null);

  if (!token) {
    return next(new Error("Unauthorized"));
  }

  try {
    const decoded = verifyToken(token);
    socket.userId = decoded.id;
    socket.role = decoded.role;
    return next();
  } catch (err) {
    return next(new Error("Unauthorized"));
  }
}
