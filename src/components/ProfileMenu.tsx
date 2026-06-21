// Profile dropdown in the nav: the user's factories with their nested floors.
// Switch factory, open a saved floor, or add a new factory/floor.
import { useEffect, useRef, useState } from 'react'
import type { FactoriesApi } from '../factoryStore'

export function ProfileMenu({ fac, onOpenFloor, onNewFloor }: {
  fac: FactoriesApi
  onOpenFloor: (factoryId: string, floorId: string) => void
  onNewFloor: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const cur = fac.currentFactory

  function deleteFloor(factoryId: string, floorId: string, floorName: string) {
    const ok = window.confirm(`Delete floor "${floorName}"? This only removes local saved work.`)
    if (!ok) return
    fac.removeFloor(factoryId, floorId)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="navlink" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {(cur?.name?.[0] ?? 'F').toUpperCase()}
          </span>
          {cur?.name ?? 'Profile'} ▾
        </span>
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 300, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 40px rgba(20,24,40,0.16)', padding: 10, zIndex: 50 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', padding: '4px 6px 8px' }}>Factories</div>
          {fac.state.factories.map((f) => (
            <div key={f.id} style={{ marginBottom: 6 }}>
              <div
                onClick={() => fac.selectFactory(f.id)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center', padding: '7px 8px', borderRadius: 8, cursor: 'pointer', background: f.id === cur?.id ? 'var(--panel-2)' : 'transparent' }}
              >
                <span style={{ fontWeight: f.id === cur?.id ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{f.floors.length} floor{f.floors.length === 1 ? '' : 's'}</span>
              </div>
              {f.id === cur?.id && (
                <div style={{ marginLeft: 10, borderLeft: '1px solid var(--line)', paddingLeft: 8, marginTop: 2 }}>
                  {f.floors.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '5px 6px' }}>No floors yet.</div>}
                  {f.floors.map((fl) => (
                    <div key={fl.id} role="menuitem"
                      onClick={() => { onOpenFloor(f.id, fl.id); setOpen(false) }}
                      style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--text)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: fl.verified ? 'var(--pos)' : 'var(--muted)' }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fl.name}</span>
                      {fl.industry && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{fl.industry}</span>}
                      <button
                        type="button"
                        aria-label={`Delete floor ${fl.name}`}
                        title="Delete floor"
                        onClick={(e) => { e.stopPropagation(); deleteFloor(f.id, fl.id, fl.name) }}
                        style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', borderRadius: 7, padding: '3px 7px', fontSize: 11, cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 10 }}>
            <button className="btn primary" style={{ flex: 1 }} onClick={() => { onNewFloor(); setOpen(false) }}>+ Floor</button>
          </div>
        </div>
      )}
    </div>
  )
}
