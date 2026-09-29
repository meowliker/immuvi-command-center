"""Pure legacy prompt/data adapter. No service credentials or agent execution."""
import ast
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from tools.strategist.pipeline import _bundle_for_synthesis
from tools.strategist.synthesis import _build_prompt as synthesis_prompt
from tools.strategist.renderer import _build_prompt as memory_prompt
from tools.strategist.aggregate import build_memory_json
from tools.strategist.clickup import compute_content_hash
from tools.strategist.taxonomy import is_judged, classify_status


def winner_contract():
    tree = ast.parse((ROOT / 'team-skill/classify_worker.py').read_text())
    fn = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)
              and n.name == 'run_variation_brief_skill_on_job')
    prompt = next(n.value for n in ast.walk(fn) if isinstance(n, ast.Assign)
                  and any(isinstance(t, ast.Name) and t.id == 'prompt' for t in n.targets))
    text = ''.join(n.value if isinstance(n, ast.Constant) else '[parent-context]'
                   for n in prompt.values)
    return text.split('  4. Visually classify', 1)[1].split('  6. Create a ClickUp', 1)[0]


def adapt(value):
    operation = value['operation']
    if operation == 'winner-contract':
        return winner_contract()
    if operation == 'task':
        bundle = _bundle_for_synthesis(value['task'], value.get('comments', [])[:30])
        if not is_judged(bundle['status']):
            return None
        fields = bundle['custom_fields']
        return {'prompt': synthesis_prompt(bundle), 'row': {
            'clickup_task_id': bundle['task_id'],
            'content_hash': compute_content_hash(bundle['status'], bundle['description'],
                                                 bundle['comments'], fields),
            'is_winner': classify_status(bundle['status']) == 'winner_group',
            'status': bundle['status'].strip().lower(),
            'spend': fields.get('Spend'), 'revenue': fields.get('Revenue')}}
    if operation == 'memory':
        memory = build_memory_json(value['product']['id'], value['product']['name'], value['rows'])
        return {'json': memory, 'prompt': memory_prompt(memory)}
    raise ValueError('Unknown analysis operation')


if __name__ == '__main__':
    print(json.dumps(adapt(json.load(sys.stdin)), ensure_ascii=True))
