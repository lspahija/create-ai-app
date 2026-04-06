import { useState } from "react";
import { Key, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSettings, useSetOAuthToken, useClearOAuthToken } from "@/hooks/use-settings";
import { toast } from "sonner";

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const setTokenMutation = useSetOAuthToken();
  const clearTokenMutation = useClearOAuthToken();

  const [token, setToken] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  function handleSetToken() {
    if (!token.trim()) {
      toast.error("Token cannot be empty");
      return;
    }
    setTokenMutation.mutate(token.trim(), {
      onSuccess: () => {
        toast.success("OAuth token updated");
        setToken("");
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function handleClearToken() {
    clearTokenMutation.mutate(undefined, {
      onSuccess: () => toast.success("OAuth token cleared"),
      onError: (err) => toast.error(err.message),
    });
    setShowClearConfirm(false);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure authentication and preferences
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      )}

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="size-4" />
              Claude OAuth Token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              {settings.oauth_token_set ? (
                <>
                  <CheckCircle2 className="size-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">Token is configured</span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-4 text-yellow-500" />
                  <span className="text-yellow-600 dark:text-yellow-400">No token configured</span>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="oauth-token">
                {settings.oauth_token_set ? "Update token" : "Set token"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="oauth-token"
                  type="password"
                  placeholder="Enter OAuth token..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSetToken()}
                />
                <Button
                  onClick={handleSetToken}
                  disabled={setTokenMutation.isPending || !token.trim()}
                >
                  {setTokenMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            {settings.oauth_token_set && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Clear Token
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              This token is used by adapters (Claude CLI and SDK) to authenticate API calls.
              It is stored securely and never displayed after saving.
            </p>
          </CardContent>
        </Card>
      )}

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Default Agent</dt>
                <dd className="font-medium">{settings.default_agent}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear OAuth token?</AlertDialogTitle>
            <AlertDialogDescription>
              Adapters will no longer be able to authenticate until a new token is set.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearToken}>Clear Token</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
