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

For the current media-driven workflow authoring implementation pass:
Please read `.agentloop/BRIDGE.md`, `.agentloop/GOAL.md`, `.agentloop/PROTOCOL.md`,
and `.agentloop/codex.md`, especially "Approved Next Iteration: Media-Driven
Workflow Authoring Stage A". Implement only that approved Stage A scope. Inspect the
repo first, keep diffs reviewable, and run `npm run gates`.

The target flow is:
Capture -> Understand -> Reflect back -> Align -> Illustrate -> Simulate -> License.

Build the end-to-end no-spend media-driven authoring console: metadata-only file
capture, deterministic draft/stub understanding, Reflect/Align approval, workflow
illustration, frozen eval preview, safety-case provenance, and descriptive no-schema
evidence metadata. AI/extraction is authoring only. The deterministic oracle/verifier
is the judge.

Do not implement real video parsing, upload/storage infrastructure, LLM/vision
extraction, model spend, Nebius/Stage B, migrations, procedural grid physics, or any
LLM-as-judge path. If gates are green and only in-scope files are staged, commit and
push directly per `.agentloop/codex.md` publish policy. Write the implementation
report to `.agentloop/claude.md` and end with the standard Handoff To Codex block.
