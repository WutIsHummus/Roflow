/* eslint-disable react/prop-types */
import { useState } from 'react'

const OPTIMIZE_PRESETS = [
  { label: 'Light', ratio: 0.75, desc: '75% — minimal reduction, best quality' },
  { label: 'Medium', ratio: 0.5, desc: '50% — balanced quality/performance' },
  { label: 'Heavy', ratio: 0.25, desc: '25% — aggressive reduction, game-ready' },
  { label: 'Ultra', ratio: 0.1, desc: '10% — maximum reduction, lowest poly' }
]

const RETOPO_PRESETS = [
  { label: 'Hi', faces: 5000, desc: '5,000 faces — high detail' },
  { label: 'Mid', faces: 2000, desc: '2,000 faces — balanced quad topology' },
  { label: 'Lo', faces: 800, desc: '800 faces — game-ready low poly' },
  { label: 'Tiny', faces: 300, desc: '300 faces — minimal quad mesh' }
]
import { 
  Plus, 
  Sparkles, 
  Copy, 
  Trash2, 
  History, 
  RefreshCw, 
  AlertTriangle, 
  Image as ImageIcon, 
  Settings, 
  RotateCcw,
  Sparkle,
  X
} from 'lucide-react'
import {
  REFERENCE_IMAGE_SLOTS,
  REFERENCE_IMAGE_LABELS,
  normalizeReferenceImages,
  partHasReferenceImages,
  countReferenceImages
} from './referenceImages'

const ATTACH_POINTS = [
  // Head
  { id: 'HatAttachment',       label: 'Hat (Top of Head)' },
  { id: 'HairAttachment',      label: 'Hair (Back of Head)' },
  { id: 'FaceCenterAttachment',label: 'Face Center' },
  { id: 'FaceFrontAttachment', label: 'Face Front' },
  // Upper Torso
  { id: 'NeckAttachment',      label: 'Neck' },
  { id: 'BodyFrontAttachment', label: 'Body Front' },
  { id: 'BodyBackAttachment',  label: 'Body Back' },
  { id: 'LeftCollarAttachment', label: 'Left Collar' },
  { id: 'RightCollarAttachment', label: 'Right Collar' },
  // Lower Torso
  { id: 'WaistCenterAttachment', label: 'Waist Center' },
  { id: 'WaistFrontAttachment',  label: 'Waist Front' },
  { id: 'WaistBackAttachment',   label: 'Waist Back' },
  // Arms
  { id: 'LeftShoulderAttachment',  label: 'Left Shoulder' },
  { id: 'RightShoulderAttachment', label: 'Right Shoulder' },
  // Hands
  { id: 'LeftGripAttachment',  label: 'Left Grip' },
  { id: 'RightGripAttachment', label: 'Right Grip' },
  // Feet
  { id: 'LeftFootAttachment',  label: 'Left Foot' },
  { id: 'RightFootAttachment', label: 'Right Foot' },
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
  onGenerateAll,
  onPickReferenceImage,
  onClearReferenceImage,
  onClearAllReferenceImages,
  onOptimize,
  onRetopo,
  onPartChange,
  showAttachPoint,
  tripoAssets = [],
  localAssets = [],
  onAddTripoAsset,
  importingAssetId = null,
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
    <div className="flex flex-col h-full bg-transparent">
      {/* Header Panel */}
      <div className="p-5 border-b border-white/[0.06] shrink-0 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-extrabold uppercase tracking-widest text-slate-300">Parts List</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
              {parts.length}
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            {parts.some(
              (part) =>
                part.status !== 'generating' &&
                part.status !== 'done' &&
                ((part.prompt || '').trim() || partHasReferenceImages(part))
            ) && (
              <button
                onClick={() => onGenerateAll?.()}
                className="px-4 py-2.5 text-xs font-bold rounded-xl border border-white/[0.08] bg-white/[0.05] text-slate-200 hover:bg-white/[0.1] hover:border-white/[0.15] hover:text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] cursor-pointer backdrop-blur-md flex items-center gap-1.5"
              >
                <Sparkles size={13} className="shrink-0 text-slate-300" />
                Generate All
              </button>
            )}
            <button
              onClick={() => onAdd?.()}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-white/[0.9] hover:bg-white text-slate-950 shadow-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] cursor-pointer flex items-center gap-1.5 backdrop-blur-md"
            >
              <Plus size={13} className="shrink-0 text-slate-950" />
              Blank Part
            </button>
          </div>
        </div>

        {/* Quick Add Presets Drawer */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 shadow-sm">
          <div className="text-[9px] text-purple-300/80 font-bold uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-purple-400 shadow-[0_0_4px_#c084fc]"></span>
            Quick Add Preset
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickParts.map((template) => (
              <button
                key={template.name}
                onClick={() => onAdd?.(template)}
                className="px-3.5 py-2 text-xs font-bold rounded-lg bg-white/[0.03] border border-white/[0.06] text-slate-300 hover:text-purple-200 hover:border-purple-500/40 hover:bg-purple-500/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={11} className="text-slate-400 shrink-0" />
                {template.name}
              </button>
            ))}
          </div>
        </div>

        {recentlyRemoved && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="min-w-0">
              <div className="text-2xs font-bold text-red-300 uppercase tracking-wide">Part removed</div>
              <div className="text-xs text-slate-400 truncate mt-0.5">
                {recentlyRemoved.name || recentlyRemoved.prompt || 'Untitled part'}
              </div>
            </div>
            <button
              onClick={() => onUndoRemove?.()}
              className="shrink-0 px-3.5 py-2 text-xs font-bold bg-purple-500/10 border border-purple-500/25 rounded-lg text-purple-300 hover:bg-purple-500/20 transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
            >
              <RotateCcw size={12} className="shrink-0" />
              Undo
            </button>
          </div>
        )}

        {showTripoBrowser && (
          <div>
            <button
              onClick={() => setShowAssets((prev) => !prev)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.01] ${
                showAssets 
                  ? 'bg-purple-950/20 border-purple-500/30 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.08)]' 
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-slate-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <History size={13} className="text-purple-400 shrink-0" />
                Browse Tripo My Assets
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {tripoAssets.length} Tripo{localAssets.length > 0 ? ` · ${localAssets.length} local` : ''}
              </span>
            </button>

            {showAssets && (
              <div className="mt-2 bg-slate-950/40 border border-white/[0.06] rounded-xl p-3 max-h-64 overflow-y-auto shadow-inner backdrop-blur-xl">
                <div className="flex gap-2 items-center mb-3">
                  <button
                    onClick={() => onRefreshAssets?.()}
                    disabled={assetRefreshState === 'loading'}
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-all duration-200 flex items-center gap-1.5 ${
                      assetRefreshState === 'loading'
                        ? 'bg-purple-900/10 border-purple-500/10 text-purple-400/50 cursor-wait'
                        : 'bg-purple-500/10 border-purple-500/25 text-purple-300 hover:bg-purple-500/20 cursor-pointer'
                    }`}
                  >
                    <RefreshCw size={12} className={`shrink-0 ${assetRefreshState === 'loading' ? 'animate-spin' : ''}`} />
                    {assetRefreshState === 'loading' ? 'Syncing…' : 'Sync My Assets'}
                  </button>
                  {assetRefreshMessage && (
                    <span className={`text-[10px] leading-tight ${assetRefreshState === 'error' ? 'text-red-400' : 'text-slate-500'}`}>
                      {assetRefreshMessage}
                    </span>
                  )}
                </div>

                {tripoAssets.length === 0 && localAssets.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-slate-500 font-medium">No assets yet</p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-normal">{emptyAssetHint}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tripoAssets.length > 0 && (
                      <div>
                        <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-1.5">
                          Tripo History
                        </div>
                        <div className="space-y-2">
                          {tripoAssets.map((asset) => (
                            <TripoAssetCard
                              key={`tripo-${asset.id}`}
                              asset={asset}
                              actionLabel={assetBrowserLabel}
                              importing={importingAssetId === (asset.id || asset.detailUrl || asset.downloadUrl)}
                              onAdd={() => onAddTripoAsset?.(asset)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {localAssets.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-1.5">
                          Workspace Models
                        </div>
                        <div className="space-y-2">
                          {localAssets.map((asset) => (
                            <TripoAssetCard
                              key={`local-${asset.id || asset.outputPath}`}
                              asset={asset}
                              actionLabel={assetBrowserLabel}
                              importing={importingAssetId === (asset.id || asset.outputPath)}
                              onAdd={() => onAddTripoAsset?.(asset)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Parts List Scroll View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {parts.length === 0 ? (
          <div className="text-center py-12 px-5 bg-white/[0.01] border border-white/[0.04] rounded-2xl flex flex-col items-center justify-center min-h-[220px]">
            <div className="w-11 h-11 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 shadow-[0_0_16px_rgba(168,85,247,0.15)] animate-pulse">
              <Settings size={18} className="text-purple-400 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <p className="text-xs font-bold text-slate-200 tracking-wide">No parts added yet</p>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed max-w-[210px] font-medium">
              Start building your Roblox asset piece-by-piece using the presets.
            </p>
            <div className="flex flex-col gap-2 mt-5 w-full">
              {quickParts.slice(0, 3).map((template) => (
                <button
                  key={`empty-${template.name}`}
                  onClick={() => onAdd?.(template)}
                  className="w-full py-2 px-3.5 text-xs font-bold rounded-xl bg-purple-500/10 border border-purple-500/15 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/30 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus size={12} className="shrink-0" />
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
              onPickReferenceImage={(slot) => onPickReferenceImage?.(part.id, slot)}
              onClearReferenceImage={(slot) => onClearReferenceImage?.(part.id, slot)}
              onClearAllReferenceImages={() => onClearAllReferenceImages?.(part.id)}
              onOptimize={(ratio) => onOptimize?.(part.id, ratio)}
              onRetopo={(faces) => onRetopo?.(part.id, faces)}
              onPartChange={(ch) => onPartChange(part.id, ch)}
              showAttachPoint={showAttachPoint}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TripoAssetCard({ asset, onAdd, actionLabel, importing = false }) {
  const sourceLabel = asset.sourceTab === 'environment' ? 'Environment Scene' : 'Character Accessory'
  const providerLabel =
    asset.provider === 'tripo-web'
      ? 'Browser Session'
      : asset.provider === 'tripo-history'
        ? 'Tripo Web history'
      : asset.provider === 'workspace'
        ? 'Workspace'
        : 'Tripo Engine'

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-lg p-2.5 hover:border-purple-500/20 hover:bg-slate-900/60 transition-all duration-200">
      <div className="flex justify-between items-start gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-200 truncate">
            {asset.name || 'Untitled Tripo Asset'}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
            {sourceLabel} · <span className="text-purple-400/80">{providerLabel}</span>
            {(asset.outputPath || asset.filePath) && (
              <span className="text-emerald-400/80"> · saved locally</span>
            )}
          </div>
        </div>
        <button
          onClick={onAdd}
          disabled={importing}
          className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1 ${
            importing
              ? 'bg-slate-800 text-slate-500 cursor-wait'
              : 'bg-purple-500/15 border border-purple-500/25 text-purple-300 hover:bg-purple-500/25 cursor-pointer'
          }`}
        >
          <Plus size={11} className="shrink-0" />
          {importing ? 'Importing…' : actionLabel}
        </button>
      </div>
      {asset.prompt && (
        <div className="text-[10px] text-slate-400 leading-relaxed font-medium line-clamp-2 italic">
          &quot;{asset.prompt}&quot;
        </div>
      )}
    </div>
  )
}

function PartCard({
  part,
  index,
  onRemove,
  onDuplicate,
  onGenerate,
  onPickReferenceImage,
  onClearReferenceImage,
  onClearAllReferenceImages,
  onOptimize,
  onRetopo,
  onPartChange,
  showAttachPoint
}) {
  const [optimizePresetIdx, setOptimizePresetIdx] = useState(1)
  const [retopoFaceIdx, setRetopoFaceIdx] = useState(1)
  const referenceImages = normalizeReferenceImages(part)
  const referenceCount = countReferenceImages(part)

  const STATUS = {
    pending: { 
      color: '#94a3b8', 
      label: 'Pending', 
      borderClass: 'border-white/[0.08] hover:border-white/[0.15]',
      glowClass: '' 
    },
    generating: { 
      color: '#f59e0b', 
      label: 'Generating…', 
      borderClass: 'border-amber-500/30 animate-pulse', 
      glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
    },
    done: { 
      color: '#4ade80', 
      label: 'Done ✓', 
      borderClass: 'border-emerald-500/20 hover:border-emerald-500/40', 
      glowClass: 'shadow-[0_0_12px_rgba(74,222,128,0.1)]' 
    },
    error: { 
      color: '#f87171', 
      label: 'Error', 
      borderClass: 'border-rose-500/30 hover:border-rose-500/50', 
      glowClass: 'shadow-[0_0_12px_rgba(248,113,113,0.1)]' 
    },
  }
  const st = STATUS[part.status || 'pending']
  const busy = part.status === 'generating'
  const canGen = (((part.prompt || '').trim().length > 0) || partHasReferenceImages(part)) && !busy

  return (
    <div 
      className={`p-4 rounded-2xl border transition-all duration-300 ${st.borderClass} ${st.glowClass}`}
      style={{
        background: 'rgba(16, 19, 28, 0.45)',
        backdropFilter: 'blur(20px)'
      }}
    >
      {/* Row 1: index + name */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-2xs font-extrabold text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded-md px-1.5 py-0.5 min-w-[20px] text-center">
          {index + 1}
        </span>
        <input
          value={part.name || ''}
          onChange={e => onPartChange({ name: e.target.value })}
          placeholder="Part name…"
          spellCheck={false}
          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none transition-all duration-200 focus:bg-white/[0.06] focus:border-white/[0.15] focus:ring-2 focus:ring-white/[0.05]"
        />
      </div>

      {/* Row 2: status + actions */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span 
          className="text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 tracking-wide"
          style={{
            color: st.color,
            borderColor: `${st.color}25`,
            backgroundColor: `${st.color}08`
          }}
        >
          {st.label}
        </span>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={onDuplicate}
            className="p-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-150 cursor-pointer flex items-center justify-center backdrop-blur-md"
            title="Duplicate part"
          >
            <Copy size={12} className="shrink-0" />
          </button>
          <button
            onClick={onRemove}
            className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:text-red-300 hover:bg-red-500/15 hover:border-red-500/40 transition-all duration-150 cursor-pointer flex items-center justify-center backdrop-blur-md"
            title="Delete part"
          >
            <Trash2 size={12} className="shrink-0" />
          </button>
        </div>
      </div>

      {/* Prompt */}
      <textarea
        value={part.prompt || ''}
        onChange={e => onPartChange({ prompt: e.target.value })}
        placeholder="Describe this part…"
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
        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-200 resize-none outline-none transition-all duration-200 focus:bg-white/[0.06] focus:border-white/[0.15] focus:ring-2 focus:ring-white/[0.05] leading-relaxed"
      />

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Reference Images (Front · Back · Left · Right)
          </span>
          {referenceCount > 0 && (
            <button
              onClick={onClearAllReferenceImages}
              className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 cursor-pointer bg-transparent border-none p-0 transition-colors duration-150"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {REFERENCE_IMAGE_SLOTS.map((slot) => {
            const ref = referenceImages[slot]
            return (
              <div
                key={slot}
                className="rounded-lg border border-white/5 bg-slate-950/30 p-2 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    {REFERENCE_IMAGE_LABELS[slot]}
                  </span>
                  {ref?.path && (
                    <button
                      onClick={() => onClearReferenceImage(slot)}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer bg-transparent border-none p-0"
                      title={`Remove ${REFERENCE_IMAGE_LABELS[slot]} image`}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => onPickReferenceImage(slot)}
                  className="flex items-center gap-2 w-full text-left rounded-md border border-dashed border-slate-700/80 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all duration-200 cursor-pointer p-1.5"
                >
                  {ref?.preview ? (
                    <img
                      src={ref.preview}
                      alt={`${REFERENCE_IMAGE_LABELS[slot]} reference`}
                      className="w-10 h-10 object-cover rounded-md border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md border border-dashed border-slate-700 bg-slate-950/40 flex items-center justify-center shrink-0">
                      <ImageIcon size={14} className="text-slate-600" />
                    </div>
                  )}
                  <span className="text-[10px] font-semibold text-slate-500 truncate">
                    {ref?.path ? 'Change' : 'Attach'}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] text-slate-600 leading-relaxed">
          Attach one image for image-to-3D, or add back/left/right for Tripo multiview generation.
        </p>
      </div>

      {/* Attach point selector */}
      {showAttachPoint && (
        <div className="relative mt-2.5">
          <select
            value={part.attachPoint || 'HatAttachment'}
            onChange={e => onPartChange({ attachPoint: e.target.value })}
            className="w-full bg-slate-950/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-400 cursor-pointer outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 appearance-none font-semibold transition-all duration-250"
          >
            {ATTACH_POINTS.map(ap => (
              <option key={ap.id} value={ap.id} className="bg-slate-950 text-slate-300">{ap.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Error message */}
      {part.status === 'error' && part.error && (
        <div className="mt-2.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 leading-relaxed flex items-start gap-2">
          <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <span>{part.error}</span>
        </div>
      )}

      {/* Generate button */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onGenerate}
          disabled={!canGen}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
            busy 
              ? 'bg-white/[0.05] border border-white/[0.1] text-white/50 cursor-wait animate-pulse'
              : part.status === 'done' 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer'
                : canGen 
                  ? 'bg-white text-slate-950 hover:bg-white/90 shadow-sm cursor-pointer'
                  : 'bg-white/[0.02] border border-white/[0.04] text-slate-500 cursor-not-allowed'
          }`}
        >
          {busy ? (
            <>
              <SmallSpinIcon />
              <span>Generating…</span>
            </>
          ) : part.status === 'done' ? (
            <>
              <RotateCcw size={12} className="shrink-0 text-emerald-300" />
              <span>Regenerate</span>
            </>
          ) : (
            <>
              <Sparkles size={13} className="shrink-0" />
              <span>Generate Part</span>
            </>
          )}
        </button>
      </div>

      {part.status === 'done' && part.outputPath && (
        <div className="mt-3 grid gap-2">
          <div className="flex gap-2">
            <select
              disabled={part.optimizeState === 'optimizing'}
              value={optimizePresetIdx}
              onChange={(event) => setOptimizePresetIdx(Number(event.target.value))}
              className="bg-slate-950/60 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-slate-400"
            >
              {OPTIMIZE_PRESETS.map((preset, index) => (
                <option key={preset.label} value={index}>{preset.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onOptimize?.(OPTIMIZE_PRESETS[optimizePresetIdx].ratio)}
              disabled={part.optimizeState === 'optimizing'}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold border border-white/10 bg-white/[0.03] text-slate-300 cursor-pointer disabled:opacity-60"
            >
              {part.optimizeState === 'optimizing' ? 'Optimizing…' : part.optimizeState === 'done' ? `Optimized (-${part.optimizeSaved ?? 0}%)` : 'Optimize Mesh'}
            </button>
          </div>
          {part.optimizeState === 'error' && part.optimizeError && (
            <div className="text-[10px] text-rose-300">{part.optimizeError}</div>
          )}
          <div className="flex gap-2">
            <select
              disabled={part.retopoState === 'retopoing'}
              value={retopoFaceIdx}
              onChange={(event) => setRetopoFaceIdx(Number(event.target.value))}
              className="bg-slate-950/60 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-slate-400"
            >
              {RETOPO_PRESETS.map((preset, index) => (
                <option key={preset.label} value={index}>{preset.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onRetopo?.(RETOPO_PRESETS[retopoFaceIdx].faces)}
              disabled={part.retopoState === 'retopoing'}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold border border-white/10 bg-white/[0.03] text-slate-300 cursor-pointer disabled:opacity-60"
            >
              {part.retopoState === 'retopoing' ? 'Retopoing…' : part.retopoState === 'done' ? 'Retopo Complete' : 'Retopo Mesh'}
            </button>
          </div>
          {part.retopoState === 'error' && part.retopoError && (
            <div className="text-[10px] text-rose-300">{part.retopoError}</div>
          )}
        </div>
      )}
      <div className="mt-2 text-[10px] text-slate-600 font-medium text-center">
        Ctrl+Enter generates the current part
      </div>
    </div>
  )
}

function SmallSpinIcon() {
  return (
    <svg style={{ animation: 'spin 1s linear infinite', width: 13, height: 13 }} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
      <path fill="currentColor" fillOpacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
