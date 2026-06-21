// Landing — operator-first entry point for ShiftBench.
export function Landing({ onCreate, onSample }: { onCreate: () => void; onSample: () => void }) {
  return (
    <section className="landing">
      <div className="landing-top">
        <div className="landing-hero">
          <span className="landing-eyebrow">ShiftBench · verified factory operations</span>
          <h1 className="landing-headline">Turn messy factory context into a verified operating plan.</h1>
          <p className="landing-sub">
            Built for supervisors and operators: upload floor evidence, orders, machine status, staffing,
            SOPs, and constraints. The brain proposes operations decisions, then the verifier checks them
            before anything runs.
          </p>

          <div className="landing-cta">
            <button className="btn primary hero-action" onClick={onCreate}>
              Open a sample floor
            </button>
            <button className="btn ghost" onClick={onSample}>
              Capture my floor
            </button>
          </div>
        </div>

        <aside className="hero-video" aria-hidden="true">
          <div className="hv-frame">
            <video src="/vision-film.mp4" autoPlay muted loop playsInline preload="auto" disablePictureInPicture controls={false} />
            <span className="hv-scrim" />
            <span className="hv-tag">Factory floor preview</span>
            <div className="hero-scorecard">
              <span>Verified plan</span>
              <strong>0 hard violations</strong>
              <small>Safety gates pass before execution</small>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
