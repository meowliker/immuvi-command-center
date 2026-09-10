import { build } from 'esbuild';
import { copyFile, cp, mkdir } from 'node:fs/promises';
await mkdir('strategist-assets',{recursive:true});
await mkdir('strategist/server',{recursive:true});
await build({entryPoints:['strategist/src/browser/App.tsx'],outfile:'strategist-assets/app.js',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},metafile:true}).then(result=>{
  const forbidden=Object.keys(result.metafile.inputs).filter(p=>/src\/(db|server)|src\/lib\/(analysis|drive|clickup)|postgres\/|googleapis\//.test(p));
  if(forbidden.length)throw new Error(`Server code included in browser bundle: ${forbidden.join(', ')}`);
});
await build({entryPoints:['strategist/src/server/handler.ts'],outfile:'strategist/server/handler.mjs',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external'});
// Vercel serves public/, while the local dev server reads the root assets.
await mkdir('public',{recursive:true});
await copyFile('strategist.html','public/strategist.html');
await cp('strategist-assets','public/strategist-assets',{recursive:true});
console.log('Strategist HTML assets and API built; public assets published.');
