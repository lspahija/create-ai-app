import { useState, useEffect, useCallback, type ReactNode } from "react";
import { AuthContext } from "@/hooks/use-auth";
import { LoginPage } from "@/components/login-page";

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
        // Check if existing cookie session is still valid
        const check = await fetch("/api/health", { credentials: "include" });
        if (check.status !== 401) {
          setAuthenticated(true);
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
        credentials: "include",
      });
      if (!res.ok) return false;
      setAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
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
