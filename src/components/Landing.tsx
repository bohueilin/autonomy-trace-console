// Landing — minimal. Hero + the decision triad + CTA + a 4-step flow. Nothing else.
const FLOW = [
  { n: '01', t: 'Open a floor', d: 'Pick a floor from the camera library — already compiled.' },
  { n: '02', t: 'Verifier gates it', d: 'Recursive TRM repair drives it to zero hard violations.' },
  { n: '03', t: 'See what it fixed', d: 'The exact constraints the raw plan broke, now resolved.' },
  { n: '04', t: 'Humanoid runs it', d: 'The optimal, verified actions execute on the floor.' },
]

export function Landing({ onCreate, onSample }: { onCreate: () => void; onSample: () => void }) {
  return (
    <section className="landing">
      <div className="landing-top">
        <div className="landing-hero">
          <span className="landing-eyebrow">FactoryCEO · verifiable operations brain</span>
          <h1 className="landing-headline">The CEO leaves for two weeks. The brain keeps the floor running, safely.</h1>
          <p className="landing-sub">
            Your floors are already streaming from the factory cameras. Open the library: the brain has
            compiled each one, the deterministic verifier drove it to zero violations, and the optimal
            actions are ready to run.
          </p>

          <div className="landing-cta">
            <button className="btn primary hero-action" onClick={onCreate}>
              <span aria-hidden="true">▦</span> Open the floor library
            </button>
            <button className="btn ghost" onClick={onSample}>Describe your own floor</button>
          </div>
          <p className="landing-trust">AI proposes; the deterministic verifier judges. Every floor is pre-verified.</p>
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
