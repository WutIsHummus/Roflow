/* eslint-disable react/prop-types */
const NAV_ITEMS = [
  {
    id: 'animation',
    label: 'Animation',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="w-5 h-5"
      >
        <path d="M5 3l14 9-14 9V3z" />
      </svg>
    ),
    badge: null
  },
  {
    id: 'modeling',
    label: 'Modeling',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="w-5 h-5"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    badge: null
  },
  {
    id: 'clothing',
    label: 'Clothing',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="w-5 h-5"
      >
        <path d="M8 4l-2 3-3 1 2 5h3v7h8v-7h3l2-5-3-1-2-3-3 2-2-2-2 2-3-2z" />
      </svg>
    ),
    badge: 'New'
  },
  {
    id: 'playground',
    label: 'Playground',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="w-5 h-5"
      >
        <path d="M3 6h18M7 3v6M17 3v6M6 11l3 3-3 3M12 17h6" />
      </svg>
    ),
    badge: 'Beta'
  },
  {
    id: 'ui',
    label: 'UI Studio',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="w-5 h-5"
      >
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M7 8h4M7 12h10M7 16h6" />
      </svg>
    ),
    badge: 'New'
  },
  {
    id: 'sfx',
    label: 'SFX',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="w-5 h-5"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
    badge: 'Soon'
  },
  {
    id: 'vfx',
    label: 'VFX',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="w-5 h-5"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    badge: 'New'
  }
]

export default function Sidebar({ active, onChange }) {
  return (
    <aside
      className="w-[210px] flex flex-col shrink-0"
      style={{ background: '#161921', borderRight: '1px solid #252a36' }}
    >
      {/* Branding */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid #252a36' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#a78bfa,#6d28d9)' }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: '#eef0f6' }}>
              Game Dev Hub
            </p>
            <p className="text-[10px] leading-tight" style={{ color: '#555b6e' }}>
              AI Powered
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p
          className="px-2 pb-2.5 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: '#3e4455' }}
        >
          Modules
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id
          const isDisabled = item.badge === 'Soon'
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onChange(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 10px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: isActive ? '600' : '500',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                border: 'none',
                background: isActive ? 'rgba(167,139,250,0.13)' : 'transparent',
                color: isActive ? '#c4b5fd' : isDisabled ? '#3a3f50' : '#9499a8',
                transition: 'all 0.12s'
              }}
              onMouseEnter={(e) => {
                if (!isActive && !isDisabled) {
                  e.currentTarget.style.background = '#1f2330'
                  e.currentTarget.style.color = '#eef0f6'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive && !isDisabled) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#9499a8'
                }
              }}
            >
              <span style={{ color: isActive ? '#a78bfa' : 'inherit', flexShrink: 0 }}>
                {item.icon}
              </span>
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#1f2330',
                    color: '#3e4455'
                  }}
                >
                  {item.badge}
                </span>
              )}
              {isActive && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#a78bfa',
                    flexShrink: 0
                  }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid #252a36' }}>
        <p className="text-[10px]" style={{ color: '#3e4455' }}>
          v1.0.0 · Roblox Game Dev
        </p>
      </div>
    </aside>
  )
}
