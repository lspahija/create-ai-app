import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { JobTracker } from "@/components/job-tracker";
import { Nav } from "@/components/nav";
import { StrategiesPage } from "@/pages/strategies";
import { StrategyEditorPage } from "@/pages/strategy-editor";
import { RunJobPage } from "@/pages/run-job";
import { JobsPage } from "@/pages/jobs";
import { SettingsPage } from "@/pages/settings";

const queryClient = new QueryClient();

function Layout() {
  const { theme, toggleTheme } = useTheme();
  const { authRequired, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-3 flex items-center gap-6">
          <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap">
            My App
          </h1>
          <Nav />
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle dark mode">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {authRequired && (
              <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
                <LogOut className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </header>
      <JobTracker />
      <main className="container mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<StrategiesPage />} />
          <Route path="/strategies/new" element={<StrategyEditorPage />} />
          <Route path="/strategies/:name" element={<StrategyEditorPage />} />
          <Route path="/strategies/:name/run" element={<RunJobPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Layout />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
