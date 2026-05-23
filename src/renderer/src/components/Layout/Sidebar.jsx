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
    badge: null
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
      className="w-[210px] flex flex-col shrink-0 z-20"
      style={{
        background: 'rgba(12, 14, 21, 0.55)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '4px 0 30px rgba(0,0,0,0.2)'
      }}
    >
      {/* Branding */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
            style={{ background: 'linear-gradient(135deg,#a78bfa,#6d28d9)' }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight tracking-wide" style={{ color: '#eef0f6' }}>
              RoFlow
            </p>
            <p className="text-[10px] font-semibold tracking-wider uppercase leading-tight mt-0.5" style={{ color: '#a78bfa', opacity: 0.8 }}>
              AI Powered
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p
          className="px-2 pb-2.5 text-[9px] font-bold uppercase tracking-widest"
          style={{ color: '#64748b' }}
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
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: isActive ? '600' : '500',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                border: isActive ? '1px solid rgba(167,139,250,0.25)' : '1px solid transparent',
                background: isActive ? 'linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(109,40,217,0.05) 100%)' : 'transparent',
                color: isActive ? '#c4b5fd' : isDisabled ? '#475569' : '#94a3b8',
                boxShadow: isActive ? '0 4px 12px rgba(167,139,250,0.1), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                if (!isActive && !isDisabled) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
                  e.currentTarget.style.color = '#eef0f6'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive && !isDisabled) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.color = '#94a3b8'
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
                    fontSize: '8px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 5px',
                    borderRadius: '5px',
                    background: isActive ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: isActive ? '#c4b5fd' : '#475569'
                  }}
                >
                  {item.badge}
                </span>
              )}
              {isActive && (
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#a78bfa',
                    boxShadow: '0 0 8px #a78bfa',
                    flexShrink: 0
                  }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="px-3 pb-3">
        <button
          onClick={() => onChange('settings')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: active === 'settings' ? '600' : '500',
            cursor: 'pointer',
            border: active === 'settings' ? '1px solid rgba(167,139,250,0.25)' : '1px solid transparent',
            background: active === 'settings' ? 'linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(109,40,217,0.05) 100%)' : 'transparent',
            color: active === 'settings' ? '#c4b5fd' : '#94a3b8',
            boxShadow: active === 'settings' ? '0 4px 12px rgba(167,139,250,0.1), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseEnter={(e) => {
            if (active !== 'settings') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
              e.currentTarget.style.color = '#eef0f6'
            }
          }}
          onMouseLeave={(e) => {
            if (active !== 'settings') {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
              e.currentTarget.style.color = '#94a3b8'
            }
          }}
        >
          <span style={{ color: active === 'settings' ? '#a78bfa' : 'inherit', flexShrink: 0 }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-5 h-5"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </span>
          <span style={{ flex: 1, textAlign: 'left' }}>Settings</span>
          {active === 'settings' && (
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#a78bfa',
                boxShadow: '0 0 8px #a78bfa',
                flexShrink: 0
              }}
            />
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[9px] font-bold tracking-wider uppercase" style={{ color: '#475569' }}>
          v1.0.0 · Roblox Dev
        </p>
      </div>
    </aside>
  )
}
