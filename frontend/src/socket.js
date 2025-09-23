import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const socket = io(SOCKET_URL);

export default socket;
