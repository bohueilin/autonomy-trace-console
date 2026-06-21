// FactoryCEO-TRM panel. The human CEO leaves a messy floor; the brain compiles it,
// plans, the verifier gates, the recursive TRM repairs to a verified safe plan, and
// the humanoid executes. Multi-modal input runs it on the USER'S own factory via the
// live brain (FastAPI). Styling takes cues from primeintellect.ai: dark, numbered
// uppercase mono labels, minimal borders, generous whitespace, terminal-like blocks.
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type Json = Record<string, any>
export type BrainFile = { name: string; kind: string; content: string }
export type BrainInput = { text: string; files: BrainFile[] }
const BRAIN = ((import.meta as any).env?.VITE_BRAIN_URL as string) || 'http://localhost:8090'
const mono = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

const card: React.CSSProperties = {
  background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14,
  padding: '22px 24px', marginBottom: 20,
}

function Label({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--accent)' }}>{n}</span>
      <span style={{ width: 18, height: 1, background: 'var(--line)' }} />
      {children}
    </div>
  )
}

function useJson(url: string) {
  const [data, setData] = useState<Json | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then(setData).catch((e) => setErr(String(e)))
  }, [url])
  return { data, err }
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span style={{ fontFamily: mono, fontSize: 11.5, border: `1px solid ${tone ?? 'var(--line)'}`, color: tone ?? 'var(--text)', borderRadius: 6, padding: '4px 8px', display: 'inline-block', marginRight: 7, marginBottom: 7 }}>{children}</span>
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function jobProvenanceLabel(jobSource?: Json | null) {
  const prov = String(jobSource?.jobs_provenance ?? '')
  if (prov.startsWith('real:')) return prov.replace('real:', '')
  if (prov.startsWith('example:')) return `${prov.replace('example:', '')} (sample — request full dataset for production)`
  if (prov) return prov
  return 'not loaded'
}

function RealFloorData({ jobSource, floorId }: { jobSource?: Json | null; floorId?: string }) {
  if (!jobSource) return null
  const src = String(jobSource.source ?? '').toUpperCase() || '—'
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--bg)' }}>
      <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Floor + dataset</div>
      <div style={{ display: 'grid', gap: 6, fontSize: 13, lineHeight: 1.5 }}>
        <div><span style={{ color: 'var(--muted)' }}>Floor plan</span> · <strong>{jobSource.floorplan_id ?? floorId ?? '—'}</strong>{jobSource.mapping_profile?.name ? ` (${jobSource.mapping_profile.name})` : ''}</div>
        <div><span style={{ color: 'var(--muted)' }}>Job dataset</span> · <strong>{src}</strong> — {jobSource.dataset ?? jobSource.adapter ?? 'warehouse orders'}</div>
        <div><span style={{ color: 'var(--muted)' }}>Order pool</span> · {jobProvenanceLabel(jobSource)}</div>
        <div><span style={{ color: 'var(--muted)' }}>On this floor</span> · {jobSource.n_orders ?? '?'} orders · {jobSource.n_order_lines ?? '?'} lines · {jobSource.n_skus ?? '?'} SKUs</div>
        {jobSource.url && (
          <div style={{ fontFamily: mono, fontSize: 11 }}>
            <a href={jobSource.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{jobSource.url}</a>
          </div>
        )}
        {jobSource.mapf_layout_source && (
          <div><span style={{ color: 'var(--muted)' }}>MAPF layout</span> · {jobSource.mapf_layout_source}</div>
        )}
        {jobSource.license && (
          <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)' }}>{jobSource.license}</div>
        )}
      </div>
    </div>
  )
}

function RolloutSnippet({ title, sample }: { title: string; sample: Json }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, background: 'var(--panel)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8, fontFamily: mono, fontSize: 11 }}>
        <strong style={{ color: 'var(--text)' }}>{title}</strong>
        <span style={{ color: 'var(--muted)' }}>
          reward {Number(sample.reward ?? 0).toFixed(2)}
          {sample.advantage != null ? ` · adv ${Number(sample.advantage) >= 0 ? '+' : ''}${Number(sample.advantage).toFixed(3)}` : ''}
        </span>
      </div>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto', fontFamily: mono, fontSize: 11, lineHeight: 1.45, color: 'var(--muted)' }}>
        {String(sample.response_excerpt ?? sample.snippet ?? 'No response text captured for this rollout.')}
      </pre>
    </div>
  )
}

function RolloutConversationSamples({ samples, bestRollout }: { samples: Json[]; bestRollout?: string }) {
  if (!samples?.length) return null
  const best = samples.find((s) => s.rollout === bestRollout) ?? samples[0]
  const low = samples.reduce((worst, s) => Number(s.reward ?? 0) < Number(worst.reward ?? 0) ? s : worst, samples[0])
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Rollout conversation excerpts</div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>
        These are captured model responses from the measured HUD group. The best row shows the candidate that earned the highest verifier reward; the comparison row shows a lower-scoring attempt from the same task.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        <RolloutSnippet title={`${best.rollout ?? 'best'} best candidate`} sample={best} />
        {low !== best && <RolloutSnippet title={`${low.rollout ?? 'low'} lower-scoring candidate`} sample={low} />}
      </div>
    </div>
  )
}

function TrainingBeforeAfter({ evidence }: { evidence?: Json | null }) {
  if (!evidence) return null
  const before: Json[] = evidence.before_samples ?? []
  const after: Json[] = evidence.after_samples ?? []
  if (!before.length && !after.length) return null
  const lift = Number(evidence.lift ?? 0)
  const improved = lift > 0
  const modelLabel = String(evidence.model ?? 'student model')
  const samples = [...before, ...after]
  const noJsonSamples = samples.filter((s) => s.has_json === false || Number(s.reward ?? 1) <= 0.05)
  const jsonOnlyFailure = noJsonSamples.length > 0 && !improved
  const teacherStudent = evidence.teacher_demos
    ? `Claude teacher demos → ${modelLabel} student`
    : `${modelLabel} self-GRPO`
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Training before / after</div>
        <Chip tone={improved ? 'var(--pos)' : 'var(--warn)'}>
          {evidence.reward_mode_compared ?? 'reward'} {Number(evidence.baseline_reward ?? 0).toFixed(3)} to {Number(evidence.final_reward ?? 0).toFixed(3)}
        </Chip>
        <Chip tone={improved ? 'var(--pos)' : 'var(--warn)'}>
          {lift >= 0 ? '+' : ''}{lift.toFixed(3)} lift
        </Chip>
        <Chip tone="var(--brand)">{teacherStudent}</Chip>
      </div>
      {(evidence.latest_hud_job_url || evidence.hud_jobs_dashboard_url || evidence.task_coverage) && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, background: 'var(--bg)', marginBottom: 10, fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>HUD run + coverage</div>
          {evidence.latest_hud_job_url && (
            <div>
              <span style={{ color: 'var(--muted)' }}>Latest training job</span> · <a href={evidence.latest_hud_job_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{evidence.latest_hud_job_id ?? evidence.latest_hud_job_url}</a>
              {evidence.training_status ? <span style={{ color: 'var(--muted)' }}> · {String(evidence.training_status).replace(/_/g, ' ')}</span> : null}
            </div>
          )}
          {evidence.hud_jobs_dashboard_url && (
            <div><span style={{ color: 'var(--muted)' }}>HUD jobs dashboard</span> · <a href={evidence.hud_jobs_dashboard_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{evidence.hud_jobs_dashboard_url}</a></div>
          )}
          {evidence.task_coverage && (
            <div><span style={{ color: 'var(--muted)' }}>Task coverage</span> · {evidence.task_coverage.platform_percent ?? 0}% — {evidence.task_coverage.reason}</div>
          )}
        </div>
      )}
      {evidence.source_path && (
        <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', marginBottom: 8 }}>
          Evidence artifact: {String(evidence.source_path).split('/').slice(-2).join('/')}
        </div>
      )}
      <p style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>
        This is real HUD TrainingClient evidence from the saved rollout artifact. The optimizer reinforces higher-advantage samples, but the panel reports the observed reward movement directly; if lift is negative, the run did not improve that reward mode yet.
        {evidence.teacher_demos ? ` In this run, the student prompt includes saved Claude teacher trajectories for the same floor task, then ${modelLabel} is updated by verifier reward.` : ` This is a self-GRPO run on ${modelLabel}: the same trainable model samples a group, the verifier scores each rollout, and GRPO updates when reward variance appears.`}
      </p>
      {jsonOnlyFailure && (
        <div style={{ border: '1px solid var(--warn)', borderRadius: 10, padding: 10, background: 'color-mix(in srgb, var(--warn) 8%, var(--bg))', marginBottom: 10, fontSize: 12.5, lineHeight: 1.5 }}>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: 6 }}>
            Why this {modelLabel} run failed
          </div>
          <p style={{ margin: '0 0 8px', color: 'var(--text)' }}>
            The run failed because the student produced a verbose reasoning trace instead of the strictly required JSON-only ActionPlan. The verifier expects a parseable object with <code style={{ fontFamily: mono }}>quote_decisions</code>, <code style={{ fontFamily: mono }}>procurement</code>, <code style={{ fontFamily: mono }}>schedule</code>, <code style={{ fontFamily: mono }}>quality</code>, <code style={{ fontFamily: mono }}>customer_messages</code>, and <code style={{ fontFamily: mono }}>safety</code>.
          </p>
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)' }}>
            Evidence: {noJsonSamples.length}/{samples.length} shown samples were non-JSON or near-zero reward. First failing sample starts: “{String(noJsonSamples[0]?.snippet ?? '').slice(0, 120).replace(/\s+/g, ' ')}…”
          </div>
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <ModelRolloutMethodCard model={evidence.model} evidence={evidence} compact />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {before[0] && <RolloutSnippet title="Before training sample" sample={before[0]} />}
        {after[0] && <RolloutSnippet title="After training sample" sample={after[0]} />}
      </div>
      {evidence.steps?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {evidence.steps.map((s: Json) => (
            <Chip key={String(s.phase)}>
              {s.phase}: {Number(s.baseline_reward ?? 0).toFixed(3)} to {Number(s.final_reward ?? 0).toFixed(3)}
              {s.optim_steps?.length ? ` · optim ${s.optim_steps.join(', ')}` : ''}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const VERIFIER_CHECKS = [
  ['Schema + entity IDs', 'job_id, operation_id, machine_id, operator_id must exist'],
  ['Machine capability', 'assigned machine must support the operation capability'],
  ['Operator skill + availability', 'operator must be qualified and available unless overtime is explicit'],
  ['Maintenance windows', 'operations cannot overlap planned downtime'],
  ['Machine/operator overlap', 'no double-booking of shared resources'],
  ['Precedence', 'routing predecessors must finish before later operations start'],
  ['Material availability', 'inventory/procurement must cover scheduled jobs before start time'],
]

const MODEL_ROLLOUT_STEPS = [
  ['Gateway model', 'HUD gateway model selected by HUD_EVAL_MODEL or HUD_TRAIN_MODEL'],
  ['Prompt/context', 'floor fixture, real job stream, canonical factory state, required job_id/operation_id targets, JSON-only ActionPlan schema'],
  ['Sampling group', 'HUD runs repeated sampled rollouts R01/R02/... on the same task so different candidate plans can be compared'],
  ['Reward scoring', 'each model candidate is scored by the same verifier reward mode: format, shaped, or strict'],
  ['GRPO advantage', 'reward minus group mean becomes the training signal: positive samples are reinforced, negative samples are discouraged'],
  ['Weight update', 'HUD TrainingClient runs forward_backward + optim_step, then promotes the checkpoint behind the same model string'],
  ['Evidence shown', 'before/after snippets and reward movement are real rollout artifacts; if lift is negative, the model did not improve yet'],
]

function VerifierMethodCard({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: compact ? 10 : 12, background: 'var(--panel)' }}>
      <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Verification used</div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>
        The before/after repair view is certified by the symbolic verifier and recursive repair loop. That proves the plan was made feasible by the gate. It is separate from model-learning evidence, which appears in the HUD rollout and Training before/after panels.
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        {VERIFIER_CHECKS.map(([name, detail]) => (
          <div key={name} style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '160px 1fr', gap: compact ? 2 : 10, fontSize: 12, lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--text)' }}>{name}</strong>
            <span style={{ color: 'var(--muted)' }}>{detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModelRolloutMethodCard({ model, evidence, compact = false }: { model?: string; evidence?: Json | null; compact?: boolean }) {
  const rows = MODEL_ROLLOUT_STEPS.map(([name, detail]) =>
    name === 'Gateway model' && model ? [name, `${model} via HUD gateway`] : [name, detail])
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: compact ? 10 : 12, background: 'var(--panel)' }}>
      <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Model rollout used</div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>
        This is how the model side works, before any verifier repair view. The selected HUD gateway model generates candidate plans, HUD records the rollout traces, the verifier scores those candidates, and GRPO uses the within-group advantage to update the trainable model when the selected model is trainable.
      </p>
      {(evidence?.latest_hud_job_url || evidence?.hud_jobs_dashboard_url) && (
        <div style={{ margin: '0 0 10px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {evidence.latest_hud_job_url && <a href={evidence.latest_hud_job_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontFamily: mono, fontSize: 11 }}>latest HUD training job ↗</a>}
          {evidence.hud_jobs_dashboard_url && <a href={evidence.hud_jobs_dashboard_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontFamily: mono, fontSize: 11 }}>HUD jobs dashboard ↗</a>}
        </div>
      )}
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map(([name, detail]) => (
          <div key={name} style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '160px 1fr', gap: compact ? 2 : 10, fontSize: 12, lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--text)' }}>{name}</strong>
            <span style={{ color: 'var(--muted)' }}>{detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MeasuredGrpoTable({ measuredRun }: { measuredRun: Json }) {
  const grpo = measuredRun.grpo ?? {}
  const rewards: number[] = grpo.rollout_rewards ?? []
  const advs: number[] = grpo.advantages ?? []
  if (!rewards.length) return null
  const mean = grpo.mean_reward ?? rewards.reduce((a, b) => a + b, 0) / rewards.length
  const bestIdx = rewards.indexOf(Math.max(...rewards))
  const summaryLine = `Measured GRPO group: ${rewards.length} rollout${rewards.length === 1 ? '' : 's'}, rewards [${rewards.map((r) => r.toFixed(2)).join(', ')}]${advs.length ? `, advantages [${advs.map((a) => a.toFixed(3)).join(', ')}]` : ''}.`
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--bg)', marginTop: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Model rollouts</div>
        <Chip tone="var(--pos)">{measuredRun.model ?? 'model'}</Chip>
        {measuredRun.head_checkpoint && <Chip>{measuredRun.head_checkpoint}</Chip>}
        {measuredRun.reward_mode && <Chip>{measuredRun.reward_mode}</Chip>}
        {measuredRun.hud_model_url && <a href={measuredRun.hud_model_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontFamily: mono, fontSize: 11 }}>HUD model ↗</a>}
        {grpo.hud_job_url && <a href={grpo.hud_job_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontFamily: mono, fontSize: 11 }}>HUD rollout job ↗</a>}
      </div>
      {grpo.task_coverage && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, background: 'var(--panel)', marginBottom: 12, fontSize: 12, lineHeight: 1.5, color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text)' }}>HUD task coverage:</strong> {grpo.task_coverage.platform_percent ?? 0}% — {grpo.task_coverage.reason}
          {grpo.task_coverage.dashboard_url ? <> · <a href={grpo.task_coverage.dashboard_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>HUD jobs</a></> : null}
        </div>
      )}
      <p style={{ margin: '0 0 12px', fontFamily: mono, fontSize: 12, lineHeight: 1.55, color: 'var(--text)' }}>{summaryLine}</p>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>
        Each <strong style={{ color: 'var(--text)' }}>Rxx</strong> row is one sampled rollout from the same HUD task group:
        the model saw the same floor/job context and produced one candidate plan. <strong style={{ color: 'var(--text)' }}>HUD reward</strong> uses the configured training mode (often shaped); <strong style={{ color: 'var(--text)' }}>Verifier hard</strong> is the strict symbolic constraint count on that same JSON. The MuJoCo panel uses the rollout marked <strong style={{ color: 'var(--text)' }}>sim</strong> — fewest hard violations, not necessarily the highest HUD reward.
      </p>
      <div style={{ marginBottom: 12 }}>
        <ModelRolloutMethodCard model={measuredRun.model} evidence={measuredRun.training_evidence} compact />
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, background: 'var(--panel)', marginBottom: 12, fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>
        <strong style={{ color: 'var(--text)' }}>How to tell model vs verifier:</strong> these `Rxx` rewards are model-only rollout attempts scored by the verifier. A higher post-training reward or positive-advantage sample shows the model produced a better candidate. The separate raw-vs-verified simulation below shows verifier repair, not model improvement by itself.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '4px 12px', paddingBottom: 6, fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <span>Rollout</span>
        <span>HUD reward</span>
        <span>Verifier hard</span>
        <span>GRPO advantage</span>
      </div>
      {rewards.map((rw, i) => (
        <div key={i} title={`R${String(i + 1).padStart(2, '0')} = rollout sample ${i + 1} from this measured HUD group`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '4px 12px', alignItems: 'center', padding: '5px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontFamily: mono, fontSize: 12 }}>
          <span style={{ color: i === bestIdx ? 'var(--pos)' : 'var(--muted)' }}>
            R{String(i + 1).padStart(2, '0')}{i === bestIdx ? ' ★' : ''}
            {grpo.sim_rollout === `R${String(i + 1).padStart(2, '0')}` ? ' · sim' : ''}
            {' '}<span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted)' }}>sample {i + 1}</span>
          </span>
          <span style={{ color: 'var(--text)' }}>{rw.toFixed(2)}</span>
          <span style={{ color: Number((grpo.rollout_samples?.[i] as Json | undefined)?.hard_violations ?? 0) > 0 ? 'var(--neg)' : 'var(--pos)' }}>
            {(grpo.rollout_samples?.[i] as Json | undefined)?.hard_violations ?? '—'}
          </span>
          <span style={{ color: (advs[i] ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{advs[i] != null ? `${advs[i] >= 0 ? '+' : ''}${advs[i].toFixed(3)}` : '—'}</span>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '4px 12px', paddingTop: 8, marginTop: 4, borderTop: '1px solid var(--line)', fontFamily: mono, fontSize: 12 }}>
        <span style={{ color: 'var(--muted)' }}>Mean</span>
        <strong style={{ color: 'var(--text)' }}>{mean.toFixed(3)}</strong>
        <span style={{ color: 'var(--muted)' }}>{grpo.sim_rollout ? `sim ${grpo.sim_rollout}` : grpo.best_rollout ? `best ${grpo.best_rollout}` : ''}</span>
        <span style={{ color: 'var(--muted)' }} />
      </div>
      <RolloutConversationSamples samples={grpo.rollout_samples ?? []} bestRollout={grpo.best_rollout} />
      <TrainingBeforeAfter evidence={measuredRun.training_evidence} />
      {measuredRun.measured_at && (
        <p style={{ margin: '10px 0 0', fontFamily: mono, fontSize: 10.5, color: 'var(--muted)' }}>
          {new Date(measuredRun.measured_at).toLocaleString()}
          {measuredRun.hud_model_id ? (
            <> · <a href={measuredRun.hud_model_url ?? `https://hud.ai/models/${measuredRun.hud_model_id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>HUD model ↗</a></>
          ) : null}
        </p>
      )}
    </div>
  )
}

function FloorPlanViewer({ src, title, detail, onClose }: { src: string; title: string; detail?: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const drag = useRef<{ id: number; x: number; y: number; pan: { x: number; y: number } } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const setZoomClamped = (next: number) => setZoom(clamp(next, 0.5, 5))
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pan }
    setIsDragging(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    setPan({ x: d.pan.x + e.clientX - d.x, y: d.pan.y + e.clientY - d.y })
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) {
      drag.current = null
      setIsDragging(false)
    }
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    setZoomClamped(zoom * (e.deltaY > 0 ? 0.9 : 1.1))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} full floor plan`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(9, 11, 14, 0.78)', backdropFilter: 'blur(10px)', padding: 18, display: 'grid', placeItems: 'center' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1180px, 96vw)', height: 'min(820px, 92vh)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 18, background: 'var(--panel)', boxShadow: '0 24px 80px rgba(0,0,0,0.38)', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</div>
            {detail && <div style={{ marginTop: 3, fontFamily: mono, fontSize: 10.5, color: 'var(--muted)' }}>{detail}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setZoomClamped(zoom - 0.2)}>−</button>
            <span style={{ minWidth: 54, textAlign: 'center', fontFamily: mono, fontSize: 11, color: 'var(--muted)' }}>{Math.round(zoom * 100)}%</span>
            <button className="btn" type="button" onClick={() => setZoomClamped(zoom + 0.2)}>+</button>
            <button className="btn" type="button" onClick={reset}>Reset</button>
            <button className="btn primary" type="button" onClick={onClose}>Close</button>
          </div>
        </div>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{ position: 'relative', overflow: 'hidden', background: '#f7f4ed', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          <img
            src={src}
            alt={`${title} floor plan`}
            draggable={false}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              maxWidth: 'none',
              width: 'min(1040px, 86vw)',
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: 'center',
              userSelect: 'none',
              filter: 'contrast(1.04) saturate(0.92)',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderTop: '1px solid var(--line)', fontFamily: mono, fontSize: 10.5, color: 'var(--muted)' }}>
          <span>Drag to pan · wheel to zoom · Escape to close</span>
          <a href={src} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Open image ↗</a>
        </div>
      </div>
    </div>
  )
}

// Sample N frames from a video (uploaded File object URL or a clip URL) into JPEG
// data URLs, entirely in the browser via <canvas>, no deps, the raw video never
// leaves the page. These frames are what the multimodal VLM intake actually sees.
export async function extractFrames(src: string, count = 2): Promise<string[]> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.src = src
    const frames: string[] = []
    const canvas = document.createElement('canvas')
    v.onloadeddata = () => {
      const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 8
      const times = Array.from({ length: count }, (_, i) => (dur * (i + 1)) / (count + 1))
      let idx = 0
      const seek = () => { if (idx < times.length) v.currentTime = times[idx]; else resolve(frames) }
      v.onseeked = () => {
        canvas.width = v.videoWidth || 640; canvas.height = v.videoHeight || 360
        canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height)
        frames.push(canvas.toDataURL('image/jpeg', 0.7)); idx++; seek()
      }
      seek()
    }
    v.onerror = () => resolve(frames)
    setTimeout(() => resolve(frames), 12000)  // safety: never hang the UI
  })
}

// Hosted sample fixtures: pre-built warehouse floor archetypes for inspecting
// the report format when the user has not uploaded real operating context yet.
function FloorLibrary({ onResult }: { onResult: (r: Json) => void }) {
  // The library is the brain's precomputed output (built offline by build_library).
  // Serve the static catalog/runs (reliable, exact, all archetypes); the live brain
  // is the fallback. Custom "describe your floor" still goes to the live brain.
  const stat = useJson('/factoryceo/library.json')
  const floorManifest = useJson('/factoryceo/floorplans/manifest.json')
  const live = useJson(`${BRAIN}/library`)
  const data = stat.data ?? live.data
  const floors: Json[] = data?.floors ?? []
  const plans: Json[] = floorManifest.data?.plans ?? []
  const [busy, setBusy] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ src: string; title: string; detail?: string } | null>(null)
  if (!floors.length) return null
  async function open(f: Json) {
    setBusy(f.id)
    try {
      // exact precomputed run for this floor
      const s = await fetch(`/factoryceo/library/${f.id}.json`, { cache: 'no-store' })
      if (s.ok) { onResult(await s.json()); return }
      throw new Error(String(s.status))
    } catch {
      // fallback: ask the live brain to compile it
      try {
        const r = await fetch(`${BRAIN}/plan_from_input`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `${f.label} factory, ${f.n_jobs} jobs` }),
        })
        if (r.ok) onResult(await r.json())
      } catch { /* ignore */ }
    } finally { setBusy(null) }
  }
  return (
    <div style={card}>
      <Label n="00">Staer-style warehouse floor library</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        Pick a visual floor-plan fixture. The base library combines the local floor-plan backdrops with Staer-style warehouse briefs: docks, aisles, staging lanes, no-go zones, AMR routes, charging contention, and long-horizon task pressure. Opening one loads a cached static run, so it does not call Fireworks.
      </p>
      {viewer && <FloorPlanViewer key={viewer.src} {...viewer} onClose={() => setViewer(null)} />}
      {plans.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
            <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Floor-plan backdrops</div>
            {floorManifest.data?.attribution && <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>{floorManifest.data.attribution}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {plans.map((plan) => {
              const allowFileMatch = plan.kind !== 'staer-gated'
              const matches = floors.filter((f) => f.floorplan?.id === plan.id || (allowFileMatch && f.floorplan?.file === plan.file))
              const matching = matches[0]
              return (
                <div
                  key={plan.id}
                  style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 0, background: 'var(--panel)', overflow: 'hidden' }}
                >
                  <div style={{ height: 150, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
                    <img src={plan.file} alt={`${plan.title ?? plan.id} floor plan`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '11px 12px' }}>
                    <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--text)' }}>{plan.title ?? plan.id}</div>
                    <div style={{ marginTop: 3, marginBottom: 10, fontSize: 11.5, color: 'var(--muted)' }}>
                      {matches.length ? `${matches.length} Staer briefs` : plan.fallback ? 'Staer thumbnail gated · local stand-in' : 'preview only'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: matching ? '1fr 1fr' : '1fr', gap: 8 }}>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => setViewer({ src: plan.file, title: plan.title ?? plan.id, detail: plan.fallback ? 'Staer thumbnail is gated on Hugging Face; showing local floor-plan stand-in.' : floorManifest.data?.attribution })}
                      >
                        View full plan
                      </button>
                      {matching && (
                        <button
                          className="btn primary"
                          type="button"
                          disabled={busy === matching.id}
                          onClick={() => open(matching)}
                        >
                          {busy === matching.id ? 'Opening…' : 'Open run'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Cached Staer briefs</div>
        <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>{floors.length} fixtures · no Fireworks on open</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {floors.map((f) => {
          const nv = f.naive_violations ?? 0
          const onTime = Math.round((f.metrics?.on_time ?? 0) * 100)
          const floorplan = f.floorplan?.file
          const jobSource = f.job_source
          const hudRun = jobSource?.hud_rollout
          const hudMeasured = hudRun?.measured
          const tags: { t: string; c: string }[] = [
            { t: `${jobSource?.n_order_lines ?? f.n_jobs} order lines`, c: 'var(--muted)' },
            ...(jobSource?.source ? [{ t: jobSource.source.toUpperCase(), c: 'var(--brand)' }] : []),
            ...(jobSource?.jobs_provenance ? [{ t: jobProvenanceLabel(jobSource), c: 'var(--pos)' }] : []),
            ...(jobSource?.floorplan_id ? [{ t: jobSource.floorplan_id, c: 'var(--pos)' }] : []),
            ...(hudMeasured ? [{ t: `HUD ${hudMeasured.hud_reward?.toFixed?.(3) ?? hudMeasured.hud_reward}`, c: 'var(--pos)' }] : []),
            ...(hudMeasured?.grpo?.n_rollouts ? [{ t: `${hudMeasured.grpo.n_rollouts} measured rollouts`, c: 'var(--brand)' }] : []),
            ...(f.horizon_days ? [{ t: `${f.horizon_days}-day horizon`, c: 'var(--muted)' }] : []),
            { t: `${onTime}% on-time`, c: onTime >= 95 ? 'var(--pos)' : 'var(--muted)' },
            ...(f.layout?.aisles ? [{ t: `${f.layout.aisles} aisles`, c: 'var(--brand)' }] : []),
            ...(f.layout?.robots ? [{ t: `${f.layout.robots} robots`, c: 'var(--brand)' }] : []),
          ]
          return (
            <div key={f.id} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 0, background: 'var(--panel)', overflow: 'hidden' }}>
              {floorplan && (
                <div style={{ position: 'relative', height: 150, background: 'var(--bg)', borderBottom: '1px solid var(--line)', overflow: 'hidden' }}>
                  <img
                    src={floorplan}
                    alt={`${f.label} floor plan`}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.03) saturate(0.9)' }}
                  />
                  <div style={{ position: 'absolute', left: 10, bottom: 10, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,253,248,0.92)', border: '1px solid var(--line)', fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>
                    floor-plan preview
                  </div>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setViewer({ src: floorplan, title: f.label, detail: f.provenance?.dataset ?? 'Cached Staer fixture' })}
                    style={{ position: 'absolute', right: 10, bottom: 10, background: 'rgba(255,253,248,0.94)' }}
                  >
                    View full plan
                  </button>
                </div>
              )}
              <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15 }}>{f.label}</span>
                {f.verified && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--pos)' }}>verified fixture</span>}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45 }}>
                {f.scenario ?? `Warehouse fixture with ${f.n_jobs} tasks across a ${f.horizon_days ?? 30}-day horizon.`}
              </p>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                {jobSource?.n_orders ?? f.n_jobs} orders · {jobSource?.source?.toUpperCase() ?? '—'} · {jobSource?.floorplan_id ?? '—'}. Adapter issues <b style={{ color: 'var(--neg)' }}>{nv}</b>, repaired to <b style={{ color: 'var(--pos)' }}>0 hard violations</b>.
                {hudMeasured ? ` Model mean reward ${hudMeasured.hud_reward?.toFixed?.(3) ?? hudMeasured.hud_reward} (${hudMeasured.grpo?.n_rollouts ?? '?'} rollouts).` : ''}
              </p>
              {jobSource?.dataset && (
                <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4 }}>
                  Dataset: {jobSource.dataset} · pool: {jobProvenanceLabel(jobSource)}
                </p>
              )}
              {jobSource?.mapping_profile?.name && (
                <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4 }}>
                  Job/floor match: {jobSource.mapping_profile.name} · zones use {jobSource.mapping_profile.source_prefix} → {jobSource.mapping_profile.station_prefix}.
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {tags.map((tg, i) => (
                  <span key={i} style={{ fontFamily: mono, fontSize: 10, color: tg.c, border: `1px solid ${tg.c === 'var(--muted)' ? 'var(--line)' : tg.c}`, borderRadius: 999, padding: '2px 8px' }}>{tg.t}</span>
                ))}
              </div>
              <button className="btn" style={{ width: '100%' }} disabled={busy === f.id} onClick={() => open(f)}>{busy === f.id ? 'Opening…' : 'Open cached floor run'}</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Stock manufacturing-task clips (CC, from Wikimedia Commons) for initial runs.
// Picking one samples frames in-browser and hands {text, files} to the brain.
export function StockGallery({ onPick, busyId }: { onPick: (clip: Json, input: BrainInput) => void; busyId?: string | null }) {
  const { data } = useJson('/factoryceo/videos/manifest.json')
  const clips: Json[] = data?.clips ?? []
  if (!clips.length) return null
  async function pick(c: Json) {
    const frames = await extractFrames(c.file, 2)
    onPick(c, {
      text: c.summary || c.title,
      files: frames.map((f, i) => ({ name: `${c.id}-frame${i}.jpg`, kind: 'image', content: f })),
    })
  }
  return (
    <div style={card}>
      <Label n="00a">Start from a stock factory floor (video → brain)</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        Real manufacturing footage. Pick one, frames are sampled in your browser and read by the multimodal brain (Qwen3.7-VL) to compile a factory it can plan.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
        {clips.map((c) => (
          <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
            <video src={c.file} poster={c.poster} muted loop playsInline
              onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
              onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
              style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '9px 11px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 3 }}>{c.title}</div>
              <div style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--muted)', marginBottom: 8 }}>{c.capability} · {c.license}</div>
              <button className="btn primary" style={{ width: '100%' }} disabled={busyId === c.id} onClick={() => pick(c)}>
                {busyId === c.id ? 'Reading…' : 'Use this floor'}
              </button>
              <a href={c.source_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 6, fontFamily: mono, fontSize: 9, color: 'var(--muted)', textDecoration: 'none' }}>
                {c.author}, {c.license} ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// MuJoCo physics render, before -> after: the raw plan and the verified plan each
// rolled out in the MuJoCo simulator (server-side) and shown as frame strips.
function MujocoFloor({ naive, verified, naiveHard, n, bare = false }:
  { naive?: Json; verified: Json; naiveHard?: number; n: string; bare?: boolean }) {
  const [before, setBefore] = useState<Json | null>(null)
  const [after, setAfter] = useState<Json | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function call(tasks: Json) {
    const r = await fetch(`${BRAIN}/mujoco_floor`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isaac_tasks: tasks }),
    })
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  }
  async function render() {
    setBusy(true); setErr(null)
    try {
      const [b, a] = await Promise.all([naive ? call(naive) : Promise.resolve(null), call(verified)])
      setBefore(b); setAfter(a)
      if (a && !a.available) setErr(a.error || 'MuJoCo unavailable on the brain host.')
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(false) }
  }
  const strip = (label: string, sub: string, color: string, d: Json | null) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14 }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color }}>{sub}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(d?.frames ?? []).length || 3}, 1fr)`, gap: 8 }}>
        {(d?.frames ?? []).map((f: string, i: number) => (
          <img key={i} src={f} alt={`mujoco ${label} ${i}`} style={{ width: '100%', borderRadius: 10, border: `1px solid ${color}`, background: '#000' }} />
        ))}
      </div>
    </div>
  )
  const body = (
    <>
      {bare
        ? <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Behavior change in MuJoCo — raw → verifier-gated</div>
        : <Label n={n}>Optional MuJoCo render — before → after</Label>}
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        The raw adapter plan and the verifier-gated operating plan are each rolled out on the MuJoCo physics floor, so the behavior change is visible, not just tabulated. Renders only if the brain host has MuJoCo available; otherwise the verified result above is still the symbolic verifier result.
      </p>
      {!after?.available && <button className="btn primary" onClick={render} disabled={busy}>{busy ? 'Rendering…' : '▶ Render raw vs verified'}</button>}
      {err && <div style={{ marginTop: 10, color: 'var(--warn)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      {before?.available && strip('Before · raw plan', `${naiveHard ?? '?'} hard violations`, 'var(--neg)', before)}
      {after?.available && strip('After · verifier-gated plan', '0 hard violations', 'var(--pos)', after)}
      {after?.available && <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>{after.n_frames} frames each · start → mid → end · engine: {after.engine}</div>}
    </>
  )
  if (bare) return <div>{body}</div>
  return <div style={card}>{body}</div>
}

// three.js floor: stations from the humanoid task queue + a humanoid per robot that
// walks between machines along the verified timeline. Drives off isaac_tasks.
function FloorScene3D({ tasks, n, accentVar, height = 320, bare = false, annotated = false, simHr, stationDiffs }:
  { tasks: Json; n?: string; accentVar?: string; height?: number; bare?: boolean; annotated?: boolean
    simHr?: number; stationDiffs?: Record<string, 'removed' | 'added' | 'retimed' | 'moved'> }) {
  const mount = useRef<HTMLDivElement>(null)
  const simHrRef = useRef(simHr ?? 0)
  simHrRef.current = simHr ?? simHrRef.current
  const stationDiffsRef = useRef(stationDiffs)
  stationDiffsRef.current = stationDiffs
  const [caption, setCaption] = useState('')
  const floorLayout = tasks.meta?.floor_layout as Json | undefined
  const bounds = (floorLayout?.bounds as Json) ?? { width: 12, depth: 12 }
  const floorW = Number(bounds.width ?? 12)
  const floorD = Number(bounds.depth ?? 12)
  const stationMap: Record<string, Json> = (floorLayout?.stations as Record<string, Json>) ?? {}
  const machineXY: Record<string, number[]> = tasks.meta?.machines ?? {}
  const stationEntries = Object.keys(stationMap).length
    ? Object.entries(stationMap)
    : Object.entries(machineXY).map(([id, xy]) => [id, { x: xy[0], y: xy[1], kind: 'machine' }] as [string, Json])
  const stationIds = stationEntries.map(([id]) => id)
  const kindCounts = (floorLayout?.kinds as Json) ?? {}
  useEffect(() => {
    const el = mount.current
    if (!el) return
    const css = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: number) => {
      const v = css.getPropertyValue(name).trim()
      try { return new THREE.Color(v || '').getHex() } catch { return fallback }
    }
    const C = {
      floor: hex('--panel-2', 0xeceae5), grid: hex('--line', 0xdcd8d0),
      station: hex('--line', 0xcfd3da), accent: hex(accentVar || '--accent', 0x3f5fe0),
      head: hex('--panel', 0xffffff),
      removed: hex('--neg', 0xc0392b), added: hex('--pos', 0x2ecc71),
      changed: hex('--warn', 0xe67e22),
      dock: hex('--brand', 0x2f6fed), aisle: hex('--line', 0xb0b8c4),
      staging: hex('--warn', 0xe6a817), target: hex('--pos', 0x3d9970),
      machine: hex('--accent', 0x3f5fe0), source: hex('--muted', 0x888888),
      no_go: hex('--neg', 0xc0392b),
    }
    const kindColor = (kind: string) => {
      if (kind === 'dock') return C.dock
      if (kind === 'aisle') return C.aisle
      if (kind === 'staging') return C.staging
      if (kind === 'target') return C.target
      if (kind === 'machine') return C.machine
      if (kind === 'source') return C.source
      if (kind === 'no_go') return C.no_go
      return C.station
    }
    const kindSize = (kind: string): [number, number, number] => {
      if (kind === 'dock') return [1.35, 0.55, 1.0]
      if (kind === 'aisle') return [0.35, 0.85, 0.35]
      if (kind === 'staging') return [1.05, 0.5, 0.75]
      if (kind === 'target') return [0.85, 0.55, 0.85]
      if (kind === 'machine') return [1.0, 0.6, 1.0]
      if (kind === 'source') return [0.45, 0.35, 0.45]
      if (kind === 'no_go') return [1.0, 0.08, 1.0]
      return [0.9, 0.55, 0.9]
    }
    const diffColor = (kind: string) => {
      if (kind === 'removed') return C.removed
      if (kind === 'added') return C.added
      return C.changed
    }
    const queues = executionQueues(tasks)
    const ids = stationIds
    const W = el.clientWidth || 640, H = height
    const scene = new THREE.Scene()
    scene.background = null
    const cx = floorW / 2
    const cz = floorD / 2
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, Math.max(100, floorW + floorD))
    cam.position.set(floorW * 0.75, Math.max(8, floorW * 0.55), floorD * 1.15)
    cam.lookAt(cx, 0, cz)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    el.appendChild(renderer.domElement)
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(floorW, floorD, 10); scene.add(key)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorD), new THREE.MeshStandardMaterial({ color: C.floor, roughness: 1 }))
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor)
    const gridDiv = Math.max(8, Math.round(Math.max(floorW, floorD) / 1.35))
    const grid = new THREE.GridHelper(Math.max(floorW, floorD), gridDiv, C.grid, C.grid)
    grid.position.set(cx, 0.01, cz); scene.add(grid)
    const stationMesh: Record<string, THREE.Mesh> = {}
    const stationRing: Record<string, THREE.Mesh> = {}
    const pos3 = (xy: number[]) => new THREE.Vector3(xy[0], 0, xy[1])
    stationEntries.forEach(([id, st]) => {
      const kind = String(st.kind ?? 'machine')
      const xy = [Number(st.x ?? 0), Number(st.y ?? 0)]
      const [sx, sy, sz] = kindSize(kind)
      const p = pos3(xy)
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(sx, sy, sz),
        new THREE.MeshStandardMaterial({ color: kindColor(kind) }),
      )
      m.position.set(p.x, sy / 2, p.z); scene.add(m); stationMesh[id] = m
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(Math.max(sx, sz) * 0.72, 0.06, 8, 32),
        new THREE.MeshStandardMaterial({ color: C.changed, transparent: true, opacity: 0 }),
      )
      ring.rotation.x = Math.PI / 2; ring.position.set(p.x, 0.02, p.z); scene.add(ring); stationRing[id] = ring
    })
    const kindById: Record<string, string> = {}
    stationEntries.forEach(([id, st]) => { kindById[id] = String(st.kind ?? 'machine') })
    const accent = new THREE.Color(C.accent)
    const robots = Object.entries(queues).map(([rid, q]) => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: accent }))
      body.position.y = 0.75
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshStandardMaterial({ color: C.head }))
      head.position.y = 1.2
      g.add(body); g.add(head); scene.add(g)
      return { rid, q: q as Json[], g }
    })
    const allHrs = robots.flatMap((r) => r.q.map((t) => t.end_hr))
    const maxHr = Math.max(1, ...allHrs)
    const controlled = simHr !== undefined
    let raf = 0; const clock = new THREE.Clock(); let lastCap = ''
    const tick = () => {
      const hr = controlled ? (simHrRef.current ?? 0) : (clock.getElapsedTime() * 0.12) % 1 * maxHr
      const pulse = 0.55 + 0.45 * Math.sin(clock.getElapsedTime() * 4)
      const diffs = stationDiffsRef.current ?? {}
      ids.forEach((id) => {
        const mat = stationMesh[id].material as THREE.MeshStandardMaterial
        const ringMat = stationRing[id].material as THREE.MeshStandardMaterial
        const dk = diffs[id]
        if (dk) {
          mat.color.setHex(diffColor(dk))
          mat.emissive.setHex(diffColor(dk))
          mat.emissiveIntensity = 0.35 * pulse
          ringMat.opacity = 0.55 * pulse
          ringMat.color.setHex(diffColor(dk))
        } else {
          mat.color.setHex(kindColor(kindById[id] ?? 'machine'))
          mat.emissive.setHex(0)
          mat.emissiveIntensity = 0
          ringMat.opacity = 0
        }
      })
      const lines: string[] = []
      robots.forEach((r) => {
        const active = r.q.find((task) => hr >= task.start_hr && hr < task.end_hr)
        const target = active ?? r.q[r.q.length - 1] ?? r.q[0]
        if (target) {
          const p = pos3(target.machine_xy ?? machineXY[target.machine] ?? [0, 0])
          r.g.position.lerp(new THREE.Vector3(p.x, 0, p.z + 0.9), controlled ? 0.18 : 0.06)
          if (active && stationMesh[active.machine] && !diffs[active.machine]) {
            (stationMesh[active.machine].material as THREE.MeshStandardMaterial).color.copy(accent)
          }
          if (annotated && active) {
            const dk = diffs[active.machine]
            const tag = dk ? ` · Δ ${dk}` : ''
            lines.push(`${r.rid} · ${String(active.task).replace(/_/g, ' ')} @ ${active.machine} · job ${active.job} · hr ${active.start_hr}–${active.end_hr}${tag}`)
          }
        }
      })
      if (annotated) {
        const cap = lines.length ? lines.join('  |  ') : `Sim time hr ${hr.toFixed(0)}/${maxHr} — robot idle or between tasks`
        if (cap !== lastCap) { lastCap = cap; setCaption(cap) }
      }
      renderer.render(scene, cam)
      raf = requestAnimationFrame(tick)
    }
    tick()
    const onResize = () => { const w = el.clientWidth || 640; cam.aspect = w / H; cam.updateProjectionMatrix(); renderer.setSize(w, H) }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); renderer.dispose(); el.removeChild(renderer.domElement) }
  }, [tasks, accentVar, height, annotated, stationIds.join(','), simHr !== undefined, floorW, floorD])
  const canvas = (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
      {annotated && stationIds.length > 0 && (
        <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', gap: 6, flexWrap: 'wrap', zIndex: 2, pointerEvents: 'none' }}>
          {Object.entries(kindCounts).filter(([, n]) => Number(n) > 0).map(([kind, n]) => (
            <span key={kind} style={{ fontFamily: mono, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'color-mix(in srgb, var(--panel) 88%, transparent)', border: '1px solid var(--line)', color: 'var(--muted)' }}>
              {n} {kind}
            </span>
          ))}
          <span style={{ fontFamily: mono, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'color-mix(in srgb, var(--panel) 88%, transparent)', border: '1px solid var(--line)', color: 'var(--muted)' }}>
            {stationIds.length} stations · {floorW.toFixed(0)}×{floorD.toFixed(0)}m
          </span>
          <span style={{ fontFamily: mono, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid var(--line)', color: 'var(--accent)' }}>● robot path</span>
        </div>
      )}
      <div ref={mount} style={{ width: '100%', height: '100%' }} />
      {annotated && caption && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 10px', background: 'linear-gradient(transparent, color-mix(in srgb, var(--panel) 94%, transparent))', fontFamily: mono, fontSize: 10, lineHeight: 1.45, color: 'var(--text)', zIndex: 2, pointerEvents: 'none' }}>
          {caption}
        </div>
      )}
    </div>
  )
  if (bare) return canvas
  return (
    <div style={card}>
      <Label n={n ?? '·'}>Shift simulation</Label>
      {canvas}
      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        Animated schedule replay: blue humanoid follows the verifier-gated task queue; highlighted station = active operation.
      </div>
    </div>
  )
}

type QueueOp = Json & { robot: string; sig: string }
type QueueDiffKind = 'removed' | 'added' | 'retimed' | 'moved'
type QueueDiff = {
  kind: QueueDiffKind
  sig: string
  robot: string
  job: string
  operation: string
  before?: QueueOp
  after?: QueueOp
  startHr: number
  endHr: number
  label: string
}

function executionQueues(tasks: Json): Record<string, Json[]> {
  const robotQueues = tasks.robot_queues ?? {}
  if (Object.values(robotQueues).some((q) => Array.isArray(q) && q.length > 0)) return robotQueues
  return tasks.all_queues ?? robotQueues
}

function queueOpCount(tasks: Json) {
  return Object.values(executionQueues(tasks)).flat().length
}

function flattenRobotQueue(tasks: Json): QueueOp[] {
  return Object.entries(executionQueues(tasks)).flatMap(([robot, q]) =>
    (q as Json[]).map((t) => ({
      ...t,
      robot,
      sig: `${robot}:${t.job}:${t.operation}`,
    })))
}

function computeQueueDiff(naive: Json, verified: Json): QueueDiff[] {
  const nMap = new Map(flattenRobotQueue(naive).map((o) => [o.sig, o]))
  const vMap = new Map(flattenRobotQueue(verified).map((o) => [o.sig, o]))
  const diffs: QueueDiff[] = []
  for (const [sig, b] of nMap) {
    const a = vMap.get(sig)
    if (!a) {
      diffs.push({
        kind: 'removed', sig, robot: b.robot, job: b.job, operation: b.operation,
        before: b, startHr: b.start_hr, endHr: b.end_hr,
        label: `Before: ${b.robot} ${String(b.task).replace(/_/g, ' ')} @ ${b.machine} (hr ${b.start_hr}–${b.end_hr}) — dropped by verifier`,
      })
    } else if (b.machine !== a.machine) {
      diffs.push({
        kind: 'moved', sig, robot: b.robot, job: b.job, operation: b.operation,
        before: b, after: a,
        startHr: Math.min(b.start_hr, a.start_hr), endHr: Math.max(b.end_hr, a.end_hr),
        label: `${b.robot} ${b.job}/${b.operation}: machine ${b.machine} → ${a.machine}`,
      })
    } else if (b.start_hr !== a.start_hr || b.end_hr !== a.end_hr) {
      diffs.push({
        kind: 'retimed', sig, robot: b.robot, job: b.job, operation: b.operation,
        before: b, after: a,
        startHr: Math.min(b.start_hr, a.start_hr), endHr: Math.max(b.end_hr, a.end_hr),
        label: `${b.robot} ${b.job}/${b.operation} @ ${b.machine}: hr ${b.start_hr}–${b.end_hr} → ${a.start_hr}–${a.end_hr}`,
      })
    }
  }
  for (const [sig, a] of vMap) {
    if (!nMap.has(sig)) {
      diffs.push({
        kind: 'added', sig, robot: a.robot, job: a.job, operation: a.operation,
        after: a, startHr: a.start_hr, endHr: a.end_hr,
        label: `After: ${a.robot} ${String(a.task).replace(/_/g, ' ')} @ ${a.machine} (hr ${a.start_hr}–${a.end_hr}) — inserted by verifier repair`,
      })
    }
  }
  return diffs.sort((x, y) => x.startHr - y.startHr || x.kind.localeCompare(y.kind))
}

function maxQueueHorizon(...taskSets: Json[]) {
  const ends = taskSets.flatMap((t) =>
    Object.values(executionQueues(t)).flatMap((q) => (q as Json[]).map((op) => op.end_hr as number)))
  return Math.max(1, ...ends, 1)
}

function stationDiffsAtTime(diffs: QueueDiff[], simHr: number, side: 'before' | 'after'): Record<string, QueueDiffKind> {
  const out: Record<string, QueueDiffKind> = {}
  for (const d of diffs) {
    if (simHr < d.startHr || simHr >= d.endHr) continue
    if (side === 'before' && d.kind === 'added') continue
    if (side === 'after' && d.kind === 'removed') continue
    const station = side === 'before' ? d.before?.machine : d.after?.machine
    if (station) out[station] = d.kind
  }
  return out
}

function activeOpsAtTime(tasks: Json, simHr: number) {
  return Object.entries(executionQueues(tasks)).flatMap(([robot, q]) =>
    (q as Json[]).filter((t) => simHr >= t.start_hr && simHr < t.end_hr).map((t) => ({ ...t, robot })))
}

// Tagged shift replay — synced timeline, pause/scrub, diff highlights.
function ShiftSimulation({ naive, verified, naiveHard, modelCandidate, secondaryModelCandidate }: { naive: Json; verified: Json; naiveHard?: number; modelCandidate?: Json; secondaryModelCandidate?: Json }) {
  const naiveMeta = naive.meta ?? {}
  const verifiedMeta = verified.meta ?? {}
  const modelTasks = modelCandidate?.ok ? modelCandidate.isaac_tasks : null
  const modelName = String(modelCandidate?.model ?? 'model')
  const secondaryTasks = secondaryModelCandidate?.ok ? secondaryModelCandidate.isaac_tasks : null
  const secondaryName = String(secondaryModelCandidate?.model ?? 'student model')
  const maxHr = useMemo(() => {
    const tasks = [naive, verified, modelTasks, secondaryTasks].filter(Boolean) as Json[]
    return tasks.length ? maxQueueHorizon(...tasks) : 1
  }, [naive, verified, modelTasks, secondaryTasks])
  const diffs = useMemo(() => computeQueueDiff(naive, verified), [naive, verified])
  const [simHr, setSimHr] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.35)
  const diffSummary = useMemo(() => ({
    removed: diffs.filter((d) => d.kind === 'removed').length,
    added: diffs.filter((d) => d.kind === 'added').length,
    retimed: diffs.filter((d) => d.kind === 'retimed').length,
    moved: diffs.filter((d) => d.kind === 'moved').length,
  }), [diffs])
  const activeDiffs = useMemo(() => diffs.filter((d) => simHr >= d.startHr && simHr < d.endHr), [diffs, simHr])
  const beforeDiffs = useMemo(() => stationDiffsAtTime(diffs, simHr, 'before'), [diffs, simHr])
  const afterDiffs = useMemo(() => stationDiffsAtTime(diffs, simHr, 'after'), [diffs, simHr])
  const beforeActive = useMemo(() => activeOpsAtTime(naive, simHr), [naive, simHr])
  const modelActive = useMemo(() => modelTasks ? activeOpsAtTime(modelTasks, simHr) : [], [modelTasks, simHr])
  const secondaryActive = useMemo(() => secondaryTasks ? activeOpsAtTime(secondaryTasks, simHr) : [], [secondaryTasks, simHr])
  const afterActive = useMemo(() => activeOpsAtTime(verified, simHr), [verified, simHr])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setSimHr((h) => {
        const next = h + dt * speed * (maxHr / 45)
        return next >= maxHr ? 0 : next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, maxHr])

  const diffKindStyle = (kind: QueueDiffKind) => ({
    removed: { color: 'var(--neg)', border: '1px solid var(--neg)' },
    added: { color: 'var(--pos)', border: '1px solid var(--pos)' },
    retimed: { color: 'var(--warn)', border: '1px solid var(--warn)' },
    moved: { color: 'var(--warn)', border: '1px solid var(--warn)' },
  }[kind])

  const taskCell = (op?: QueueOp) => op
    ? `${op.robot} · ${op.job}/${op.operation} · ${op.machine} · hr ${op.start_hr}-${op.end_hr}`
    : 'not scheduled'

  const panel = (label: string, sub: string, color: string, tasks: Json, accentVar: string,
    stationDiffMap: Record<string, QueueDiffKind>, active: Json[], extra?: React.ReactNode) => (
    <div style={{ background: 'var(--bg)', border: `1px solid ${color}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14 }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color }}>{sub}</span>
      </div>
      <FloorScene3D tasks={tasks} accentVar={accentVar} height={220} bare annotated simHr={simHr} stationDiffs={stationDiffMap} />
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {active.length ? 'Active right now' : 'Idle at this hour'}
        </div>
        {active.length === 0 && (
          <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', padding: '4px 8px' }}>No robot task scheduled at hr {simHr.toFixed(0)}</div>
        )}
        {active.map((t, i) => (
          <div key={i} style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--text)', padding: '4px 8px', background: 'var(--panel)', borderRadius: 6, border: '1px solid var(--line)' }}>
            <span style={{ color: `var(${accentVar})` }}>{t.robot}</span>
            {' · '}{String(t.task).replace(/_/g, ' ')} @ <strong>{t.machine}</strong>
            {' · '}job {t.job} · hr {t.start_hr}–{t.end_hr}
          </div>
        ))}
        {extra}
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Shift simulation — raw adapter vs measured model rollout vs verifier gate</div>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.55 }}>
        All panels share one timeline. <strong style={{ color: 'var(--text)' }}>Before</strong> is the raw adapter output ({naiveMeta.hard_violations ?? naiveHard ?? '?'} hard violations); <strong style={{ color: 'var(--text)' }}>Measured model rollout</strong> is the best HUD answer from {modelName} converted into the same simulator queue; {secondaryTasks ? <><strong style={{ color: 'var(--text)' }}>{secondaryName}</strong> is the trainable open-student rollout below Gemma; </> : null}<strong style={{ color: 'var(--text)' }}>After</strong> is the verifier-repaired operating plan ({verifiedMeta.hard_violations ?? 0} violations). Middle panels are model evidence; the after panel is verifier/repair evidence.
      </p>
      <VerifierMethodCard compact />

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--bg)', marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <button type="button" className="btn primary" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ Pause' : '▶ Play'}</button>
          <button type="button" className="btn" onClick={() => { setPlaying(false); setSimHr(0) }}>↺ Reset</button>
          {[0.2, 0.35, 0.6, 1].map((s) => (
            <button key={s} type="button" className="btn" style={{ opacity: speed === s ? 1 : 0.55 }} onClick={() => setSpeed(s)}>{s}×</button>
          ))}
          <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>hr {simHr.toFixed(0)} / {maxHr}</span>
        </div>
        <div style={{ position: 'relative', paddingBottom: 14 }}>
          <input
            type="range" min={0} max={maxHr} step={1} value={simHr}
            onChange={(e) => { setPlaying(false); setSimHr(Number(e.target.value)) }}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 8 }}>
            {diffs.map((d, i) => (
              <span
                key={i}
                title={d.label}
                style={{
                  position: 'absolute',
                  left: `${(d.startHr / maxHr) * 100}%`,
                  width: Math.max(2, ((d.endHr - d.startHr) / maxHr) * 100) + '%',
                  height: 6,
                  borderRadius: 3,
                  background: d.kind === 'removed' ? 'var(--neg)' : d.kind === 'added' ? 'var(--pos)' : 'var(--warn)',
                  opacity: 0.75,
                  top: 0,
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <Chip tone="var(--neg)">{diffSummary.removed} dropped</Chip>
          <Chip tone="var(--pos)">{diffSummary.added} inserted</Chip>
          <Chip tone="var(--warn)">{diffSummary.retimed} retimed</Chip>
          <Chip tone="var(--warn)">{diffSummary.moved} moved</Chip>
          <Chip>{diffs.length} total schedule diffs</Chip>
        </div>
      </div>

      {activeDiffs.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--panel)', marginBottom: 14 }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
            Diff at hr {simHr.toFixed(0)} — pause here to compare
          </div>
          {activeDiffs.map((d, i) => (
            <div key={i} style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.5, marginBottom: 6, padding: '6px 8px', borderRadius: 6, ...diffKindStyle(d.kind), background: 'var(--bg)' }}>
              <strong>{d.kind}</strong> · {d.label}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {panel('Before · raw adapter', `${naiveMeta.hard_violations ?? naiveHard ?? '?'} hard violations · ${queueOpCount(naive)} ops`, 'var(--neg)', naive, '--neg', beforeDiffs, beforeActive)}
        {modelTasks
          ? panel(
            `${modelName} · measured HUD rollout`,
            `${modelCandidate?.hard_violations ?? modelTasks.meta?.hard_violations ?? '?'} hard violations · ${queueOpCount(modelTasks)} ops`,
            'var(--brand)',
            modelTasks,
            '--brand',
            {},
            modelActive,
            modelCandidate?.trace_url ? (
              <a href={String(modelCandidate.trace_url)} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--brand)' }}>
                HUD trace: best model rollout
              </a>
            ) : null,
          )
          : (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Measured model rollout</div>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
                No parseable model ActionPlan is attached for this floor yet. Re-run <code style={{ fontFamily: mono, fontSize: 11 }}>distill/hud_floor_eval.py</code> to attach a simulator queue from the best HUD trace.
              </p>
            </div>
          )}
        {panel('After · verifier-gated', `${verifiedMeta.hard_violations ?? 0} hard violations · ${queueOpCount(verified)} ops`, 'var(--pos)', verified, '--pos', afterDiffs, afterActive)}
      </div>
      {secondaryTasks && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
            Trainable student below Gemma — {secondaryName}
          </div>
          {panel(
            `${secondaryName} · measured HUD rollout`,
            `${secondaryModelCandidate?.hard_violations ?? secondaryTasks.meta?.hard_violations ?? '?'} hard violations · ${queueOpCount(secondaryTasks)} ops`,
            'var(--accent)',
            secondaryTasks,
            '--accent',
            {},
            secondaryActive,
            secondaryModelCandidate?.trace_url ? (
              <a href={String(secondaryModelCandidate.trace_url)} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--accent)' }}>
                HUD trace: {secondaryName} rollout
              </a>
            ) : null,
          )}
        </div>
      )}
      <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.45 }}>
        Legend: <span style={{ color: 'var(--neg)' }}>red ring</span> = op dropped · <span style={{ color: 'var(--pos)' }}>green ring</span> = op inserted · <span style={{ color: 'var(--warn)' }}>orange ring</span> = retimed or moved. Scrub the timeline or pause on a marker to inspect side-by-side.
      </div>
      {diffs.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--panel)', marginTop: 14 }}>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Changed tasks</div>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>
            These are exact task-queue differences between the raw adapter output and the verifier-gated schedule. Use “jump” to scrub both 3D panels to the hour where the difference occurs.
          </p>
          <div style={{ display: 'grid', gap: 7 }}>
            {diffs.slice(0, 12).map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '86px minmax(0, 1fr) minmax(0, 1fr) 72px', gap: 8, alignItems: 'center', padding: '7px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', fontFamily: mono, fontSize: 10.5 }}>
                <span style={{ textTransform: 'uppercase', ...diffKindStyle(d.kind), borderRadius: 6, padding: '3px 6px', textAlign: 'center' }}>{d.kind}</span>
                <span style={{ color: d.before ? 'var(--text)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Before: {taskCell(d.before)}</span>
                <span style={{ color: d.after ? 'var(--text)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>After: {taskCell(d.after)}</span>
                <button type="button" className="btn" style={{ padding: '3px 7px', fontSize: 10 }} onClick={() => { setPlaying(false); setSimHr(Math.max(0, d.startHr)) }}>jump</button>
              </div>
            ))}
          </div>
          {diffs.length > 12 && <div style={{ marginTop: 8, fontFamily: mono, fontSize: 10.5, color: 'var(--muted)' }}>+{diffs.length - 12} more queue differences</div>}
        </div>
      )}
    </div>
  )
}

// Before -> After: the same scene with the RAW plan vs the verified plan, so the
// verifier's value is visible, not just tabulated.
function BeforeAfter({ naive, verified, naiveHard, n }:
  { naive: Json; verified: Json; naiveHard: number; n: string }) {
  const panel = (label: string, sub: string, color: string, tasks: Json, accentVar: string) => (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14 }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color }}>{sub}</span>
      </div>
      <FloorScene3D tasks={tasks} accentVar={accentVar} height={240} bare />
    </div>
  )
  return (
    <div style={card}>
      <Label n={n}>Before → after: what the verifier actually fixes</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {panel('Raw plan', `${naiveHard} hard violations`, 'var(--neg)', naive, '--neg')}
        {panel('Verified plan', '0 hard violations', 'var(--pos)', verified, '--pos')}
      </div>
      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
        same factory, same humanoid: the raw plan (left) violates {naiveHard} hard constraints; recursive TRM repair drives it to a feasible, safe schedule (right).
      </div>
    </div>
  )
}

// ---- multi-modal input: the user's own factory floor ----
export function FactoryInput({ onResult }: { onResult: (r: Json) => void }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<{ name: string; kind: string; content: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function addFiles(list: FileList | null) {
    if (!list) return
    const out: { name: string; kind: string; content: string }[] = []
    for (const f of Array.from(list)) {
      if (f.type.startsWith('image/')) {
        const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f) })
        out.push({ name: f.name, kind: 'image', content: url })
      } else if (f.type.startsWith('video/')) {
        const u = URL.createObjectURL(f)
        const frames = await extractFrames(u, 2)
        URL.revokeObjectURL(u)
        frames.forEach((fr, i) => out.push({ name: `${f.name}-frame${i}.jpg`, kind: 'image', content: fr }))
      } else out.push({ name: f.name, kind: 'text', content: await f.text() })
    }
    setFiles((p) => [...p, ...out])
  }

  async function run() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`${BRAIN}/plan_from_input`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, files }),
      })
      if (!res.ok) throw new Error(String(res.status))
      onResult(await res.json())
    } catch {
      setErr(`Couldn't reach the brain at ${BRAIN}. Start it: cd factoryceo_trm && uvicorn api:app --port 8090 (set VITE_BRAIN_URL to override).`)
    } finally { setBusy(false) }
  }

  const sample = 'Automotive injection-molding + CNC shop. ~14 jobs this month, clips and brackets in ABS and Nylon, a few medical syringe runs in PP. M2 has been overheating. One operator out sick next week. Acme wants 10k clips by Friday at $0.18/unit.'
  return (
    <div style={{ ...card, borderColor: 'var(--accent)' }}>
      <Label n="00">Your factory floor, describe it, the brain plans it</Label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
        placeholder="Paste RFQs, machine logs, operator notes, inventory, anything. The brain compiles it into a real, feasible factory and plans it."
        style={{ width: '100%', fontFamily: mono, fontSize: 13, lineHeight: 1.55, color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Compiling…' : '▶ Compile & plan'}</button>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>📎 Add files</button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        <button className="btn ghost" onClick={() => setText(sample)} disabled={busy}>use a sample</button>
        {files.map((f, i) => <Chip key={i} tone={f.kind === 'image' ? 'var(--warn)' : undefined}>{f.kind === 'image' ? '🖼 ' : '📄 '}{f.name}</Chip>)}
      </div>
      {err && <div style={{ marginTop: 10, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
    </div>
  )
}

// ---- live floor plan: the CEO drag-selects (lasso) a region to optimize ----
type Rect = { x: number; y: number; w: number; h: number }

const CELL_W = 168, CELL_H = 118, GAP = 26, PAD = 30, BOX_W = 138, BOX_H = 88
function layout(machines: Json[]): Record<string, { x: number; y: number; w: number; h: number }> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(machines.length || 1)))
  const out: Record<string, { x: number; y: number; w: number; h: number }> = {}
  machines.forEach((m, i) => {
    const r = Math.floor(i / cols), c = i % cols
    out[m.id] = { x: PAD + c * (CELL_W + GAP) + (CELL_W - BOX_W) / 2, y: PAD + r * (CELL_H + GAP), w: BOX_W, h: BOX_H }
  })
  return out
}

function intersects(a: Rect, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

// capability -> glyph + color, so each station reads as a piece of equipment.
const CAP_STYLE: Record<string, { glyph: string; color: string }> = {
  mold: { glyph: '◳', color: 'var(--accent)' },
  cnc: { glyph: '⚙', color: 'var(--warn)' },
  deburr: { glyph: '✦', color: 'var(--pos)' },
  assembly: { glyph: '⛭', color: 'var(--brand)' },
  inspect: { glyph: '◎', color: 'var(--brand)' },
}
const capStyle = (caps: string[] = []) => CAP_STYLE[caps[0]] ?? { glyph: '▰', color: 'var(--muted)' }

function FloorPlanLasso({ machines, onResult }: { machines: Json[]; onResult: (r: Json) => void }) {
  const pos = useMemo(() => layout(machines), [machines])
  const cols = Math.max(1, Math.ceil(Math.sqrt(machines.length || 1)))
  const rows = Math.max(1, Math.ceil((machines.length || 1) / cols))
  const W = PAD * 2 + cols * CELL_W + (cols - 1) * GAP
  const H = PAD * 2 + (rows - 1) * CELL_H + BOX_H
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function toLocal(e: React.PointerEvent) {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const m = svg.getScreenCTM()!.inverse()
    const p = pt.matrixTransform(m)
    return { x: p.x, y: p.y }
  }
  const rect = (d: NonNullable<typeof drag>): Rect => ({
    x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1),
    w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0),
  })
  function down(e: React.PointerEvent) {
    const { x, y } = toLocal(e); setDrag({ x0: x, y0: y, x1: x, y1: y }); setSel([])
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    if (!drag) return
    const { x, y } = toLocal(e); setDrag({ ...drag, x1: x, y1: y })
    const r = rect({ ...drag, x1: x, y1: y })
    setSel(machines.filter((m) => intersects(r, pos[m.id])).map((m) => m.id))
  }
  function up() { if (drag && rect(drag).w * rect(drag).h < 40) setDrag(null) }

  async function optimize() {
    if (!sel.length) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`${BRAIN}/optimize_region`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_ids: sel }),
      })
      if (!res.ok) throw new Error(String(res.status))
      onResult(await res.json())
    } catch {
      setErr(`Couldn't reach the brain at ${BRAIN}. Start it: cd factoryceo_trm && uvicorn api:app --port 8090.`)
    } finally { setBusy(false) }
  }

  const dr = drag ? rect(drag) : null
  return (
    <div style={{ ...card, borderColor: 'var(--accent)' }}>
      <Label n="02">Floor plan — lasso the stations to optimize</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        Drag a box across the equipment you want the brain to focus on; it re-plans just that region.
      </p>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, borderRadius: 14, touchAction: 'none', cursor: 'crosshair', userSelect: 'none', display: 'block' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <defs>
          <pattern id="fp-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0 L0 0 0 22" fill="none" stroke="var(--line)" strokeWidth="0.6" opacity="0.6" />
          </pattern>
          <filter id="fp-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="var(--accent)" floodOpacity="0.45" />
          </filter>
          <filter id="fp-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#0d0d0f" floodOpacity="0.10" />
          </filter>
        </defs>
        <rect x={0} y={0} width={W} height={H} rx={14} fill="var(--panel-2)" />
        <rect x={0} y={0} width={W} height={H} rx={14} fill="url(#fp-grid)" />
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={14} fill="none" stroke="var(--line)" />
        {machines.map((m) => {
          const b = pos[m.id], on = sel.includes(m.id), cs = capStyle(m.capabilities)
          return (
            <g key={m.id} filter={on ? 'url(#fp-glow)' : 'url(#fp-shadow)'} style={{ transition: 'all .15s' }}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12}
                fill="var(--panel)" stroke={on ? 'var(--accent)' : 'var(--line)'} strokeWidth={on ? 2.5 : 1} />
              {on && <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} fill="var(--accent)" fillOpacity={0.06} />}
              {/* capability chip */}
              <rect x={b.x + 12} y={b.y + 12} width={26} height={26} rx={8} fill={cs.color} fillOpacity={0.16} />
              <text x={b.x + 25} y={b.y + 30} textAnchor="middle" fontSize={15} fill={cs.color}>{cs.glyph}</text>
              {/* id + caps */}
              <text x={b.x + 46} y={b.y + 25} fontFamily="var(--font-display)" fontWeight={800} fontSize={16} fill="var(--text)">{m.id}</text>
              <text x={b.x + 46} y={b.y + 40} fontFamily={mono} fontSize={8.5} fill="var(--muted)">{(m.capabilities ?? []).join(' · ')}</text>
              {/* status row */}
              <circle cx={b.x + 16} cy={b.y + b.h - 16} r={3} fill={(m.uptime ?? 1) >= 0.9 ? 'var(--pos)' : 'var(--warn)'} />
              <text x={b.x + 26} y={b.y + b.h - 12} fontFamily={mono} fontSize={8.5} fill="var(--muted)">
                {(m.uptime ?? 1) >= 0.9 ? 'healthy' : 'degraded'}
              </text>
              {on && (
                <g>
                  <circle cx={b.x + b.w - 16} cy={b.y + 16} r={9} fill="var(--accent)" />
                  <text x={b.x + b.w - 16} y={b.y + 20} textAnchor="middle" fontSize={11} fill="#fff" fontWeight={700}>✓</text>
                </g>
              )}
            </g>
          )
        })}
        {dr && dr.w * dr.h >= 40 && (
          <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} rx={6} fill="var(--accent)" fillOpacity={0.10} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="6 4">
            <animate attributeName="stroke-dashoffset" from="0" to="20" dur="0.6s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
        <button className="btn primary" onClick={optimize} disabled={busy || !sel.length}>{busy ? 'Optimizing…' : `▶ Optimize region (${sel.length})`}</button>
        {sel.length > 0
          ? <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--accent)' }}>selected: {sel.join(', ')}</span>
          : <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)' }}>drag to select stations</span>}
      </div>
      {err && <div style={{ marginTop: 10, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
    </div>
  )
}

function RegionResult({ region }: { region: Json }) {
  return (
    <div style={{ ...card, borderColor: region.verified ? 'var(--pos)' : 'var(--neg)' }}>
      <Label n="00c">Region optimized, {region.machine_ids?.join(', ')}</Label>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><div style={{ fontFamily: mono, fontSize: 30, color: region.verified ? 'var(--pos)' : 'var(--neg)' }}>{region.hard_violations}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>HARD VIOLATIONS</div></div>
        <div><div style={{ fontFamily: mono, fontSize: 30, color: 'var(--accent)' }}>{region.n_ops}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>OPS IN REGION</div></div>
        <div><div style={{ fontFamily: mono, fontSize: 30, color: 'var(--text)' }}>{(region.job_ids ?? []).length}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>JOBS TOUCHED</div></div>
      </div>
      <div style={{ marginTop: 12 }}>{(region.job_ids ?? []).map((j: string) => <Chip key={j}>{j}</Chip>)}</div>
    </div>
  )
}

export function Baseline({ b, n }: { b: Json; n: string }) {
  const hm = b.headline_metrics ?? {}, raw = hm.frontier_llm_raw ?? {}, trm = hm.factoryceo_trm ?? {}
  const lb: Json[] = b.hud_leaderboard ?? []
  const maxR = Math.max(...lb.map((x) => x.reward), 1)
  const cell = (v: any, good: boolean) => <td style={{ padding: '7px 8px', textAlign: 'right', color: good ? 'var(--pos)' : 'var(--neg)' }}>{v}</td>
  return (
    <div style={{ ...card, borderColor: 'var(--neg)' }}>
      <Label n={n}>Baseline comparison on the sample fixture</Label>
      <p style={{ margin: '0 0 18px', color: 'var(--text)', lineHeight: 1.6 }}>{b.headline}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>HUD leaderboard · graded by the verifier</div>
          {lb.map((x, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 4 }}>{x.agent}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4 }}>
                  <div style={{ width: `${(100 * x.reward) / maxR}%`, height: '100%', borderRadius: 4, background: x.reward > 0.5 ? 'var(--pos)' : 'var(--neg)' }} />
                </div>
                <span style={{ fontFamily: mono, fontSize: 12.5, minWidth: 42 }}>{x.reward.toFixed(3)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{x.note}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>30-day run · raw frontier vs TRM</div>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--muted)', fontFamily: mono, fontSize: 10.5 }}>
              <th /><th style={{ padding: '4px 8px', textAlign: 'right' }}>frontier raw</th><th style={{ padding: '4px 8px', textAlign: 'right' }}>TRM</th></tr></thead>
            <tbody>
              <tr><td style={{ padding: '7px 8px', color: 'var(--muted)' }}>invalid actions</td>{cell(raw.invalid_actions, false)}{cell(trm.invalid_actions, true)}</tr>
              <tr><td style={{ padding: '7px 8px', color: 'var(--muted)' }}>customer trust</td>{cell(raw.customer_trust, false)}{cell(trm.customer_trust, true)}</tr>
              <tr><td style={{ padding: '7px 8px', color: 'var(--muted)' }}>unsafe incidents</td>{cell(raw.unsafe_incidents, false)}{cell(trm.unsafe_incidents, true)}</tr>
            </tbody>
          </table>
        </div>
      </div>
      <ul style={{ margin: '16px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.7 }}>
        {(b.raw_llm_failure_modes ?? []).map((f: string, i: number) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  )
}

function Humanoid({ tasks, n }: { tasks: Json; n: string }) {
  const rq = executionQueues(tasks)
  const entries = Object.entries(rq) as [string, Json[]][]
  if (!entries.length) return null
  const all = entries.flatMap(([, q]) => q)
  const lo = Math.min(...all.map((t) => t.start_hr)), hi = Math.max(...all.map((t) => t.end_hr)), span = (hi - lo) || 1
  return (
    <div style={card}>
      <Label n={n}>Symbolic execution queue</Label>
      <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        verified={String(tasks.meta?.verified)} · {tasks.meta?.safety_incidents ?? 0} safety incidents
        {(tasks.safety_controls ?? []).map((s: Json, i: number) => <span key={i} style={{ marginLeft: 8, color: 'var(--pos)', border: '1px solid var(--pos)', borderRadius: 5, padding: '1px 6px' }}>{s.control} {s.target}</span>)}
      </div>
      {entries.map(([rid, q]) => (
        <div key={rid} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', marginBottom: 5 }}>{rid} (humanoid), {q.length} tasks</div>
          <div style={{ position: 'relative', height: 24, background: 'var(--bg)', borderRadius: 6 }}>
            {q.map((t, i) => (
              <div key={i} title={`${t.task} @ ${t.machine} (h${t.start_hr}-${t.end_hr}, ${t.job})`} style={{ position: 'absolute', top: 3, height: 18, borderRadius: 4, left: `${(100 * (t.start_hr - lo)) / span}%`, width: `${Math.max(3, (100 * (t.end_hr - t.start_hr)) / span)}%`, background: 'var(--accent)', color: '#0c0f17', fontFamily: mono, fontSize: 9, lineHeight: '18px', overflow: 'hidden', padding: '0 4px', whiteSpace: 'nowrap' }}>{t.machine}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Scoreboard({ rows, n }: { rows: Json[]; n: string }) {
  return (
    <div style={card}>
      <Label n={n}>Scoreboard, 30-day run, averaged over scenarios</Label>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead><tr style={{ color: 'var(--muted)', fontFamily: mono, fontSize: 10.5 }}>
          <th style={{ textAlign: 'left', padding: '6px 8px' }}>method</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>profit</th>
          <th style={{ padding: '6px 8px', textAlign: 'right' }}>on-time</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>invalid</th>
          <th style={{ padding: '6px 8px', textAlign: 'right' }}>trust</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>unsafe</th></tr></thead>
        <tbody>{rows.map((r) => {
          const trm = r.method === 'trm'
          return (
            <tr key={r.method} style={{ borderTop: '1px solid var(--line)', fontWeight: trm ? 600 : 400 }}>
              <td style={{ padding: '8px', color: trm ? 'var(--accent)' : 'var(--text)' }}>{r.label}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{Math.round(r.profit).toLocaleString()}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{Math.round(r.on_time_rate * 100)}%</td>
              <td style={{ padding: '8px', textAlign: 'right', color: r.invalid_actions === 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.invalid_actions}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: r.customer_trust >= 90 ? 'var(--pos)' : 'var(--neg)' }}>{Math.round(r.customer_trust)}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: (r.safety_incidents ?? 0) === 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.safety_incidents ?? '-'}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

// Step 3 of the diagram: teacher → small specialist. Shows the distillation
// pipeline, the LLM-alone vs trained TRM gain, and a per-customer checkpoint you
// train once and reload on return.
export function TrainDistill({ rows, n, customerId, customerName, taskId, state }: { rows: Json[]; n: string; customerId?: string; customerName?: string; taskId?: string; state?: Json }) {
  const base = rows.find((r) => r.method === 'base_llm') ?? rows.find((r) => r.method === 'llm_retry')
  const trm = rows.find((r) => r.method === 'trm')
  const cid = customerId || 'default'
  const key = taskId || cid                              // per-task checkpoint key
  const taskSpecific = !!(taskId && state && (state.machines ?? []).length)
  const [ckpt, setCkpt] = useState<Json | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let on = true
    fetch(`${BRAIN}/checkpoint/${encodeURIComponent(key)}`).then((r) => r.json()).then((j) => { if (on) setCkpt(j) }).catch(() => {})
    return () => { on = false }
  }, [key])
  async function trainSave() {
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`${BRAIN}/train_trm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: cid, task_id: taskId || '', state: taskSpecific ? state : null, n_episodes: 40, epochs: 40 }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const m = await r.json()
      setCkpt({ ...m, loadable: m.trained })
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(false) }
  }
  const stat = (label: string, b: any, t: any, fmt: (v: number) => string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span><span style={{ color: 'var(--neg)' }}>{fmt(b)}</span> <span style={{ color: 'var(--muted)' }}>→</span> <span style={{ color: 'var(--pos)', fontWeight: 600 }}>{fmt(t)}</span></span>
    </div>
  )
  return (
    <div style={card}>
      <Label n={n}>Teacher → student: train a TRM (+ optional Gemma) on verified traces</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--text)', lineHeight: 1.6, fontSize: 13.5 }}>
        The serverless teacher proposes plans; the verifier + recursive repair turn each proposal into a <b>verified reasoning trace</b>. Those traces can train a small specialist for this narrow scheduling domain, while the verifier remains the gate before execution.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, fontFamily: mono, fontSize: 11 }}>
        {['seed corpus', 'teacher amplifies', 'verifier gates', 'verified traces', 'distill TRM', 'Gemma fallback'].map((s, i) => (
          <span key={s} style={{ color: 'var(--muted)' }}>{i > 0 && <span style={{ margin: '0 6px', color: 'var(--line)' }}>→</span>}{s}</span>
        ))}
      </div>
      {base && trm && (
        <div>
          {stat('invalid actions', base.invalid_actions, trm.invalid_actions, (v) => String(v))}
          {stat('customer trust', base.customer_trust, trm.customer_trust, (v) => String(Math.round(v)))}
          {stat('profit', base.profit, trm.profit, (v) => Math.round(v).toLocaleString())}
          {stat('on-time', base.on_time_rate, trm.on_time_rate, (v) => `${Math.round(v * 100)}%`)}
        </div>
      )}

      {/* per-customer trained checkpoint: train once, reload on return */}
      <div style={{ marginTop: 16, padding: '14px 16px', border: `1px solid ${ckpt?.trained ? 'var(--pos)' : 'var(--line)'}`, borderRadius: 10, background: 'var(--bg)' }}>
        <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
          TRM checkpoint · {taskSpecific ? 'per-task' : 'per-customer'} · {customerName || cid}
        </div>
        {ckpt?.trained ? (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--pos)', fontWeight: 700 }}>✓ checkpoint loaded</span>
            <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--text)' }}>{ckpt.params?.toLocaleString()} params</span>
            <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--text)' }}>train acc {Math.round((ckpt.train_acc ?? 0) * 100)}%</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)' }}>{ckpt.n_traces} traces · {String(ckpt.created || '').slice(0, 10)}</span>
            <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={trainSave} disabled={busy}>{busy ? 'Retraining…' : '↻ retrain'}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>No saved model for this customer yet.</span>
            <button className="btn primary" onClick={trainSave} disabled={busy}>{busy ? 'Training & saving…' : '▶ Train & save checkpoint'}</button>
          </div>
        )}
        {err && <div style={{ marginTop: 8, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      </div>
    </div>
  )
}

type PipelineStageState = { ok?: boolean | null; [key: string]: unknown }

function PipelineStage({ k, label, body, state }: { k: string; label: string; body: string; state?: PipelineStageState }) {
  const ok = state?.ok
  const color = ok === true ? 'var(--pos)' : ok === false ? 'var(--neg)' : 'var(--muted)'
  const dot = ok === true ? '●' : ok === false ? '✕' : '○'
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ color, fontFamily: mono, fontSize: 13, width: 14 }}>{dot}</span>
      <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', width: 70 }}>{k}</span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: 12, color }}>{body}</span>
    </div>
  )
}

function currentFloorId(live: Json | null) {
  return live?._catalog?.id ?? live?.id ?? live?.floor_profile?.id ?? null
}

function seedFromContext(live: Json | null) {
  const key = String(currentFloorId(live) ?? live?.intake?.summary ?? live?.intake?.industry ?? 'shiftbench')
  return Array.from(key).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 9000, 1000)
}

// One-button pipeline: Fireworks/seed synth -> TRM train -> local HUD eval +
// GRPO signal -> optional HUD cloud grading -> MuJoCo/V-JEPA execution QA.
export function Pipeline({ n, live, defaultTeacher = 'deterministic' }: { n: string; live?: Json | null; defaultTeacher?: 'deterministic' | 'fireworks' }) {
  const [d, setD] = useState<Json | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [teacher, setTeacher] = useState<'deterministic' | 'fireworks'>(defaultTeacher)
  const [includeHud, setIncludeHud] = useState(false)
  const [showOpts, setShowOpts] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const context = live ?? null
  const floorId = currentFloorId(context)
  const contextSummary = context?.intake?.summary ?? context?.intake?.scenario ?? context?.intake?.industry
  async function run(run_hud: boolean, run_mujoco = false) {
    setBusy(run_hud ? 'hud' : 'run'); setErr(null)
    try {
      const r = await fetch(`${BRAIN}/pipeline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: seedFromContext(context),
          teacher,
          n_episodes: live ? 8 : 12,
          epochs: 40,
          run_hud,
          run_mujoco,
          floor_synth: true,
          floor_id: floorId,
          context_summary: contextSummary,
        }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setD(await r.json())
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(null) }
  }
  const s = d?.stages ?? {}
  return (
    <div style={{ ...card, borderColor: 'var(--brand)' }}>
      <Label n={n}>Current-context training pipeline</Label>
      {context && (
        <div style={{ margin: '0 0 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip tone={floorId ? 'var(--pos)' : 'var(--warn)'}>context: {floorId ?? 'generated brief'}</Chip>
          <Chip>seed: {seedFromContext(context)}</Chip>
          {contextSummary && <Chip>{String(contextSummary).slice(0, 42)}</Chip>}
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => run(includeHud, true)} disabled={!!busy}>
            {busy ? 'Running pipeline…' : '▶ Run training pipeline'}
          </button>
          <button type="button" onClick={() => setShowOpts((s) => !s)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: mono, fontSize: 11, color: 'var(--muted)', padding: '4px 2px' }}>
            {showOpts ? '▾ options' : '▸ options'}
          </button>
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginTop: 7 }}>
          {teacher === 'fireworks' ? 'Qwen synth' : 'free synth'} → TRM → GRPO → MuJoCo{includeHud ? ' + HUD cloud grading' : ''}.
        </div>
        {showOpts && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)' }}>
            <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {(['deterministic', 'fireworks'] as const).map((t) => (
                <button key={t} onClick={() => setTeacher(t)} style={{ border: 'none', padding: '6px 11px', fontSize: 11.5, cursor: 'pointer', background: teacher === t ? 'var(--accent)' : 'var(--panel)', color: teacher === t ? '#fff' : 'var(--muted)' }}>
                  {t === 'fireworks' ? 'Qwen synth' : 'free synth'}
                </button>
              ))}
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeHud} onChange={(e) => setIncludeHud(e.target.checked)} />
              HUD cloud grading <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)' }}>(uses credits)</span>
            </label>
          </div>
        )}
      </div>
      {err && <div style={{ marginBottom: 10, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      {d && (
        <div>
          {s.floor_synth_summary && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 12px' }}>
              <EvidenceStat label="grounded synth" value={`${s.floor_synth_summary.grounded}/${s.floor_synth_summary.records}`} tone="var(--pos)" />
              <EvidenceStat label="hard violations" value={`${s.floor_synth_summary.raw_hard} → ${s.floor_synth_summary.verified_hard}`} tone={s.floor_synth_summary.verified_hard === 0 ? 'var(--pos)' : 'var(--warn)'} />
              <EvidenceStat label="reward delta" value={`${s.floor_synth_summary.reward_delta >= 0 ? '+' : ''}${s.floor_synth_summary.reward_delta}`} tone={s.floor_synth_summary.reward_delta >= 0 ? 'var(--pos)' : 'var(--warn)'} />
              <EvidenceStat label="avg GRPO lift" value={`${s.floor_synth_summary.avg_grpo_lift >= 0 ? '+' : ''}${s.floor_synth_summary.avg_grpo_lift}`} tone="var(--pos)" />
            </div>
          )}
          <PipelineStage k="synth" label={`synthetic verified traces (${s.synth?.source})`} state={s.synth} body={s.synth?.ok === false ? String(s.synth?.error ?? 'failed') : `${s.synth?.trace_steps ?? 0} repair steps`} />
          <PipelineStage k="trm" label="train TRM repair-policy checkpoint" state={s.trm} body={s.trm?.ok ? `${s.trm.backend ?? 'trm'} · ${s.trm.params?.toLocaleString()} params · ${Math.round((s.trm.train_acc ?? 0) * 100)}% acc` : String(s.trm?.error ?? '—')} />
          <PipelineStage k="hud_eval" label="offline HUD Taskset eval (free)" state={s.hud_eval} body={s.hud_eval?.ok ? 'graded locally' : String(s.hud_eval?.error ?? '—')} />
          <PipelineStage k="grpo" label="local GRPO/ART rollout-group signal" state={s.grpo} body={s.grpo?.ok ? 'advantages ready' : String(s.grpo?.error ?? '—')} />
          <PipelineStage k="hud" label="HUD cloud grading: TRM vs open/fallback gateway" state={s.hud} body={s.hud?.ok === null ? 'skipped' : (s.hud?.output ? 'see output' : String(s.hud?.error ?? 'done'))} />
          <PipelineStage k="jepa" label="MuJoCo + JEPA2 execution check" state={s.jepa} body={s.jepa?.ok ? `${s.jepa.embedding_backend ?? (s.jepa.jepa2 ? 'vjepa2' : 'deterministic_stub')} · ${s.jepa.frames ?? 0} frames · score ${s.jepa.score}` : String(s.jepa?.error ?? s.jepa?.note ?? 'not ready')} />
          <PipelineStage k="gemma" label="Gemma SFT data generated; fine-tune is gated" state={s.gemma} body={s.gemma?.sft_rows ? `${s.gemma.sft_rows} rows ready` : 'not launched'} />
          {s.hud_eval?.output && <pre style={{ fontFamily: mono, fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 10, color: 'var(--text)', background: 'var(--bg)', padding: 10, borderRadius: 8 }}>{s.hud_eval.output}</pre>}
          {s.grpo?.output && <pre style={{ fontFamily: mono, fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 10, color: 'var(--text)', background: 'var(--bg)', padding: 10, borderRadius: 8 }}>{s.grpo.output}</pre>}
          {s.hud?.output && <pre style={{ fontFamily: mono, fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 10, color: 'var(--text)', background: 'var(--bg)', padding: 10, borderRadius: 8 }}>{s.hud.output}</pre>}
          {s.floor_synth_summary?.best_policies?.length > 0 && <div style={{ marginTop: 10, color: 'var(--muted)', fontFamily: mono, fontSize: 11 }}>Best GRPO policies: {s.floor_synth_summary.best_policies.join(', ')}</div>}
          {s.gemma?.sft_path && <div style={{ marginTop: 10, color: 'var(--muted)', fontFamily: mono, fontSize: 11 }}>Gemma SFT artifact: {s.gemma.sft_path}</div>}
        </div>
      )}
    </div>
  )
}

// Long-horizon manufacturing eval (DragonBench-style): naive / greedy / TRM across
// the HUD Taskset (14-60 day scenarios), partial-credit leaderboard + per-task.
export function EvalReport({ n }: { n: string }) {
  const [d, setD] = useState<Json | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function run() {
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`${BRAIN}/eval_report`)
      if (!r.ok) throw new Error(String(r.status))
      setD(await r.json())
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(false) }
  }
  const col: Record<string, string> = { trm: 'var(--pos)', greedy: 'var(--accent)', naive: 'var(--neg)' }
  const maxScore = 1
  return (
    <div style={card}>
      <Label n={n}>Long-horizon eval: how the verifier-gated brain improves the benchmark</Label>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        The same approaches run across a Taskset of 14-60 day factory scenarios, scored by partial credit (feasibility + on-time + safety + profit). This is the manufacturing analogue of a single-answer eval report.
      </p>
      {!d && <button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Running eval…' : '▶ Run long-horizon eval'}</button>}
      {err && <div style={{ marginTop: 10, color: 'var(--warn)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      {d && (
        <div>
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
            {d.benchmark} · {d.n_tasks} tasks · horizons {(d.horizons ?? []).join('/')} days
          </div>
          {/* leaderboard bars */}
          <div style={{ marginBottom: 16 }}>
            {(d.leaderboard ?? []).map((l: Json) => (
              <div key={l.agent} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text)', fontWeight: l.agent === 'trm' ? 700 : 400 }}>{l.agent === 'naive' ? 'frontier-style (no repair)' : l.agent === 'trm' ? 'verifier-gated TRM' : 'greedy'}</span>
                  <span style={{ fontFamily: mono, color: col[l.agent] }}>{l.score.toFixed(3)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(100 * l.score) / maxScore}%`, height: '100%', background: col[l.agent] }} />
                </div>
              </div>
            ))}
          </div>
          {/* per-task table */}
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--muted)', fontFamily: mono, fontSize: 10 }}>
              <th style={{ textAlign: 'left', padding: '5px 6px' }}>task</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>horizon</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>naive</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>greedy</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>TRM</th></tr></thead>
            <tbody>{(d.rows ?? []).map((r: Json) => (
              <tr key={r.task} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px', color: 'var(--text)' }}>{r.task}</td>
                <td style={{ padding: '6px', textAlign: 'right', color: 'var(--muted)' }}>{r.horizon_days}d</td>
                {['naive', 'greedy', 'trm'].map((a) => {
                  const pc = r.agents[a]
                  return <td key={a} style={{ padding: '6px', textAlign: 'right', color: pc.feasible ? 'var(--pos)' : 'var(--neg)' }}>{pc.total.toFixed(2)}{pc.feasible ? '' : ` (${pc.hard_violations})`}</td>
                })}
              </tr>
            ))}</tbody>
          </table>
          <p style={{ margin: '12px 0 0', color: 'var(--text)', fontSize: 12.5, lineHeight: 1.5 }}>{d.headline}</p>
        </div>
      )}
    </div>
  )
}

// Final step: teacher gives actionable feedback the operator can use to patch the
// humanoid for next time. Real call to the brain's /teacher_feedback (Fireworks).
export function TeacherFeedback({ live, n }: { live: Json | null; n: string }) {
  const [fb, setFb] = useState<Json | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function ask() {
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`${BRAIN}/teacher_feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode: live?.episode, isaac_tasks: live?.isaac_tasks, intake: live?.intake }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setFb(await r.json())
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(false) }
  }
  return (
    <div style={card}>
      <Label n={n}>Actionable feedback, patch the humanoid for next time</Label>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        The teacher reviews the verified run and writes concrete patches the operator (or the humanoid's policy) should apply next cycle.
      </p>
      {!fb && <button className="btn primary" onClick={ask} disabled={busy || !live}>{busy ? 'Asking the teacher…' : '▶ Get actionable feedback'}</button>}
      {err && <div style={{ marginTop: 10, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      {fb && (
        <div>
          {fb.summary && <p style={{ margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.6 }}>{fb.summary}</p>}
          {(fb.patches ?? []).map((p: Json, i: number) => (
            <div key={i} style={{ borderLeft: '2px solid var(--accent)', background: 'var(--bg)', padding: '10px 12px', marginBottom: 8, borderRadius: '0 8px 8px 0' }}>
              <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--accent)', marginBottom: 3 }}>{p.target ?? `patch ${i + 1}`}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{typeof p === 'string' ? p : p.action ?? p.text}</div>
            </div>
          ))}
          <button className="btn ghost" style={{ marginTop: 6 }} onClick={ask} disabled={busy}>↻ regenerate</button>
        </div>
      )}
    </div>
  )
}

function EvidenceAndTraining({ live, ep, tasks, baseline, run, n }: { live: Json; ep: Json; tasks: Json; baseline: Json | null; run: Json | null; n: string }) {
  const rl = useJson('/factoryceo/rl_curve.json').data
  const hud = useJson('/factoryceo/hud_rl_curve.json').data
  const before = ep?.verifier_before ?? {}
  const after = ep?.verifier_after ?? {}
  const beforeHard = before.n_hard ?? live.naive_verdict?.hard_violations ?? 0
  const afterHard = after.n_hard ?? 0
  const beforeReward = Number(before.reward ?? 0)
  const afterReward = Number(after.reward ?? 0)
  const repaired = Math.max(0, beforeHard - afterHard)
  const scoreRows: Json[] = run?.scoreboard ?? baseline?.scoreboard ?? []
  const raw = scoreRows.find((r) => r.method === 'base_llm')
  const trm = scoreRows.find((r) => r.method === 'trm')
  const profitLift = raw && trm ? ((trm.profit - raw.profit) / Math.max(1, raw.profit)) * 100 : null
  const invalidDrop = raw && trm ? `${raw.invalid_actions} → ${trm.invalid_actions}` : '10.8 → 0'
  const rlLift = rl?.lift_pct
  const hudLift = hud?.lift_vs_greedy_pct
  const currentHadRepair = beforeHard > 0 || (ep?.repair_trace ?? []).length > 0
  return (
    <div style={card}>
      <Label n={n}>Supporting evidence and training status</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.55 }}>
        This section is not claiming that the uploaded floor-painting scenario was physically trained in MuJoCo. It separates the current run's verifier result from benchmark evidence collected on the ShiftBench tasksets.
      </p>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--bg)', marginBottom: 14 }}>
        <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>This uploaded run</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <EvidenceStat label="hard violations" value={`${beforeHard} → ${afterHard}`} tone={afterHard === 0 ? 'var(--pos)' : 'var(--neg)'} />
          <EvidenceStat label="repair decisions" value={ep?.repair_trace?.length ?? 0} tone={currentHadRepair ? 'var(--brand)' : 'var(--muted)'} />
          <EvidenceStat label="reward delta" value={`${Math.round(afterReward - beforeReward) >= 0 ? '+' : ''}${Math.round(afterReward - beforeReward).toLocaleString()}`} tone={afterReward >= beforeReward ? 'var(--pos)' : 'var(--neg)'} />
          <EvidenceStat label="symbolic queue" value={`${queueOpCount(tasks ?? {})}`} />
        </div>
        <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
          {repaired > 0
            ? `The verifier actually fixed ${repaired} hard constraint issue${repaired === 1 ? '' : 's'} in this run.`
            : 'The raw plan was already feasible on this tiny symbolic scenario, so there is no dramatic before/after repair win to show for this upload.'}
        </p>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--bg)', marginBottom: 14 }}>
        <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Benchmark wins, separate from this upload</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <EvidenceStat label="LLM invalid actions" value={invalidDrop} tone="var(--pos)" />
          <EvidenceStat label="TRM profit vs raw LLM" value={profitLift == null ? 'measured' : `+${profitLift.toFixed(1)}%`} tone="var(--pos)" />
          <EvidenceStat label="RL dispatch lift" value={rlLift == null ? 'loading' : `+${rlLift}%`} tone="var(--pos)" />
          <EvidenceStat label="open-student GRPO signal" value={hudLift == null ? 'loading' : `${hudLift >= 0 ? '+' : ''}${hudLift}%`} tone={Number(hudLift ?? 0) >= 0 ? 'var(--pos)' : 'var(--warn)'} />
        </div>
        <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
          The real training win currently shown is the CPU RL dispatch policy: {rl?.final_profit ? `${fmtMoney(rl.greedy_profit)} greedy to ${fmtMoney(rl.final_profit)} trained policy with ${rl.final_hard_viol_rate} hard-violation rate.` : 'loading the static RL curve.'} The HUD path grades the agent online; Gemma/Qwen-style GRPO weight updates remain a separate open-student training step.
        </p>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--bg)' }}>
        <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>MuJoCo / physical execution status</div>
        <p style={{ margin: '0 0 10px', color: 'var(--text)', fontSize: 13, lineHeight: 1.55 }}>
          MuJoCo is now treated as execution QA: it can render the raw and verified symbolic queues when the brain host has MuJoCo available. It is not the source of the RL lift above unless a rollout returns frames and scores.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip tone={tasks?.meta?.verified ? 'var(--pos)' : 'var(--warn)'}>symbolic verified: {String(tasks?.meta?.verified ?? false)}</Chip>
          <Chip>safety incidents: {tasks?.meta?.safety_incidents ?? 0}</Chip>
          <Chip>execution tasks: {queueOpCount(tasks ?? {})}</Chip>
        </div>
      </div>
    </div>
  )
}

function reanalysisInputFromRun(live: Json): BrainInput {
  const intake = live?.intake ?? {}
  const jobSource = intake.job_source ?? live?.job_source
  const fs = live?.episode?.observation?.factory_state ?? {}
  const layout = intake.layout ?? {}
  const floorplan = intake.floorplan ?? {}
  const lines = [
    'Re-analyze this existing ShiftBench run with Fireworks.',
    intake.summary && `Run summary: ${intake.summary}`,
    intake.scenario && `Scenario: ${intake.scenario}`,
    intake.scenario_method && `Previous scenario method: ${intake.scenario_method}`,
    intake.scenario_note && `Previous scenario note: ${intake.scenario_note}`,
    floorplan.id && `Floor plan: ${floorplan.id} ${floorplan.file ?? ''}`,
    Object.keys(layout).length && `Declared layout: ${JSON.stringify(layout)}`,
    jobSource && `Warehouse job source: ${String(jobSource.source ?? '').toUpperCase()} · ${jobSource.n_orders ?? '?'} orders · ${jobSource.n_order_lines ?? '?'} order lines · mapped to ${jobSource.floorplan_id ?? floorplan.id ?? 'the current floor plan'}.`,
    jobSource?.summary && `Job-source summary: ${jobSource.summary}`,
    jobSource?.mapping_profile?.name && `Mapping profile: ${jobSource.mapping_profile.name}; source prefix ${jobSource.mapping_profile.source_prefix}; station prefix ${jobSource.mapping_profile.station_prefix}.`,
    jobSource?.mapping_profile?.route_constraints?.length && `Route constraints: ${jobSource.mapping_profile.route_constraints.join(', ')}.`,
    fs.jobs?.length && `Symbolic scheduler state from prior run: ${fs.jobs.length} jobs, ${fs.machines?.length ?? '?'} resources, ${fs.horizon_days ?? intake.horizon_days ?? '?'} day horizon.`,
    !jobSource && !floorplan.id && 'If no domain adapter matches, say that clearly and compile the best bounded symbolic scheduler scenario from the available context.',
  ].filter(Boolean)
  return { text: lines.join('\n'), files: [] }
}

// Legible "what the verifier caught" — the actual hard constraints the raw plan
// broke, grouped and explained, then driven to zero. This is the real before/after.
const VIO_LABEL: Record<string, string> = {
  machine_overlap: 'Machine double-booked (two ops at once)',
  capability_mismatch: 'Wrong machine for the operation',
  operator_unavailable: 'Operator not on shift',
  operator_unqualified: 'Operator lacks the skill',
  operator_overlap: 'Operator or robot double-booked',
  material_shortage: 'Not enough material',
  material_late: 'Material arrives after the op starts',
  maintenance_conflict: 'Scheduled during machine maintenance',
  precedence_violation: 'Operation order broken',
  hallucinated_entity: 'References a machine/job that does not exist',
  unscheduled_operation: 'Operation left unscheduled',
  bad_window: 'Operation outside its allowed time window',
  overlap: 'Two operations overlap',
}

// What each repair op means in plain English (the brain/TRM's decisions).
const OP_LABEL: Record<string, string> = {
  move_operation: 'Moved the op to a free slot',
  swap_machine: 'Swapped to a capable machine',
  assign_operator: 'Assigned a qualified, on-shift operator',
  delay_job: 'Delayed the job to respect constraints',
  add_overtime: 'Added overtime to hit the deadline',
  expedite_material: 'Expedited material to arrive in time',
  reject_rfq: 'Rejected an unprofitable order',
  warn_customer: 'Warned the customer of a delay',
  inspect: 'Scheduled a safety inspection',
  lockout: 'Locked out a degraded machine',
  slowdown: 'Capped robot continuous run (safety)',
  safety_check: 'Added a safety inspection before execution',
  noop: 'No change needed',
}

function isWarehouseFixture(live: Json | null) {
  return live?.intake?.source === 'staer_warehouse_fixture' || live?.intake?.industry === 'warehouse_ops'
}

function violationLabel(type: string | undefined, warehouse: boolean) {
  if (!warehouse) return VIO_LABEL[type ?? ''] ?? type ?? 'violation'
  const labels: Record<string, string> = {
    machine_overlap: 'Station or aisle resource double-booked',
    capability_mismatch: 'Task assigned to the wrong resource type',
    operator_unavailable: 'Worker or robot not available',
    operator_unqualified: 'Worker or robot lacks the required capability',
    operator_overlap: 'Worker or robot double-booked',
    material_shortage: 'Inventory or replenishment shortfall',
    material_late: 'Inventory arrives after the task starts',
    maintenance_conflict: 'Task routed through a blocked resource window',
    precedence_violation: 'Task sequence order broken',
  }
  return labels[type ?? ''] ?? VIO_LABEL[type ?? ''] ?? type ?? 'verification issue'
}

function repairLabel(op: string, warehouse: boolean) {
  if (!warehouse) return OP_LABEL[op] ?? op
  const labels: Record<string, string> = {
    move_operation: 'Moved the task to an open time window',
    swap_machine: 'Rerouted to a compatible station/resource',
    assign_operator: 'Assigned an available worker or robot',
    delay_job: 'Delayed the task to respect constraints',
    add_overtime: 'Extended coverage to hit the deadline',
    expedite_material: 'Expedited inventory/replenishment',
    reject_rfq: 'Rejected an infeasible request',
    warn_customer: 'Raised a delay warning',
    inspect: 'Scheduled a safety inspection',
    lockout: 'Locked out a blocked or degraded resource',
    slowdown: 'Capped robot continuous run time',
    safety_check: 'Added a safety check before execution',
    noop: 'No change needed',
  }
  return labels[op] ?? OP_LABEL[op] ?? op
}

function fmtMoney(v: number | undefined) {
  const n = Number(v ?? 0)
  return Math.abs(n) >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`
}

export function pct(v: number | undefined) {
  return `${Math.round(Number(v ?? 0) * 100)}%`
}

function EvidenceStat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div style={{ flex: '1 1 132px', minWidth: 125, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', padding: '10px 12px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 800, color: tone ?? 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

function ArchitectureCard({ live, ep, n }: { live: Json; ep: Json; n: string }) {
  const info = live.intake ?? {}
  const fs = ep?.observation?.factory_state ?? {}
  const beforeHard = ep?.verifier_before?.n_hard ?? live?.naive_verdict?.hard_violations ?? 0
  const afterHard = ep?.verifier_after?.n_hard ?? 0
  const steps = [
    ['Intake', info.job_source ? `${info.job_source.n_order_lines ?? '?'} RAFS/SOAR lines` : info.source ?? 'uploaded context', 'var(--brand)'],
    ['FactoryState', `${fs.jobs?.length ?? info.n_jobs ?? '?'} jobs · ${fs.machines?.length ?? '?'} resources`, 'var(--line)'],
    ['Brain proposal', live.planner?.actual ?? (isWarehouseFixture(live) ? 'cached fixture' : 'deterministic'), 'var(--accent)'],
    ['Verifier/repair', `${beforeHard} → ${afterHard} hard violations`, afterHard === 0 ? 'var(--pos)' : 'var(--warn)'],
    ['Verified queue', `${queueOpCount(live.isaac_tasks ?? {})} execution tasks`, 'var(--warn)'],
    ['Execution QA', 'MuJoCo/Isaac + V-JEPA when enabled', 'var(--brand)'],
  ]
  return (
    <div style={card}>
      <Label n={n}>Architecture used for this run</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 9 }}>
        {steps.map(([title, detail, tone], i) => (
          <div key={title} style={{ border: `1px solid ${tone}`, borderRadius: 12, background: 'var(--bg)', padding: '11px 12px' }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: tone }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13.5, marginTop: 5 }}>{title}</div>
            <div style={{ fontFamily: mono, color: 'var(--muted)', fontSize: 10.5, marginTop: 4, lineHeight: 1.35 }}>{detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalysisBoundary({ live, ep, n }: { live: Json; ep: Json; n: string }) {
  const info = live.intake ?? {}
  const method = String(info.scenario_method ?? 'compiled')
  const generic = method === 'generic_synthetic'
  const warehouse = isWarehouseFixture(live)
  const fs = ep?.observation?.factory_state ?? {}
  return (
    <div style={{ ...card, borderColor: generic ? 'var(--warn)' : 'var(--line)' }}>
      <Label n={n}>What this analysis is, and is not</Label>
      <p style={{ margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.55, fontSize: 13.5 }}>
        {warehouse ? (
          <>This is a warehouse benchmark fixture: Staer-style floor metadata plus a RAFS/SOAR order stream, compiled into ShiftBench's symbolic verifier.</>
        ) : generic ? (
          <>This uploaded run did not match a domain seed, so ShiftBench created a <b>generic symbolic scheduler scenario</b>. It is a verifier/planner smoke test for the text you provided, not a validated floor-painting process model.</>
        ) : (
          <>This is a symbolic operations scenario compiled from the uploaded context and then verified before execution.</>
        )}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Chip tone={generic ? 'var(--warn)' : 'var(--pos)'}>method: {method}</Chip>
        <Chip>jobs: {fs.jobs?.length ?? info.n_jobs ?? '?'}</Chip>
        <Chip>resources: {fs.machines?.length ?? '?'}</Chip>
        <Chip>horizon: {info.horizon_days ?? fs.horizon_days ?? '?'} days</Chip>
        <Chip>planner: {live.planner?.actual ?? 'deterministic'}</Chip>
      </div>
      {generic && (
        <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
          For floor painting, curing time, humidity, substrate prep, crew access, and blocked areas need a real domain adapter before the result should be treated as an operational plan. The verifier result below only proves the generated symbolic schedule is internally consistent.
        </p>
      )}
    </div>
  )
}

function GenerationProvenance({ live, ep, n }: { live: Json; ep: Json; n: string }) {
  const fs = ep?.observation?.factory_state ?? {}
  const warehouse = isWarehouseFixture(live)
  const layout = live.intake?.layout ?? {}
  const source = live.intake?.source === 'llm' ? 'Fireworks intake parser' : live.intake?.source ?? 'deterministic fallback'
  const planner = live.planner?.actual === 'fireworks' ? 'Fireworks planner' : live.planner?.actual ?? 'deterministic planner'
  return (
    <div style={card}>
      <Label n={n}>How this report was generated</Label>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.55 }}>
        {warehouse ? (
          <>This is a <b>cached warehouse benchmark fixture</b>, not a live warehouse integration. The Staer-style layout is adapted into ShiftBench's current symbolic scheduler so the verifier can test task order, resource conflicts, inventory, timing, and safety repairs.</>
        ) : (
          <>This is not a live factory integration yet. ShiftBench converts your uploaded context into a <b>symbolic factory scenario</b>, asks the planner for operations decisions, then runs the verifier and repair loop over that scenario.</>
        )}
      </p>
      <div className="provenance-strip">
        <div><span>1</span>{warehouse ? 'Fixture loaded' : 'Input parsed'}<small>{source}</small></div>
        <div><span>2</span>{warehouse ? 'Layout mapped' : 'Scenario compiled'}<small>{warehouse ? `${layout.aisles ?? '?'} aisles · ${layout.docks ?? '?'} docks · ${layout.robots ?? '?'} robots` : `${fs.jobs?.length ?? live.intake?.n_jobs ?? '?'} jobs · ${fs.machines?.length ?? '?'} machines`}</small></div>
        <div><span>3</span>{warehouse ? 'Plan generated' : 'Plan proposed'}<small>{warehouse && !live.planner ? 'cached deterministic baseline' : planner}</small></div>
        <div><span>4</span>Verifier gated<small>hard constraints + repair trace</small></div>
      </div>
    </div>
  )
}

// Decision ledger: what the verifier found in the raw proposal and what the repair
// loop changed. This is an audit log for the symbolic scenario, not a real-world
// execution trace.
function WhatWasFixed({ ep, naiveHard, n, warehouse = false }: { ep: Json; naiveHard?: number; n: string; warehouse?: boolean }) {
  const steps: Json[] = ep?.repair_trace ?? []
  const before = ep?.verifier_before?.n_hard ?? naiveHard ?? (ep?.verifier_before?.errors ?? []).length
  const r0 = Math.round(ep?.verifier_before?.reward ?? 0)
  const rf = Math.round(ep?.verifier_after?.reward ?? 0)
  const m = ep?.verifier_after?.metrics ?? {}
  // reward trajectory across the brain's decisions.
  const series = [r0, ...steps.map((s) => Math.round(s.reward_after ?? r0))]
  const lo = Math.min(...series), hi = Math.max(...series), span = (hi - lo) || 1
  const W = 720, H = 60
  const xs = (i: number) => (i / Math.max(1, series.length - 1)) * W
  const ys = (v: number) => H - 6 - ((v - lo) / span) * (H - 12)
  const stat = (v: React.ReactNode, l: string, c: string) => (
    <div><div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: c, lineHeight: 1 }}>{v}</div><div style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--muted)', marginTop: 5, textTransform: 'uppercase' }}>{l}</div></div>
  )
  const prev = (i: number) => (i === 0 ? r0 : Math.round(steps[i - 1].reward_after ?? r0))
  const hadHardViolations = before > 0
  return (
    <div style={card}>
      <Label n={n}>Verifier and repair audit</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        {warehouse ? (
          <>The cached baseline produced a simulated warehouse plan with <b>{before}</b> hard violation{before === 1 ? '' : 's'} and verifier score <b>{r0.toLocaleString()}</b>. The repair loop made <b>{steps.length}</b> change{steps.length === 1 ? '' : 's'} before marking the task sequence verified.</>
        ) : (
          <>The planner produced a raw proposal with <b>{before}</b> hard violation{before === 1 ? '' : 's'} and verifier reward <b>{r0.toLocaleString()}</b>. The repair loop made <b>{steps.length}</b> change{steps.length === 1 ? '' : 's'} to produce the final verified operating plan.</>
        )}
      </p>
      <div style={{ marginBottom: 14 }}>
        <VerifierMethodCard compact />
      </div>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', marginBottom: 14 }}>
        {stat(`${before} → 0`, 'hard violations', 'var(--pos)')}
        {stat(`${r0.toLocaleString()} → ${rf.toLocaleString()}`, warehouse ? 'verifier score' : 'verifier reward', 'var(--brand)')}
        {!warehouse && stat(Math.round(m.profit ?? 0).toLocaleString(), 'profit', 'var(--text)')}
        {stat(`${Math.round((m.on_time_rate ?? 0) * 100)}%`, warehouse ? 'deadline pass rate' : 'on-time', 'var(--text)')}
      </div>
      {/* reward climbs as the brain makes decisions */}
      {series.length > 1 && (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 52, marginBottom: 12 }} preserveAspectRatio="none">
          <polyline points={series.map((v, i) => `${xs(i)},${ys(v)}`).join(' ')} fill="none" stroke="var(--brand)" strokeWidth={2} />
          {series.map((v, i) => <circle key={i} cx={xs(i)} cy={ys(v)} r={2.2} fill="var(--brand)" />)}
        </svg>
      )}
      {/* per-decision ledger */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.slice(0, 12).map((s, i) => {
          const te = s.targeted_error || {}
          const op = s.repair_action?.op ?? 'noop'
          const tgt = [s.repair_action?.job_id && `${s.repair_action.job_id}/${s.repair_action.operation_id ?? ''}`, s.repair_action?.machine_id, s.repair_action?.operator_id, s.repair_action?.material].filter(Boolean).join(' → ')
          const d = Math.round((s.reward_after ?? r0)) - prev(i)
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'baseline', padding: '9px 0', borderTop: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 9.5, color: hadHardViolations ? 'var(--neg)' : 'var(--muted)', textTransform: 'uppercase' }}>{hadHardViolations ? 'Verifier flagged' : 'Verifier refinement'}</div>
                <div style={{ fontSize: 12.5 }}>{hadHardViolations ? violationLabel(te.type, warehouse) : 'Raw proposal was feasible; repair improved the objective.'}</div>
              </div>
              <div>
                <div style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--pos)', textTransform: 'uppercase' }}>Repair action</div>
                <div style={{ fontSize: 12.5 }}>{repairLabel(op, warehouse)} <span style={{ fontFamily: mono, color: 'var(--muted)', fontSize: 10.5 }}>{tgt}</span></div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: mono, fontSize: 12, color: d >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{d >= 0 ? '+' : ''}{d.toLocaleString()}</div>
            </div>
          )
        })}
        {steps.length > 12 && <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', paddingTop: 8 }}>+{steps.length - 12} more repair decisions</div>}
      </div>
    </div>
  )
}

function IntakeThinking({
  busy,
  err,
  brainUrl,
  elapsed,
  events,
  onRetry,
}: {
  busy: boolean
  err: string | null
  brainUrl: string
  elapsed: number
  events: Json[]
  onRetry: () => void
}) {
  const lastEvent = events[events.length - 1]
  const stage = String(lastEvent?.stage ?? lastEvent?.type ?? (busy ? 'connecting' : err ? 'error' : 'idle'))
  const stageRank: Record<string, number> = {
    connecting: 0,
    received: 1,
    vision: 1,
    vision_done: 1,
    intake: 1,
    intake_done: 1,
    planning: 2,
    planning_done: 2,
    verify: 3,
    verify_done: 3,
    rationale: 3,
  }
  const activeStep = stageRank[stage] ?? (busy ? 0 : 1)
  const status =
    err
      ? 'Analysis stopped before a verified plan was produced.'
      : !busy
        ? 'Analysis is idle.'
        : events.length === 0
          ? elapsed > 8
            ? 'Connected request is still waiting for the brain service to emit its first streaming event.'
            : 'Connecting to the streaming brain endpoint.'
          : String(lastEvent?.message ?? 'Working through the brain pipeline.')

  return (
    <div style={{ ...card, borderColor: busy ? 'var(--accent)' : err ? 'var(--warn)' : 'var(--line)' }}>
      <Label n="01">Analyzing factory context</Label>
      <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
        {busy ? 'The brain is running now.' : 'Analysis did not finish.'}
      </h2>
      <p style={{ margin: '0 0 16px', color: 'var(--muted)', lineHeight: 1.55, maxWidth: 700 }}>
        This screen should move as the backend streams events. If it stays on “connecting,” the brain service is not emitting or the request is blocked before intake starts.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: mono, fontSize: 12, color: busy ? 'var(--accent)' : err ? 'var(--warn)' : 'var(--muted)' }}>
          {busy ? 'LIVE' : err ? 'ERROR' : 'IDLE'} · {elapsed}s · {stage}
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)' }}>{brainUrl}/plan_from_input_stream</div>
      </div>
      <div className="thinking-steps">
        <div className={`thinking-step ${activeStep >= 1 ? 'on' : ''}`}>
          <span>1</span>
          <strong>Read operating context</strong>
          <small>Extract knobs from the brief/files, then generate a bounded synthetic scenario for the scheduler.</small>
        </div>
        <div className={`thinking-step ${activeStep >= 2 ? 'on' : ''}`}>
          <span>2</span>
          <strong>Planner pass</strong>
          <small>Fireworks is used when configured; otherwise the deterministic planner is shown as fallback.</small>
        </div>
        <div className={`thinking-step ${activeStep >= 3 ? 'on' : ''}`}>
          <span>3</span>
          <strong>Verifier + repair</strong>
          <small>Hard constraints are checked and repaired before anything is marked runnable.</small>
        </div>
      </div>
      {busy && (
        <div style={{ marginTop: 16, color: 'var(--accent)', fontFamily: mono, fontSize: 12 }}>
          {status}
        </div>
      )}
      {(events.length > 0 || busy) && (
        <div className="stream-log" aria-label="Live analysis log">
          {events.length === 0 && (
            <div className="stream-row">
              <span>connecting</span>
              <p>Waiting for the first streamed event from the brain service.</p>
            </div>
          )}
          {events.map((ev, i) => (
            <div key={`${ev.stage ?? ev.type}-${i}`} className="stream-row">
              <span>{String(ev.stage ?? ev.type ?? 'event')}</span>
              <p>
                {String(ev.message ?? '')}
                {ev.data?.method && <small style={{ display: 'block', marginTop: 4, color: 'var(--muted)', fontFamily: mono }}>method: {String(ev.data.method)}</small>}
                {ev.data?.note && <small style={{ display: 'block', marginTop: 3, color: 'var(--muted)' }}>{String(ev.data.note)}</small>}
              </p>
            </div>
          ))}
        </div>
      )}
      {err && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: 'var(--warn)', fontFamily: mono, fontSize: 12.5, marginBottom: 10 }}>{err}</div>
          <button className="btn" onClick={onRetry}>Retry analysis</button>
        </div>
      )}
    </div>
  )
}

function ReasoningPanel({ live }: { live: Json }) {
  const reasoning = live.reasoning ?? {}
  const planner = live.planner ?? {}
  const observations: string[] = Array.isArray(reasoning.observations) ? reasoning.observations : []
  const assumptions: string[] = Array.isArray(reasoning.assumptions) ? reasoning.assumptions : []
  const plan: string[] = Array.isArray(reasoning.plan) ? reasoning.plan : []
  const risks: string[] = Array.isArray(reasoning.risks) ? reasoning.risks : []
  if (![...observations, ...assumptions, ...plan, ...risks].length) return null
  const rows = [
    ['Planner', planner.actual === 'fireworks' ? 'Fireworks' : planner.actual ?? 'deterministic'],
    ['Requested', planner.requested ?? 'fireworks'],
    ['Model', planner.model ?? 'fallback'],
    ['Intake', live.intake?.source ?? 'compiled'],
  ]
  return (
    <div style={{ ...card, borderColor: planner.actual === 'fireworks' ? 'var(--accent)' : 'var(--warn)' }}>
      <Label n="00">Planner rationale</Label>
      <div className="reasoning-grid">
        <div>
          <div className="panel-kicker">Operator-facing rationale</div>
          {[...observations, ...assumptions].slice(0, 5).map((item, i) => (
            <p key={i} className="reasoning-line">{item}</p>
          ))}
        </div>
        <div>
          <div className="panel-kicker">Plan of attack</div>
          {plan.slice(0, 4).map((item, i) => (
            <p key={i} className="reasoning-line">{item}</p>
          ))}
          {risks.slice(0, 2).map((item, i) => (
            <p key={`risk-${i}`} className="reasoning-line warn">{item}</p>
          ))}
        </div>
        <dl className="reasoning-meta">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function CompiledScenarioCard({ live, fs, n }: { live: Json; fs: Json; n: string }) {
  const warehouse = isWarehouseFixture(live)
  const layout = live.intake?.layout ?? {}
  const provenance = live.intake?.provenance ?? {}
  const jobSource = live.intake?.job_source ?? live.job_source
  if (warehouse) {
    const fields = [
      ['Aisles', layout.aisles],
      ['Docks', layout.docks],
      ['Staging lanes', layout.staging_lanes],
      ['Robots', layout.robots],
      ['No-go zones', layout.no_go_zones],
      ['Orders', jobSource?.n_orders ?? live.intake?.n_jobs ?? fs.jobs?.length],
      ['Order lines', jobSource?.n_order_lines],
      ['Source', jobSource?.source?.toUpperCase()],
    ]
    return (
      <div style={card}>
        <Label n={n}>Warehouse benchmark fixture · Staer-style layout</Label>
        {live.intake?.scenario && <p style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: 13, lineHeight: 1.55 }}>{live.intake.scenario}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {fields.map(([k, v]) => <Chip key={String(k)}>{k}: {v ?? '?'}</Chip>)}
        </div>
        <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
          Current simulator backend: {jobSource?.summary ?? 'warehouse jobs are compiled onto ShiftBench symbolic scheduling.'} The internal resource names below are simulator handles for the adapter.
        </p>
        <div>{(fs.machines ?? []).map((mm: Json) => <Chip key={mm.id}>{mm.id} · resource type {mm.capabilities?.join('/')}</Chip>)}</div>
        <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)', margin: '10px 0 4px' }}>sample simulated task deadlines</div>
        <div>{(fs.jobs ?? []).slice(0, 8).map((j: Json) => <Chip key={j.id}>{j.id} · due d{j.due_day}</Chip>)}</div>
        {provenance.dataset && (
          <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontFamily: mono, fontSize: 11, lineHeight: 1.45 }}>
            Provenance: {provenance.dataset}. {provenance.note}
          </p>
        )}
      </div>
    )
  }
  return (
    <div style={card}>
      <Label n={n}>{`Compiled symbolic scenario · ${live.intake?.industry} · ${live.intake?.n_jobs} jobs`}</Label>
      {live.intake?.vision_caption && <p style={{ margin: '0 0 8px', color: 'var(--accent)', fontFamily: mono, fontSize: 12, lineHeight: 1.5 }}>vision: {live.intake.vision_caption}</p>}
      <div>{(fs.machines ?? []).map((mm: Json) => <Chip key={mm.id}>{mm.id} · {mm.capabilities?.join('/')}</Chip>)}</div>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)', margin: '10px 0 4px' }}>jobs</div>
      <div>{(fs.jobs ?? []).slice(0, 8).map((j: Json) => <Chip key={j.id}>{j.id} · due d{j.due_day}</Chip>)}</div>
    </div>
  )
}

function shortLocation(loc: string, pickLabel?: string) {
  if (pickLabel) return pickLabel
  let slug = String(loc).replace(/^plan-\d+-/, '')
  const m = slug.match(/^(.*)-(\d{1,4})$/)
  if (!m) return slug.replace(/-/g, ' ')
  const tokens = m[1].split('-').filter(Boolean)
  const deduped: string[] = []
  for (const t of tokens) {
    if (!deduped.length || deduped[deduped.length - 1] !== t) deduped.push(t)
  }
  const num = parseInt(m[2], 10)
  const label = deduped.join(' ')
  return Number.isFinite(num) ? `${label} #${num}` : label
}

function shortStation(st: string) {
  const s = String(st)
  const m = s.match(/-(dock|bench|station|gate)-([\w-]+)-(\d+)$/) ?? s.match(/-([\w-]+)-(\d+)$/)
  if (m) return `${m[1].replace(/-/g, ' ')} · ${m[m.length - 1]}`
  return s.split('-').slice(-2).join(' ')
}

const JOB_FAMILY_TONE: Record<string, string> = {
  inbound_to_staging: '#3f5fe0',
  bulk_break_forward_pick: '#c47a12',
  outbound_dock_wave: '#1a8f5a',
  pick_pack_order: '#3f5fe0',
  sort_carrier_stage: '#7c5cdb',
  charger_replenishment: '#0891b2',
  returns_inspection: '#b45309',
  repack_restock: '#6366f1',
  kitting_packout: '#059669',
  scrap_hold: '#dc2626',
  cold_room_packout: '#0284c7',
  scan_quarantine: '#d97706',
  maintenance_bypass_move: '#64748b',
}

function JobRouteIllustration({ job }: { job: Json }) {
  const lines = (job.lines ?? []) as Json[]
  const accent = JOB_FAMILY_TONE[String(job.family)] ?? '#3f5fe0'
  const src = lines[0] ? shortLocation(String(lines[0].source_location), String(lines[0].pick_label || '')) : '—'
  const tgt = shortStation(String(job.target_station ?? ''))
  const route = String(job.route_constraint ?? 'direct')
  const pri = Number(job.priority ?? 2)
  const relHr = Number(job.release_time ?? 0)
  const dueHr = Number(job.due_time ?? 0)
  const arrowId = `arr-${String(job.job_id).replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <div>
      <svg viewBox="0 0 440 96" width="100%" height="96" role="img" aria-label={`${job.job_id} route from ${src} to ${tgt}`} style={{ display: 'block' }}>
        <defs>
          <marker id={arrowId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={accent} />
          </marker>
        </defs>
        <rect x="0" y="0" width="440" height="96" rx="8" fill="var(--bg)" stroke="var(--line)" />
        <text x="12" y="16" fontFamily="var(--font-display)" fontSize="11" fontWeight="800" fill="var(--text)">{job.job_id}</text>
        <text x="12" y="30" fontFamily="ui-monospace, monospace" fontSize="9" fill="var(--muted)">
          {String(job.family).replace(/_/g, ' ')} · P{pri} · hr {relHr}→{dueHr}
        </text>
        <rect x="10" y="38" width="120" height="50" rx="6" fill="color-mix(in srgb, var(--panel) 92%, transparent)" stroke={accent} strokeWidth="1.5" />
        <text x="18" y="52" fontFamily="ui-monospace, monospace" fontSize="8" fill="var(--muted)" letterSpacing="0.06em">SOURCE</text>
        <text x="18" y="66" fontFamily="ui-monospace, monospace" fontSize="9" fill="var(--text)">{src.length > 22 ? src.slice(0, 20) + '…' : src}</text>
        <text x="18" y="80" fontFamily="ui-monospace, monospace" fontSize="8" fill="var(--muted)">{lines.length} line{lines.length === 1 ? '' : 's'}</text>
        <path d="M 136 63 H 172" stroke={accent} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
        <rect x="180" y="38" width="120" height="50" rx="6" fill="color-mix(in srgb, var(--panel) 92%, transparent)" stroke="var(--line)" />
        <text x="188" y="52" fontFamily="ui-monospace, monospace" fontSize="8" fill="var(--muted)" letterSpacing="0.06em">ROUTE</text>
        <text x="188" y="66" fontFamily="ui-monospace, monospace" fontSize="8.5" fill="var(--text)">{route.length > 24 ? route.slice(0, 22) + '…' : route}</text>
        <path d="M 306 63 H 342" stroke={accent} strokeWidth="2" markerEnd={`url(#${arrowId})`} />
        <rect x="350" y="38" width="80" height="50" rx="6" fill="color-mix(in srgb, var(--pos) 10%, var(--panel))" stroke="var(--pos)" strokeWidth="1.5" />
        <text x="358" y="52" fontFamily="ui-monospace, monospace" fontSize="8" fill="var(--muted)" letterSpacing="0.06em">STATION</text>
        <text x="358" y="68" fontFamily="ui-monospace, monospace" fontSize="9" fill="var(--text)">{tgt.length > 12 ? tgt.slice(0, 10) + '…' : tgt}</text>
      </svg>
      <div style={{ padding: '6px 10px 8px', borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
        {lines.map((ln: Json, i: number) => (
          <div key={i} style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
            <span style={{ color: accent, fontWeight: 600 }}>{ln.sku_id}</span>
            {' · qty '}{ln.quantity}
            {' · pick @ '}{shortLocation(String(ln.source_location), String(ln.pick_label || ''))}
          </div>
        ))}
      </div>
    </div>
  )
}

function WarehouseJobBoard({ jobSource }: { jobSource: Json }) {
  const prov = String(jobSource.jobs_provenance ?? '')
  const isReal = prov.startsWith('real') || prov.startsWith('example')
  const allJobs = ((jobSource.jobs ?? jobSource.jobs_sample ?? []) as Json[])
  const [showAll, setShowAll] = useState(false)
  if (!isReal) {
    return (
      <div style={{ marginTop: 12, border: '1px dashed var(--line)', borderRadius: 12, padding: 12, background: 'var(--bg)' }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
          Real order pools not loaded for this floor. Run <code style={{ fontFamily: mono, fontSize: 11 }}>space/fetch_job_sources.py</code> to import RAFS/SOAR/ARMBench data.
        </p>
      </div>
    )
  }
  if (!allJobs.length) return null
  const visible = showAll ? allJobs : allJobs.slice(0, 6)
  const srcLabel = jobSource.source?.toUpperCase() ?? 'ORDERS'
  const provLabel = prov.startsWith('example') ? `${prov} (sample — register at armbench.com for full set)` : prov
  return (
    <div style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{srcLabel} orders on this floor</div>
          <p style={{ margin: '4px 0 0', color: 'var(--text)', fontSize: 12.5, lineHeight: 1.5 }}>
            Each card is one imported order: source zone → route constraint → target station. SKU lines are drawn from verified {jobProvenanceLabel(jobSource)} pools — not synthetic.
          </p>
          {jobSource.url && (
            <a href={jobSource.url} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--accent)', display: 'inline-block', marginTop: 6 }}>
              {jobSource.dataset ?? jobSource.url} ↗
            </a>
          )}
        </div>
        <span style={{ fontFamily: mono, fontSize: 9.5, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--pos)', color: 'var(--pos)', whiteSpace: 'nowrap' }}>
          {provLabel} · {jobSource.n_order_lines} lines
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
        {visible.map((job: Json) => (
          <div key={String(job.job_id)} style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--panel)' }}>
            <JobRouteIllustration job={job} />
          </div>
        ))}
      </div>
      {allJobs.length > 6 && (
        <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer orders' : `Show all ${allJobs.length} orders`}
        </button>
      )}
    </div>
  )
}

function WarehouseFixtureReport({ live, n }: { live: Json; n: string }) {
  const layout = live.intake?.layout ?? {}
  const provenance = live.intake?.provenance ?? {}
  const floorplan = live.intake?.floorplan?.file
  const jobSource = live.intake?.job_source ?? live.job_source
  const measuredRun = jobSource?.hud_rollout?.measured
  const [viewerOpen, setViewerOpen] = useState(false)
  const fields = [
    ['Floor plan', jobSource?.floorplan_id],
    ['Job dataset', jobSource?.source?.toUpperCase()],
    ['Order pool', jobProvenanceLabel(jobSource)],
    ['Orders', jobSource?.n_orders],
    ['Order lines', jobSource?.n_order_lines],
    ['SKUs', jobSource?.n_skus],
    ['Aisles', layout.aisles],
    ['Robots', layout.robots],
    ...(measuredRun ? [['Model reward', measuredRun.hud_reward?.toFixed?.(3) ?? measuredRun.hud_reward]] as [string, Json][] : []),
    ...(measuredRun?.grpo?.n_rollouts ? [['Rollouts', measuredRun.grpo.n_rollouts]] as [string, Json][] : []),
  ]
  return (
    <div style={card}>
      <Label n={n}>Staer floor-plan fixture</Label>
      {viewerOpen && floorplan && (
        <FloorPlanViewer
          key={floorplan}
          src={floorplan}
          title={live.intake?.summary ?? 'Warehouse layout'}
          detail={provenance.dataset ?? 'Cached Staer floor-plan fixture'}
          onClose={() => setViewerOpen(false)}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: floorplan ? 'minmax(220px, 0.9fr) minmax(260px, 1.1fr)' : '1fr', gap: 18, alignItems: 'start' }}>
        {floorplan && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'var(--bg)' }}>
            <img src={floorplan} alt={`${live.intake?.summary ?? 'Staer'} floor plan`} style={{ width: '100%', display: 'block' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, padding: 10, borderTop: '1px solid var(--line)' }}>
              <button className="btn primary" type="button" onClick={() => setViewerOpen(true)}>View full floor plan</button>
            </div>
          </div>
        )}
        <div>
          <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.02em' }}>{live.intake?.summary ?? 'Warehouse layout'}</h3>
          {live.intake?.scenario && <p style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: 13.5, lineHeight: 1.55 }}>{live.intake.scenario}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {fields.map(([k, v]) => <Chip key={String(k)}>{k}: {v ?? '—'}</Chip>)}
          </div>
          <RealFloorData jobSource={jobSource} floorId={live.intake?.floorplan?.id} />
          {jobSource && (jobSource.jobs?.length || jobSource.jobs_sample?.length) ? (
            <div style={{ marginTop: 12 }}>
              <WarehouseJobBoard jobSource={jobSource} />
            </div>
          ) : null}
          {measuredRun ? (
            <MeasuredGrpoTable measuredRun={measuredRun} />
          ) : (
            <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
              No model rollouts recorded for this floor yet. Run <code style={{ fontFamily: mono, fontSize: 11 }}>distill/hud_floor_eval.py</code> to attach measured GRPO rewards.
            </p>
          )}
          {provenance.dataset && (
            <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontFamily: mono, fontSize: 11, lineHeight: 1.45 }}>
              Fixture: {provenance.dataset}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Operator behavior: the input the model faced on this floor, how it tackled each
// rollout (measured GRPO group, tied to the active head checkpoint), and the raw ->
// verifier-gated behavior change rolled out in MuJoCo.
function OperatorBehavior({ live, n }: { live: Json; n: string }) {
  const jobSource = live.intake?.job_source ?? live.job_source
  const measuredRun = jobSource?.hud_rollout?.measured
  const studentRollouts: Json[] = jobSource?.hud_rollout?.student_rollouts ?? []
  const modelCandidate = measuredRun?.model_candidate ?? measuredRun?.qwen_candidate
  const labeledModelCandidate = modelCandidate ? { ...modelCandidate, model: modelCandidate.model ?? measuredRun?.model } : undefined
  const secondaryRun = studentRollouts[0]
  const secondaryCandidateRaw = secondaryRun?.model_candidate ?? secondaryRun?.qwen_candidate
  const secondaryHard = Number(secondaryCandidateRaw?.hard_violations ?? secondaryCandidateRaw?.metrics?.n_hard_violations ?? 999)
  const secondarySimOk = Boolean(secondaryCandidateRaw?.ok) && secondaryHard <= 5
  const labeledSecondaryCandidate = secondarySimOk && secondaryCandidateRaw
    ? { ...secondaryCandidateRaw, model: secondaryCandidateRaw.model ?? secondaryRun?.model }
    : undefined
  const naiveHard = live.naive_verdict?.hard_violations
  const hasMujoco = !!live.isaac_tasks
  const hasRollouts = !!(measuredRun || studentRollouts.length)
  if (!hasRollouts && !hasMujoco && !jobSource) return null
  return (
    <div style={{ ...card, borderColor: 'var(--brand)' }}>
      <Label n={n}>Operator behavior — input → model rollouts</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div>
          <RealFloorData jobSource={jobSource} floorId={live.intake?.floorplan?.id} />
          {jobSource?.jobs_sample?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                Sample {String(jobSource.source ?? '').toUpperCase()} orders on this floor
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(jobSource.jobs_sample as Json[]).slice(0, 2).map((job: Json) => (
                  <JobRouteIllustration key={String(job.job_id)} job={job} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          {measuredRun ? (
            <MeasuredGrpoTable measuredRun={measuredRun} />
          ) : (
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--bg)' }}>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
                No measured model rollouts on this floor yet. Run <code style={{ fontFamily: mono, fontSize: 11 }}>distill/hud_floor_eval.py</code> to record real GRPO rewards from the active head.
              </p>
            </div>
          )}
          {studentRollouts.map((studentRun, idx) => (
            <MeasuredGrpoTable key={String(studentRun.model ?? idx)} measuredRun={studentRun} />
          ))}
        </div>
      </div>
      {hasMujoco && live.naive_isaac_tasks && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <ShiftSimulation
            naive={live.naive_isaac_tasks}
            verified={live.isaac_tasks}
            naiveHard={naiveHard}
            modelCandidate={labeledModelCandidate}
            secondaryModelCandidate={labeledSecondaryCandidate}
          />
          {secondaryRun && !secondarySimOk && (
            <div style={{ marginTop: 14, border: '1px solid var(--warn)', borderRadius: 12, padding: 12, background: 'color-mix(in srgb, var(--warn) 8%, var(--bg))' }}>
              <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: 6 }}>
                {String(secondaryRun.model ?? 'Student model')} rollout — not sim-ready
              </div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--muted)' }}>
                {secondaryCandidateRaw?.ok === false
                  ? 'Latest GPT-OSS rollouts did not finish with parseable JSON-only ActionPlan output.'
                  : `Best parseable plan still had ${secondaryHard} verifier hard violations.`}
                {' '}Common cause: using robot/operator IDs like <code style={{ fontFamily: mono }}>R1</code> as <code style={{ fontFamily: mono }}>machine_id</code> instead of real machines <code style={{ fontFamily: mono }}>M1</code>–<code style={{ fontFamily: mono }}>M4</code>. Shaped HUD reward can look high while strict verifier rejects the schedule — see the GRPO table above for HUD reward vs verifier hard per rollout.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type FactoryCeoPanelProps = {
  initial?: BrainInput | null
  initialRun?: Json | null
  onRestart?: () => void
  onRun?: (run: Json) => void
  customerId?: string
  customerName?: string
  taskId?: string
}

export function FactoryCeoPanel({ initial, initialRun, onRestart, onRun }: FactoryCeoPanelProps = {}) {
  const { data: run } = useJson('/factoryceo/run.json')
  const { data: baseline } = useJson('/factoryceo/baseline.json')
  const { data: cannedTasks } = useJson('/factoryceo/isaac_tasks.json')
  const [live, setLive] = useState<Json | null>(() => initialRun ?? null)
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoErr, setAutoErr] = useState<string | null>(null)
  const [autoElapsed, setAutoElapsed] = useState(0)
  const [autoEvents, setAutoEvents] = useState<Json[]>([])
  const [retryNonce, setRetryNonce] = useState(0)
  const [reanalysisInput, setReanalysisInput] = useState<BrainInput | null>(null)
  const [adv, setAdv] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const activeInput = reanalysisInput ?? initial

  // Set the live run and persist it to the current floor (profile store).
  function applyRun(j: Json | null) { setLive(j); if (j) onRun?.(j) }

  // Static library artifacts can be rebuilt while the Studio is already open.
  // Refresh mounted warehouse fixtures in-place so the panel does not keep showing
  // a stale localStorage/React copy of an older HUD rollout.
  useEffect(() => {
    const summary = live?.intake?.summary
    if (!summary || autoBusy) return
    let cancelled = false
    async function refreshStaticFloor() {
      try {
        const catalog = await fetch('/factoryceo/library.json', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null)
        const match = catalog?.floors?.find((row: Json) => row.label === summary)
        if (!match?.id) return
        const latest = await fetch(`/factoryceo/library/${match.id}.json`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null)
        if (!latest || cancelled) return
        const currentMeasured = live?.intake?.job_source?.hud_rollout?.measured ?? live?.job_source?.hud_rollout?.measured
        const latestMeasured = latest?.intake?.job_source?.hud_rollout?.measured ?? latest?.job_source?.hud_rollout?.measured
        const currentSig = JSON.stringify({
          model: currentMeasured?.model,
          reward: currentMeasured?.hud_reward,
          trace: currentMeasured?.model_candidate?.trace_id ?? currentMeasured?.qwen_candidate?.trace_id,
          evidence: currentMeasured?.training_evidence?.source_path,
        })
        const latestSig = JSON.stringify({
          model: latestMeasured?.model,
          reward: latestMeasured?.hud_reward,
          trace: latestMeasured?.model_candidate?.trace_id ?? latestMeasured?.qwen_candidate?.trace_id,
          evidence: latestMeasured?.training_evidence?.source_path,
        })
        if (currentSig !== latestSig) applyRun(latest)
      } catch { /* keep current run */ }
    }
    refreshStaticFloor()
    return () => { cancelled = true }
  }, [live?.intake?.summary, autoBusy])

  // When a floor is opened/compiled, jump to the result so the change is obvious.
  useEffect(() => {
    if (live) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [live])

  // Real backend call on the captured input (messy inputs / video frames).
  useEffect(() => {
    if (initialRun && retryNonce === 0) return
    if (!activeInput || (!activeInput.text && !activeInput.files?.length)) return
    const input = activeInput
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 90_000)
    const startedAt = Date.now()
    const ticker = window.setInterval(() => {
      if (!cancelled) setAutoElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)

    setAutoElapsed(0)
    setAutoEvents([])
    setAutoBusy(true); setAutoErr(null)

    async function run() {
      const response = await fetch(`${BRAIN}/plan_from_input_stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ text: input.text, files: input.files, planner: 'fireworks', return_reasoning: true }),
      })
      if (!response.ok) throw new Error(String(response.status))
      if (!response.body) {
        const fallback = await fetch(`${BRAIN}/plan_from_input`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ text: input.text, files: input.files, planner: 'fireworks', return_reasoning: true }),
        })
        if (!fallback.ok) throw new Error(String(fallback.status))
        applyRun(await fallback.json())
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (!cancelled) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          const line = chunk.split('\n').find((part) => part.startsWith('data: '))
          if (!line) continue
          const ev = JSON.parse(line.slice(6)) as Json
          if (ev.type === 'done') {
            applyRun(ev.result)
            return
          }
          setAutoEvents((prev) => [...prev, ev].slice(-8))
        }
      }
    }

    run()
      .catch((e) => {
        if (cancelled) return
        const timedOut = e?.name === 'AbortError'
        setAutoErr(
          timedOut
            ? `Timed out after 90s waiting for Fireworks + verifier. The brain may still be processing; retry or shorten the operating brief.`
            : `Brain request failed at ${BRAIN}. Check the brain terminal and retry.`,
        )
      })
      .finally(() => {
        window.clearTimeout(timeout)
        window.clearInterval(ticker)
        if (!cancelled) setAutoBusy(false)
      })
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
      window.clearInterval(ticker)
    }
  }, [activeInput, initialRun, retryNonce])

  const ep = live?.episode
  const tasks = live?.isaac_tasks ?? cannedTasks
  const fs = ep?.observation?.factory_state ?? {}
  const m = ep?.verifier_after?.metrics ?? {}
  const hasCapturedInput = !!activeInput && (!!activeInput.text || !!activeInput.files?.length)
  const hasOriginalCapture = !!initial && (!!initial.text || !!initial.files?.length)
  const canReanalyze = !!live && !autoBusy
  const warehouse = isWarehouseFixture(live)

  // ── library-first: no floor open → just the library grid ──
  if (!live) {
    if (hasCapturedInput || autoBusy || autoErr) {
      return (
        <IntakeThinking
          busy={autoBusy}
          err={autoErr}
          brainUrl={BRAIN}
          elapsed={autoElapsed}
          events={autoEvents}
          onRetry={() => setRetryNonce((n) => n + 1)}
        />
      )
    }
    return (
      <div>
        <div style={{ ...card, marginBottom: 18, borderColor: 'var(--brand)' }}>
          <Label n="·">Start with real context</Label>
          <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Upload the factory operating context first.</h2>
          <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 700, fontSize: 14 }}>
            ShiftBench should reason over jobs, machines, staffing, materials, quality, customer commitments, safety constraints, and floor evidence. Samples below are just fixtures for checking the report layout.
          </p>
          {onRestart && <button className="btn primary" style={{ marginTop: 16 }} onClick={onRestart}>Capture my floor</button>}
        </div>
        {autoErr && <div style={{ ...card, color: 'var(--warn)', fontFamily: mono, fontSize: 12.5 }}>{autoErr}</div>}
        <FloorLibrary onResult={applyRun} />
      </div>
    )
  }

  // ── a floor is open → its verified plan ──
  const hard = ep?.verifier_after?.n_hard ?? 0
  const reward = Math.round(ep?.verifier_after?.reward ?? 0)
  const layout = live.intake?.layout ?? {}
  const tiles = warehouse ? [
    { v: layout.aisles ?? '?', l: 'declared aisles', c: 'var(--brand)', big: true },
    { v: layout.docks ?? '?', l: 'declared docks', c: 'var(--text)' },
    { v: layout.staging_lanes ?? '?', l: 'declared staging', c: 'var(--text)' },
    { v: layout.robots ?? '?', l: 'declared robots', c: 'var(--text)' },
    { v: layout.no_go_zones ?? '?', l: 'declared no-go', c: 'var(--warn)' },
    { v: 'config', l: 'layout source', c: 'var(--pos)' },
  ] : [
    { v: reward.toLocaleString(), l: 'reward', c: 'var(--brand)', big: true },
    { v: hard, l: 'hard violations', c: hard === 0 ? 'var(--pos)' : 'var(--neg)' },
    { v: `${Math.round((m.on_time_rate ?? 0) * 100)}%`, l: 'on-time', c: 'var(--text)' },
    { v: Math.round(m.profit ?? 0).toLocaleString(), l: 'profit', c: 'var(--text)' },
    { v: `${Math.round((m.utilization ?? 0) * 100)}%`, l: 'utilization', c: 'var(--text)' },
    { v: m.safety_incidents ?? 0, l: 'safety incidents', c: (m.safety_incidents ?? 0) === 0 ? 'var(--pos)' : 'var(--neg)' },
    { v: `${m.completed_jobs ?? '?'} / ${m.total_jobs ?? '?'}`, l: 'jobs done', c: 'var(--text)' },
  ]
  return (
    <div>
      <div ref={resultRef} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {!initialRun && <button className="btn ghost" onClick={() => setLive(null)}>← Back to library</button>}
        {onRestart && <button className="btn ghost" onClick={onRestart}>{initialRun ? 'Capture another floor' : 'Capture new analysis'}</button>}
        {canReanalyze && (
          <button
            className="btn"
            onClick={() => {
              setReanalysisInput(initial ?? reanalysisInputFromRun(live))
              setLive(null)
              setRetryNonce((n) => n + 1)
            }}
            title={hasOriginalCapture ? 'Run Fireworks again on the original capture.' : 'Run Fireworks from a generated brief based on this open report.'}
          >
            {hasOriginalCapture ? 'Re-analyze original capture' : 'Re-analyze current context'}
          </button>
        )}
      </div>

      {autoBusy && <div style={{ ...card, color: 'var(--accent)', fontFamily: mono, fontSize: 13 }}>▶ Brain compiling…</div>}
      {autoErr && <div style={{ ...card, color: 'var(--warn)', fontFamily: mono, fontSize: 12.5 }}>{autoErr}</div>}
      {initialRun && retryNonce === 0 && (
        <div style={{ ...card, color: 'var(--muted)', fontFamily: mono, fontSize: 12.5 }}>
          {hasOriginalCapture
            ? (warehouse ? 'Loaded cached floor-plan fixture. Fireworks will only run if you choose Re-analyze.' : 'Loaded cached verified run. Fireworks will only run if you choose Re-analyze.')
            : (warehouse ? 'Loaded cached floor-plan fixture. Re-analyze uses a generated brief from this fixture; capture a new analysis for fresh uploaded evidence.' : 'Loaded cached verified run. Re-analyze uses a generated brief from this report; capture a new analysis for fresh uploaded evidence.')}
        </div>
      )}

      <div style={{ ...card, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>{live.intake?.summary ?? live.intake?.industry ?? 'Run report'}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: hard === 0 ? 'var(--pos)' : 'var(--neg)' }}>{warehouse ? 'FLOOR PLAN · fixture' : hard === 0 ? 'VERIFIED · executable' : `${hard} hard violations`}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          {tiles.map((t, i) => (
            <div key={i} style={{ background: 'var(--panel)', padding: '12px 14px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: t.big ? 26 : 20, fontWeight: 800, color: t.c, lineHeight: 1 }}>{t.v}</div>
              <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--muted)', marginTop: 7, textTransform: 'uppercase' }}>{t.l}</div>
            </div>
          ))}
        </div>
      </div>

      {ep && (
        <>
          {warehouse ? (
            <>
              <ArchitectureCard live={live} ep={ep} n="00" />
              <Pipeline n="00a" live={live} defaultTeacher="fireworks" />
              <WarehouseFixtureReport live={live} n="01" />
              <OperatorBehavior live={live} n="02" />
            </>
          ) : (
            <>
              <ArchitectureCard live={live} ep={ep} n="00" />
              <GenerationProvenance live={live} ep={ep} n="00a" />
              <AnalysisBoundary live={live} ep={ep} n="00b" />
              <Pipeline n="00c" live={live} defaultTeacher="fireworks" />
              <ReasoningPanel live={live} />
              <CompiledScenarioCard live={live} fs={fs} n="01" />
          <WhatWasFixed ep={ep} naiveHard={live?.naive_verdict?.hard_violations} n="02" />
              {tasks && <EvidenceAndTraining live={live} ep={ep} tasks={tasks} baseline={baseline} run={run} n="03" />}
            </>
          )}

          {/* everything else is power-user detail, hidden by default for custom runs. */}
          {!warehouse && (
          <div style={{ textAlign: 'center', margin: '6px 0 18px' }}>
            <button className="btn ghost" onClick={() => setAdv((a) => !a)}>
                {adv ? '▾ Hide execution debug' : '▸ Show execution debug — lasso · MuJoCo · 3D queue'}
            </button>
          </div>
          )}
          {!warehouse && adv && (
            <>
              {(fs.machines ?? []).length > 0 && <FloorPlanLasso machines={fs.machines} onResult={applyRun} />}
              {live?.region && <RegionResult region={live.region} />}
              {live?.naive_isaac_tasks && tasks && (live.naive_verdict?.hard_violations ?? 0) > 0 && (
                <BeforeAfter naive={live.naive_isaac_tasks} verified={tasks} naiveHard={live.naive_verdict?.hard_violations ?? 0} n="a1" />
              )}
              {tasks && <MujocoFloor naive={live?.naive_isaac_tasks} verified={tasks} naiveHard={live?.naive_verdict?.hard_violations} n="a2" />}
              {tasks && <FloorScene3D tasks={tasks} n="a3" />}
              {tasks && <Humanoid tasks={tasks} n="a4" />}
            </>
          )}
        </>
      )}
    </div>
  )
}
