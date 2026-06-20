// Phase 1 landing screen — sells the Physical AI licensing story and routes the
// operator into the intake flow (or the prebuilt sample eval).

const DOMAINS = ['Factories', 'Hospitals', 'Eldercare', 'Warehouses', 'Logistics', 'Labs']

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
    </section>
  )
}
