import { useState } from 'react'
import TripoPanel from '../../components/Settings/TripoPanel'
import ProviderSettings from '../../components/Settings/ProviderSettings'

const SECTIONS = [
  { id: 'tripo', label: 'Tripo / 3D Modeling', icon: '⬡' },
  { id: 'providers', label: 'API & Providers', icon: '🔑' }
]

export default function SettingsModule() {
  const [section, setSection] = useState('tripo')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' }}>
      <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #1e2330', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#eef0f6', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#555b6e', marginTop: 4, marginBottom: 16 }}>
          Configure API keys, provider sessions, and generation defaults
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {SECTIONS.map((item) => {
            const active = section === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: active ? '1px solid rgba(124,58,237,0.4)' : '1px solid #252a36',
                  background: active ? 'rgba(124,58,237,0.15)' : '#1a1d26',
                  color: active ? '#c4b5fd' : '#9499a8'
                }}
              >
                {item.icon} {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 640 }}>
          {section === 'tripo' && <TripoPanel />}
          {section === 'providers' && <ProviderSettings />}
        </div>
      </div>
    </div>
  )
}
