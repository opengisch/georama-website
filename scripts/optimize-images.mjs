import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import fg from 'fast-glob'
import sharp from 'sharp'
import { optimize as optimizeSvg } from 'svgo'

const args = new Set(process.argv.slice(2))
const shouldWrite = args.has('--write')
const shouldGenerateWebp = args.has('--webp')

if (args.has('--help') || args.has('-h')) {
  console.log(`Usage: node scripts/optimize-images.mjs [--write] [--webp]

Optimizes images in static/ (currently: static/images/** and static/*).

Options:
  --write   Overwrite originals (PNG/JPG/JPEG/SVG). Without this, runs in dry-run mode.
  --webp    Also generate .webp variants next to PNG/JPG/JPEG (implies --write for webp outputs).
`)
  process.exit(0)
}

const workspaceRoot = process.cwd()
const targets = await fg(
  [
    'static/images/**/*.{png,jpg,jpeg,svg}',
    'static/*.{png,jpg,jpeg,svg}',
    '!static/**/_gen/**',
  ],
  { cwd: workspaceRoot, onlyFiles: true, dot: false }
)

const formatBytes = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

const readSize = async (filePath) => {
  const stat = await fs.stat(filePath)
  return stat.size
}

let filesChanged = 0
let bytesBefore = 0
let bytesAfter = 0
let webpGenerated = 0

for (const rel of targets) {
  const abs = path.join(workspaceRoot, rel)
  const ext = path.extname(rel).toLowerCase()

  const before = await readSize(abs)
  bytesBefore += before

  if (ext === '.svg') {
    const input = await fs.readFile(abs, 'utf8')
    const result = optimizeSvg(input, {
      path: abs,
      multipass: true,
      plugins: [
        'preset-default',
        {
          name: 'removeViewBox',
          active: false,
        },
      ],
    })

    if (typeof result.data !== 'string') {
      bytesAfter += before
      continue
    }

    const out = Buffer.from(result.data, 'utf8')
    const after = Math.min(before, out.byteLength)
    bytesAfter += after

    if (shouldWrite && out.byteLength < before) {
      await fs.writeFile(abs, out)
      filesChanged += 1
    }
    continue
  }

  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    const input = await fs.readFile(abs)
    const image = sharp(input, { failOn: 'none' })
    await image.metadata()

    let optimized
    if (ext === '.png') {
      optimized = await image
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          effort: 10,
        })
        .toBuffer()
    } else {
      optimized = await image
        .jpeg({
          quality: 82,
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer()
    }

    const after = Math.min(before, optimized.byteLength)
    bytesAfter += after

    if (shouldWrite && optimized.byteLength < before) {
      await fs.writeFile(abs, optimized)
      filesChanged += 1
    }

    if (shouldGenerateWebp) {
      const webpOut = await image.webp({ quality: 82, effort: 5 }).toBuffer()
      const webpPath = abs.replace(/\.(png|jpe?g)$/i, '.webp')
      await fs.writeFile(webpPath, webpOut)
      webpGenerated += 1
    }

    continue
  }

  bytesAfter += before
}

const delta = bytesBefore - bytesAfter
const deltaPct = bytesBefore > 0 ? (delta / bytesBefore) * 100 : 0

console.log(`Scanned: ${targets.length} file(s)`)
console.log(`Mode: ${shouldWrite ? 'write' : 'dry-run'}${shouldGenerateWebp ? ' + webp' : ''}`)
console.log(`Total before: ${formatBytes(bytesBefore)}`)
console.log(`Total after:  ${formatBytes(bytesAfter)}${shouldWrite ? '' : ' (estimated)'}`)
console.log(`Savings:     ${formatBytes(Math.max(0, delta))} (${Math.max(0, deltaPct).toFixed(1)}%)`)
if (shouldWrite) console.log(`Changed:     ${filesChanged} file(s)`)
if (shouldGenerateWebp) console.log(`WebP files:  ${webpGenerated}`)
