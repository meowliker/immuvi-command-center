"""Bounded QA adaptations of the retained legacy media pipeline."""
import ast


def extend_qa_download_timeout(tree):
    definitions = [node for node in tree.body
                   if isinstance(node, ast.FunctionDef) and node.name == 'download_ytdlp']
    if len(definitions) != 1:
        raise RuntimeError('Legacy download boundary changed; review required')
    calls = [node for node in ast.walk(definitions[0])
             if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
             and isinstance(node.func.value, ast.Name)
             and node.func.value.id == 'subprocess' and node.func.attr == 'run']
    if len(calls) != 1:
        raise RuntimeError('Legacy download subprocess changed; review required')
    timeouts = [keyword for keyword in calls[0].keywords if keyword.arg == 'timeout']
    if len(timeouts) != 1 or not isinstance(timeouts[0].value, ast.Constant) or timeouts[0].value.value != 90:
        raise RuntimeError('Legacy download timeout changed; review required')
    # Allow slower public video transfers, still below the outer 900-second cap.
    # Leave yt-dlp arguments and existing resumable .part files unchanged.
    timeouts[0].value = ast.copy_location(ast.Constant(value=300), timeouts[0].value)
    return tree
