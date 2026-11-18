// Global authentication context supporting Google OAuth.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authApi from "@/api/authApi.js";
import { AUTH_EXPIRED_EVENT } from "@/api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Sync session state and check the token whenever it changes. The profile
  // is fetched even when a cached user exists, so an expired token found on
  // page load signs the user out instead of showing a logged-in app whose
  // every request fails.
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      authApi.getMe()
        .then((profile) => {
          setUser(profile);
          localStorage.setItem("user", JSON.stringify(profile));
        })
        .catch((err) => {
          if (err?.status === 401) logout();
        });
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
    }
  }, [token]);

  // Any API call that gets a 401 for our token signs the user out.
  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  // Authenticates athlete via Google OAuth using real user credentials.
  const loginWithGoogle = useCallback(async function loginWithGoogle(googleData = {}) {
    if (!googleData?.token) {
      const err = new Error("Google did not return a valid identity token.");
      setAuthError(err.message);
      throw err;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const payload = {
        token: googleData.token,
        email: googleData.email?.trim().toLowerCase() || undefined,
        name: googleData.name?.trim() || undefined,
        picture: googleData.picture || null,
      };

      const res = await authApi.googleAuth(payload);

      setToken(res.access_token);
      setUser(res.user);
      localStorage.setItem("token", res.access_token);
      localStorage.setItem("user", JSON.stringify(res.user));
      return res.user;
    } catch (err) {
      setAuthError(err.message || "Failed to sign in with Google");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logs athlete out and clears local session storage.
  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        loading,
        authError,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
