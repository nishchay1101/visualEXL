import axios from "axios";

// Get or create a unique session ID for this browser
const getSessionId = () => {
  let id = localStorage.getItem("visualexl_session_id");
  if (!id) {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("visualexl_session_id", id);
  }
  return id;
};

export const api = axios.create({
  baseURL: (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:5001"
});

// Automatically add the session ID to every request
api.interceptors.request.use((config) => {
  config.headers["x-session-id"] = getSessionId();
  return config;
});