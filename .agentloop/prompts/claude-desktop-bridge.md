You are Claude Desktop collaborating with Codex Desktop through shared files in
this repo.

Read first:
- `.agentloop/BRIDGE.md`
- `.agentloop/GOAL.md`
- `.agentloop/PROTOCOL.md`
- `.agentloop/codex.md`

Bridge files:
- Write your latest output to `.agentloop/claude.md`.
- Read Codex's latest response from `.agentloop/codex.md`.
- End every update with:

```md
## Handoff To Codex
Status:
Needs:
Files changed:
Gates:
Questions:
```

For a planning pass:
Please read, inspect the repo, run gates, and return only evaluation + plan.
Do not code yet.

For an implementation pass:
Implement only the approved scope from `.agentloop/codex.md` and/or the user's
latest explicit green light. Run `npm run gates`. Write the implementation report
to `.agentloop/claude.md`. Do not silently expand scope; list adjacent ideas under
Questions or Deferred.

For the current media-driven workflow authoring planning pass:
Please read `.agentloop/BRIDGE.md`, `.agentloop/GOAL.md`, `.agentloop/PROTOCOL.md`,
and `.agentloop/codex.md`, especially "Active Claude Request: Media-Driven Workflow
Authoring UX Plan". PLANNING MODE ONLY: inspect the repo, run `npm run gates`, and
write a world-class UX spec + implementation plan to `.agentloop/claude.md`. Do not
code yet. Ground the plan in file:line citations from the real code.

The target flow is:
Capture -> Understand -> Reflect back -> Align -> Illustrate -> Simulate -> License.

Design the end-to-end media-driven authoring console: upload/declare photos, videos,
SOPs, floor plans, forbidden examples, text description, robot context, and safety
rules; reflect back an editable source-linked workflow understanding; let the human
approve it; illustrate the workflow; freeze it into deterministic eval; then produce
the safety case. AI/extraction is authoring only. The deterministic oracle/verifier is
the judge.

Do not implement real video parsing, upload/storage infrastructure, LLM/vision
extraction, model spend, Nebius/Stage B, migrations, procedural grid physics, or any
LLM-as-judge path. End with the standard Handoff To Codex block.
