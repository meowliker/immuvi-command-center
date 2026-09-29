"""Snapshot the legacy Producer prompt without importing or executing its worker."""
import ast
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent


def contract():
    tree = ast.parse((ROOT / 'team-skill/classify_worker.py').read_text())
    functions = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)
                 and n.name == '_execute_producer_run']
    prompts = [n.value for n in ast.walk(functions[0]) if isinstance(n, ast.Assign)
               and any(isinstance(t, ast.Name) and t.id == '_prompt' for t in n.targets)]
    if len(prompts) != 1 or not isinstance(prompts[0], ast.JoinedStr):
        raise RuntimeError('Legacy Producer prompt boundary changed')
    text = ''.join(n.value if isinstance(n, ast.Constant) else '[parent-context]'
                   for n in prompts[0].values)
    return {'worker_creative': text.split('7. Build a reference_anatomy note', 1)[1]
            .split('15. Upload only final accepted images', 1)[0],
            'model': 'gpt-5.5', 'reasoning_effort': 'medium'}


if __name__ == '__main__':
    path = ROOT / 'team-skill/shared-qa-producer-contract.json'
    content = json.dumps(contract(), ensure_ascii=True, indent=2) + '\n'
    if '--check' in sys.argv:
        if path.read_text() != content:
            raise SystemExit('Producer contract differs from legacy; regenerate and review')
        print('Legacy Producer worker prompt snapshot matches.')
    elif '--write' in sys.argv:
        path.write_text(content)
    else:
        print(content, end='')
