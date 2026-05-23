/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'

const DEFAULT_WORKFLOW = {
  assetType: 'shirt',
  designPrompt: '',
  colorPalette: '',
  materialNotes: '',
  styleNotes: '',
  templateImagePath: null,
  templateDataUrl: null,
  resultPath: null,
  resultDataUrl: null,
  seed: '',
  lastPrompt: ''
}

const REPLICATE_MODEL = 'black-forest-labs/flux-kontext-pro'
const REPLICATE_URL = `https://replicate.com/${REPLICATE_MODEL}`
const BUNDLED_SHIRT_TEMPLATE_URL = '/roblox-classic-shirt-template.png'
const BUNDLED_SHIRT_TEMPLATE_LABEL = 'Built-in Roblox shirt template'

function buildPromptPack(workflow) {
  const hardRequirements = [
    'You are filling a Roblox classic clothing template with original clothing artwork.',
    '',
    'Follow these rules exactly:',
    '- Use the provided template as the fixed UV layout.',
    '- Keep the original canvas size, proportions, and panel positions unchanged.',
    '- Fill the blank clothing template panels with clothing artwork.',
    '- Treat the template as panel guides to fill, not as an image whose style should be changed.',
    '- Do not restyle, repaint, reinterpret, or transform the template itself.',
    '- Generate only the final clothing artwork mapped onto the template.',
    '- Do not generate a character, mannequin, mockup, or 3D preview.',
    '- Do not add perspective, staging, background scenery, or presentation elements.',
    '- Keep the design seam-aware so adjacent faces connect cleanly across torso and sleeves or legs.',
    '- Put the main visual focus on the torso front or primary visible panel.',
    '- Keep side transitions simple and consistent.',
    '- Use bold readable shapes suitable for Roblox classic non-mesh clothing.',
    '- Avoid tiny noisy details that will blur after upload.',
    '- Preserve clean transparent or empty non-design areas where appropriate.',
    '- Cover the template guide regions with usable clothing graphics so the result is ready for PNG cleanup.',
    '- The result must look like a production-ready PNG texture for Roblox classic clothing.',
    '',
    'Rendering intent:',
    '- flat graphic texture',
    '- template-aligned',
    '- panel-filling artwork',
    '- clean edges',
    '- game-ready',
    '- easy to edit manually after generation'
  ].join('\n')

  const negativePrompt = [
    'person',
    'mannequin',
    'avatar',
    'roblox character',
    'shirt mockup',
    'pants mockup',
    'folded clothing',
    'hanging clothing',
    'fashion photo',
    '3d render',
    'perspective',
    'realistic cloth folds',
    'studio lighting',
    'scene background',
    'extra panels',
    'warped template',
    'distorted layout',
    'style transfer',
    'restyled template',
    'template redesign',
    'watermark',
    'signature',
    'labels',
    'text annotations',
    'tiny noisy details'
  ].join(', ')

  const designBrief = [
    `User clothing request: ${workflow.designPrompt || 'Create a clean Roblox classic clothing texture.'}`,
    `Asset target: Roblox classic ${workflow.assetType}.`,
    workflow.colorPalette ? `Color palette: ${workflow.colorPalette}` : null,
    workflow.materialNotes ? `Material notes: ${workflow.materialNotes}` : null,
    workflow.styleNotes ? `Style notes: ${workflow.styleNotes}` : null,
    'Output goal: Roblox classic clothing texture, flat 2D, seam-aware, template-safe.',
    `Avoid: ${negativePrompt}.`
  ]
    .filter(Boolean)
    .join('\n')

  const finalPrompt = `${hardRequirements}\n\n${designBrief}`

  const workflowNotes = [
    'Workflow',
    '1. Start with the built-in Roblox shirt template or attach your own template PNG.',
    '2. Write the clothing direction in plain language.',
    '3. Generate with Replicate FLUX Kontext Pro so it fills the UV panels with clothing artwork.',
    '4. Inspect seams and clean up any edge issues in an editor before upload.',
    '5. Upload the final PNG to Roblox as classic clothing.'
  ].join('\n')

  const exportText = [
    'Roblox Classic Clothing Prompt Pack',
    '',
    `Model: ${REPLICATE_MODEL}`,
    `Asset type: ${workflow.assetType}`,
    workflow.colorPalette ? `Palette: ${workflow.colorPalette}` : null,
    workflow.materialNotes ? `Material notes: ${workflow.materialNotes}` : null,
    workflow.styleNotes ? `Style notes: ${workflow.styleNotes}` : null,
    '',
    'Prompt Prefix',
    hardRequirements,
    '',
    'Negative Constraints',
    negativePrompt,
    '',
    'Final Prompt',
    finalPrompt,
    '',
    workflowNotes
  ]
    .filter(Boolean)
    .join('\n')

  return {
    hardRequirements,
    negativePrompt,
    finalPrompt,
    exportText,
    workflowNotes
  }
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' },
  header: { padding: '20px 24px 0', borderBottom: '1px solid #1e2330', flexShrink: 0 },
  title: { fontSize: 18, fontWeight: 700, color: '#eef0f6', margin: 0 },
  subtitle: { fontSize: 13, color: '#555b6e', marginTop: 4, lineHeight: 1.6 },
  body: { flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr 360px', minHeight: 0 },
  rail: { borderRight: '1px solid #1e2330', padding: 20, overflowY: 'auto' },
  center: { padding: 24, overflowY: 'auto' },
  pack: { borderLeft: '1px solid #1e2330', padding: 20, overflowY: 'auto' },
  card: {
    background: '#141821',
    border: '1px solid #202533',
    borderRadius: 12,
    padding: 14
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#7c8499',
    marginBottom: 7
  },
  input: {
    width: '100%',
    background: '#0d0f14',
    border: '1px solid #252a36',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    color: '#eef0f6',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  textarea: {
    width: '100%',
    background: '#0d0f14',
    border: '1px solid #252a36',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    color: '#c4cad8',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
    lineHeight: 1.6
  },
  button: {
    border: '1px solid #2a3040',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 700,
    background: '#171b24',
    color: '#c4cad8',
    cursor: 'pointer'
  },
  primaryButton: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 700,
    background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
    color: '#fff',
    cursor: 'pointer'
  }
}

export default function ClothingModule({ workflowState, setWorkflowState }) {
  const [workflow, setWorkflow] = useState(() => ({ ...DEFAULT_WORKFLOW, ...(workflowState?.clothingWorkflow || {}) }))
  const [replicateToken, setReplicateToken] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    if (workflowState?.clothingWorkflow?.templateDataUrl) return
    let cancelled = false

    async function loadBundledTemplate() {
      const response = await fetch(BUNDLED_SHIRT_TEMPLATE_URL)
      const blob = await response.blob()
      const reader = new FileReader()
      reader.onloadend = () => {
        if (cancelled) return
        const dataUrl = typeof reader.result === 'string' ? reader.result : null
        if (!dataUrl) return
        setWorkflow((prev) => {
          if (prev.templateDataUrl) return prev
          return {
            ...prev,
            templateImagePath: BUNDLED_SHIRT_TEMPLATE_LABEL,
            templateDataUrl: dataUrl
          }
        })
      }
      reader.readAsDataURL(blob)
    }

    loadBundledTemplate().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [workflowState?.clothingWorkflow?.templateDataUrl])

  useEffect(() => {
    window.api.configGet('replicateApiToken').then((value) => {
      if (value) setReplicateToken(value)
    })
  }, [])

  useEffect(() => {
    if (!setWorkflowState) return
    setWorkflowState((prev) => ({ ...prev, clothingWorkflow: workflow }))
  }, [workflow, setWorkflowState])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (!window.api.onClothingProgress) return undefined
    const unsubscribe = window.api.onClothingProgress((data) => setProgress(data))
    return unsubscribe
  }, [])

  const promptPack = useMemo(() => buildPromptPack(workflow), [workflow])

  const updateWorkflow = useCallback((changes) => {
    setWorkflow((prev) => ({ ...prev, ...changes }))
  }, [])

  const attachTemplate = useCallback(async () => {
    setBusy('template')
    const filePath = await window.api.openImage()
    if (!filePath) {
      setBusy('')
      return
    }
    const result = await window.api.readFileAsDataURL({ filePath })
    setBusy('')
    if (!result.success) {
      setNotice(result.error || 'Could not load template image.')
      return
    }
    updateWorkflow({
      templateImagePath: filePath,
      templateDataUrl: result.dataUrl
    })
    setNotice('Template attached.')
  }, [updateWorkflow])

  const removeTemplate = useCallback(() => {
    updateWorkflow({
      templateImagePath: null,
      templateDataUrl: null
    })
    setNotice('Template removed.')
  }, [updateWorkflow])

  const saveToken = useCallback(async () => {
    await window.api.configSet('replicateApiToken', replicateToken.trim())
    setNotice('Replicate token saved.')
  }, [replicateToken])

  const copyPrompt = useCallback(async () => {
    const result = await window.api.copyText(promptPack.finalPrompt)
    if (!result?.success) {
      setNotice(result?.error || 'Could not copy prompt.')
      return
    }
    setNotice('Prompt copied.')
  }, [promptPack.finalPrompt])

  const exportPromptPack = useCallback(async () => {
    const filePath = await window.api.saveFile({
      title: 'Export Clothing Prompt Pack',
      defaultPath: 'roblox-classic-clothing-pack.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    })
    if (!filePath) return
    const result = await window.api.writeTextFile({
      filePath,
      text: promptPack.exportText
    })
    if (!result?.success) {
      setNotice(result?.error || 'Could not export prompt pack.')
      return
    }
    setNotice('Prompt pack exported.')
    window.api.openPath(filePath)
  }, [promptPack.exportText])

  const saveGeneratedTexture = useCallback(async () => {
    if (!workflow.resultPath) return
    const filePath = await window.api.saveFile({
      title: 'Save Classic Clothing Texture',
      defaultPath: `roblox-${workflow.assetType}-texture.png`,
      filters: [{ name: 'PNG Images', extensions: ['png'] }]
    })
    if (!filePath) return
    await window.api.copyFile({ src: workflow.resultPath, dest: filePath })
    setNotice('Generated texture saved.')
    window.api.openPath(filePath)
  }, [workflow.assetType, workflow.resultPath])

  const generateTexture = useCallback(async () => {
    if (!replicateToken.trim()) {
      setNotice('Add your Replicate API token first.')
      return
    }
    if (!workflow.templateImagePath) {
      setNotice('Attach a Roblox clothing template image first.')
      return
    }
    if (!workflow.designPrompt.trim()) {
      setNotice('Describe the clothing design first.')
      return
    }

    setBusy('generate')
    setProgress({ step: 'Preparing Replicate request…', pct: 4 })

    const parsedSeed =
      workflow.seed.trim() && Number.isFinite(Number(workflow.seed)) ? Number(workflow.seed) : null

    const result = await window.api.replicateGenerateClothing({
      apiToken: replicateToken.trim(),
      prompt: promptPack.finalPrompt,
      inputImagePath: workflow.templateImagePath,
      inputImageDataUrl: workflow.templateDataUrl,
      model: REPLICATE_MODEL,
      seed: parsedSeed
    })

    setBusy('')

    if (!result?.success) {
      setProgress(null)
      setNotice(result?.error || 'Generation failed.')
      return
    }

    const dataUrlResult = await window.api.readFileAsDataURL({ filePath: result.outputPath })
    setProgress(null)
    updateWorkflow({
      resultPath: result.outputPath,
      resultDataUrl: dataUrlResult.success ? dataUrlResult.dataUrl : null,
      lastPrompt: promptPack.finalPrompt
    })
    setNotice('Classic clothing texture generated.')
  }, [promptPack.finalPrompt, replicateToken, updateWorkflow, workflow.designPrompt, workflow.seed, workflow.templateDataUrl, workflow.templateImagePath])

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 16
          }}
        >
          <div>
            <h1 style={styles.title}>Classic Clothing Studio</h1>
            <p style={styles.subtitle}>
              Generate Roblox classic clothing by filling the Roblox UV template panels with hosted
              FLUX on Replicate. The built-in shirt template is ready inside the app.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={styles.button} onClick={() => window.api.openExternalUrl(REPLICATE_URL)}>
              Open Replicate
            </button>
            <button style={styles.primaryButton} onClick={exportPromptPack}>
              Export Prompt Pack
            </button>
          </div>
        </div>

        {notice && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.18)',
              color: '#c4b5fd',
              fontSize: 12
            }}
          >
            {notice}
          </div>
        )}

        {progress && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#9499a8',
                marginBottom: 4
              }}
            >
              <span>{progress.step}</span>
              <span>{progress.pct}%</span>
            </div>
            <div style={{ height: 3, background: '#1e2330', borderRadius: 2 }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 2,
                  background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                  width: `${progress.pct}%`,
                  transition: 'width .3s'
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={styles.body}>
        <div style={styles.rail}>
          <div style={{ ...styles.card, marginBottom: 14 }}>
            <label style={styles.label}>Replicate API Token</label>
            <input
              value={replicateToken}
              onChange={(event) => setReplicateToken(event.target.value)}
              placeholder="r8_..."
              type="password"
              style={styles.input}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={styles.primaryButton} onClick={saveToken}>
                Save Token
              </button>
              <button style={styles.button} onClick={() => window.api.openExternalUrl('https://replicate.com/account/api-tokens')}>
                Get Token
              </button>
            </div>
          </div>

          <div style={{ ...styles.card, marginBottom: 14 }}>
            <label style={styles.label}>Asset Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['shirt', 'pants'].map((type) => {
                const active = workflow.assetType === type
                return (
                  <button
                    key={type}
                    style={{
                      ...styles.button,
                      flex: 1,
                      border: active ? '1px solid #7c3aed' : styles.button.border,
                      color: active ? '#c4b5fd' : styles.button.color
                    }}
                    onClick={() => updateWorkflow({ assetType: type })}
                  >
                    {type === 'shirt' ? 'Classic Shirt' : 'Classic Pants'}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={styles.card}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#eef0f6',
                marginBottom: 8
              }}
            >
              Template Input
            </div>
            <div style={{ fontSize: 12, color: '#8b93a7', lineHeight: 1.6, marginBottom: 12 }}>
              The built-in shirt template is already loaded. Attach a different template only if you
              want to replace it.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button style={styles.primaryButton} onClick={attachTemplate} disabled={busy === 'template'}>
                {busy === 'template' ? 'Loading…' : 'Replace Template'}
              </button>
              {workflow.templateImagePath && (
                <button style={styles.button} onClick={removeTemplate}>
                  Remove
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', wordBreak: 'break-all' }}>
              {workflow.templateImagePath || 'Loading built-in template...'}
            </div>
          </div>
        </div>

        <div style={styles.center}>
          <div style={{ ...styles.card, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={styles.label}>Design Prompt</label>
                <textarea
                  value={workflow.designPrompt}
                  onChange={(event) => updateWorkflow({ designPrompt: event.target.value })}
                  placeholder="Example: black varsity jacket with white sleeves, red trim, chest patch, and clean sleeve stripes"
                  style={{ ...styles.textarea, minHeight: 110 }}
                />
              </div>
              <div>
                <label style={styles.label}>Panel Fill Notes</label>
                <textarea
                  value={workflow.styleNotes}
                  onChange={(event) => updateWorkflow({ styleNotes: event.target.value })}
                  placeholder="Example: front logo on torso front, plain back, matching cuffs, simple side seams"
                  style={{ ...styles.textarea, minHeight: 110 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: 14, marginTop: 14 }}>
              <div>
                <label style={styles.label}>Color Palette</label>
                <input
                  value={workflow.colorPalette}
                  onChange={(event) => updateWorkflow({ colorPalette: event.target.value })}
                  placeholder="black, red, dark gray"
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Material Notes</label>
                <input
                  value={workflow.materialNotes}
                  onChange={(event) => updateWorkflow({ materialNotes: event.target.value })}
                  placeholder="matte fabric, soft trim"
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Seed</label>
                <input
                  value={workflow.seed}
                  onChange={(event) => updateWorkflow({ seed: event.target.value })}
                  placeholder="optional"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                style={styles.primaryButton}
                onClick={generateTexture}
                disabled={busy === 'generate'}
              >
                {busy === 'generate' ? 'Generating…' : 'Generate with Replicate FLUX'}
              </button>
              <button style={styles.button} onClick={copyPrompt}>
                Copy Prompt
              </button>
              {workflow.resultPath && (
                <button style={styles.button} onClick={saveGeneratedTexture}>
                  Save PNG
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={styles.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>
                Template Preview
              </div>
              {workflow.templateDataUrl ? (
                <img
                  src={workflow.templateDataUrl}
                  alt="Roblox clothing template"
                  style={{ width: '100%', borderRadius: 10, border: '1px solid #252a36' }}
                />
              ) : (
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                The built-in shirt template will appear here once loaded.
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>
                Generated Result
              </div>
              {workflow.resultDataUrl ? (
                <img
                  src={workflow.resultDataUrl}
                  alt="Generated classic clothing texture"
                  style={{ width: '100%', borderRadius: 10, border: '1px solid #252a36' }}
                />
              ) : (
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                  Your generated PNG will appear here after Replicate finishes.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={styles.pack}>
          <div style={{ ...styles.card, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 8 }}>
              Hosted Workflow
            </div>
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: 12,
                lineHeight: 1.7,
                color: '#9aa0b0'
              }}
            >
              {promptPack.workflowNotes}
            </pre>
          </div>

          <div style={{ ...styles.card, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 8 }}>
              Negative Constraints
            </div>
            <div style={{ fontSize: 12, color: '#9aa0b0', lineHeight: 1.7 }}>
              {promptPack.negativePrompt}
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 8 }}>
              Final Prompt
            </div>
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: 12,
                lineHeight: 1.7,
                color: '#9aa0b0'
              }}
            >
              {promptPack.finalPrompt}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
