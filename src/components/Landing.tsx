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
      <div className="landing-top">
        <div className="landing-hero">
          <span className="landing-eyebrow">Autonomy License for Physical AI</span>
          <h1 className="landing-headline">Turn factory footage into a robot safety eval.</h1>
          <p className="landing-sub">
            Upload workflow video, floor plans, SOPs, and forbidden examples. Confirm what the
            system understood, then run a deterministic eval that proves what a robot can safely{' '}
            <strong>finish</strong>, when it must <strong>escalate</strong>, and when it has to{' '}
            <strong>refuse</strong> — and earn the autonomy license for that specific site.
          </p>

          <div className="landing-cta">
            <button className="btn primary hero-action" onClick={onCreate}>
              <span aria-hidden="true">↑</span> Upload workflow video
            </button>
            <button className="btn ghost" onClick={onSample}>
              See sample safety case
            </button>
          </div>

          <div className="landing-domains">
            {DOMAINS.map((d) => (
              <span key={d} className="landing-domain-chip">
                {d}
              </span>
            ))}
          </div>
          <p className="landing-trust">
            Deterministic oracle decides finish / escalate / refuse — never an LLM. Demo captures
            local metadata only; nothing is uploaded or parsed.
          </p>
        </div>

        {/* Product-preview mockup: a media intake console the user can recognize instantly. */}
        <aside className="landing-preview" aria-hidden="true">
          <div className="lp-window">
            <div className="lp-bar">
              <span className="lp-dot" />
              <span className="lp-dot" />
              <span className="lp-dot" />
              <span className="lp-title">Capture · workflow media</span>
            </div>
            <div className="lp-drop">
              <div className="lp-orb">↑</div>
              <div className="lp-drop-title">Upload workflow video</div>
              <div className="lp-drop-sub">MP4 · MOV · WebM · images · PDF</div>
              <div className="lp-btn">Select video or files</div>
              <div className="lp-drive">
                <span className="lp-link">▢ Paste Google Drive link</span>
                <span className="lp-add">Add</span>
              </div>
            </div>
            <div className="lp-cards">
              <span className="lp-file"><span className="lp-ic">▤</span> dad_floor.mp4 · video</span>
              <span className="lp-file"><span className="lp-ic">▦</span> floor_plan.pdf · plan</span>
            </div>
          </div>
        </aside>
      </div>

      <ol className="landing-bento" aria-label="How it works">
        <li><span className="lb-step">1 · Media intake</span><p>Video, photos, floor plan, SOPs, Drive links.</p></li>
        <li className="lb-arrow" aria-hidden="true">→</li>
        <li><span className="lb-step">2 · Understood workflow</span><p>Site map, storyboard, finish/escalate/refuse rules you approve.</p></li>
        <li className="lb-arrow" aria-hidden="true">→</li>
        <li><span className="lb-step">3 · Deterministic oracle</span><p>BFS oracle + hard-gated reward score the agent.</p></li>
        <li className="lb-arrow" aria-hidden="true">→</li>
        <li><span className="lb-step">4 · Safety case</span><p>FAR/FRR, reward-hack trace, evidence pack.</p></li>
      </ol>

      <ol className="landing-steps" aria-label="Workflow stages">
        <li>
          <span className="ls-num">1</span>
          <div>
            <strong>Capture the workflow</strong>
            <p>Upload a video, paste a Drive link, and declare the safety rules for the site.</p>
          </div>
        </li>
        <li>
          <span className="ls-num">2</span>
          <div>
            <strong>Align on understanding</strong>
            <p>Edit the proposed site map, storyboard, and finish/escalate/refuse rules.</p>
          </div>
        </li>
        <li>
          <span className="ls-num">3</span>
          <div>
            <strong>Freeze into a safety case</strong>
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
            unsafe examples, and escalation rules. The current demo captures local metadata only;
            the evaluation remains deterministic.
          </p>
        </div>
        <div className="pilot-grid">
          <div>
            <strong>Customer inputs</strong>
            <span>Outcome, video, Drive links, SOPs, floor plan, unsafe examples.</span>
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
