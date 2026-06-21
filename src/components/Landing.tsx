// Landing — minimal. Hero + the decision triad + CTA + a 4-step flow. Nothing else.
const FLOW = [
  { n: '01', t: 'Capture the floor', d: 'Video, photos, a stock clip, or a few notes.' },
  { n: '02', t: 'Brain plans, you approve', d: 'Verifier + recursive TRM repair to zero violations.' },
  { n: '03', t: 'Baseline → train', d: 'See where an LLM alone fails; distil a per-task TRM.' },
  { n: '04', t: 'Execute + license', d: 'Humanoid runs the verified plan; you get the evidence.' },
]

export function Landing({ onCreate, onSample }: { onCreate: () => void; onSample: () => void }) {
  return (
    <section className="landing">
      <div className="landing-top">
        <div className="landing-hero">
          <span className="landing-eyebrow">FactoryCEO · verifiable operations brain</span>
          <h1 className="landing-headline">The CEO leaves for two weeks. The brain keeps the floor running, safely.</h1>
          <p className="landing-sub">
            Turn a walkthrough into a verified operations plan: the brain proposes, a deterministic
            verifier decides when each step may <strong>finish</strong>, must <strong>escalate</strong>,
            or must <strong>refuse</strong>, and recursive repair drives it to zero violations before
            anything executes.
          </p>

          <div className="decision-triad" role="img" aria-label="The licensed calls: finish, escalate, refuse">
            <span className="dt-seg dt-finish">Finish</span>
            <span className="dt-seg dt-escalate">Escalate</span>
            <span className="dt-seg dt-refuse">Refuse</span>
          </div>

          <div className="landing-cta">
            <button className="btn primary hero-action" onClick={onCreate}>
              <span aria-hidden="true">↑</span> Describe your floor
            </button>
            <button className="btn ghost" onClick={onSample}>Start from a stock floor</button>
          </div>
          <p className="landing-trust">AI proposes; the deterministic verifier judges. Frames are read locally; nothing is uploaded.</p>
        </div>

        <aside className="hero-video" aria-hidden="true">
          <div className="hv-frame">
            <video src="/vision-film.mp4" autoPlay muted loop playsInline preload="auto" disablePictureInPicture controls={false} />
            <span className="hv-scrim" />
            <span className="hv-tag">Vision film</span>
          </div>
        </aside>
      </div>

      <ol className="flow-bento" aria-label="How it works">
        {FLOW.map((s) => (
          <li key={s.n}>
            <span className="fb-num">{s.n}</span>
            <strong>{s.t}</strong>
            <p>{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
