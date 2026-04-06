# Task: Create a continuous-bug-hunt loop strategy

## Context

We want to test running an AI agent in an infinite loop for hours. The hypothesis is that agents degrade during long single runs — they "get lost" and try to finish early. The loop approach resets context each iteration while preserving findings via `carry_context`, giving the agent a fresh start with memory each cycle.

## What to create

Create `strategies/continuous-bug-hunt.yaml` following the pattern in `strategies/loop.yaml`.

### Strategy spec

```yaml
description: Continuously hunt for critical bugs in an infinite loop

prompt:
  system: You are a relentless bug-hunting agent. Each iteration you must explore NEW areas of the codebase you haven't checked before. Be thorough and systematic.
  task: |
    There is a critical issue in this codebase. Dig really deep and try to find it.
    This codebase is huge — check areas you didn't explore in previous iterations.

    Do not stop until you find a critical bug.

    If you found issues in previous iterations, do NOT re-investigate those — move on to unexplored areas.

    $previous_result

max_turns: 30
timeout: 900

execution:
  mode: loop
  interval: 60
  max_iterations: 0
  carry_context: true
```

### Key parameters
- `timeout: 900` — 15 minutes per iteration (enough to dig deep)
- `interval: 60` — 1 minute pause between iterations
- `max_iterations: 0` — infinite (runs until cancelled via `POST /api/jobs/{id}/cancel`)
- `carry_context: true` — injects `$previous_result` so the agent knows what it already found
- `max_turns: 30` — generous turn budget per iteration

## Verification

1. Start the API: `just serve`
2. Confirm strategy loaded: `curl localhost:8000/api/strategies` — should include `continuous-bug-hunt`
3. Start a job: `curl -X POST localhost:8000/api/jobs -H 'Content-Type: application/json' -d '{"strategy": "continuous-bug-hunt"}'`
4. Stream output: `curl localhost:8000/api/jobs/{id}/stream` — verify iterations run and carry context
5. Cancel: `curl -X POST localhost:8000/api/jobs/{id}/cancel` — verify clean stop
