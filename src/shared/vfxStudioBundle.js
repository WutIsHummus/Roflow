import { extname, join } from 'path'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

export const STUDIO_BUNDLE_VERSION = 1

function sanitizeLayerFileStem(layerId) {
  return String(layerId || 'layer')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'layer'
}

export function collectLayerTextureExports(preset) {
  const effectName = preset?.meta?.effectName || 'VFX Effect'
  const entries = []

  for (const layer of preset?.layers || []) {
    const uploadName = `${effectName} — ${layer.name || 'Layer'}`.slice(0, 120)

    if (layer.textureSource === 'image' && layer.textureImagePath && existsSync(layer.textureImagePath)) {
      const ext = extname(layer.textureImagePath).toLowerCase() || '.png'
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tga'].includes(ext) ? ext : '.png'
      entries.push({
        layerId: layer.id,
        kind: 'file',
        fileName: `textures/${sanitizeLayerFileStem(layer.id)}${safeExt}`,
        uploadName,
        sourcePath: layer.textureImagePath
      })
      continue
    }

    entries.push({
      layerId: layer.id,
      kind: 'procedural',
      proceduralShape: layer.shape || 'orb',
      uploadName,
      color: layer.color || '#a78bfa'
    })
  }

  return entries
}

export function buildStudioManifest({ effectName, preset, stem, textureEntries }) {
  return {
    version: STUDIO_BUNDLE_VERSION,
    effectName: effectName || preset?.meta?.effectName || 'VFX Effect',
    presetFile: `${stem}.preset.json`,
    generatedAt: new Date().toISOString(),
    textures: textureEntries.map(({ layerId, kind, fileName, proceduralShape, uploadName, color }) => ({
      layerId,
      kind,
      fileName: fileName || null,
      proceduralShape: proceduralShape || null,
      uploadName,
      color: color || null
    })),
    instructions: [
      '1. Install the RoFlow VFX Studio plugin (Export screen → Install Studio Plugin).',
      '2. In Roblox Studio, open the RoFlow VFX toolbar widget.',
      '3. Click Import Bundle and select manifest.json from this folder.',
      '4. When prompted, select all PNG/JPG files from the textures/ folder.',
      '5. The plugin uploads textures to your Roblox account and builds the effect in Workspace.'
    ].join('\n')
  }
}

export function writeStudioBundle({ folderPath, effectName, preset, workflowText, stem }) {
  mkdirSync(join(folderPath, 'textures'), { recursive: true })

  const textureEntries = collectLayerTextureExports(preset)
  const copiedTextures = []

  for (const entry of textureEntries) {
    if (entry.kind !== 'file' || !entry.sourcePath) continue
    const destPath = join(folderPath, entry.fileName)
    mkdirSync(join(folderPath, 'textures'), { recursive: true })
    copyFileSync(entry.sourcePath, destPath)
    copiedTextures.push({ layerId: entry.layerId, fileName: entry.fileName, destPath })
  }

  const presetPath = join(folderPath, `${stem}.preset.json`)
  const workflowPath = join(folderPath, `${stem}.workflow.txt`)
  const manifestPath = join(folderPath, 'manifest.json')
  const readmePath = join(folderPath, 'README.txt')

  const manifest = buildStudioManifest({ effectName, preset, stem, textureEntries })

  return {
    presetPath,
    workflowPath,
    manifestPath,
    readmePath,
    manifest,
    copiedTextures,
    textureEntries
  }
}

export function buildBundleReadme({ effectName, manifest }) {
  return [
    `RoFlow VFX Studio Bundle — ${effectName}`,
    '',
    manifest.instructions,
    '',
    `Generated: ${manifest.generatedAt}`,
    `Layers: ${manifest.textures?.length || 0}`,
    ''
  ].join('\n')
}
