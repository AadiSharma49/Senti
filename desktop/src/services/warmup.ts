import { voiceEmbeddingEngine } from './voiceEmbeddingEngine'
import { loadSpeechRecognition } from './speechRecognition'

/**
 * Warm the on-device models in the background at boot.
 *
 * Both models are loaded lazily on first use, which meant the first voice
 * unlock — and the first question you ask — paid a multi-second cold start
 * while onnxruntime parsed the graph. The user reads that as "Senti is slow",
 * when in truth it was slow exactly once.
 *
 * We load them while the user is still looking at the lock screen, so by the
 * time they tap anything the model is already resident.
 */
let started = false

export function warmModels(): void {
  if (started) return
  started = true

  // Speaker verification first: it's on the critical path (unlocking), and
  // it's the smaller of the two.
  void voiceEmbeddingEngine.load().catch(() => {
    // A failure here surfaces properly when the user actually tries to unlock.
  })

  // Whisper is far heavier (fp32) and is only needed once the user talks to the
  // assistant. Stagger it so it can't starve the unlock path of CPU.
  window.setTimeout(() => {
    void loadSpeechRecognition().catch(() => {})
  }, 2000)
}
