export const DEFAULT_ANIMATION_WORKFLOW = {
  tab: 'text',
  progress: null,
  textForm: {
    prompt: '',
    model: 'hymotion',
    duration: 4
  },
  videoForm: {
    videoPath: null
  },
  activeJob: null,
  error: null,
  result: null
}

export function normalizeAnimationWorkflow(source = {}) {
  const workflow = source.animationWorkflow || source
  const legacyResult = source.animationResult ?? null

  return {
    ...DEFAULT_ANIMATION_WORKFLOW,
    ...workflow,
    textForm: {
      ...DEFAULT_ANIMATION_WORKFLOW.textForm,
      ...(workflow.textForm || {})
    },
    videoForm: {
      ...DEFAULT_ANIMATION_WORKFLOW.videoForm,
      ...(workflow.videoForm || {})
    },
    result: workflow.result ?? legacyResult ?? null
  }
}

export function mergeAnimationWorkflow(workflow, patch) {
  const next = {
    ...workflow,
    ...patch
  }

  if (patch.textForm) {
    next.textForm = { ...workflow.textForm, ...patch.textForm }
  }

  if (patch.videoForm) {
    next.videoForm = { ...workflow.videoForm, ...patch.videoForm }
  }

  return next
}

export function serializeAnimationWorkflow(workflow) {
  if (!workflow) return null
  return {
    tab: workflow.tab || 'text',
    progress: workflow.progress || null,
    textForm: {
      prompt: workflow.textForm?.prompt || '',
      model: workflow.textForm?.model || 'hymotion',
      duration: workflow.textForm?.duration ?? 4
    },
    videoForm: {
      videoPath: workflow.videoForm?.videoPath || null
    },
    activeJob: workflow.activeJob || null,
    error: workflow.error || null,
    result: workflow.result || null
  }
}
