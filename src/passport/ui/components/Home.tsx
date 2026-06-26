import { useCallback, useState } from 'react'
import type { ScenarioSpec } from '../../scenarios/types'
import { SCENARIOS, SECONDARY_USE_CASES, getScenario } from '../../scenarios'
import { IntentParser } from '../../engine/intentParser'
import { useVoiceInput } from '../useVoiceInput'

const PILLARS = [
  { k: 'AI security', d: 'Agents operate inside bounded, testable, fail-closed systems.' },
  { k: 'Agent security', d: 'Every action is tied to identity, scope, policy, and revocation.' },
  { k: 'Governance', d: 'Intent, permissions, approvals, denials, and residual risk are explicit and auditable.' },
  { k: 'Trust', d: 'You can understand, approve, inspect, and revoke what agents do on your behalf.' },
  { k: 'Safe deployment', d: 'Powerful workflows without silent overreach, credential exposure, or runaway spend.' },
]

const SPONSORS = [
  { role: 'Voice', name: 'VoiceCursor', note: 'speak your intent' },
  { role: 'Wallet', name: 'Snaplii', note: 'scoped, real payments' },
  { role: 'Inference', name: 'GMI Cloud', note: 'the agent’s brain' },
]

export function Home({ onRun }: { onRun: (s: ScenarioSpec) => void }) {
  const [text, setText] = useState('')
  const matched = text.trim() ? IntentParser.match(text, SCENARIOS) : null

  // Speak → match → run. (Web Speech today; GMI-backed classification once keys land.)
  const route = useCallback((t: string) => {
    const m = IntentParser.match(t, SCENARIOS)
    if (m) onRun(m)
  }, [onRun])
  const voice = useVoiceInput((t) => { setText(t); route(t) })
  // While listening, show the live interim transcript; otherwise the typed/settled text.
  const shown = voice.listening ? voice.transcript : text

  return (
    <div className="pp-home">
      <section className="pp-hero">
        <div className="pp-hero-pill">
          <span className="pp-hero-dot" /> Local demo · real wallet, scoped · secrets never exposed
        </div>
        <h1 className="pp-hero-title">Capability is not permission.</h1>
        <p className="pp-hero-lede">
          Passport is the control plane for <b>delegated autonomy</b>. You declare intent — by voice. The agent
          proposes a plan. Passport issues a <b>scoped, revocable</b> grant. Tools run only within bounds, every
          purchase needs your approval, and every action leaves a trace.
        </p>
        <p className="pp-hero-founder">
          We’re building Passport because the next platform shift isn’t smarter agents — it’s <b>agents you can
          trust to act</b>. Identity-bound, policy-governed, user-authorized, auditable, revocable.
        </p>
      </section>

      <section className="pp-funnel">
        <div className="pp-funnel-label">Speak what you want — your agent does the rest</div>
        <div className={`pp-voice ${voice.listening ? 'pp-voice-on' : ''}`}>
          <button
            className={`pp-mic ${voice.listening ? 'pp-mic-on' : ''}`}
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            aria-pressed={voice.listening}
            aria-label={voice.listening ? 'Stop listening' : 'Start voice input'}
            disabled={!voice.supported}
            title={voice.supported ? 'Hold a thought and speak' : 'Voice not supported here — type instead'}
          >
            {voice.listening ? <span className="pp-mic-wave"><i /><i /><i /><i /></span> : '🎙'}
          </button>
          <div className="pp-voice-body">
            <input
              id="pp-req"
              className="pp-request-input"
              placeholder={voice.listening ? 'Listening… speak now' : 'e.g. Plan me a FIFA catch-up night and order my usual DoorDash…'}
              value={shown}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && matched) onRun(matched) }}
            />
            <div className="pp-voice-sub">
              {voice.error
                ? <span className="pp-voice-err">{voice.error}</span>
                : voice.listening
                  ? <span className="pp-voice-live"><span className="pp-hero-dot" /> Listening…</span>
                  : matched
                    ? <>Heard you — matched <b>{matched.title}</b>. Press <b>Run</b> or Enter.</>
                    : <>Try “airport pickup”, “FIFA night + DoorDash”, or “fill my night”.</>}
            </div>
          </div>
          <button className="pp-btn pp-btn-primary pp-run-btn" disabled={!matched} onClick={() => matched && onRun(matched)}>
            {matched ? `Run “${matched.title}”` : 'Run'}
          </button>
        </div>
        <div className="pp-voice-cursor">
          🖱 Prefer to dictate? <b>VoiceCursor</b> types straight into this box on Mac, Windows, iOS &amp; Android — speak anywhere.
        </div>
      </section>

      <section className="pp-scenarios">
        <div className="pp-funnel-label pp-scenarios-label">Or start from an example</div>
        <div className="pp-scenario-grid">
          {SCENARIOS.map((s, i) => (
            <button key={s.id} className="pp-scenario-card" onClick={() => onRun(s)}>
              <span className="pp-scenario-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="pp-scenario-title">{s.title}</span>
              <span className="pp-scenario-tag">{s.tagline}</span>
              <span className="pp-scenario-prompt">“{s.prompt.slice(0, 110)}…”</span>
              <span className="pp-scenario-cta">Run scenario →</span>
            </button>
          ))}
        </div>
      </section>

      <section className="pp-sponsors">
        <span className="pp-sponsors-label">Powered by</span>
        <div className="pp-sponsor-row">
          {SPONSORS.map((s) => (
            <div key={s.name} className="pp-sponsor">
              <span className="pp-sponsor-role">{s.role}</span>
              <span className="pp-sponsor-name">{s.name}</span>
              <span className="pp-sponsor-note">{s.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pp-pillars">
        <div className="pp-kicker">Why Passport advances the infrastructure for safe agent adoption</div>
        <div className="pp-pillar-grid">
          {PILLARS.map((p) => (
            <div key={p.k} className="pp-pillar">
              <b>{p.k}</b>
              <span>{p.d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pp-usecases">
        <div className="pp-kicker">More flows Passport governs</div>
        <div className="pp-usecase-grid">
          {SECONDARY_USE_CASES.map((u) => {
            const target = u.maps_to && u.maps_to !== 'any' ? getScenario(u.maps_to) : null
            return (
              <div key={u.id} className="pp-usecase">
                <div className="pp-usecase-head">
                  <b>{u.title}</b>
                  <span className={`pp-usecase-badge pp-usecase-${u.status}`}>{u.status === 'live' ? 'in a live scenario' : 'card'}</span>
                </div>
                <p className="pp-usecase-prompt">“{u.prompt}”</p>
                <div className="pp-usecase-safety">🛡 {u.safety_angle}</div>
                {target && (
                  <button className="pp-usecase-link" onClick={() => onRun(target)}>
                    See it in “{target.title}” →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
