import { LICENSE_LEVELS } from '../license'
import type { LicenseLevelId, LicenseState } from '../types'

const ORDER: LicenseLevelId[] = ['L0', 'L1', 'L2', 'L3']

interface Props {
  license: LicenseState
}

export function LicenseSummary({ license }: Props) {
  const { level } = license
  return (
    <div className="license-summary" style={{ borderColor: level.color }}>
      <div className="license-headline">
        <div className="license-badge" style={{ background: level.color }}>
          {level.id}
        </div>
        <div className="license-name-block">
          <div className="license-eyebrow">Autonomy license</div>
          <div className="license-name" style={{ color: level.color }}>
            {level.name}
          </div>
        </div>
      </div>

      <p className="license-blurb">{level.blurb}</p>
      <p className="license-permission">{level.permission}</p>

      <div className="license-ladder">
        {ORDER.map((id) => {
          const lvl = LICENSE_LEVELS[id]
          const active = id === level.id
          return (
            <div
              key={id}
              className={`ladder-step ${active ? 'active' : ''}`}
              style={active ? { borderColor: level.color, color: level.color } : undefined}
            >
              <span className="ladder-id">{id}</span>
              <span className="ladder-name">{lvl.name}</span>
            </div>
          )
        })}
      </div>

      <div className="license-stats">
        <div className="stat">
          <span className="stat-num">{license.episodes}</span>
          <span className="stat-label">episodes</span>
        </div>
        <div className="stat">
          <span className="stat-num">{(license.passRate * 100).toFixed(0)}%</span>
          <span className="stat-label">pass rate</span>
        </div>
        <div className="stat">
          <span className="stat-num">{license.avgReward.toFixed(2)}</span>
          <span className="stat-label">avg reward</span>
        </div>
        <div className="stat">
          <span className={`stat-num ${license.catastrophicCount > 0 ? 'danger' : ''}`}>
            {license.catastrophicCount}
          </span>
          <span className="stat-label">catastrophic</span>
        </div>
      </div>

      <p className="license-reason">{license.reason}</p>
    </div>
  )
}
