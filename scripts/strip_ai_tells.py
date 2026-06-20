#!/usr/bin/env python3
"""
Strip AI-tell color utilities from clubhub tab components.

Replaces hardcoded Tailwind color utilities with semantic civic equivalents:
- text-emerald-500 / text-emerald-600 / text-emerald-700 → text-foreground
- text-red-500 / text-red-600 / text-red-700 → text-foreground (use .pill-bad for status)
- text-blue-500 / text-blue-600 / text-blue-700 → text-foreground
- text-violet-500 / text-purple-500 / text-pink-500 → text-foreground
- text-amber-500 / text-amber-600 → text-foreground (use .pill-warn for warnings)
- bg-emerald-500 / bg-red-500 / bg-amber-500 / bg-blue-500 (solid) → bg-foreground
- bg-emerald-500/10 / bg-emerald-500/20 (translucent) → bg-muted
- border-emerald-500 / border-emerald-500/30 → border-foreground
- rounded-xl / rounded-2xl / rounded-3xl → (removed, civic uses 0 radius)
- shadow-xl / shadow-2xl / shadow-lg / shadow-sm / shadow → (removed, civic uses borders)
- backdrop-blur / backdrop-blur-md / backdrop-blur-lg → (removed, civic uses solid bg)
- from-emerald-500/10 to-emerald-500/5 (gradients) → bg-muted (handled manually per file)

Leaves the actual logic intact. Idempotent.
"""
import os
import re
import sys

ROOT = "/home/z/my-project/src/components/clubhub"
EXTS = (".tsx", ".ts")

# Color → semantic mapping. Order matters: more-specific patterns first.
COLOR_REPLACEMENTS = [
    # Translucent bg-* (e.g. bg-emerald-500/10) → bg-muted
    (r'\bbg-(emerald|red|blue|violet|purple|pink|amber|yellow|cyan|teal|indigo|rose|lime|orange|fuchsia|sky)-(?:50|100|200|500|600|700)/(?:\d+)',
     'bg-muted'),
    # Solid bg-* (e.g. bg-emerald-500) → bg-foreground
    (r'\bbg-(emerald|red|violet|purple|pink|indigo|rose|fuchsia|sky)-(?:50|100|200|500|600|700)\b',
     'bg-foreground'),
    # bg-amber-500 → bg-foreground (kept separate in case we want to refine later)
    (r'\bbg-amber-(?:50|100|200|500|600|700)\b', 'bg-foreground'),
    (r'\bbg-blue-(?:50|100|200|500|600|700)\b', 'bg-foreground'),
    (r'\bbg-yellow-(?:50|100|200|500|600|700)\b', 'bg-foreground'),
    (r'\bbg-cyan-(?:50|100|200|500|600|700)\b', 'bg-foreground'),
    (r'\bbg-teal-(?:50|100|200|500|600|700)\b', 'bg-foreground'),
    (r'\bbg-lime-(?:50|100|200|500|600|700)\b', 'bg-foreground'),
    (r'\bbg-orange-(?:50|100|200|500|600|700)\b', 'bg-foreground'),

    # text-* (e.g. text-emerald-500) → text-foreground
    (r'\btext-(emerald|red|violet|purple|pink|indigo|rose|fuchsia|sky)-(?:50|100|200|400|500|600|700)\b',
     'text-foreground'),
    (r'\btext-amber-(?:50|100|200|400|500|600|700)\b', 'text-foreground'),
    (r'\btext-blue-(?:50|100|200|400|500|600|700)\b', 'text-foreground'),
    (r'\btext-yellow-(?:50|100|200|400|500|600|700)\b', 'text-foreground'),
    (r'\btext-cyan-(?:50|100|200|400|500|600|700)\b', 'text-foreground'),
    (r'\btext-teal-(?:50|100|200|400|500|600|700)\b', 'text-foreground'),
    (r'\btext-lime-(?:50|100|200|400|500|600|700)\b', 'text-foreground'),
    (r'\btext-orange-(?:50|100|200|400|500|600|700)\b', 'text-foreground'),

    # border-* (e.g. border-emerald-500) → border-foreground
    (r'\bborder-(emerald|red|violet|purple|pink|indigo|rose|fuchsia|sky)-(?:50|100|200|400|500|600|700)\b',
     'border-foreground'),
    (r'\bborder-amber-(?:50|100|200|400|500|600|700)\b', 'border-foreground'),
    (r'\bborder-blue-(?:50|100|200|400|500|600|700)\b', 'border-foreground'),

    # ring-* (rare, but consistent)
    (r'\bring-(emerald|red|violet|purple|pink|indigo|rose|fuchsia|sky|amber|blue)-(?:50|100|200|400|500|600|700)\b',
     'ring-foreground'),
]

# Decorative utilities to remove entirely (replace with empty string).
# These are the AI-tell decorative elements.
DECORATIVE_REMOVALS = [
    (r'\brounded-(?:xl|2xl|3xl)\b', ''),  # civic uses 0 radius (--radius: 0)
    (r'\bshadow-(?:sm|md|lg|xl|2xl)\b', ''),
    (r'\bbackdrop-blur(?:-(?:sm|md|lg|xl|2xl))?\b', ''),
    # Gradient utilities — replace with bg-muted
    (r'\bbg-gradient-to-(?:br|tr|bl|tl|b|t|r|l)\b', 'bg-muted'),
    (r'\bfrom-(?:emerald|red|violet|purple|pink|indigo|rose|fuchsia|sky|amber|blue|cyan|teal|lime|orange)-(?:50|100|200|400|500|600|700)(?:/\d+)?\b', ''),
    (r'\bto-(?:emerald|red|violet|purple|pink|indigo|rose|fuchsia|sky|amber|blue|cyan|teal|lime|orange)-(?:50|100|200|400|500|600|700)(?:/\d+)?\b', ''),
    (r'\bvia-(?:emerald|red|violet|purple|pink|indigo|rose|fuchsia|sky|amber|blue|cyan|teal|lime|orange)-(?:50|100|200|400|500|600|700)(?:/\d+)?\b', ''),
]

def clean_file(path: str) -> tuple[int, list[str]]:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            original = f.read()
    except (UnicodeDecodeError, PermissionError):
        return (0, [])

    content = original
    changes: list[str] = []

    for pattern, replacement in COLOR_REPLACEMENTS + DECORATIVE_REMOVALS:
        new_content, n = re.subn(pattern, replacement, content)
        if n:
            desc = f"{pattern[:40]}{'…' if len(pattern) > 40 else ''} → {replacement or '(removed)'}: {n}x"
            changes.append(desc)
            content = new_content

    # Clean up any double-spaces left by removals
    content = re.sub(r'  +', ' ', content)
    # Clean up trailing space before " in className="..."
    content = re.sub(r'className="\s+', 'className="', content)
    content = re.sub(r'\s+"', '"', content)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return (len(changes), changes)
    return (0, [])


def main() -> int:
    if not os.path.isdir(ROOT):
        print(f"ERR: {ROOT} not found", file=sys.stderr)
        return 1

    total_files = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        for skip in ('node_modules',):
            if skip in dirnames:
                dirnames.remove(skip)
        for fn in filenames:
            if not fn.endswith(EXTS):
                continue
            path = os.path.join(dirpath, fn)
            n, changes = clean_file(path)
            if n:
                total_files += 1
                rel = os.path.relpath(path, ROOT)
                print(f"[OK] {rel}")
                for c in changes:
                    print(f"  {c}")

    print(f"\nFiles modified: {total_files}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
