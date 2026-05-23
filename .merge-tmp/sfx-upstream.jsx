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
  chip: { display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#1e2330', color: '#93c5fd' },
  chipGreen: { display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#0d2518', color: '#4ade80' },
  tag: { display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, background: '#1e2330', color: '#9499a8', marginRight: 4, marginBottom: 4 }
}

const CATEGORIES = ['hit', 'ambient', 'ui', 'ability', 'environment', 'music']

export default function SFXModule() {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('hit')
  const [gameContext, setGameContext] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyLoaded, setApiKeyLoaded] = useState(() => !window.api?.configGet)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [recipe, setRecipe] = useState(null)

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

  const generate = useCallback(async () => {
    if (!apiKey.trim()) { setError('Add your DeepSeek API key first.'); return }
    if (!description.trim()) { setError('Enter a sound description first.'); return }
    setError('')
    setNotice('')
    setBusy(true)
    const result = await window.api.sfxGenerateRecipe({ description, category, gameContext, apiKey: apiKey.trim() })
    setBusy(false)
    if (!result?.success) { setError(result?.error || 'Generation failed.'); return }
    setRecipe(result.recipe)
    setNotice(`Recipe generated ΓÇö "${result.recipe.soundName}"`)
  }, [apiKey, category, description, gameContext])

  const exportLua = useCallback(async () => {
    if (!recipe?.luaScript) return
    const filePath = await window.api.saveFile({
      title: 'Export SFX Lua Script',
      defaultPath: `${(recipe.soundName || 'sfx').replace(/\s+/g, '_')}.lua`,
      filters: [{ name: 'Lua Script', extensions: ['lua'] }]
    })
    if (!filePath) return
    await window.api.writeTextFile({ filePath, text: recipe.luaScript.replace(/\\n/g, '\n').replace(/\\"/g, '"') })
    window.api.openPath(filePath)
  }, [recipe])

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>SFX Studio</h1>
        <p style={S.subtitle}>Describe your sound effect ΓÇö DeepSeek designs the Roblox SoundService setup and Lua code automatically.</p>
      </div>

      <div style={S.body}>
        <aside style={S.rail}>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>Sound Input</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={S.label}>Sound Description</label>
                <textarea
                  style={{ ...S.textarea, minHeight: 90 }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. A sharp magical impact with a short echo, used when a spell hits an enemy"
                />
              </div>

              <div>
                <label style={S.label}>Category</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      style={{
                        ...S.button,
                        padding: '5px 10px',
                        fontSize: 11,
                        border: category === c ? '1px solid #7c3aed' : S.button.border,
                        color: category === c ? '#c4b5fd' : S.button.color
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={S.label}>Game Context (optional)</label>
                <input
                  style={S.input}
                  value={gameContext}
                  onChange={(e) => setGameContext(e.target.value)}
                  placeholder="e.g. Fantasy RPG combat, Sci-fi shooter, Casual platformer"
                />
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
                style={{ ...S.primaryButton, opacity: busy ? 0.6 : 1 }}
                disabled={busy}
                onClick={generate}
              >
                {busy ? 'GeneratingΓÇª' : 'Generate SFX Recipe'}
              </button>
            </div>
          </div>
        </aside>

        <main style={S.main}>
          {notice && <div style={S.notice}>{notice}</div>}
          {error && <div style={S.error}>{error}</div>}

          {!recipe && !busy && (
            <div style={{ ...S.card, color: '#555b6e', fontSize: 13, lineHeight: 1.7, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2e3340', marginBottom: 8 }}>≡ƒöè Waiting for input</div>
              Describe your sound on the left and hit <strong style={{ color: '#7c3aed' }}>Generate SFX Recipe</strong>. DeepSeek will return:
              <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                <li>Roblox SoundService property values</li>
                <li>SoundEffect chain (Equalizer, Reverb, etc.)</li>
                <li>Audio search terms for Roblox Marketplace &amp; Freesound</li>
                <li>Ready-to-paste Lua script</li>
              </ul>
            </div>
          )}

          {recipe && (
            <>
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#eef0f6' }}>{recipe.soundName}</div>
                    <div style={{ fontSize: 12, color: '#9499a8', marginTop: 4 }}>{recipe.description}</div>
                  </div>
                  <span style={S.chip}>{recipe.category}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    ['Volume', recipe.volume],
                    ['Looped', recipe.looped ? 'Yes' : 'No'],
                    ['Speed', recipe.playbackSpeed + 'x'],
                    ['Roll Off', `${recipe.rollOffMinDistance}ΓÇô${recipe.rollOffMaxDistance} studs`]
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#0d0f14', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#7c8499', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {Array.isArray(recipe.layerBreakdown) && recipe.layerBreakdown.length > 0 && (
                <div style={S.card}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 12 }}>Sound Layers</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recipe.layerBreakdown.map((layer, i) => (
                      <div key={i} style={{ background: '#0d0f14', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#c4cad8' }}>{layer.name}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{layer.role}</div>
                          {layer.notes && <div style={{ fontSize: 11, color: '#555b6e', marginTop: 3 }}>{layer.notes}</div>}
                        </div>
                        <span style={{ ...S.chip, flexShrink: 0 }}>{layer.frequency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(recipe.soundEffects) && recipe.soundEffects.length > 0 && (
                <div style={S.card}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 12 }}>SoundEffect Chain</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recipe.soundEffects.map((fx, i) => (
                      <div key={i} style={{ background: '#0d0f14', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>{fx.type}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {Object.entries(fx.params || {}).map(([k, v]) => (
                            <span key={k} style={S.tag}>{k}: <strong style={{ color: '#c4cad8' }}>{String(v)}</strong></span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(recipe.audioSearchTerms) && recipe.audioSearchTerms.length > 0 && (
                <div style={S.card}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 12 }}>Audio Search Terms</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recipe.audioSearchTerms.map((term, i) => (
                      <div key={i} style={{ background: '#0d0f14', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#7c8499', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{term.source}</div>
                          <div style={{ fontSize: 12, color: '#c4cad8' }}>{term.query}</div>
                        </div>
                        <button
                          style={{ ...S.button, padding: '5px 10px', fontSize: 11 }}
                          onClick={() => window.api.copyText(term.query)}
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recipe.designNotes && (
                <div style={S.card}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 8 }}>Design Notes</div>
                  <div style={{ fontSize: 12, color: '#9499a8', lineHeight: 1.7 }}>{recipe.designNotes}</div>
                </div>
              )}

              {recipe.luaScript && (
                <div style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Lua Script</div>
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

