#!/usr/bin/env node
/**
 * Clean up orphan closing braces left by apply-dark-mode-hook.js.
 *
 * The broken pattern is:
 *   <blank line>
 *     <whitespace></whitespace>
 *   }
 *
 * right after a useEffect block. The `}` is leftover from the useEffect
 * that was supposed to be fully removed.
 */
const fs = require('fs')

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

let totalFixed = 0

for (const filePath of FILES) {
  if (!fs.existsSync(filePath)) continue
  let src = fs.readFileSync(filePath, 'utf8')
  const orig = src

  // Remove the orphan pattern: blank line(s) + whitespace-only line + closing brace + blank line
  // The brace is on its own line at column 2 or 4 (indented inside the function body)
  src = src.replace(/\n\s*\n\s*\n  \}\n/g, '\n\n')
  // Also try with 4-space indent
  src = src.replace(/\n\s*\n\s*\n    \}\n/g, '\n\n')
  // Also try with 1-space indent (some files use single-space indents)
  src = src.replace(/\n\s*\n\s*\n \}\n/g, '\n\n')

  if (src !== orig) {
    fs.writeFileSync(filePath, src, 'utf8')
    console.log(`[fixed] ${filePath}`)
    totalFixed++
  } else {
    console.log(`[skip]  ${filePath}`)
  }
}

console.log(`\nFixed ${totalFixed} file(s).`)
