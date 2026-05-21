import { useState } from 'react'

const ATTACH_POINTS = [
  // Head
  { id: 'HatAttachment',       label: '🎩 Hat (Top of Head)' },
  { id: 'HairAttachment',      label: '💇 Hair (Back of Head)' },
  { id: 'FaceCenterAttachment',label: '👁️ Face Center' },
  { id: 'FaceFrontAttachment', label: '🥸 Face Front' },
  // Upper Torso
  { id: 'NeckAttachment',      label: '🔗 Neck' },
  { id: 'BodyFrontAttachment', label: '🦺 Body Front' },
  { id: 'BodyBackAttachment',  label: '🎒 Body Back' },
  { id: 'LeftCollarAttachment', label: '◀ Left Collar' },
  { id: 'RightCollarAttachment', label: '▶ Right Collar' },
  // Lower Torso
  { id: 'WaistCenterAttachment', label: '🔰 Waist Center' },
  { id: 'WaistFrontAttachment',  label: '⬆ Waist Front' },
  { id: 'WaistBackAttachment',   label: '⬇ Waist Back' },
  // Arms
  { id: 'LeftShoulderAttachment',  label: '◀ Left Shoulder' },
  { id: 'RightShoulderAttachment', label: '▶ Right Shoulder' },
  // Hands
  { id: 'LeftGripAttachment',  label: '✋ Left Grip' },
  { id: 'RightGripAttachment', label: '🤚 Right Grip' },
  // Feet
  { id: 'LeftFootAttachment',  label: '👟 Left Foot' },
  { id: 'RightFootAttachment', label: '👟 Right Foot' },
]

export default function PartsList({ parts, onAdd, onRemove, onGenerate, onPartChange, showAttachPoint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2330', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Parts List</span>
          <span style={{ fontSize: 11, color: '#555b6e', marginLeft: 8 }}>{parts.length} part{parts.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={onAdd}
          style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: '#c4b5fd', cursor: 'pointer' }}
        >
          + Add Part
        </button>
      </div>

      {/* Parts */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {parts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#3e4455' }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.5 }}>⚙</div>
            <p style={{ fontSize: 13, color: '#555b6e' }}>No parts yet</p>
            <p style={{ fontSize: 11, color: '#3e4455', marginTop: 4, lineHeight: 1.6 }}>
              Build assets piece by piece.<br />Example: desk + monitor + keyboard
            </p>
          </div>
        ) : (
          parts.map((part, i) => (
            <PartCard
              key={part.id}
              part={part}
              index={i}
              onRemove={() => onRemove(part.id)}
              onGenerate={() => onGenerate(part.id)}
              onPartChange={(ch) => onPartChange(part.id, ch)}
              showAttachPoint={showAttachPoint}
            />
          ))
        )}
      </div>
    </div>
  )
}

function PartCard({ part, index, onRemove, onGenerate, onPartChange, showAttachPoint }) {
  const [focusPrompt, setFocusPrompt] = useState(false)
  const [focusName, setFocusName] = useState(false)

  const STATUS = {
    pending:    { color: '#555b6e', label: 'Pending' },
    generating: { color: '#f59e0b', label: 'Generating…' },
    done:       { color: '#4ade80', label: 'Done ✓' },
    error:      { color: '#fca5a5', label: 'Error' },
  }
  const st = STATUS[part.status || 'pending']
  const busy = part.status === 'generating'
  const canGen = (part.prompt || '').trim().length > 0 && !busy

  return (
    <div style={{
      background: '#13151c',
      border: '1px solid #1e2330',
      borderLeft: `3px solid ${st.color}`,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    }}>
      {/* Row 1: index + name + status + delete */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#3e4455', minWidth: 18, textAlign: 'center' }}>
          {index + 1}
        </span>
        <input
          value={part.name || ''}
          onChange={e => onPartChange({ name: e.target.value })}
          onFocus={() => setFocusName(true)}
          onBlur={() => setFocusName(false)}
          placeholder="Part name…"
          spellCheck={false}
          style={{
            flex: 1, background: '#0d0f14', border: `1px solid ${focusName ? '#7c3aed' : '#252a36'}`,
            borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#eef0f6',
            outline: 'none', fontFamily: 'inherit', transition: 'border-color .15s',
            boxShadow: focusName ? '0 0 0 3px rgba(124,58,237,0.15)' : 'none',
          }}
        />
        <span style={{
          fontSize: 10, fontWeight: 700, color: st.color,
          padding: '3px 9px', borderRadius: 20,
          background: `${st.color}18`, border: `1px solid ${st.color}30`,
          whiteSpace: 'nowrap', letterSpacing: '0.02em',
        }}>
          {st.label}
        </span>
        <button
          onClick={onRemove}
          style={{ background: 'transparent', border: 'none', color: '#3e4455', cursor: 'pointer', padding: '2px 5px', fontSize: 14, lineHeight: 1, flexShrink: 0, borderRadius: 4, transition: 'color .15s' }}
          title="Remove part"
          onMouseEnter={e => e.target.style.color = '#f87171'}
          onMouseLeave={e => e.target.style.color = '#3e4455'}
        >
          ✕
        </button>
      </div>

      {/* Prompt */}
      <textarea
        value={part.prompt || ''}
        onChange={e => onPartChange({ prompt: e.target.value })}
        onFocus={() => setFocusPrompt(true)}
        onBlur={() => setFocusPrompt(false)}
        placeholder="Describe this part…"
        rows={3}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          width: '100%', background: '#0d0f14', border: `1px solid ${focusPrompt ? '#7c3aed' : '#252a36'}`,
          borderRadius: 8, padding: '9px 11px', fontSize: 12, color: '#c4cad8', resize: 'none',
          outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
          boxShadow: focusPrompt ? '0 0 0 3px rgba(124,58,237,0.15)' : 'none',
          boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s',
        }}
      />

      {/* Attach point selector */}
      {showAttachPoint && (
        <select
          value={part.attachPoint || 'HatAttachment'}
          onChange={e => onPartChange({ attachPoint: e.target.value })}
          style={{
            width: '100%', marginTop: 8, background: '#0d0f14', border: '1px solid #252a36',
            borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#7c8499',
            cursor: 'pointer', outline: 'none', boxSizing: 'border-box',
            appearance: 'none', WebkitAppearance: 'none',
          }}
        >
          {ATTACH_POINTS.map(ap => (
            <option key={ap.id} value={ap.id}>{ap.label}</option>
          ))}
        </select>
      )}

      {/* Error message */}
      {part.status === 'error' && part.error && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#fca5a5', background: 'rgba(248,113,113,0.07)', borderRadius: 6, padding: '6px 10px', lineHeight: 1.5 }}>
          ⚠ {part.error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={!canGen}
        style={{
          width: '100%', marginTop: 10, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: busy ? 'rgba(124,58,237,0.07)'
            : part.status === 'done' ? 'rgba(74,222,128,0.1)'
            : canGen ? 'linear-gradient(135deg,#6d28d9,#8b5cf6)'
            : '#13151c',
          color: busy ? '#6d28d9'
            : part.status === 'done' ? '#4ade80'
            : canGen ? '#fff' : '#3e4455',
          border: busy ? '1px solid rgba(124,58,237,0.25)'
            : part.status === 'done' ? '1px solid rgba(74,222,128,0.2)'
            : canGen ? 'none' : '1px solid #1e2330',
          cursor: canGen ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxSizing: 'border-box', transition: 'opacity .15s',
          letterSpacing: '0.02em',
        }}
      >
        {busy ? <><SmallSpinIcon />Generating…</> : part.status === 'done' ? '↺ Regenerate' : '⚡ Generate Part'}
      </button>
    </div>
  )
}

function SmallSpinIcon() {
  return (
    <svg style={{ animation: 'spin 1s linear infinite', width: 13, height: 13 }} viewBox="0 0 24 24" fill="none">
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
      <path fill="currentColor" fillOpacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
