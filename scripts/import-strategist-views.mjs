import { readFile,writeFile,mkdir } from 'node:fs/promises';
const source=process.argv[2];
const views={
  formats:{start:'  const solid',props:'{ snap }: { snap: Snapshot }',imports:"import type { Snapshot } from '../lib/data/types'\n"},
  keywords:{start:'  const groups',props:'{ snap }: { snap: Snapshot }',imports:"import type { Snapshot } from '../lib/data/types'\n"},
  verification:{start:'  const verified',props:'{ snap }: { snap: Snapshot }',imports:"import type { Snapshot } from '../lib/data/types'\n"},
  research:{start:'  const winners',props:'{ cards, syntheses, combos }: { cards: ResearchCard[]; syntheses: SynthesisCard[]; combos: CombinationInsights }',imports:"import type { ResearchCard, SynthesisCard, CombinationInsights } from '../lib/data/research'\n"},
};
await mkdir('strategist/src/views',{recursive:true});
for (const [name,config] of Object.entries(views)) {
  let text=await readFile(`${source}/src/app/${name}/page.tsx`,'utf8');
  text=text.replace(/^import .*from ['"].*\/(?:load|select|research)['"]\n/gm,'').replace(/export const dynamic = 'force-dynamic'\n/,'');
  const start=text.indexOf('export default async function ');
  const body=text.indexOf(config.start,start);
  const component=name[0].toUpperCase()+name.slice(1);
  text=config.imports+text.slice(0,start)+`export default function ${component}(${config.props}) {\n`+text.slice(body);
  text=text.replaceAll("'../../", "'../");
  text=text.replace('Run <code>npm run synthesize</code>.','Synthesis is pending.');
  await writeFile(`strategist/src/views/${component}.tsx`,text,{flag:'wx'});
}
