#!/usr/bin/env node
/**
 * Bulk-replace the dark-mode useEffect pattern with the useDarkMode hook.
 *
 * Pattern being replaced (in each file):
 *   const [dark, setDark] = useState(false)
 *   ...
 *   useEffect(() => { setDark(document.documentElement.classList.contains('dark')) }, [...])
 *   ...
 *   const toggleDark = () => { ... 8 lines ... }
 *
 * With:
 *   const { dark, toggle: toggleDark } = useDarkMode()
 *
 * Also adds the import: import { useDarkMode } from '@/lib/clubhub/use-dark-mode'
 *
 * Run once. Idempotent — files that don't match the pattern are skipped.
 */
const fs = require('fs')
const path = require('path')

const FILES = [
  '/home/z/my-project/src/app/app/page.tsx',
  '/home/z/my-project/src/app/app/me/page.tsx',
  '/home/z/my-project/src/app/app/parent/page.tsx',
  '/home/z/my-project/src/app/discover/page.tsx',
  '/home/z/my-project/src/app/kiosk/page.tsx',
  '/home/z/my-project/src/app/page.tsx',
  '/home/z/my-project/src/components/clubhub/command-palette.tsx',
  '/home/z/my-project/src/components/clubhub/user-menu.tsx',
]

// The toggle function pattern (varies slightly per file, so we use a regex)
const TOGGLE_REGEX = /const toggleDark = \(\) => \{[\s\S]*?\}\n/

// The useState + useEffect pattern
// We need to handle both `useState(false)` for dark
const DARK_USE_STATE_REGEX = /const \[dark, setDark\] = useState\(false\)\n/
const DARK_USE_EFFECT_REGEX = /useEffect\(\(\) => \{\s*setDark\(document\.documentElement\.classList\.contains\('dark'\)\)\s*\}, \[[^)]*\]\)\n/

let totalChanged = 0

for (const filePath of FILES) {
  if (!fs.existsSync(filePath)) {
    console.log(`[skip] not found: ${filePath}`)
    continue
  }

  let src = fs.readFileSync(filePath, 'utf8')
  const orig = src
  const rel = path.relative('/home/z/my-project', filePath)

  // 1. Add the import (if not already present)
  if (!src.includes('use-dark-mode')) {
    // Insert after the last `import ... from '@/lib/clubhub/...'` line, or
    // after the first `import` line as a fallback.
    const importRegex = /(import [^\n]+ from ['"]@\/lib\/clubhub\/[^'"]+['"]\n)/
    if (importRegex.test(src)) {
      src = src.replace(importRegex, (m) => m + "import { useDarkMode } from '@/lib/clubhub/use-dark-mode'\n")
    } else {
      // Fallback: add after the first 'use client' or first import
      const firstImport = src.match(/(import [^\n]+\n)/)
      if (firstImport) {
        src = src.replace(firstImport[0], firstImport[0] + "import { useDarkMode } from '@/lib/clubhub/use-dark-mode'\n")
      }
    }
  }

  // 2. Replace `const [dark, setDark] = useState(false)` with `const { dark, toggle: toggleDark } = useDarkMode()`
  if (DARK_USE_STATE_REGEX.test(src)) {
    src = src.replace(DARK_USE_STATE_REGEX, "const { dark, toggle: toggleDark } = useDarkMode()\n")
  }

  // 3. Remove the useEffect that reads dark from DOM
  if (DARK_USE_EFFECT_REGEX.test(src)) {
    src = src.replace(DARK_USE_EFFECT_REGEX, '')
  } else {
    // Try multi-line variant
    const multilineRegex = /useEffect\(\(\) => \{\s*\n\s*setDark\(document\.documentElement\.classList\.contains\('dark'\)\)\s*\n\s*\}, \[[^\]]*\]\)\n?\s*\n?/
    if (multilineRegex.test(src)) {
      src = src.replace(multilineRegex, '')
    }
  }

  // 4. Remove the toggleDark function definition
  if (TOGGLE_REGEX.test(src)) {
    src = src.replace(TOGGLE_REGEX, '')
  }

  if (src !== orig) {
    fs.writeFileSync(filePath, src, 'utf8')
    console.log(`[ok]   ${rel}`)
    totalChanged++
  } else {
    console.log(`[skip] no changes: ${rel}`)
  }
}

console.log(`\nDone. Modified ${totalChanged} file(s).`)
