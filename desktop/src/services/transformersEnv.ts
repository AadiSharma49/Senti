/**
 * Shared @huggingface/transformers environment config. Import this once
 * (side-effect) before using any model so every engine loads locally and
 * offline, through the Vite-bundled onnxruntime WASM runtime.
 */
import { env } from '@huggingface/transformers'
// ORT WASM runtime resolved by Vite (?url) so dev + prod both serve the
// loader as a real module; /public files cannot be dynamically imported.
import ortWasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url'
import ortMjsUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url'

// All assets are local: never touch the HuggingFace hub or CDNs.
// (allowLocalModels defaults to false in browser environments.)
env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = '/models/'
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortMjsUrl }
  // Single-threaded: worker threads require cross-origin isolation
  env.backends.onnx.wasm.numThreads = 1
}
