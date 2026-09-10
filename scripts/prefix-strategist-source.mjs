import ts from 'typescript';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const tables = ['tasks', 'creatives', 'transcripts', 'frame_texts', 'observations', 'verdicts', 'keywords', 'sync_runs', 'research', 'synthesis'];
const sqlTable = new RegExp(`\\b(from|join|update|into)\\s+(${tables.join('|')})\\b`, 'gi');
async function transform(file) {
  const source = await readFile(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const edits = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['pgTable', 'pgEnum', 'index', 'uniqueIndex'].includes(node.expression.text)) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg) && !arg.text.startsWith('strategist_')) {
        edits.push({ start: arg.getStart(tree) + 1, end: arg.getEnd() - 1, text: `strategist_${arg.text}` });
      }
    }
    if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 'sql') {
      const parts = ts.isTemplateExpression(node.template) ? [node.template.head, ...node.template.templateSpans.map(s => s.literal)] : [node.template];
      for (const part of parts) {
        const raw = source.slice(part.getStart(tree), part.getEnd());
        const next = raw.replace(sqlTable, '$1 strategist_$2');
        if (next !== raw) edits.push({ start: part.getStart(tree), end: part.getEnd(), text: next });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  if (output !== source) await writeFile(file, output);
}
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (file.endsWith('.ts') || file.endsWith('.tsx')) await transform(file);
  }
}
await walk('strategist/src');
