import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE,
});

export const makeCall = (toNumbers) =>
  api.post("/api/outbound/make-call", { toNumbers });

export const getAllCalls = () =>
  api.get("/api/outbound/get-all-calls");

export const getRecordingUrl = (callSid) =>`${API_BASE}/api/outbound/recording/${callSid}`;

export default api;
