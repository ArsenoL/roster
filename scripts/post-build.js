// Cross-platform post-build step — copies .next/static and public/ into the
// standalone server output dir. Replaces the previous Unix-only `cp -r`
// command in package.json's "build" script so `npm run build` works on
// Windows out of the box.
//
// This script is a no-op if .next/standalone doesn't exist (e.g., when
// running `next build` without `output: 'standalone'` configured in
// next.config).

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const standaloneDir = path.join(projectRoot, '.next', 'standalone')

if (!fs.existsSync(standaloneDir)) {
  console.log('[post-build] .next/standalone not found — skipping copy step.')
  process.exit(0)
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

// 1. .next/static → .next/standalone/.next/static
const staticSrc = path.join(projectRoot, '.next', 'static')
const staticDest = path.join(standaloneDir, '.next', 'static')
if (fs.existsSync(staticSrc)) {
  console.log(`[post-build] Copying .next/static → .next/standalone/.next/static`)
  copyRecursive(staticSrc, staticDest)
} else {
  console.log('[post-build] .next/static not found — skipping.')
}

// 2. public/ → .next/standalone/public/
const publicSrc = path.join(projectRoot, 'public')
const publicDest = path.join(standaloneDir, 'public')
if (fs.existsSync(publicSrc)) {
  console.log(`[post-build] Copying public/ → .next/standalone/public/`)
  copyRecursive(publicSrc, publicDest)
} else {
  console.log('[post-build] public/ not found — skipping.')
}

console.log('[post-build] Done.')
