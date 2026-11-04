import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const port=Number(process.env.PORT||4173);
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');let requested=decodeURIComponent(url.pathname);
    if(requested==='/Wedding'||requested==='/Wedding/'){res.writeHead(302,{location:'/Wedding/index.html'+url.search}).end();return;}
    if(requested.startsWith('/Wedding/'))requested=requested.slice('/Wedding'.length);
    let file=path.resolve(root,'.'+requested);
    const relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('파일을 찾을 수 없습니다.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/Wedding/`));
