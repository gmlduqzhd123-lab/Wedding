import { cp,mkdir,writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
await mkdir(dist,{recursive:true});
await cp(new URL('index.html',root),new URL('index.html',dist));
await cp(new URL('assets/',root),new URL('assets/',dist),{recursive:true});
await mkdir(new URL('data/',dist),{recursive:true});
for(const name of ['site.json','studios.json'])await cp(new URL('data/'+name,root),new URL('data/'+name,dist));
await writeFile(new URL('.nojekyll',dist),'');
console.log('Built static site: dist/');
