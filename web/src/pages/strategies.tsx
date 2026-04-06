import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, MoreVertical, Pencil, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useStrategies, useDeleteStrategy } from "@/hooks/use-strategies";
import { toast } from "sonner";

export function StrategiesPage() {
  const { data: strategies, isLoading } = useStrategies();
  const deleteMutation = useDeleteStrategy();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => toast.success(`Deleted "${deleteTarget}"`),
      onError: (err) => toast.error(err.message),
    });
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Strategies</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your AI agent strategies
          </p>
        </div>
        <Button asChild>
          <Link to="/strategies/new">
            <Plus className="size-4 mr-1.5" />
            New Strategy
          </Link>
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading strategies...</p>
      )}

      {strategies && strategies.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No strategies yet</p>
            <Button asChild variant="outline">
              <Link to="/strategies/new">Create your first strategy</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {strategies?.map((s) => (
          <Card key={s.name} className="group relative">
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{s.name}</h3>
                  {s.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {s.description}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 size-8">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/strategies/${s.name}`}>
                        <Pencil className="size-3.5 mr-2" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/strategies/${s.name}/run`}>
                        <Play className="size-3.5 mr-2" />
                        Run
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(s.name)}
                    >
                      <Trash2 className="size-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{s.execution.mode}</Badge>
                <Badge variant="outline">{s.agent}</Badge>
                {s.variables.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {s.variables.length} variable{s.variables.length !== 1 && "s"}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete strategy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
