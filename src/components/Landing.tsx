// Landing — two choices: upload your floor, or pick a pre-existing one. Nothing else.
export function Landing({ onCreate, onSample }: { onCreate: () => void; onSample: () => void }) {
  return (
    <section className="landing">
      <div className="landing-top">
        <div className="landing-hero">
          <span className="landing-eyebrow">FactoryCEO · verifiable operations brain</span>
          <h1 className="landing-headline">Pick a floor. The brain runs it, safely.</h1>

          <div className="landing-cta">
            <button className="btn primary hero-action" onClick={onCreate}>
              <span aria-hidden="true">▦</span> Choose from the library
            </button>
            <button className="btn ghost" onClick={onSample}>
              <span aria-hidden="true">↑</span> Upload your floor plan
            </button>
          </div>
        </div>

        <aside className="hero-video" aria-hidden="true">
          <div className="hv-frame">
            <video src="/vision-film.mp4" autoPlay muted loop playsInline preload="auto" disablePictureInPicture controls={false} />
            <span className="hv-scrim" />
            <span className="hv-tag">Vision film</span>
          </div>
        </aside>
      </div>
    </section>
  )
}
