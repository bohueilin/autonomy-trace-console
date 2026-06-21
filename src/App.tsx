import { useState } from 'react'
import './App.css'
import type { EnvironmentRequirement } from './environmentPlan'
import type { CaptureManifest } from './captureManifest'
import { Landing } from './components/Landing'
import { CaptureConsole } from './components/CaptureConsole'
import { FactoryCeoPanel, type BrainFile, type BrainInput } from './components/FactoryCeoPanel'
import { BenchmarkReport } from './components/BenchmarkReport'
import { ProfileMenu } from './components/ProfileMenu'
import { useFactories } from './factoryStore'

// One simple flow: landing → capture (messy inputs / videos) → studio (the brain
// reasons, plans, you approve, it shows the LLM-alone baseline, the TRM/Gemma it
// trains, the MuJoCo before/after, and actionable feedback to patch the humanoid).
// A separate FactoryBench report page presents the eval. Saved work lives under
// the profile's factories/floors.
type View = 'landing' | 'capture' | 'studio' | 'benchmark'

function App() {
  const fac = useFactories()
  const [view, setView] = useState<View>('landing')
  const [brain, setBrain] = useState<BrainInput | null>(null)

  function deriveBrainInput(req: EnvironmentRequirement, frames: BrainFile[]): BrainInput {
    const text = [req.outcome, req.notes, (req.attachments ?? []).join('; ')].filter(Boolean).join('\n')
    return { text, files: frames }
  }

  function handleCapture(req: EnvironmentRequirement, _cap: CaptureManifest, frames: BrainFile[] = []) {
    const input = deriveBrainInput(req, frames)
    setBrain(input)
    fac.startFloor(req.outcome, input)
    setView('studio')
  }

  function openSavedFloor(factoryId: string, floorId: string) {
    fac.openFloor(factoryId, floorId)
    const f = fac.state.factories.find((x) => x.id === factoryId)
    const fl = f?.floors.find((x) => x.id === floorId)
    setBrain(fl?.brainInput ?? null)
    setView('studio')
  }

  return (
    <div className="console">
      <nav className="appnav">
        <button className="appbrand" onClick={() => setView('landing')} aria-label="FactoryCEO home">
          <span className="appbrand-mark">FC</span>
          <span className="appbrand-text">
            <span className="appbrand-name">FactoryCEO</span>
            <span className="appbrand-sub">verifiable operations brain</span>
          </span>
        </button>
        <div className="appnav-links">
          <button className={`navlink ${view === 'benchmark' ? 'on' : ''}`} onClick={() => setView('benchmark')}>FactoryBench</button>
          <ProfileMenu fac={fac} onOpenFloor={openSavedFloor} onNewFloor={() => setView('capture')} />
          <button className="btn primary navlink-cta" onClick={() => setView('capture')}>New capture</button>
        </div>
      </nav>

      {view === 'landing' && (
        <Landing onCreate={() => setView('capture')} onSample={() => setView('capture')} />
      )}

      {view === 'capture' && (
        <CaptureConsole onAnalyze={handleCapture} onManual={handleCapture} onBack={() => setView('landing')} />
      )}

      {view === 'benchmark' && <BenchmarkReport onBack={() => setView('landing')} />}

      {view === 'studio' && (
        <section className="flow-shell" style={{ paddingTop: 16 }}>
          <FactoryCeoPanel
            initial={brain}
            onRestart={() => setView('capture')}
            onRun={(run) => fac.saveRun(run)}
            customerId={fac.currentFactory?.id}
            customerName={fac.currentFactory?.name}
            taskId={fac.currentFloor?.id}
          />
        </section>
      )}
    </div>
  )
}

export default App
