// Phase 1 landing screen — sells the Physical AI licensing story and routes the
// operator into the intake flow (or the prebuilt sample eval).

const DOMAINS = ['Factories', 'Hospitals', 'Eldercare', 'Warehouses', 'Logistics', 'Labs']

const WHY_NOW = [
  'Robotics bodies are becoming available before most sites know how to license them.',
  'Physical AI mistakes are not bad text outputs; they can injure people or halt operations.',
  'Every site needs proof of when a robot should finish, escalate, or refuse.',
]

const WHY_US = [
  'Deterministic oracle and hard-gated reward, not an LLM judge.',
  'FAR/FRR calibration as the headline safety metric.',
  'Tamper-evident evidence path inherited from the trace console shell.',
]

export function Landing({ onCreate, onSample }: { onCreate: () => void; onSample: () => void }) {
  return (
    <section className="landing">
      <div className="landing-hero">
        <span className="landing-eyebrow">Autonomy License for Physical AI</span>
        <h1 className="landing-headline">
          Before a robot works beside someone you love, it should earn a license.
        </h1>
        <p className="landing-sub">
          The training, evaluation, and certification layer for embodied robots in human spaces.
          We prove what a robot can safely <strong>finish</strong>, when it must{' '}
          <strong>escalate</strong>, and when it has to <strong>refuse</strong> — then issue the
          autonomy license it has earned for a specific environment.
        </p>
        <p className="landing-oneliner">The driving test for Physical AI.</p>

        <div className="landing-domains">
          {DOMAINS.map((d) => (
            <span key={d} className="landing-domain-chip">
              {d}
            </span>
          ))}
        </div>

        <div className="landing-cta">
          <button className="btn primary" onClick={onCreate}>
            <span aria-hidden="true">＋</span> Create Physical AI License Eval
          </button>
          <button className="btn ghost" onClick={onSample}>
            View sample eval
          </button>
        </div>
      </div>

      <ol className="landing-steps" aria-label="How it works">
        <li>
          <span className="ls-num">1</span>
          <div>
            <strong>Describe the outcome</strong>
            <p>“A robot assistant for my dad’s factory.” Pick the domain and robot type.</p>
          </div>
        </li>
        <li>
          <span className="ls-num">2</span>
          <div>
            <strong>We generate a calibrated environment</strong>
            <p>Deterministic tasks, hazards, human-only zones, and a BFS oracle ground truth.</p>
          </div>
        </li>
        <li>
          <span className="ls-num">3</span>
          <div>
            <strong>You get an Autonomy License report</strong>
            <p>FAR/FRR calibration, reward-hacking checks, and what the robot may, must escalate, or must refuse.</p>
          </div>
        </li>
      </ol>

      <div className="landing-market">
        <section className="market-panel">
          <div className="panel-kicker">Why now</div>
          <h2>Robots are leaving demos and entering human spaces.</h2>
          <ul>
            {WHY_NOW.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section className="market-panel">
          <div className="panel-kicker">Why us</div>
          <h2>We make autonomy measurable before it becomes permission.</h2>
          <ul>
            {WHY_US.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="pilot-package">
        <div>
          <div className="panel-kicker">Pilot package</div>
          <h2>What a customer gives us, and what they get back.</h2>
          <p>
            Start with a small workplace slice: the task outcome, robot type, SOPs, floor plan,
            unsafe examples, and escalation rules. The current demo uses placeholders for those
            inputs; the evaluation remains deterministic.
          </p>
        </div>
        <div className="pilot-grid">
          <div>
            <strong>Customer inputs</strong>
            <span>Outcome, domain, embodiment, SOPs, floor plan, unsafe examples.</span>
          </div>
          <div>
            <strong>Eval generated</strong>
            <span>Tasks, hazards, human-only zones, oracle labels, reward gates.</span>
          </div>
          <div>
            <strong>Evidence returned</strong>
            <span>Operating envelope, FAR/FRR, reward-hack trace, Signal Extractor rows.</span>
          </div>
          <div>
            <strong>Next pilot step</strong>
            <span>Run the actual model/robot and persist its trace as license evidence.</span>
          </div>
        </div>
      </section>

      <p className="landing-disclaimer">
        Autonomy License is a readiness evidence pack today, not a regulatory certification
        authority. The wedge is simple: certification can attest controls; we train and measure the
        physical behavior underneath.
      </p>
    </section>
  )
}
