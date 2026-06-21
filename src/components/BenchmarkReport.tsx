import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

type Json = Record<string, any>

const mono = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const wrap: CSSProperties = { maxWidth: 960, margin: '0 auto', padding: '8px 20px 80px' }
const h2: CSSProperties = { fontFamily: 'var(--font-display)', fontWeight: 850, fontSize: 23, letterSpacing: '-0.02em', margin: '38px 0 8px' }
const kicker: CSSProperties = { fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand)' }
const prose: CSSProperties = { color: 'var(--text)', lineHeight: 1.65, fontSize: 15.5, margin: '0 0 14px' }
const panel: CSSProperties = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14 }
const th: CSSProperties = { textAlign: 'left', padding: '8px 10px', fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--line)' }
const td: CSSProperties = { padding: '9px 10px', fontSize: 13.5, borderBottom: '1px solid var(--line)', verticalAlign: 'top' }

function useStaticJson<T = Json>(path: string) {
  const [d, setD] = useState<T | null>(null)
  useEffect(() => {
    let on = true
    fetch(path)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (on) setD(j) })
      .catch(() => {})
    return () => { on = false }
  }, [path])
  return d
}

function clamp(n: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, n))
}

function jobProvenanceLabel(jobSource?: Json | null) {
  const prov = String(jobSource?.jobs_provenance ?? '')
  if (prov.startsWith('real:')) return prov.replace('real:', '')
  if (prov.startsWith('example:')) return prov.replace('example:', '')
  return prov || '—'
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function scoreColor(kind: 'noRl' | 'withRl' | 'measured') {
  return kind === 'noRl' ? 'var(--warn)' : kind === 'withRl' ? 'var(--pos)' : 'var(--accent)'
}

type ScoreKind = 'noRl' | 'withRl' | 'measured'

function Stat({ label, value, good, muted }: { label: string; value: string; good?: boolean; muted?: boolean }) {
  return (
    <div style={{ flex: '1 1 150px', minWidth: 136, padding: '11px 12px', ...panel }}>
      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 750, color: good ? 'var(--pos)' : muted ? 'var(--muted)' : 'var(--text)' }}>{value}</div>
      <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: mono, fontSize: 11, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)' }}>{children}</span>
}

function Pending() {
  return <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>loading static benchmark artifacts...</div>
}

function ArchitectureFlow() {
  const stages = [
    ['Messy plant context', 'emails · logs · video · voice', 'intake'],
    ['FactoryState', 'canonical machines · operators · jobs', 'state'],
    ['Brain proposes plan', 'quote · schedule · procure · recover', 'brain'],
    ['Verifier + recursive repair', 'hard rules + reward · drives to 0', 'gate'],
    ['Verified plan', '0 hard violations · executable queue', 'gate'],
    ['Execution + perception', 'MuJoCo/Isaac queue · V-JEPA QA', 'execute'],
  ]
  const color = (kind: string) => (
    kind === 'brain' ? 'var(--accent)' :
    kind === 'gate' ? 'var(--warn)' :
    kind === 'execute' || kind === 'intake' ? 'var(--brand)' :
    'var(--line)'
  )
  return (
    <div style={{ ...panel, padding: 16, marginTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(142px, 1fr))', gap: 10 }}>
        {stages.map(([title, sub, kind], i) => (
          <div key={title} style={{ border: `1px solid ${color(kind)}`, borderRadius: 12, padding: '12px 13px', background: kind === 'state' ? 'var(--bg)' : 'var(--panel-2)', minHeight: 78 }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: color(kind), marginBottom: 6 }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, lineHeight: 1.15 }}>{title}</div>
            <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', marginTop: 5, lineHeight: 1.35 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px dashed var(--line)', marginTop: 14, paddingTop: 12 }}>
        <p style={{ ...prose, margin: 0, fontSize: 13.5 }}>
          Offline training uses the same checked path in reverse: Fireworks/seed teachers generate SYNTH proposals,
          the verifier/repair loop converts them into grounded traces, and those traces train TRM/RL students before
          any plan is allowed to execute.
        </p>
      </div>
    </div>
  )
}

function ScoreBars({ summary }: { summary: Json }) {
  const bars: { k: ScoreKind; label: string; score: number | null }[] = [
    { k: 'noRl', label: 'Qwen / LLM without RL (HUD baseline)', score: summary.llmNoRlReward },
    { k: 'withRl', label: 'Qwen / LLM with HUD RL (final checkpoint)', score: summary.llmWithRlReward },
    { k: 'measured', label: 'Active head measured per-floor HUD mean', score: summary.measuredHudReward },
  ]
  return (
    <div style={{ marginTop: 16 }}>
      {bars.map((b) => (
        <div key={b.k} style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 5, gap: 12 }}>
            <span style={{ fontWeight: b.k === 'withRl' ? 800 : 500 }}>{b.label}</span>
            <span style={{ fontFamily: mono, color: b.score == null ? 'var(--muted)' : scoreColor(b.k) }}>{b.score == null ? '—' : b.score.toFixed(4)}</span>
          </div>
          <div style={{ height: 10, background: 'var(--panel-2)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ width: `${clamp(b.score ?? 0) * 100}%`, height: '100%', background: b.score == null ? 'var(--muted)' : scoreColor(b.k) }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function MultiFloorChart({ rows }: { rows: Json[] }) {
  const W = 920, H = 300, padL = 42, padB = 72, padT = 18
  const innerW = W - padL - 12
  const group = innerW / Math.max(1, rows.length)
  const y = (v: number) => padT + (1 - clamp(v)) * (H - padT - padB)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', ...panel }}>
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={W - 12} y2={y(v)} stroke="var(--line)" strokeWidth={0.7} />
          <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">{v.toFixed(2)}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const x0 = padL + i * group + 5
        const bw = Math.max(6, Math.min(13, group / 4))
        const bars: [ScoreKind, number][] = r.hudReward != null ? [['measured', r.hudReward]] : []
        return (
          <g key={r.id}>
            {bars.map(([k, v], j) => {
              const yy = y(v)
              return <rect key={k} x={x0 + j * (bw + 3)} y={yy} width={bw} height={H - padB - yy} rx={2} fill={scoreColor(k)} />
            })}
            <text transform={`translate(${x0 + bw} ${H - 53}) rotate(50)`} fontFamily={mono} fontSize={9.5} fill="var(--muted)">{r.short}</text>
          </g>
        )
      })}
      <text x={padL} y={H - 10} fontFamily={mono} fontSize={10.5} fill="var(--muted)">blue = measured HUD/Qwen reward only; missing bars mean no measured rollout yet</text>
    </svg>
  )
}

function FloorTable({ rows }: { rows: Json[] }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>floor</th>
            <th style={th}>source</th>
            <th style={{ ...th, textAlign: 'right' }}>orders</th>
            <th style={{ ...th, textAlign: 'right' }}>lines</th>
            <th style={{ ...th, textAlign: 'right' }}>rollouts</th>
            <th style={{ ...th, textAlign: 'right' }}>HUD reward</th>
            <th style={{ ...th, textAlign: 'right' }}>best</th>
            <th style={{ ...th, textAlign: 'right' }}>GRPO spread</th>
            <th style={th}>raw model output</th>
            <th style={{ ...th, textAlign: 'right' }}>raw hard</th>
            <th style={{ ...th, textAlign: 'right' }}>verified hard</th>
            <th style={{ ...th, textAlign: 'right' }}>map</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={td}>
                <b>{r.label}</b>
                <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.floorplan} · {r.profile}</div>
              </td>
              <td style={{ ...td, fontFamily: mono, fontSize: 12 }}>{r.source}<div style={{ color: 'var(--muted)', fontSize: 10.5 }}>{r.pool}</div></td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono }}>{r.orders}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono }}>{r.lines}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono }}>{r.measured ? r.rollouts : '—'}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono, color: r.hudReward != null ? 'var(--pos)' : 'var(--muted)' }}>{r.hudReward != null ? r.hudReward.toFixed(3) : '—'}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono }}>{r.bestRollout ?? '—'}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono, color: r.grpoSpread != null ? 'var(--accent)' : 'var(--muted)' }}>{r.grpoSpread != null ? r.grpoSpread.toFixed(3) : '—'}</td>
              <td style={{ ...td, minWidth: 260 }}>
                {r.rawModelOutput ? (
                  <details>
                    <summary style={{ cursor: 'pointer', fontFamily: mono, fontSize: 11, color: 'var(--accent)' }}>
                      {r.rawModelRollout ?? 'rollout'} · {r.rawModelReward != null ? `reward ${r.rawModelReward.toFixed(3)}` : 'raw Qwen output'}
                    </summary>
                    <pre style={{ margin: '8px 0 0', maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: mono, fontSize: 10.5, lineHeight: 1.45, color: 'var(--muted)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                      {r.rawModelOutput}
                    </pre>
                    {r.rawModelTraceUrl && <a href={r.rawModelTraceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, color: 'var(--accent)', fontFamily: mono, fontSize: 10.5 }}>HUD trace ↗</a>}
                  </details>
                ) : (
                  <span style={{ fontFamily: mono, color: 'var(--muted)', fontSize: 11 }}>—</span>
                )}
              </td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono, color: r.rawHard ? 'var(--neg)' : 'var(--pos)' }}>{r.rawHard}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono, color: r.verifiedHard ? 'var(--neg)' : 'var(--pos)' }}>{r.verifiedHard}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono, color: r.coherent ? 'var(--pos)' : 'var(--warn)' }}>{r.coherent ? 'ok' : 'check'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FloorGallery({ rows }: { rows: Json[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginTop: 12 }}>
      {rows.slice(0, 8).map((r) => (
        <div key={r.id} style={{ ...panel, overflow: 'hidden' }}>
          {r.image && <img src={r.image} alt={r.label} style={{ width: '100%', height: 112, objectFit: 'cover', display: 'block', borderBottom: '1px solid var(--line)' }} />}
          <div style={{ padding: 11 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14 }}>{r.label.replace('Staer · ', '')}</div>
            <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>{r.floorplan} · {r.source} · {r.lines} lines</div>
            <div style={{ fontFamily: mono, fontSize: 10.5, color: r.measured ? 'var(--pos)' : 'var(--muted)', marginTop: 4 }}>
              {r.measured ? `HUD ${r.hudReward?.toFixed?.(3) ?? r.hudReward} · ${r.rollouts} rollouts` : 'no measured rollouts yet'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RLChart() {
  const d = useStaticJson('/factoryceo/rl_curve.json')
  if (!d?.curve?.length) return null
  const curve = d.curve
  const eps = curve.map((p: Json) => p.episode)
  const maxEp = Math.max(1, ...eps)
  const profits = curve.map((p: Json) => p.policy_profit)
  const greedy = d.greedy_profit ?? curve[0]?.greedy_profit ?? 0
  const lo = Math.min(greedy, ...profits) * 0.97
  const hi = Math.max(greedy, ...profits) * 1.03
  const W = 900, H = 250, padL = 64, padB = 30, padT = 14
  const x = (e: number) => padL + (e / maxEp) * (W - padL - 14)
  const y = (v: number) => padT + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - padT - padB)
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`)
  const path = curve.map((p: Json, i: number) => `${i ? 'L' : 'M'}${x(p.episode).toFixed(1)} ${y(p.policy_profit).toFixed(1)}`).join(' ')
  const last = curve[curve.length - 1]
  return (
    <div style={{ marginTop: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', ...panel }}>
        {[0, 0.5, 1].map((f) => {
          const v = lo + f * (hi - lo)
          return <g key={f}><line x1={padL} y1={y(v)} x2={W - 14} y2={y(v)} stroke="var(--line)" strokeWidth={0.6} /><text x={padL - 8} y={y(v) + 3} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">{fmt(v)}</text></g>
        })}
        <line x1={padL} y1={y(greedy)} x2={W - 14} y2={y(greedy)} stroke="var(--muted)" strokeWidth={1.4} strokeDasharray="5 4" />
        <text x={W - 16} y={y(greedy) - 6} textAnchor="end" fontFamily={mono} fontSize={11} fill="var(--muted)">greedy {fmt(greedy)}</text>
        <path d={path} fill="none" stroke="var(--pos)" strokeWidth={2.6} />
        <circle cx={x(last.episode)} cy={y(last.policy_profit)} r={4} fill="var(--pos)" />
        <text x={x(last.episode) - 6} y={y(last.policy_profit) - 9} textAnchor="end" fontFamily={mono} fontSize={11} fill="var(--pos)">trained policy {fmt(last.policy_profit)}</text>
        <text x={padL} y={H - 9} fontFamily={mono} fontSize={10} fill="var(--muted)">episode 0</text>
        <text x={W - 14} y={H - 9} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">{maxEp} episodes</text>
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
        <Stat label="single-floor policy lift" value={`+${d.lift_pct ?? 0}%`} good />
        <Stat label="hard violations" value={`${d.final_hard_viol_rate ?? 0}`} />
        <Stat label="training horizon" value={`${d.n_jobs}j · ${d.horizon_days}d`} />
      </div>
    </div>
  )
}

function HudRLNote({ evidence }: { evidence?: Json | null }) {
  if (!evidence) return null
  const phases: Json[] = evidence.steps ?? []
  return (
    <div style={{ ...panel, padding: '13px 15px', marginTop: 14 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Completed HUD TrainingClient run</div>
      <p style={{ ...prose, fontSize: 13.5, margin: 0 }}>
        Model <strong>{evidence.model ?? 'shiftbench-qwen36-27b'}</strong> trained with HUD TrainingClient
        on the saved multi-floor artifact. The compared reward mode is <strong>{evidence.reward_mode_compared ?? 'shaped'}</strong>:
        {' '}baseline <strong>{Number(evidence.baseline_reward ?? 0).toFixed(4)}</strong> → final
        <strong> {Number(evidence.final_reward ?? 0).toFixed(4)}</strong>
        {evidence.lift != null ? <> (lift {Number(evidence.lift) >= 0 ? '+' : ''}{Number(evidence.lift).toFixed(4)})</> : null}.
        This is the LLM-without-RL vs LLM-with-RL comparison; it is separate from verifier repair.
      </p>
      {phases.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {phases.map((p) => (
            <Chip key={String(p.phase)}>
              {p.phase}: {Number(p.baseline_reward ?? 0).toFixed(4)} → {Number(p.final_reward ?? 0).toFixed(4)}
              {p.optim_steps?.length ? ` · optim ${p.optim_steps.join(', ')}` : ''}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function BenchmarkReport({ onBack }: { onBack: () => void }) {
  const lib = useStaticJson('/factoryceo/library.json')
  const floors: Json[] = lib?.floors ?? []
  const trainingEvidence = useMemo(() => {
    for (const f of floors) {
      const ev = f.job_source?.hud_rollout?.measured?.training_evidence
      if (ev) return ev
    }
    return null
  }, [floors])
  const rows = useMemo(() => floors.map((f) => {
    const js = f.job_source ?? {}
    const measured = js.hud_rollout?.measured
    const rewards: number[] = (measured?.grpo?.rollout_rewards ?? []).filter((n: unknown) => typeof n === 'number')
    const hudReward = measured ? Number(measured.hud_reward ?? 0) : null
    const grpoSpread = rewards.length > 1 ? Math.max(...rewards) - Math.min(...rewards) : null
    const samples: Json[] = measured?.grpo?.rollout_samples ?? []
    const bestRollout = measured?.grpo?.best_rollout
    const bestSample = samples.find((s) => s.rollout === bestRollout) ?? samples[0]
    const fallbackSample = measured?.training_evidence?.before_samples?.[0]
    return {
      id: f.id,
      label: f.label,
      short: f.label.replace('Staer · ', '').replace(' ', '\n'),
      image: f.floorplan?.file,
      floorplan: js.floorplan_id ?? f.floorplan?.id,
      profile: js.mapping_profile?.name ?? 'mapped floor',
      source: String(js.source ?? '').toUpperCase(),
      pool: jobProvenanceLabel(js),
      coherent: js.coherence?.ok !== false,
      orders: js.n_orders ?? f.n_jobs,
      lines: js.n_order_lines ?? 0,
      rollouts: measured?.grpo?.n_rollouts ?? rewards.length,
      hudReward,
      bestRollout,
      grpoSpread,
      rawModelRollout: bestSample?.rollout ?? (fallbackSample ? 'training sample' : null),
      rawModelReward: bestSample?.reward != null ? Number(bestSample.reward) : (fallbackSample?.reward != null ? Number(fallbackSample.reward) : null),
      rawModelOutput: bestSample?.response_excerpt ?? fallbackSample?.snippet ?? null,
      rawModelTraceUrl: bestSample?.trace_url,
      rawHard: f.naive_violations ?? 0,
      verifiedHard: f.metrics?.hard_violations ?? 0,
      measured: !!measured,
    }
  }), [floors])

  const summary = useMemo(() => {
    const measuredRewards = rows.map((r) => r.hudReward).filter((n) => typeof n === 'number') as number[]
    const llmNoRlReward = trainingEvidence?.baseline_reward != null ? Number(trainingEvidence.baseline_reward) : null
    const llmWithRlReward = trainingEvidence?.final_reward != null ? Number(trainingEvidence.final_reward) : null
    return {
      llmNoRlReward,
      llmWithRlReward,
      measuredHudReward: measuredRewards.length ? avg(measuredRewards) : null,
      floors: rows.length,
      measuredFloors: rows.filter((r) => r.measured).length,
      orders: rows.reduce((a, r) => a + r.orders, 0),
      lines: rows.reduce((a, r) => a + r.lines, 0),
      rollouts: rows.reduce((a, r) => a + r.rollouts, 0),
      rawHard: rows.reduce((a, r) => a + r.rawHard, 0),
      verifiedHard: rows.reduce((a, r) => a + r.verifiedHard, 0),
      rlLiftPct: llmNoRlReward && llmWithRlReward != null ? (llmWithRlReward / llmNoRlReward - 1) * 100 : null,
      rlLiftAbs: llmNoRlReward != null && llmWithRlReward != null ? llmWithRlReward - llmNoRlReward : null,
      trainingEvidence,
    }
  }, [rows, trainingEvidence])

  return (
    <section style={wrap}>
      <button className="btn ghost back" onClick={onBack} style={{ marginBottom: 18 }}>← Back</button>

      <div style={kicker}>ShiftBench · warehouse floor-plan benchmark</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 36, letterSpacing: '-0.03em', lineHeight: 1.08, margin: '10px 0 16px' }}>
        How much worse are standalone LLMs than verifier-gated students?
      </h1>
      <p style={prose}>
        This report now uses the same Staer/MAPF floor library the product shows: floor-plan fixtures,
        RAFS/SOAR/ARMBench order streams, and mapped floor plans. It separates two real measurements:
        verifier feasibility repair, and HUD/Qwen rollout rewards before vs after RL.
      </p>
      <p style={{ ...prose, color: 'var(--muted)', fontSize: 14 }}>
        The layout details are declared fixture metadata and job-source mappings, not image-extracted
        geometry. The report is honest about that boundary while still benchmarking the planning problem
        the app actually runs.
      </p>

      {!rows.length ? <Pending /> : (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '18px 0' }}>
            <Stat label="floor runs" value={`${summary.floors}`} />
            <Stat label="real/example orders" value={`${summary.orders}`} />
            <Stat label="order lines" value={`${summary.lines}`} />
            <Stat label="measured floors" value={`${summary.measuredFloors}/${summary.floors}`} />
            <Stat label="measured rollouts" value={`${summary.rollouts}`} />
          </div>

          <div style={{ ...kicker, marginTop: 36 }}>01 · Architecture</div>
          <h2 style={h2}>Use the verifier-gated brain architecture, not a standalone LLM</h2>
          <p style={prose}>
            The benchmark is scored around this control loop. The LLM/student is allowed to propose,
            but the deterministic verifier and recursive repair loop are the gate. SYNTH data trains
            the student offline; V-JEPA/MuJoCo sit on the execution QA side, not inside the symbolic score.
          </p>
          <ArchitectureFlow />

          <div style={{ ...kicker, marginTop: 36 }}>02 · Multi-floor result</div>
          <h2 style={h2}>Raw plans fail feasibility; HUD RL is reported separately</h2>
          <p style={prose}>
            Across {summary.floors} warehouse floors, the raw standalone planner accumulates
            <strong> {summary.rawHard} hard violations</strong>. The verifier-gated TRM path repairs to
            <strong> {summary.verifiedHard}</strong>. The Qwen/HUD RL numbers below are not inferred from
            those violations; they come from the completed HUD TrainingClient artifact:
            <strong> {summary.llmNoRlReward?.toFixed?.(4) ?? '—'}</strong> without RL to
            <strong> {summary.llmWithRlReward?.toFixed?.(4) ?? '—'}</strong> after RL.
          </p>
          <ScoreBars summary={summary} />
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
            <Stat label="HUD RL reward delta" value={summary.rlLiftAbs == null ? '—' : `${summary.rlLiftAbs >= 0 ? '+' : ''}${summary.rlLiftAbs.toFixed(4)}`} good={Number(summary.rlLiftAbs ?? 0) >= 0} />
            <Stat label="HUD RL pct delta" value={summary.rlLiftPct == null ? '—' : fmtPct(summary.rlLiftPct)} good={Number(summary.rlLiftPct ?? 0) >= 0} />
            <Stat label="active head HUD mean" value={summary.measuredHudReward == null ? '—' : summary.measuredHudReward.toFixed(4)} />
            <Stat label="standalone hard violations" value={`${summary.rawHard}`} />
            <Stat label="verified hard violations" value={`${summary.verifiedHard}`} good />
          </div>

          <div style={{ ...kicker, marginTop: 36 }}>03 · Floor-plan spread</div>
          <h2 style={h2}>The comparison spans different floor plans, not one cherry-picked run</h2>
          <p style={prose}>
            Each group below is one Staer fixture with its own floor plan, RAFS/SOAR order stream,
            and measured HUD rollouts where available ({summary.measuredFloors}/{summary.floors} floors).
          </p>
          <p style={{ ...prose, color: 'var(--muted)', fontSize: 14 }}>
            Hard-violation repair (raw {summary.rawHard} → verified {summary.verifiedHard}) is real verifier output.
            HUD reward, best rollout, and GRPO spread are shown only when measured via distill/hud_floor_eval.py.
            There are no projected LLM/TRM/RLF scores in this table.
          </p>
          <MultiFloorChart rows={rows} />
          <FloorTable rows={rows} />

          <div style={{ ...kicker, marginTop: 36 }}>04 · What is being optimized</div>
          <h2 style={h2}>RL trains decisions the verifier does not settle</h2>
          <p style={prose}>
            The verifier can prove a plan executable, but it does not magically choose the best dispatch
            order, station balance, failure recovery, or escalation policy. Those are the decisions RLF/RL
            can improve. In the current completed HUD run, the shaped reward was essentially flat:
            {summary.llmNoRlReward != null && summary.llmWithRlReward != null
              ? ` ${summary.llmNoRlReward.toFixed(4)} without RL to ${summary.llmWithRlReward.toFixed(4)} with RL`
              : ' no completed before/after HUD artifact loaded'}
            . The report labels that honestly rather than converting it into a fake win.
          </p>
          <RLChart />
          <HudRLNote evidence={summary.trainingEvidence} />

          <div style={{ ...kicker, marginTop: 36 }}>05 · Corpus</div>
          <h2 style={h2}>Staer/MAPF floor plans plus RAFS/SOAR/ARMBench work</h2>
          <p style={prose}>
            The benchmark corpus is no longer a generic manufacturing paper benchmark. It is the warehouse
            corpus ShiftBench is building: Staer and MAPF floor-plan scenes for spatial context, RAFS/SOAR/ARMBench
            order streams and routing pressure, and HUD-style failures for long-horizon recovery.
          </p>
          <FloorGallery rows={rows} />

          <div style={{ ...kicker, marginTop: 36 }}>06 · Methodology</div>
          <h2 style={h2}>How to read the numbers</h2>
          {[
            ['Raw planner / verifier repair', 'The raw proposal is measured by hard-constraint violations before repair. The verified plan is measured by the same verifier after recursive repair. These are real outputs from the static floor library.'],
            ['LLM without RL', 'The no-RL model number is the baseline_reward from the completed HUD TrainingClient artifact, not a formula derived from hard violations.'],
            ['LLM with RL', 'The RL model number is the final_reward from the same HUD TrainingClient artifact. If it is flat or lower, the report shows that directly.'],
            ['Measured floor HUD reward', 'Per-floor HUD reward, best rollout, and GRPO spread appear only after distill/hud_floor_eval.py. Floors without measured rollouts show —, never projected rewards.'],
            ['Physical grounding boundary', 'Staer images and sampled frames ground the warehouse context. Layout counts and route zones are declared fixture metadata and mappings; they are not yet extracted from image pixels.'],
          ].map(([title, body]) => (
            <div key={title} style={{ marginBottom: 15 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, marginBottom: 3 }}>{title}</div>
              <p style={{ ...prose, margin: 0, fontSize: 14.5 }}>{body}</p>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
