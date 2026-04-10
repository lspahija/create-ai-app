# Strategies

A strategy is a YAML file that fully defines how an AI agent approaches a task — what it's told to do, which model runs it, and how long it runs. Every job uses a strategy. There is no separate agent config file.

Drop a `.yaml` file in `strategies/` and it's immediately available via the API.

## Quick start

The simplest possible strategy:

```yaml
prompt:
  task: Summarize the README in this repository.
```

That's it. Everything else has defaults. Run it:

```
POST /api/jobs {"strategy": "my-strategy", "variables": {}}
```

## Full reference

### Identity

**`name`** (string, default: filename)

A human-readable identifier for the strategy. If you omit this, it's derived from the filename — `audit-broad.yaml` becomes `audit-broad`. Shown in API responses.

**`description`** (string, default: `""`)

What this strategy does, in plain language. Returned by `GET /api/strategies` so users can browse what's available without reading the YAML.

### Prompt

The prompt is the core of a strategy — it defines what the agent is actually told to do.

**`prompt.system`** (string, default: `""`)

Optional context prepended before the task prompt, separated by a blank line. Use this to set the agent's role, constraints, or domain expertise.

```yaml
prompt:
  system: |
    You are an expert security auditor specializing in smart contracts.
    Be thorough and provide proof-of-concept exploits where possible.
```

If omitted or empty, no system prompt is sent — the agent gets only the task.

**`prompt.task`** (string, **required**)

The actual work prompt. This is the only required field in the entire strategy.

Supports variable substitution using `$name` or `${name}` syntax. Variables are passed at runtime via the API's `variables` field. Unmatched variables are left as literal text (no errors).

```yaml
prompt:
  task: |
    Review the code in $repo_path for vulnerabilities.
    Focus areas: $focus_areas
```

```
POST /api/jobs {
  "strategy": "audit",
  "variables": {"repo_path": "./contracts", "focus_areas": "reentrancy, access control"}
}
```

### Agent configuration

These control which AI provider runs the task and with what parameters.

**`agent`** (string, default: `"claude-cli"`)

Which adapter to use. Must match a registered adapter name. Ships with:

- `claude-cli` — runs Claude Code as a subprocess (no SDK dependency)
- `claude-sdk` — uses the Claude Agent SDK library (in-process, requires `claude-agent-sdk` package)

Add your own adapters (Codex, Gemini, etc.) by implementing the `BaseAdapter` protocol in `app/adapters/`.

**`model`** (string, default: `null`)

Which model the adapter should use. When `null`, the adapter picks its own default.

Examples: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`

**`max_turns`** (integer, default: `null`)

Maximum number of agent turns. A "turn" is one cycle of the agent thinking, using a tool, and getting the result back. When `null`, the adapter picks its own default (typically 30 for Claude).

Set higher for complex multi-step tasks (e.g. `100` for a thorough audit). Set lower to keep quick tasks cheap (e.g. `5` for a simple question).

**`timeout`** (integer, default: `900`)

Seconds before the agent process is killed. Default is 15 minutes.

Set higher for long-running tasks: `3600` (1 hour), `7200` (2 hours). The agent is hard-killed at this limit regardless of what it's doing.

**`options`** (dict, default: `{}`)

Provider-specific key-value pairs passed through to the adapter. The adapter decides what to do with them — unknown keys are ignored.

Currently supported options by provider:

| Provider | Key | Values | Effect |
|----------|-----|--------|--------|
| Claude (`claude-cli`, `claude-sdk`) | `effort` | `low`, `medium`, `high`, `max` | Controls how much thinking the model does before responding |

```yaml
options:
  effort: max
```

### Execution policy

Controls whether the strategy runs once or repeatedly.

**`execution.mode`** (string, default: `"one-shot"`)

- **`one-shot`** — Run the agent once and return the result. This is the default and right for most tasks.
- **`loop`** — Run the agent repeatedly on an interval. Useful for monitoring, continuous improvement, or tasks that benefit from multiple passes. The job runs until `max_iterations` is reached or it's cancelled via `POST /api/jobs/{id}/cancel`.

**`execution.interval`** (integer, default: `300`)

Loop mode only. Seconds to wait between runs. The wait is interruptible — cancelling a job stops it immediately, even mid-sleep.

**`execution.max_iterations`** (integer, default: `0`)

Loop mode only. Stop after this many runs. `0` means run forever until cancelled.

**`execution.max_consecutive_failures`** (integer, default: `3`)

Loop mode only. Abort the loop after this many failures in a row. `0` disables the check (loop runs until `max_iterations` or cancellation). Uses exponential backoff between failed iterations — wait time doubles after each failure, capped at 8x the normal interval.

**`execution.self_assess`** (boolean, default: `true`)

Loop mode only. When `true`, the agent is instructed to include a `[RESULT: SUCCESS]` or `[RESULT: FAILED]` marker at the end of each iteration's output. The orchestrator uses this to determine whether the iteration made meaningful progress, overriding the default exit-code-based success check.

This is the key difference between "the process didn't crash" and "the agent accomplished something useful." Without self-assessment, an agent that produces broken code with exit code 0 is treated as successful. With it, the agent evaluates its own work and reports honestly.

If the agent doesn't include a marker, the orchestrator falls back to exit-code-based success.

**`execution.carry_context`** (boolean, default: `false`)

Loop mode only. When `true`, cumulative notes from all prior iterations are injected into the next run as the `$notes` variable. Each note is a one-line summary with the iteration number and success/failure status. This lets the agent build on its previous work across runs — useful for iterative refinement. The `$previous_result` variable is also set (as an alias for `$notes`) for backwards compatibility.

If `true` but there are no previous notes yet (first iteration), `$notes` is set to an empty string.

## Examples

### Simple one-shot

```yaml
prompt:
  task: |
    Think about the following topic and share your thoughts:
    $topic
```

### Security audit with high limits

```yaml
description: Deep security audit

prompt:
  system: You are an expert security auditor. Be thorough and systematic.
  task: |
    Audit the smart contracts in this repository for vulnerabilities.
    Focus on: $focus_areas

model: claude-opus-4-6
max_turns: 100
timeout: 3600
options:
  effort: max
```

### Continuous monitoring loop

```yaml
description: Periodically check project health

prompt:
  system: You are a project maintenance agent.
  task: |
    Check the project for failing tests and lint errors. Fix any issues.
    $notes

max_turns: 20
timeout: 300

execution:
  mode: loop
  interval: 600
  carry_context: true
  max_consecutive_failures: 3
  self_assess: true
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/jobs` | Run a strategy. Body: `{"strategy": "name", "variables": {...}}` |
| `GET` | `/api/strategies` | List available strategies (name, description, mode) |
| `GET` | `/api/jobs` | List all jobs |
| `GET` | `/api/jobs/{id}` | Get job status |
| `GET` | `/api/jobs/{id}/stream` | SSE stream of real-time agent output |
| `POST` | `/api/jobs/{id}/cancel` | Cancel a running job |
