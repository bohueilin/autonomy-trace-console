# Desktop Bridge — Codex Desktop <-> Claude Desktop

Use this when the Desktop apps are collaborating through the shared repo folder.
The CLI loop in `run.sh` still uses `design.md`, `implementation.md`, and
`review.md`; the bridge files below are for human-triggered Desktop handoffs.

## Files

| File | Writer | Purpose |
| --- | --- | --- |
| `.agentloop/claude.md` | Claude | Latest Claude evaluation, plan, implementation report, or questions. |
| `.agentloop/codex.md` | Codex | Latest Codex critique, refined plan, or instructions for Claude. |
| `.agentloop/STATE.json` | either/runner | Lightweight status. `run.sh` may overwrite this with round/phase/status. |

## Protocol

1. Claude reads the repo, this bridge doc, and the relevant `.agentloop` files.
2. Claude writes its latest output to `.agentloop/claude.md`.
3. Codex reads `.agentloop/claude.md` and writes response/instructions to
   `.agentloop/codex.md`.
4. Claude reads `.agentloop/codex.md` before continuing.
5. Repeat until the plan is aligned, then Claude implements and reports back in
   `.agentloop/claude.md`.

## Required Claude Handoff Format

Claude should end every bridge update with:

```md
## Handoff To Codex
Status:
Needs:
Files changed:
Gates:
Questions:
```

## Planning-Only First Task

For a new Claude planning pass, include this instruction directly in the prompt:

> Please read, inspect the repo, run gates, and return only evaluation + plan.
> Do not code yet.

## Implementation Pass

Once Codex/user gives green light, Claude should:

1. Read `.agentloop/codex.md`, `.agentloop/GOAL.md`, `.agentloop/PROTOCOL.md`, and
   this file.
2. Implement only the approved scope.
3. Run `npm run gates`.
4. Write the implementation report to `.agentloop/claude.md`.
5. Stop and ask Codex to review.

Claude should not silently expand scope. Adjacent ideas go under "Questions" or
"Deferred".
