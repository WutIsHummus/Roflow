/* eslint-disable react/prop-types */
import { useState } from 'react'

const OPTIMIZE_PRESETS = [
  { label: 'Light',  ratio: 0.75, desc: '75% — minimal reduction, best quality' },
  { label: 'Medium', ratio: 0.50, desc: '50% — balanced quality/performance' },
  { label: 'Heavy',  ratio: 0.25, desc: '25% — aggressive reduction, game-ready' },
  { label: 'Ultra',  ratio: 0.10, desc: '10% — maximum reduction, lowest poly' },
]

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

const QUICK_PARTS = {
  character: [
    {
      name: 'Hat',
      prompt: 'stylized hat accessory that fits the character',
      attachPoint: 'HatAttachment'
    },
    {
      name: 'Hair',
      prompt: 'stylized hair accessory shaped for the character head',
      attachPoint: 'HairAttachment'
    },
    {
      name: 'Glasses',
      prompt: 'stylized glasses accessory for the character face',
      attachPoint: 'FaceFrontAttachment'
    },
    {
      name: 'Backpack',
      prompt: 'stylized backpack accessory for the character',
      attachPoint: 'BodyBackAttachment'
    }
  ],
  environment: [
    { name: 'Crate', prompt: 'stylized game-ready wooden crate prop' },
    { name: 'Lamp', prompt: 'stylized street lamp prop for the scene' },
    { name: 'Tree', prompt: 'stylized low-poly tree for the environment' },
    { name: 'Rock', prompt: 'stylized rock prop for the environment' }
  ]
}

export default function PartsList({
  activeTab = 'character',
  parts,
  onAdd,
  onRemove,
  onDuplicate,
  onGenerate,
  onPartChange,
  onImportMesh,
  onOptimize,
  showAttachPoint,
  tripoAssets = [],
  onAddTripoAsset,
  showTripoBrowser = false,
  assetBrowserLabel = 'Add',
  emptyAssetHint = 'Generate a model in the app, then import it here.',
  onRefreshAssets,
  assetRefreshState = 'idle',
  assetRefreshMessage = '',
  recentlyRemoved = null,
  onUndoRemove
}) {
  const [showAssets, setShowAssets] = useState(false)
  const quickParts = QUICK_PARTS[activeTab] || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2330', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Parts List</span>
            <span style={{ fontSize: 11, color: '#555b6e', marginLeft: 8 }}>
              {parts.length} part{parts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => onAdd?.()}
              style={{
                background: 'linear-gradient(135deg,#6d28d9,#8b5cf6)',
                border: 'none',
                borderRadius: 7,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              + Blank Part
            </button>
            <button
              onClick={() => onImportMesh?.()}
              style={{
                background: '#12151d',
                border: '1px solid #1e2330',
                borderRadius: 7,
                padding: '7px 10px',
                fontSize: 12,
                fontWeight: 700,
                color: '#9499a8',
                cursor: 'pointer'
              }}
              title="Import a GLB/GLTF/FBX/OBJ mesh directly"
            >
              📂 Import Mesh
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: '#555b6e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Quick add
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {quickParts.map((template) => (
              <button
                key={template.name}
                onClick={() => onAdd?.(template)}
                style={{
                  background: '#12151d',
                  border: '1px solid #1e2330',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#9499a8',
                  cursor: 'pointer'
                }}
              >
                + {template.name}
              </button>
            ))}
          </div>
        </div>

        {recentlyRemoved && (
          <div
            style={{
              marginTop: 10,
              background: 'rgba(248,113,113,0.06)',
              border: '1px solid rgba(248,113,113,0.18)',
              borderRadius: 8,
              padding: '9px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5' }}>Part removed</div>
              <div
                style={{
                  fontSize: 11,
                  color: '#7c8499',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {recentlyRemoved.name || recentlyRemoved.prompt || 'Untitled part'}
              </div>
            </div>
            <button
              onClick={() => onUndoRemove?.()}
              style={{
                flexShrink: 0,
                background: 'rgba(124,58,237,0.18)',
                border: '1px solid rgba(124,58,237,0.35)',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 700,
                color: '#c4b5fd',
                cursor: 'pointer'
              }}
            >
              Undo
            </button>
          </div>
        )}

        {showTripoBrowser && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowAssets((prev) => !prev)}
              style={{
                width: '100%',
                background: showAssets ? 'rgba(124,58,237,0.16)' : '#12151d',
                border: showAssets
                  ? '1px solid rgba(124,58,237,0.35)'
                  : '1px solid #1e2330',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: showAssets ? '#c4b5fd' : '#9499a8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>⬡ Browse Tripo History</span>
              <span style={{ fontSize: 11, color: '#555b6e' }}>
                {tripoAssets.length} available
              </span>
            </button>

            {showAssets && (
              <div
                style={{
                  marginTop: 8,
                  background: '#111318',
                  border: '1px solid #1e2330',
                  borderRadius: 10,
                  padding: 10,
                  maxHeight: 260,
                  overflowY: 'auto'
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <button
                    onClick={() => onRefreshAssets?.()}
                    disabled={assetRefreshState === 'loading'}
                    style={{
                      background: 'rgba(124,58,237,0.18)',
                      border: '1px solid rgba(124,58,237,0.35)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#c4b5fd',
                      cursor: assetRefreshState === 'loading' ? 'wait' : 'pointer'
                    }}
                  >
                    {assetRefreshState === 'loading' ? 'Syncing…' : 'Sync Tripo History'}
                  </button>
                  {assetRefreshMessage && (
                    <span
                      style={{
                        fontSize: 10,
                        color: assetRefreshState === 'error' ? '#fca5a5' : '#7c8499',
                        lineHeight: 1.4
                      }}
                    >
                      {assetRefreshMessage}
                    </span>
                  )}
                </div>

                {tripoAssets.length === 0 ? (
                  <div style={{ padding: '18px 10px', textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                      No Tripo history assets yet
                    </p>
                    <p style={{ fontSize: 11, color: '#3e4455', marginTop: 6, lineHeight: 1.6 }}>
                      {emptyAssetHint}
                    </p>
                  </div>
                ) : (
                  tripoAssets.map((asset) => (
                    <TripoAssetCard
                      key={`${asset.id}-${asset.sourceTab}`}
                      asset={asset}
                      actionLabel={assetBrowserLabel}
                      onAdd={() => onAddTripoAsset?.(asset)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              {quickParts.map((template) => (
                <button
                  key={`empty-${template.name}`}
                  onClick={() => onAdd?.(template)}
                  style={{
                    background: '#12151d',
                    border: '1px solid #1e2330',
                    borderRadius: 999,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#9499a8',
                    cursor: 'pointer'
                  }}
                >
                  Start with {template.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          parts.map((part, i) => (
            <PartCard
              key={part.id}
              part={part}
              index={i}
              onRemove={() => onRemove(part.id)}
              onDuplicate={() => onDuplicate?.(part.id)}
              onGenerate={() => onGenerate(part.id)}
              onPartChange={(ch) => onPartChange(part.id, ch)}
              onOptimize={(ratio) => onOptimize?.(part.id, ratio)}
              showAttachPoint={showAttachPoint}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TripoAssetCard({ asset, onAdd, actionLabel }) {
  const sourceLabel = asset.sourceTab === 'environment' ? 'Environment' : 'Accessories'
  const providerLabel =
    asset.provider === 'tripo-web'
      ? 'Browser Session'
      : asset.provider === 'workspace'
        ? 'Workspace'
        : 'Tripo'

  return (
    <div
      style={{
        background: '#13151c',
        border: '1px solid #1e2330',
        borderRadius: 9,
        padding: 10,
        marginBottom: 8
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#eef0f6',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {asset.name || 'Untitled Tripo Asset'}
          </div>
          <div style={{ fontSize: 10, color: '#555b6e', marginTop: 3 }}>
            {sourceLabel} · {providerLabel}
          </div>
        </div>
        <button
          onClick={onAdd}
          style={{
            flexShrink: 0,
            background: 'rgba(124,58,237,0.18)',
            border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: 6,
            padding: '5px 9px',
            fontSize: 11,
            fontWeight: 700,
            color: '#c4b5fd',
            cursor: 'pointer'
          }}
        >
          {actionLabel}
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#7c8499', lineHeight: 1.5 }}>
        {asset.prompt || 'No prompt saved for this asset.'}
      </div>
    </div>
  )
}

function PartCard({ part, index, onRemove, onDuplicate, onGenerate, onPartChange, onOptimize, showAttachPoint }) {
  const [focusPrompt, setFocusPrompt] = useState(false)
  const [focusName, setFocusName] = useState(false)
  const [imageMode, setImageMode] = useState(Boolean(part.imagePath))
  const [multiviewMode, setMultiviewMode] = useState(Boolean(part.multiviewImages?.some(Boolean)))
  const [optimizePresetIdx, setOptimizePresetIdx] = useState(1)

  const MULTIVIEW_SLOTS = ['Front', 'Back', 'Left', 'Right']

  const STATUS = {
    pending:    { color: '#555b6e', label: 'Pending' },
    generating: { color: '#f59e0b', label: 'Generating…' },
    done:       { color: '#4ade80', label: 'Done ✓' },
    error:      { color: '#fca5a5', label: 'Error' },
  }
  const st = STATUS[part.status || 'pending']
  const busy = part.status === 'generating'
  const hasMultiview = multiviewMode && part.multiviewImages?.some(Boolean)
  const canGen = ((part.prompt || '').trim().length > 0 || Boolean(part.imagePath) || hasMultiview) && !busy

  async function pickReferenceImage() {
    if (!window.api?.openImage) return
    const filePath = await window.api.openImage()
    if (!filePath) return
    onPartChange({ imagePath: filePath })
    setImageMode(true)
  }

  function clearReferenceImage() {
    onPartChange({ imagePath: null })
    if (!(part.prompt || '').trim()) setImageMode(false)
  }

  async function pickMultiviewImage(slotIndex) {
    if (!window.api?.openImage) return
    const filePath = await window.api.openImage()
    if (!filePath) return
    const updated = [...(part.multiviewImages || [null, null, null, null])]
    updated[slotIndex] = filePath
    onPartChange({ multiviewImages: updated })
  }

  function clearMultiviewSlot(slotIndex) {
    const updated = [...(part.multiviewImages || [null, null, null, null])]
    updated[slotIndex] = null
    onPartChange({ multiviewImages: updated })
    if (!updated.some(Boolean) && !(part.prompt || '').trim()) setMultiviewMode(false)
  }

  function toggleImageMode() {
    if (multiviewMode) {
      setMultiviewMode(false)
      onPartChange({ multiviewImages: [] })
    }
    setImageMode(v => !v)
  }

  function toggleMultiviewMode() {
    if (imageMode) {
      setImageMode(false)
      onPartChange({ imagePath: null })
    }
    const next = !multiviewMode
    setMultiviewMode(next)
    if (!next) onPartChange({ multiviewImages: [] })
  }

  return (
    <div style={{
      background: '#13151c',
      border: '1px solid #1e2330',
      borderLeft: `3px solid ${st.color}`,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    }}>
      {/* Row 1: index + name + status + actions */}
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
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={onDuplicate}
            style={{
              background: '#12151d',
              border: '1px solid #1e2330',
              color: '#7c8499',
              cursor: 'pointer',
              padding: '5px 8px',
              fontSize: 11,
              lineHeight: 1,
              borderRadius: 6
            }}
            title="Duplicate part"
          >
            Duplicate
          </button>
          <button
            onClick={onRemove}
            style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
              color: '#fca5a5',
              cursor: 'pointer',
              padding: '5px 8px',
              fontSize: 11,
              lineHeight: 1,
              borderRadius: 6
            }}
            title="Delete part"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Prompt */}
      <textarea
        value={part.prompt || ''}
        onChange={e => onPartChange({ prompt: e.target.value })}
        onFocus={() => setFocusPrompt(true)}
        onBlur={() => setFocusPrompt(false)}
        placeholder={imageMode ? 'Optional prompt for image-to-3D…' : 'Describe this part…'}
        rows={3}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canGen) {
            e.preventDefault()
            onGenerate()
          }
        }}
        style={{
          width: '100%', background: '#0d0f14', border: `1px solid ${focusPrompt ? '#7c3aed' : '#252a36'}`,
          borderRadius: 8, padding: '9px 11px', fontSize: 12, color: '#c4cad8', resize: 'none',
          outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
          boxShadow: focusPrompt ? '0 0 0 3px rgba(124,58,237,0.15)' : 'none',
          boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s',
        }}
      />

      {/* Image mode toggle + multiview + reference image */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={toggleImageMode}
            style={{
              background: imageMode ? 'rgba(124,58,237,0.18)' : '#12151d',
              border: imageMode ? '1px solid rgba(124,58,237,0.45)' : '1px solid #1e2330',
              borderRadius: 6,
              padding: '4px 9px',
              fontSize: 10,
              fontWeight: 700,
              color: imageMode ? '#c4b5fd' : '#555b6e',
              cursor: 'pointer',
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}
          >
            🖼 Image-to-3D
          </button>
          <button
            onClick={toggleMultiviewMode}
            style={{
              background: multiviewMode ? 'rgba(6,182,212,0.18)' : '#12151d',
              border: multiviewMode ? '1px solid rgba(6,182,212,0.45)' : '1px solid #1e2330',
              borderRadius: 6,
              padding: '4px 9px',
              fontSize: 10,
              fontWeight: 700,
              color: multiviewMode ? '#67e8f9' : '#555b6e',
              cursor: 'pointer',
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}
          >
            🔲 Multi-view
          </button>
        </div>

        {imageMode && !multiviewMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            {part.imagePath ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, color: '#4ade80', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ✓ {part.imagePath.split(/[\\/]/).pop()}
                </span>
                <button
                  onClick={clearReferenceImage}
                  style={{ background: 'none', border: 'none', color: '#7c8499', cursor: 'pointer', fontSize: 11, padding: '2px 4px', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={pickReferenceImage}
                style={{
                  background: '#12151d',
                  border: '1px solid #252a36',
                  borderRadius: 6,
                  padding: '4px 9px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#9499a8',
                  cursor: 'pointer'
                }}
              >
                Attach Image…
              </button>
            )}
          </div>
        )}

        {multiviewMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 7 }}>
            {MULTIVIEW_SLOTS.map((label, i) => {
              const filePath = part.multiviewImages?.[i] || null
              return (
                <div key={label} style={{ background: '#0d0f14', border: '1px solid #1e2330', borderRadius: 6, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: '#555b6e', flexShrink: 0 }}>{label}</span>
                  {filePath ? (
                    <>
                      <span style={{ fontSize: 10, color: '#4ade80', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {filePath.split(/[\\/]/).pop()}
                      </span>
                      <button
                        onClick={() => clearMultiviewSlot(i)}
                        style={{ background: 'none', border: 'none', color: '#7c8499', cursor: 'pointer', fontSize: 10, padding: '0 2px', flexShrink: 0 }}
                      >✕</button>
                    </>
                  ) : (
                    <button
                      onClick={() => pickMultiviewImage(i)}
                      style={{ background: 'none', border: 'none', color: '#7c8499', cursor: 'pointer', fontSize: 10, padding: 0, textDecoration: 'underline' }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          onClick={onGenerate}
          disabled={!canGen}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxSizing: 'border-box',
            transition: 'opacity .15s',
            letterSpacing: '0.02em',
          }}
        >
          {busy ? <><SmallSpinIcon />Generating…</> : part.status === 'done' ? '↺ Regenerate' : '⚡ Generate Part'}
        </button>
        {part.status === 'done' && part.outputPath && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
            <select
              disabled={part.optimizeState === 'optimizing'}
              value={optimizePresetIdx}
              onChange={(e) => setOptimizePresetIdx(Number(e.target.value))}
              title={OPTIMIZE_PRESETS[optimizePresetIdx].desc}
              style={{
                padding: '4px 6px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                background: '#12151d',
                color: '#7c8499',
                border: '1px solid #1e2330',
                cursor: part.optimizeState === 'optimizing' ? 'wait' : 'pointer',
                outline: 'none',
              }}
            >
              {OPTIMIZE_PRESETS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
            <button
              onClick={() => onOptimize?.(OPTIMIZE_PRESETS[optimizePresetIdx].ratio)}
              disabled={part.optimizeState === 'optimizing'}
              title={OPTIMIZE_PRESETS[optimizePresetIdx].desc}
              style={{
                padding: '9px 11px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                background: part.optimizeState === 'done' ? 'rgba(74,222,128,0.1)'
                  : part.optimizeState === 'error' ? 'rgba(248,113,113,0.08)'
                  : part.optimizeState === 'optimizing' ? 'rgba(245,158,11,0.08)'
                  : '#12151d',
                color: part.optimizeState === 'done' ? '#4ade80'
                  : part.optimizeState === 'error' ? '#fca5a5'
                  : part.optimizeState === 'optimizing' ? '#f59e0b'
                  : '#7c8499',
                border: part.optimizeState === 'done' ? '1px solid rgba(74,222,128,0.2)'
                  : part.optimizeState === 'error' ? '1px solid rgba(248,113,113,0.2)'
                  : part.optimizeState === 'optimizing' ? '1px solid rgba(245,158,11,0.2)'
                  : '1px solid #1e2330',
                cursor: part.optimizeState === 'optimizing' ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {part.optimizeState === 'optimizing' ? <><SmallSpinIcon />Optimizing…</>
                : part.optimizeState === 'done' ? `✓ -${part.optimizeSaved ?? 0}%`
                : '✦ Optimize'}
            </button>
          </div>
        )}
      </div>
      {part.optimizeState === 'error' && part.optimizeError && (
        <div style={{ marginTop: 5, fontSize: 10, color: '#fca5a5', lineHeight: 1.5 }}>
          ⚠ {part.optimizeError}
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 10, color: '#3e4455' }}>
        Ctrl+Enter generates the current part
      </div>
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
