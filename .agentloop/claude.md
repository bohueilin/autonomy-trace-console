# Claude Bridge Output — Review handoff (landing rebuild + voice intake + clarity)

## Status
Several UX + feature passes are done and on `origin/codex/physical-ai-license`
(HEAD `d415ebf`). `npm run gates` GREEN — build + lint + verify:evidence (40) +
**133 tests / 17 files**. Requesting a read-only Codex review + ranked recommendations
before the next build.

## Product (one line)
Turn real-world workplace footage into a deterministic robot-safety eval, then issue the
autonomy license a robot has earned for a specific site. Thesis: capability ≠ permission.
**AI proposes, a human approves, a deterministic oracle judges — never an LLM judge.**

## What changed since the last review
1. **Frontier landing rebuild** (`src/components/Landing.tsx`, `src/App.css`,
   `src/index.css`, `index.html`): Space Grotesk display type; proof-first descent
   (hero → proof bar → 4-step flow → trust diagram → personalized-AI-brain feature →
   "across human spaces" reference films → why-now origin wedge → who-it's-for + AIUC
   credibility → closing CTA). Signature device: the finish/escalate/refuse decision
   triad. Hero plays a self-hosted commercial film (`public/vision-film.mp4`),
   non-interactive. Reference Shorts use poster→play-on-scroll (`src/components/ScrollVideo.tsx`).
2. **Voice intake** (`src/components/VoiceInput.tsx`, `src/useVoiceWorkflow.ts`,
   `server/minimaxHandler.ts`, `POST /api/voice/structure` + `voiceStatus` in
   `server/app.ts`, `minimax` in `server/config.ts`): one-click "Speak your site" →
   browser SpeechRecognition transcript → server-side MiniMax proxy structures it into
   the Capture fields. Key is server-side only (`.env.local`, gitignored; verified 0
   hits in `dist`). Graceful fallback to the raw transcript on no-key/error. INTAKE /
   AUTHORING ONLY — never touches oracle/reward/label/license. Tests:
   `server/minimaxHandler.test.ts`. Verified live (MiniMax `MiniMax-Text-01`,
   `/text/chatcompletion_v2`).
3. **Clarity + plain-English layer** (`src/components/CaptureConsole.tsx`,
   `src/App.tsx` showcase, `Landing.tsx`): numbered review fields (1 Outcome / 2 Workflow
   / 3 Safety rules) + "review fields 1–3, then Analyze" banner + brief highlight after
   voice fill; Capture tips as one-primary + progressive-disclosure `<details>` (≤3);
   reworded jargon ("a fixed rulebook (the 'oracle'), not an AI"); an "In plain English"
   glossary on the sample report (Oracle, finish/escalate/refuse, FAR, FRR, reward-hacking).
4. **Honest claims**: removed the homepage "FAR/FRR 0% / 0%" over-promise → "Calibrated
   per site — no blanket accuracy promises" + a "How do you handle accuracy?" accordion
   that defines FAR/FRR plainly. Results cert numbers labeled "reference-oracle operating point."
5. **Readability fixes**: leftover dark-theme colors on Illustrate/Capture/Understand
   (light-gray, white-on-cream/paper) mapped to bright tokens.
6. **Server boot fix**: `src/environmentPlan.ts` needed an explicit `.ts` import
   extension for Node native type-stripping — `npm run server` had been unstartable; it
   boots now (the voice proxy requires it).

## Non-negotiables (please confirm we held these)
- Determinism is sacred; oracle/verifier is the source of truth; NO LLM-as-judge.
- Secrets only in `.env.local` (never committed/bundled); no InsForge schema/migrations.
- Voice/video/AI are authoring/storytelling only; they cannot set labels/rewards/license.
- Robot placement on the site map is descriptive provenance only
  (`src/workflowDraft.test.ts` asserts `frozenToPlanInput` excludes robots/siteMap).

## Run / verify
- UI: `npm run dev` (proxies `/api` + `/v1` → `:8787`). Live voice/evidence: also `npm run server`.
- Gates: `npm run gates`. Secret check: `grep -r "$MINIMAX_API_KEY" dist` → 0.

## Handoff To Codex
Status: Landing rebuild + MiniMax voice intake + plain-English/clarity layer + FAR/FRR
honesty fix shipped; gates green; pushed `d415ebf`.
Needs: a read-only review + a P0/P1/P2 recommendation list written to `.agentloop/codex.md`,
covering (1) voice trust-boundary audit (key can't leak; structured voice can't influence
scoring — `minimaxHandler.ts`, `app.ts`, `useVoiceWorkflow.ts`); (2) code quality
(SpeechRecognition lifecycle/cleanup, fallback handling, any other `.ts`-extension/native-
ESM risks); (3) YC product/positioning (remaining over-claims, jargon, a11y, demo-flow
coherence); (4) ranked next tasks with rough effort + risks.
Files changed: see "What changed" above (Landing.tsx, App.tsx, App.css, index.css,
index.html, CaptureConsole.tsx, VoiceInput.tsx, ScrollVideo.tsx, useVoiceWorkflow.ts,
server/minimaxHandler.ts + test, server/app.ts, server/config.ts, src/environmentPlan.ts;
asset public/vision-film.mp4).
Gates: `npm run gates` GREEN — build + lint + verify:evidence (40) + 133 tests / 17 files.
Questions: any trust-boundary or over-claim concerns before we add the next feature?
