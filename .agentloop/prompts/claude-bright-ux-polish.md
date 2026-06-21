# Claude Prompt — Bright Premium UX Polish

Follow `.agentloop/BRIDGE.md` and `.agentloop/prompts/claude-desktop-bridge.md`.
Read `.agentloop/GOAL.md`, `.agentloop/codex.md`, and the current code before editing.
Write your final implementation report to `.agentloop/claude.md`.

This is an approved implementation pass. Please read/inspect the repo, run
`npm run gates` first to establish the baseline, then implement the UX polish below.
If anything is genuinely ambiguous, ask before coding. Otherwise proceed, keep diffs
focused, run gates again, and commit/push the branch directly if gates are green and
only in-scope files are staged.

# Mission

Polish the Autonomy License for Physical AI web UX into a bright, premium,
YC-demo-ready product experience. The current media workflow is directionally
correct, but the user still cannot immediately see the video/image upload path and
does not feel the Sierra/Linear/Apple-grade quality yet.

The product story:

- A customer wants a robot to safely help in a real physical workplace, such as the
  user's dad's factory.
- They arrive at the console, upload or declare workflow media: video, images, floor
  plan, SOP, forbidden examples, and/or Google Drive link.
- The product reflects back what it understood, lets the operator approve/edit it,
  illustrates the mapped workflow, then runs the deterministic Physical AI license eval.
- The oracle/verifier, not an LLM, decides finish/escalate/refuse and license outcome.

# Design Direction

Act as an elite senior frontend engineer specializing in polished modern B2B product
UX. Use Sierra.ai and Linear.app as inspiration for clarity, refinement, spacing,
trust surfaces, and product-preview storytelling, but **do not make this dark mode**.

Desired aesthetic:

- Bright, premium, spacious, technically sophisticated.
- Apple-grade product feel: clear hierarchy, calm motion, crisp surfaces, polished
  whitespace, precise copy.
- "Safety lab meets enterprise builder": warm, trustworthy, optimistic.
- The page should feel beautiful immediately, but still usable as a working console.

Visual tokens:

- Background: bright white / soft ivory / very pale blue-gray, not black.
- Text: near-black graphite for primary, cool gray for secondary.
- Accent: soft cyan/blue with tiny hints of mint or lavender; avoid heavy purple
  gradient blobs and avoid dark navy/slate dominance.
- Borders: crisp thin light borders, subtle shadows, soft glass only when it improves
  legibility.
- Radius: restrained, generally <= 8px unless existing UI needs otherwise.
- Typography: SF Pro / Inter / system sans feel, large confident headings, no negative
  letter spacing.

# UX Requirements

1. Make upload-first obvious in the first viewport.
   - The primary CTA should communicate media upload, e.g. `Upload workflow video` or
     `Start with workflow media`, not a vague "Describe site" label.
   - The landing hero should visibly preview a media intake console with a video/file
     upload area and Google Drive link row.
   - The user should not wonder where to upload video/images.

2. Bright premium landing page.
   - Redesign `Landing` so the first screen feels like a polished product, not a
     generic hackathon form.
   - Include concise, strong copy. Possible headline directions:
     - `License robots before they act`
     - `Prove robot readiness`
     - `Turn factory footage into a safety eval`
   - Keep the human story implicit but present: helping real workers safely, not
     deploying robots blindly.
   - Include a product-preview mockup/bento below or beside the hero:
     media intake -> understood workflow -> deterministic oracle -> safety case.

3. Capture screen polish.
   - `CaptureConsole` should look like a premium media intake studio.
   - The upload zone must be visually dominant and above the fold.
   - Use clear labels: `Upload workflow video`, `Select video or files`,
     `Paste Google Drive link`.
   - Supported formats should be visible: MP4, MOV, WebM, AVI, images, PDFs, text.
   - Keep the honest Stage A copy: `Metadata only in this demo. Nothing is uploaded
     or parsed.`
   - Add polished selected-file cards and Drive-link cards.
   - Add a small trust note explaining that media helps author the workflow, while the
     deterministic oracle still judges safety.

4. Flow clarity.
   - Add/upgrade a visible stepper:
     `Capture -> Understand -> Align -> Simulate -> License`
   - The user should always know where they are and what happens next.

5. Product illustration.
   - Improve `WorkflowIllustration` so it feels like a real product visualization:
     clean map, path, terminal decision, and safety rationale.
   - Keep `prefers-reduced-motion` support.
   - Do not introduce heavy animation that risks jank or visual clutter.

6. Remove stale/confusing old journey.
   - Ensure the default app route cannot show the old `Create Physical AI License Eval`
     path.
   - If `IntakeForm` is now unused, either retire it safely or make sure it is not
     reachable and cannot confuse the demo.
   - Search for stale copy like `Create Physical AI License Eval` and replace/remove
     where appropriate.

7. Keep non-negotiable trust boundaries.
   - No real upload/storage.
   - No byte reads.
   - No object URLs.
   - No model calls.
   - No LLM judge.
   - No schema/migrations.
   - Do not alter oracle/verifier semantics.
   - Keep deterministic tests passing.

8. Preserve existing winning proof points.
   - Triptych demo.
   - FAR/FRR matrix.
   - Reward-hacking trace.
   - Signal Extractor JSON/report.
   - Evidence bridge and provenance.
   - Physical AI wedge and readiness disclaimer.

# Files To Inspect First

- `src/App.tsx`
- `src/App.css`
- `src/components/Landing.tsx`
- `src/components/CaptureConsole.tsx`
- `src/components/UnderstandingProgress.tsx`
- `src/components/ReflectAlign.tsx`
- `src/components/WorkflowIllustration.tsx`
- `src/components/EnvironmentPreview.tsx`
- `src/components/LicenseResults.tsx`
- `src/captureManifest.ts`
- `src/workflowDraft.ts`
- `src/environmentPlan.ts`
- relevant tests in `src/*.test.ts`, `server/*.test.ts`, `server/env/*.test.ts`

# Implementation Guidance

- Work in the existing React/CSS stack. Do not add Tailwind unless explicitly approved;
  this repo currently uses `src/App.css`.
- Prefer focused component/CSS refinements over large rewrites.
- Keep mobile responsive and avoid overlap/clipping.
- Use semantic HTML and accessible labels/focus states.
- If you add small CSS-native product mockups/illustrations, keep them lightweight.
- If you have access to image generation and want to add bitmap assets, ask first;
  otherwise use CSS/React product-preview visuals.

# Verification

- Run `npm run gates` before and after.
- Manually verify with a fresh dev server. If port `5174` shows stale old UI, start a
  strict fresh port such as:

  ```sh
  npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
  ```

- Report the exact URL tested.
- Verify the click path:
  1. landing page visible
  2. primary CTA leads to capture
  3. upload video/file button visible
  4. Google Drive link visible
  5. analyze -> understand -> align -> illustrate -> preview -> results

# Report Back

Write to `.agentloop/claude.md` and end with:

```md
## Handoff To Codex
Status:
Needs:
Files changed:
Gates:
Preview URL tested:
Questions:
```
