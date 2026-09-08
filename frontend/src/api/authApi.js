// Authentication API calls.
import { apiRequest } from "./client.js";

export async function googleAuth(data = {}) {
  return apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function register(data) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function login(username, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe() {
  return apiRequest("/auth/me");
}
