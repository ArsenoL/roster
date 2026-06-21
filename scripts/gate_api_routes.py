#!/usr/bin/env python3
"""
Add module-gate calls to module-specific API routes.

For each (route_path, module_id) pair, prepend a verifyModule check
to each exported HTTP method (GET/POST/PUT/PATCH/DELETE).

The gate is added AFTER existing imports but BEFORE the function body.
If the route file already imports verifyModule, skip it (idempotent).
"""
import os
import re
import sys

# Map of route file path → module ID
ROUTES = {
    'src/app/api/finance/route.ts': 'finance',
    'src/app/api/volunteer-hours/route.ts': 'volunteer',
    'src/app/api/polls/route.ts': 'polls',
    'src/app/api/forms/route.ts': 'forms',
    'src/app/api/inventory/route.ts': 'inventory',
    'src/app/api/maintenance/route.ts': 'maintenance',
    'src/app/api/resources/route.ts': 'resources',
    'src/app/api/meeting-minutes/route.ts': 'meeting-minutes',
    'src/app/api/applications/route.ts': 'applications',
    'src/app/api/invites/route.ts': 'invites',
    'src/app/api/offboarding/route.ts': 'offboarding',
    'src/app/api/alumni/route.ts': 'alumni',
    'src/app/api/analytics/route.ts': 'analytics',
    'src/app/api/reports/route.ts': 'reports',
    'src/app/api/documents/route.ts': 'documents',
    'src/app/api/audit/route.ts': 'audit',
    'src/app/api/integrations/route.ts': 'integrations',
    # 'src/app/api/bulk-import/route.ts': 'bulk-import',  # has sub-routes, skip for now
    'src/app/api/digests/route.ts': 'digests',
    'src/app/api/ai-insights/route.ts': 'insights',
    'src/app/api/assistant/route.ts': 'insights',
    'src/app/api/attendance-excuses/route.ts': 'excuses',
    'src/app/api/attendance-reminders/route.ts': 'reminders',
    'src/app/api/photo-albums/route.ts': 'photos',
    'src/app/api/messages/conversations/route.ts': 'messages',
    # Gamification is spread across badges/points; gate badges
    'src/app/api/badges/route.ts': 'gamification',
}

# Skip routes that already have the gate (idempotent)
GATE_MARKER = "verifyModule(req, "

def patch_file(path: str, module_id: str) -> bool:
    with open(path) as f:
        src = f.read()

    if GATE_MARKER in src:
        print(f"  SKIP (already gated): {path}")
        return False

    # Add import for verifyModule if not present
    if 'verifyModule' not in src:
        # Find the last import line
        import_match = re.findall(r"^import .*$", src, flags=re.MULTILINE)
        if import_match:
            last_import = import_match[-1]
            new_import = "import { verifyModule } from '@/lib/clubhub/module-gate'"
            src = src.replace(last_import, last_import + "\n" + new_import, 1)
        else:
            print(f"  SKIP (no imports found): {path}")
            return False

    # For each exported HTTP method, add the gate at the top of the function body.
    # Pattern: `export async function GET(req: NextRequest) {` or with params
    # We add the gate as the first line of the function body.
    pattern = re.compile(
        r"(export async function (?:GET|POST|PUT|PATCH|DELETE)\(([^)]+)\)\s*\{)"
    )

    def add_gate(m):
        decl = m.group(1)
        params = m.group(2)
        # Detect if there's a `params`/`context` arg (Next.js dynamic routes)
        # e.g. `req: NextRequest, { params }: { params: { id: string } }`
        has_params_arg = 'params' in params
        if has_params_arg:
            # Extract the params variable name
            pm = re.search(r"(\w+)\s*:\s*\{\s*params\s*:", params)
            ctx_var = pm.group(1) if pm else None
            if ctx_var:
                gate_call = f"\n  const __gate = await verifyModule(req, '{module_id}', {ctx_var}.params)\n  if (__gate instanceof Response) return __gate\n"
            else:
                gate_call = f"\n  const __gate = await verifyModule(req, '{module_id}')\n  if (__gate instanceof Response) return __gate\n"
        else:
            gate_call = f"\n  const __gate = await verifyModule(req, '{module_id}')\n  if (__gate instanceof Response) return __gate\n"
        return decl + gate_call

    new_src, n = pattern.subn(add_gate, src)
    if n == 0:
        print(f"  SKIP (no HTTP methods matched): {path}")
        return False

    with open(path, 'w') as f:
        f.write(new_src)
    print(f"  OK ({n} methods gated): {path}")
    return True


def main():
    os.chdir('/home/z/my-project')
    n_ok = 0
    for path, module_id in ROUTES.items():
        if not os.path.exists(path):
            print(f"  MISSING: {path}")
            continue
        if patch_file(path, module_id):
            n_ok += 1
    print(f"\n{ n_ok } files patched.")


if __name__ == '__main__':
    main()
