import { useState, useEffect, useCallback, type ReactNode } from "react";
import { AuthContext } from "@/hooks/use-auth";
import { LoginPage } from "@/components/login-page";

const TOKEN_KEY = "auth_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/status");
        const data = await res.json();
        if (!data.auth_required) {
          setAuthenticated(true);
          setAuthRequired(false);
          setLoading(false);
          return;
        }
        setAuthRequired(true);
        // Check if we have a stored token that still works
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          const check = await fetch("/api/health", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (check.status !== 401) {
            setAuthenticated(true);
            setLoading(false);
            return;
          }
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        // If status check fails, assume no auth needed (server might be down)
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      setAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthenticated(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ authenticated, authRequired, loading, login, logout }}>
      {authRequired && !authenticated ? <LoginPage /> : children}
    </AuthContext.Provider>
  );
}
