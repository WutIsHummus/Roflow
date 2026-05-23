/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react'

const S = {
  page: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' },
  header: { padding: '20px 24px 16px', borderBottom: '1px solid #1e2330', flexShrink: 0 },
  title: { fontSize: 18, fontWeight: 700, color: '#eef0f6', margin: 0 },
  subtitle: { fontSize: 13, color: '#555b6e', marginTop: 4, lineHeight: 1.6 },
  body: { flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 0, overflow: 'hidden' },
  rail: { borderRight: '1px solid #1e2330', padding: 16, overflowY: 'auto', display: 'grid', gap: 14, alignContent: 'start' },
  main: { padding: 20, overflowY: 'auto', display: 'grid', gap: 16, alignContent: 'start' },
  card: { background: '#141821', border: '1px solid #202533', borderRadius: 12, padding: 14 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7c8499', marginBottom: 7 },
  input: { width: '100%', background: '#0d0f14', border: '1px solid #252a36', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#eef0f6', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { width: '100%', background: '#0d0f14', border: '1px solid #252a36', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#c4cad8', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 },
  button: { border: '1px solid #2a3040', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 700, background: '#171b24', color: '#c4cad8', cursor: 'pointer' },
  primaryButton: { border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', cursor: 'pointer', width: '100%' },
  notice: { padding: '10px 12px', borderRadius: 10, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.18)', color: '#c4b5fd', fontSize: 12 },
  error: { padding: '10px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#fca5a5', fontSize: 12 },
  chip: { display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#1e2330', color: '#93c5fd' }
}

const STYLES = ['Medieval', 'Sci-Fi', 'Modern', 'Fantasy', 'Japanese', 'Western', 'Cyberpunk', 'Generic']
const GAME_TYPES = ['RPG', 'Tycoon', 'Adventure', 'FPS', 'Horror', 'Simulator', 'Other']

export default function BuildingModule() {
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('Generic')
  const [gameType, setGameType] = useState('RPG')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyLoaded, setApiKeyLoaded] = useState(() => !window.api?.configGet)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [recipe, setRecipe] = useState(null)
  const [tripoProgress, setTripoProgress] = useState({})

  useEffect(() => {
    if (!window.api?.configGet) return undefined
    window.api.configGet('deepseekApiKey').then((saved) => {
      if (saved) setApiKey(saved)
      setApiKeyLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!apiKeyLoaded || !window.api?.configSet) return
    window.api.configSet('deepseekApiKey', apiKey)
  }, [apiKey, apiKeyLoaded])

  useEffect(() => {
    if (!window.api?.onModelingProgress) return undefined
    return window.api.onModelingProgress((data) => {
      setTripoProgress((prev) => ({ ...prev, __active: data }))
    })
  }, [])

  const generate = useCallback(async () => {
    if (!apiKey.trim()) { setError('Add your DeepSeek API key first.'); return }
    if (!description.trim()) { setError('Enter a building description first.'); return }
    setError('')
    setNotice('')
    setBusy('generate')
    const result = await window.api.buildingGenerateRecipe({ description, style, gameType, apiKey: apiKey.trim() })
    setBusy('')
    if (!result?.success) { setError(result?.error || 'Generation failed.'); return }
    setRecipe(result.recipe)
    setTripoProgress({})
    setNotice(`Recipe generated ΓÇö "${result.recipe.buildingName}" with ${result.recipe.components?.length || 0} components.`)
  }, [apiKey, description, gameType, style])

  const generateComponent = useCallback(async (component, index) => {
    const key = `comp_${index}`
    setTripoProgress((prev) => ({ ...prev, [key]: { step: 'Starting TripoΓÇª', pct: 0 } }))

    const tripoConfig = await Promise.all([
      window.api.configGet('tripoWebBaseUrl'),
      window.api.configGet('tripoWebGenerateUrl'),
      window.api.configGet('tripoShowBrowserAutomation')
    ])

    const result = await window.api.tripoWebGenerate({
      prompt: component.tripoPrompt,
      baseUrl: tripoConfig[0] || undefined,
      generateUrl: tripoConfig[1] || undefined,
      showBrowser: tripoConfig[2] !== false
    })

    setTripoProgress((prev) => ({
      ...prev,
      [key]: result?.success
        ? { step: 'Done!', pct: 100, outputPath: result.outputPath }
        : { step: result?.error || 'Failed', pct: 0, error: true }
    }))
  }, [])

  const exportLua = useCallback(async () => {
    if (!recipe?.luaScript) return
    const filePath = await window.api.saveFile({
      title: 'Export Building Lua Script',
      defaultPath: `${(recipe.buildingName || 'building').replace(/\s+/g, '_')}.lua`,
      filters: [{ name: 'Lua Script', extensions: ['lua'] }]
    })
    if (!filePath) return
    await window.api.writeTextFile({ filePath, text: recipe.luaScript.replace(/\\n/g, '\n').replace(/\\"/g, '"') })
    window.api.openPath(filePath)
  }, [recipe])

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Building Generator</h1>
        <p style={S.subtitle}>Describe a Roblox building ΓÇö DeepSeek breaks it into 3D components, each ready for Tripo generation.</p>
      </div>

      <div style={S.body}>
        <aside style={S.rail}>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>Building Input</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={S.label}>Building Description</label>
                <textarea
                  style={{ ...S.textarea, minHeight: 90 }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. A two-story medieval tavern with a wooden facade, stone chimney, arched entrance, and sign above the door"
                />
              </div>

              <div>
                <label style={S.label}>Architectural Style</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      style={{
                        ...S.button,
                        padding: '5px 10px',
                        fontSize: 11,
                        border: style === s ? '1px solid #7c3aed' : S.button.border,
                        color: style === s ? '#c4b5fd' : S.button.color
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={S.label}>Game Type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {GAME_TYPES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGameType(g)}
                      style={{
                        ...S.button,
                        padding: '5px 10px',
                        fontSize: 11,
                        border: gameType === g ? '1px solid #7c3aed' : S.button.border,
                        color: gameType === g ? '#c4b5fd' : S.button.color
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={S.label}>DeepSeek API Key</label>
                <input
                  style={S.input}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ΓÇª"
                />
              </div>

              <button
                style={{ ...S.primaryButton, opacity: busy === 'generate' ? 0.6 : 1 }}
                disabled={busy === 'generate'}
                onClick={generate}
              >
                {busy === 'generate' ? 'GeneratingΓÇª' : 'Generate Building Recipe'}
              </button>
            </div>
          </div>
        </aside>

        <main style={S.main}>
          {notice && <div style={S.notice}>{notice}</div>}
          {error && <div style={S.error}>{error}</div>}

          {!recipe && busy !== 'generate' && (
            <div style={{ ...S.card, color: '#555b6e', fontSize: 13, lineHeight: 1.7, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2e3340', marginBottom: 8 }}>≡ƒÅù∩╕Å Waiting for input</div>
              Describe your building on the left and hit <strong style={{ color: '#7c3aed' }}>Generate Building Recipe</strong>. DeepSeek will return:
              <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                <li>Structural component breakdown</li>
                <li>Tripo3D prompt for each component</li>
                <li>Roblox material &amp; colour recommendations</li>
                <li>Roblox Studio Lua assembly script</li>
              </ul>
            </div>
          )}

          {recipe && (
            <>
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#eef0f6' }}>{recipe.buildingName}</div>
                    <div style={{ fontSize: 12, color: '#9499a8', marginTop: 4 }}>{recipe.description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span style={S.chip}>{recipe.style}</span>
                    <span style={S.chip}>{recipe.theme}</span>
                  </div>
                </div>
                {recipe.designNotes && (
                  <div style={{ fontSize: 12, color: '#7c8499', marginTop: 8, lineHeight: 1.6 }}>{recipe.designNotes}</div>
                )}
              </div>

              {Array.isArray(recipe.components) && recipe.components.length > 0 && (
                <div style={S.card}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 12 }}>
                    Components ({recipe.components.length}) ΓÇö Generate each with Tripo
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {recipe.components
                      .slice()
                      .sort((a, b) => (a.priority || 99) - (b.priority || 99))
                      .map((comp, i) => {
                        const key = `comp_${i}`
                        const prog = tripoProgress[key]
                        return (
                          <div key={i} style={{ background: '#0d0f14', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#555b6e', background: '#1e2330', borderRadius: 4, padding: '2px 6px' }}>#{comp.priority || i + 1}</span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#c4cad8' }}>{comp.name}</span>
                                  <span style={{ fontSize: 11, color: '#6b7280' }}>{comp.robloxSize}</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#9499a8', lineHeight: 1.55, marginBottom: 6 }}>
                                  <strong style={{ color: '#7c8499' }}>Tripo prompt:</strong> {comp.tripoPrompt}
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, color: '#7c8499' }}>
                                    Material: <strong style={{ color: '#c4cad8' }}>{comp.robloxMaterial}</strong>
                                  </span>
                                  {comp.robloxColor && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7c8499' }}>
                                      Color:
                                      <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: comp.robloxColor, border: '1px solid #2e3340', flexShrink: 0 }} />
                                      <strong style={{ color: '#c4cad8' }}>{comp.robloxColor}</strong>
                                    </span>
                                  )}
                                </div>
                                {comp.assemblyHint && (
                                  <div style={{ fontSize: 11, color: '#555b6e', marginTop: 5 }}>{comp.assemblyHint}</div>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                                <button
                                  style={{ ...S.button, padding: '6px 12px', fontSize: 11, opacity: busy === key ? 0.6 : 1 }}
                                  disabled={busy === key}
                                  onClick={() => generateComponent(comp, i)}
                                >
                                  {busy === key ? 'GeneratingΓÇª' : 'Generate with Tripo'}
                                </button>
                                <button
                                  style={{ ...S.button, padding: '6px 12px', fontSize: 11 }}
                                  onClick={() => window.api.copyText(comp.tripoPrompt)}
                                >
                                  Copy Prompt
                                </button>
                              </div>
                            </div>
                            {prog && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, color: prog.error ? '#fca5a5' : '#93c5fd', marginBottom: 4 }}>
                                  {prog.step}
                                  {prog.pct > 0 && prog.pct < 100 && ` (${prog.pct}%)`}
                                </div>
                                {prog.outputPath && (
                                  <button
                                    style={{ ...S.button, padding: '5px 10px', fontSize: 11 }}
                                    onClick={() => window.api.openPath(prog.outputPath)}
                                  >
                                    Open Model
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {recipe.luaScript && (
                <div style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Lua Assembly Script</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ ...S.button, padding: '6px 10px', fontSize: 11 }} onClick={() => window.api.copyText(recipe.luaScript.replace(/\\n/g, '\n').replace(/\\"/g, '"'))}>
                        Copy
                      </button>
                      <button style={{ ...S.button, padding: '6px 10px', fontSize: 11 }} onClick={exportLua}>
                        Export .lua
                      </button>
                    </div>
                  </div>
                  <pre style={{ margin: 0, background: '#0a0c11', borderRadius: 8, padding: '12px 14px', fontSize: 11, color: '#c7d0e2', lineHeight: 1.7, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {recipe.luaScript.replace(/\\n/g, '\n').replace(/\\"/g, '"')}
                  </pre>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

