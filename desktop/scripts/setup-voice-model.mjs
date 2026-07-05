/**
 * One-time setup for the on-device voice models.
 *
 * Downloads into public/models/ so the app runs fully offline:
 *   - WeSpeaker ResNet34-LM  → speaker verification (WHO is speaking)
 *   - Whisper tiny.en (ONNX) → speech recognition (WHAT was said)
 *
 * (The onnxruntime WASM runtime itself is bundled by Vite from
 * node_modules — see voiceEmbeddingEngine.ts.)
 *
 * Run with: npm run setup:voice
 */
import { mkdir, stat } from 'fs/promises'
import { createWriteStream } from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const MODELS_DIR = path.join(root, 'public', 'models')

// Each model mirrors its HuggingFace repo into public/models/<localId>/.
const MODELS = [
  {
    localId: 'wespeaker-voxceleb-resnet34-LM',
    base: 'https://huggingface.co/onnx-community/wespeaker-voxceleb-resnet34-LM/resolve/main',
    files: [
      'config.json',
      'preprocessor_config.json',
      'onnx/model.onnx', // fp32, ~26 MB — best accuracy for security use
    ],
  },
  {
    localId: 'whisper-tiny.en',
    base: 'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main',
    files: [
      'config.json',
      'generation_config.json',
      'preprocessor_config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'added_tokens.json',
      'special_tokens_map.json',
      'normalizer.json',
      'merges.txt',
      'vocab.json',
      // q8 (quantized) variants — what transformers.js loads with dtype 'q8'
      'onnx/encoder_model_quantized.onnx',
      'onnx/decoder_model_merged_quantized.onnx',
    ],
  },
]

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function download(url, dest) {
  if (await exists(dest)) {
    console.log(`  skip (exists): ${path.relative(MODELS_DIR, dest)}`)
    return
  }
  console.log(`  downloading: ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  await mkdir(path.dirname(dest), { recursive: true })
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
  const { size } = await stat(dest)
  console.log(`  saved: ${path.relative(MODELS_DIR, dest)} (${(size / 1024 / 1024).toFixed(1)} MB)`)
}

for (const model of MODELS) {
  const dir = path.join(MODELS_DIR, model.localId)
  console.log(`[setup-voice] ${model.localId} -> ${dir}`)
  for (const file of model.files) {
    await download(`${model.base}/${file}`, path.join(dir, file))
  }
}

console.log('[setup-voice] Done.')
