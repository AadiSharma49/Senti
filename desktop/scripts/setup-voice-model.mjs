/**
 * One-time setup for the on-device speaker verification model.
 *
 * Downloads the WeSpeaker ResNet34-LM speaker embedding model (ONNX)
 * into public/models/ and stages the onnxruntime-web WASM runtime into
 * public/ort/, so the app runs fully offline with no CDN access.
 *
 * Run with: npm run setup:voice
 */
import { mkdir, copyFile, stat, readdir } from 'fs/promises'
import { createWriteStream } from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const MODEL_ID = 'wespeaker-voxceleb-resnet34-LM'
const HF_BASE = `https://huggingface.co/onnx-community/${MODEL_ID}/resolve/main`
const MODEL_DIR = path.join(root, 'public', 'models', MODEL_ID)
const ORT_DIR = path.join(root, 'public', 'ort')
const ORT_DIST = path.join(root, 'node_modules', 'onnxruntime-web', 'dist')

const MODEL_FILES = [
  'config.json',
  'preprocessor_config.json',
  'onnx/model.onnx', // fp32, ~26 MB — best accuracy for security use
]

// Copy every runtime variant (base/jsep/asyncify/jspi × wasm/mjs):
// which one onnxruntime-web picks depends on its version and features.
const ORT_FILE_PATTERN = /^ort-.*\.(wasm|mjs)$/

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
    console.log(`  skip (exists): ${path.basename(dest)}`)
    return
  }
  console.log(`  downloading: ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  await mkdir(path.dirname(dest), { recursive: true })
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
  const { size } = await stat(dest)
  console.log(`  saved: ${path.basename(dest)} (${(size / 1024 / 1024).toFixed(1)} MB)`)
}

console.log(`[setup-voice] Model files -> ${MODEL_DIR}`)
for (const file of MODEL_FILES) {
  await download(`${HF_BASE}/${file}`, path.join(MODEL_DIR, file))
}

console.log(`[setup-voice] ORT runtime -> ${ORT_DIR}`)
await mkdir(ORT_DIR, { recursive: true })
const distFiles = await readdir(ORT_DIST)
for (const file of distFiles) {
  if (!ORT_FILE_PATTERN.test(file)) continue
  await copyFile(path.join(ORT_DIST, file), path.join(ORT_DIR, file))
  console.log(`  copied: ${file}`)
}

console.log('[setup-voice] Done.')
