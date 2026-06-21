#!/usr/bin/env python3
"""
Rename ClubHub → Roster across the source tree.

Rules:
- Replace user-facing "ClubHub" (case-sensitive capital C, capital H) → "Roster"
- Replace internal identifiers that show up in devtools / API contracts:
    clubhub_session          → roster_session
    clubhub-dev-secret       → roster-dev-secret
    noreply@clubhub.local    → noreply@roster.local
    X-ClubHub-*              → X-Roster-*
    clubhub.theme            → roster.theme
    clubhub.currentClub      → roster.currentClub
- LEAVE the lowercase folder/import path `@/lib/clubhub/` and
  `@/components/clubhub/` untouched — they're internal identifiers,
  renaming them is churn with no user-visible benefit.

Idempotent: re-running it on already-renamed files is a no-op.
"""
import os
import re
import sys

ROOT = "/home/z/my-project/src"
EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".md", ".html")

# Ordered replacements. Each entry: (pattern, replacement, description)
# Use plain string replace for literals, regex only where needed.
REPLACEMENTS = [
    # Internal identifiers (lowercase) — do these FIRST so they don't get
    # partially clobbered by the catch-all ClubHub→Roster replace below.
    ("clubhub_session",            "roster_session",            "session cookie name"),
    ("clubhub-dev-secret",         "roster-dev-secret",         "dev auth secret fallback"),
    ("noreply@clubhub.local",      "noreply@roster.local",      "default from-email"),
    ("X-ClubHub-Event",            "X-Roster-Event",            "webhook header"),
    ("X-ClubHub-Timestamp",        "X-Roster-Timestamp",        "webhook header"),
    ("X-ClubHub-Signature",        "X-Roster-Signature",        "webhook header"),
    ("clubhub.theme",              "roster.theme",              "theme localStorage key"),
    ("clubhub.currentClub",        "roster.currentClub",        "current-club localStorage key"),
    # User-facing brand name (capital C, capital H) — won't touch lowercase 'clubhub'
    # import paths like @/lib/clubhub/ or @/components/clubhub/
    ("ClubHub",                    "Roster",                    "brand name"),
]

def rename_file(path: str) -> tuple[int, list[str]]:
    """Apply all replacements to a single file. Returns (n_changes, descriptions)."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            original = f.read()
    except (UnicodeDecodeError, PermissionError):
        return (0, [])

    content = original
    changes: list[str] = []
    for old, new, desc in REPLACEMENTS:
        count = content.count(old)
        if count:
            content = content.replace(old, new)
            changes.append(f"  {desc}: {count}x")

    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return (len(changes), changes)
    return (0, [])


def main() -> int:
    if not os.path.isdir(ROOT):
        print(f"ERR: {ROOT} not found", file=sys.stderr)
        return 1

    total_files = 0
    total_changes = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # Skip irrelevant subdirs
        for skip in ("node_modules", ".next", ".git"):
            if skip in dirnames:
                dirnames.remove(skip)
        for fn in filenames:
            if not fn.endswith(EXTS):
                continue
            path = os.path.join(dirpath, fn)
            n, changes = rename_file(path)
            if n:
                total_files += 1
                total_changes += sum(int(c.rsplit(": ", 1)[-1].rstrip("x")) for c in changes)
                rel = os.path.relpath(path, ROOT)
                print(f"[OK] {rel}")
                for c in changes:
                    print(c)

    print()
    print(f"Files modified: {total_files}")
    print(f"Total replacements: {total_changes}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
