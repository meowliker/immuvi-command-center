import { createServer } from 'node:http';
import { readFile,stat,mkdir,open } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { targetEnv } from './strategist-env.mjs';

const root=process.cwd();
const port=Number(process.env.STRATEGIST_PORT || 8099);
if(process.argv.includes('--background')) {
  await mkdir('backups/strategist-dev',{recursive:true});
  const log=await open('backups/strategist-dev/server.log','a',0o600);
  const child=spawn(process.execPath,[path.resolve('scripts/strategist-dev.mjs')],{cwd:root,env:process.env,detached:true,stdio:['ignore',log.fd,log.fd]});
  child.unref();await log.close();console.log(`Dev server requested at http://127.0.0.1:${port}/strategist.html (PID ${child.pid})`);
} else {
  Object.assign(process.env,targetEnv());
  const {default:handler}=await import('../strategist/server/handler.mjs');
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/strategist'){
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413).end();return;}chunks.push(chunk);}
        req.body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):undefined;
        res.status=function(code){this.statusCode=code;return this;};
        res.json=function(body){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(body));};
        await handler(req,res);return;
      }
      const pathname=decodeURIComponent(url.pathname);
      // Explicit public surface, so local backups and source credentials are never served.
      const allowed=pathname==='/'||pathname==='/immuvi-command-center.html'||pathname==='/strategist.html'||/^\/strategist-assets\/[a-z0-9.-]+$/i.test(pathname);
      if(!allowed){res.writeHead(404).end('Not found');return;}
      const file=path.join(root,pathname==='/'?'immuvi-command-center.html':pathname);
      if(!(await stat(file)).isFile()){res.writeHead(404).end();return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(await readFile(file));
    }catch{res.writeHead(500).end('Request failed');}
  });
  server.listen(port,'127.0.0.1',()=>console.log(`Strategist: http://127.0.0.1:${port}/strategist.html`));
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
}
