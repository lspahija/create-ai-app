import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useStrategy, useCreateStrategy, useUpdateStrategy } from "@/hooks/use-strategies";
import { toast } from "sonner";
import type { StrategyCreateRequest } from "@/api/types";

const DEFAULT_FORM: StrategyCreateRequest = {
  name: "",
  description: "",
  prompt: { system: "", task: "" },
  agent: "claude-cli",
  model: null,
  max_turns: null,
  timeout: 900,
  options: {},
  execution: { mode: "one-shot", interval: 300, max_iterations: 0, carry_context: false, max_consecutive_failures: 3, self_assess: true },
};

export function StrategyEditorPage() {
  const { name } = useParams<{ name: string }>();
  const isEdit = !!name;
  const navigate = useNavigate();
  const { data: existing } = useStrategy(name);
  const createMutation = useCreateStrategy();
  const updateMutation = useUpdateStrategy();

  const [form, setForm] = useState<StrategyCreateRequest>(DEFAULT_FORM);
  const [lastExisting, setLastExisting] = useState(existing);
  if (existing && existing !== lastExisting) {
    setLastExisting(existing);
    setForm({
      name: existing.name,
      description: existing.description,
      prompt: { ...existing.prompt },
      agent: existing.agent,
      model: existing.model,
      max_turns: existing.max_turns,
      timeout: existing.timeout,
      options: { ...existing.options },
      execution: { ...existing.execution },
    });
  }

  function update<K extends keyof StrategyCreateRequest>(key: K, val: StrategyCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function updatePrompt(key: "system" | "task", val: string) {
    setForm((f) => ({ ...f, prompt: { ...f.prompt!, [key]: val } }));
  }

  function updateExecution(key: string, val: unknown) {
    setForm((f) => ({ ...f, execution: { ...f.execution!, [key]: val } }));
  }

  const isLoop = form.execution?.mode === "loop";

  function handleSave() {
    if (!form.prompt?.task) {
      toast.error("Task prompt is required");
      return;
    }
    if (!isEdit && !form.name) {
      toast.error("Strategy name is required");
      return;
    }

    if (isEdit) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { name: _name, ...data } = form;
      updateMutation.mutate(
        { name: name!, data },
        {
          onSuccess: () => {
            toast.success("Strategy updated");
            navigate("/");
          },
          onError: (err) => toast.error(err.message),
        },
      );
    } else {
      createMutation.mutate(form, {
        onSuccess: () => {
          toast.success("Strategy created");
          navigate("/");
        },
        onError: (err) => toast.error(err.message),
      });
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight">
          {isEdit ? `Edit: ${name}` : "New Strategy"}
        </h2>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="my-strategy"
              value={form.name ?? ""}
              onChange={(e) => update("name", e.target.value)}
              disabled={isEdit}
            />
            {!isEdit && (
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="What this strategy does"
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="prompt">
          <TabsList>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
          </TabsList>

          <TabsContent value="prompt" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">System Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Optional role or context for the agent..."
                  rows={3}
                  value={form.prompt?.system ?? ""}
                  onChange={(e) => updatePrompt("system", e.target.value)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Task Prompt *</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  placeholder="The main instruction. Use $variable for substitution..."
                  rows={6}
                  value={form.prompt?.task ?? ""}
                  onChange={(e) => updatePrompt("task", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use <code className="bg-muted px-1 rounded">$variable</code> syntax for runtime substitution
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="execution" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-2">
                  <Label>Execution Mode</Label>
                  <Select
                    value={form.execution?.mode ?? "one-shot"}
                    onValueChange={(v) => updateExecution("mode", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-shot">One-shot</SelectItem>
                      <SelectItem value="loop">Loop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isLoop && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="interval">Interval (seconds)</Label>
                      <Input
                        id="interval"
                        type="number"
                        min={1}
                        value={form.execution?.interval ?? 300}
                        onChange={(e) => updateExecution("interval", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-iter">Max Iterations (0 = infinite)</Label>
                      <Input
                        id="max-iter"
                        type="number"
                        min={0}
                        value={form.execution?.max_iterations ?? 0}
                        onChange={(e) => updateExecution("max_iterations", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-failures">Max Consecutive Failures (0 = disabled)</Label>
                      <Input
                        id="max-failures"
                        type="number"
                        min={0}
                        value={form.execution?.max_consecutive_failures ?? 3}
                        onChange={(e) => updateExecution("max_consecutive_failures", Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Aborts the loop after this many failures in a row. Uses exponential backoff between retries.
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="carry-ctx">Carry Context</Label>
                      <Switch
                        id="carry-ctx"
                        checked={form.execution?.carry_context ?? false}
                        onCheckedChange={(v) => updateExecution("carry_context", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="self-assess">Self-Assess</Label>
                        <p className="text-xs text-muted-foreground">
                          Agent reports whether it made meaningful progress each iteration
                        </p>
                      </div>
                      <Switch
                        id="self-assess"
                        checked={form.execution?.self_assess ?? true}
                        onCheckedChange={(v) => updateExecution("self_assess", v)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-2">
                  <Label>Agent Adapter</Label>
                  <Select
                    value={form.agent ?? "claude-cli"}
                    onValueChange={(v) => update("agent", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-cli">Claude CLI</SelectItem>
                      <SelectItem value="claude-sdk">Claude SDK</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model (optional)</Label>
                  <Input
                    id="model"
                    placeholder="e.g. claude-sonnet-4-6"
                    value={form.model ?? ""}
                    onChange={(e) => update("model", e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-turns">Max Turns (optional)</Label>
                  <Input
                    id="max-turns"
                    type="number"
                    min={1}
                    placeholder="Default"
                    value={form.max_turns ?? ""}
                    onChange={(e) => update("max_turns", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={1}
                    value={form.timeout ?? 900}
                    onChange={(e) => update("timeout", Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/")}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-1.5" />
          {saving ? "Saving..." : isEdit ? "Update Strategy" : "Create Strategy"}
        </Button>
      </div>
    </div>
  );
}
