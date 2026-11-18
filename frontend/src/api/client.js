// HTTP API client wrapper for backend communication.
const API_BASE = import.meta.env?.VITE_API_URL || "/api";

// Fired when the backend rejects our token (expired or invalid). AuthContext
// listens for it and signs the user out instead of leaving a dead session.
export const AUTH_EXPIRED_EVENT = "auth:expired";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && token && typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }

  if (!res.ok) {
    let message = `API request failed: ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        message = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch (_) {}
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}
