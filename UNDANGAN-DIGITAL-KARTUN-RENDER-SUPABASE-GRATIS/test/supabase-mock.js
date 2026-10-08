'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'undangan-online-test-'));
fs.cpSync(path.join(root,'public'),path.join(tmp,'public'),{recursive:true});
for (const f of ['server.js','persistence.js']) fs.copyFileSync(path.join(root,f),path.join(tmp,f));
const state={invitation:{id:1,data:{}},rsvps:[],wishes:[],uploads:new Map()};
let server, child;
const readBody = req => new Promise((resolve,reject)=>{const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)});
const mock = http.createServer(async(req,res)=>{
  try{
    if (!req.url.startsWith('/storage/v1/object/public/')) {
      assert.equal(req.headers.apikey,'sb_secret_test');
      assert.ok(!req.headers.authorization,'Modern secret should not use Bearer');
    }
    const u = new URL(req.url,'http://localhost');const p=u.pathname;
    const input=await readBody(req);
    let output;
    if(p==='/rest/v1/invitation_config'){
      if(req.method==='GET') output = u.searchParams.get('select')==='id'?[{id:1}]:[state.invitation];
      else if(req.method==='POST'){state.invitation=JSON.parse(input.toString());output=null;}
    }else if(p.startsWith('/rest/v1/rsvp_entries')||p.startsWith('/rest/v1/wish_entries')){
      const key=p.includes('rsvp')?'rsvps':'wishes';
      if(req.method==='GET')output=state[key].slice().reverse().slice(0,Number(u.searchParams.get('limit'))||2000);
      if(req.method==='POST'){state[key].push(JSON.parse(input.toString()));output=null;}
      if(req.method==='DELETE'){state[key]=state[key].filter(row=>row.id!==u.searchParams.get('id').slice(3));output=null;}
    }else if(p.startsWith('/storage/v1/object/undangan-media/')){
      assert.ok(input.length>10);state.uploads.set(p, input);output={Key:p};
    }else if(p.startsWith('/storage/v1/object/public/undangan-media/')){
      const name=p.replace('/public','');const file=state.uploads.get(name);
      if(!file){res.writeHead(404);return res.end();}
      res.writeHead(200,{'Content-Type':'image/webp'});return res.end(file);
    }else{res.writeHead(404);return res.end('no such mock endpoint');}
    if(output===undefined){res.writeHead(400);return res.end('mock unsupported');}
    res.writeHead(output===null?204:200, {'Content-Type':'application/json'});res.end(output===null?'':JSON.stringify(output));
  }catch(e){console.error('mock:',e);res.writeHead(500);res.end('mock failure');}
});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const stopChild=async()=>{if(child && child.exitCode===null){const proc=child;proc.kill();await new Promise(r=>proc.once('exit',r));}};
const stopMock=()=>new Promise(resolve=>mock.close(resolve));
let base;
async function start(mockPort,appPort){
  child=spawn(process.execPath,['server.js'],{cwd:tmp,env:{...process.env,NODE_ENV:'test',RENDER:'true',PORT:String(appPort),HOST:'127.0.0.1',SUPABASE_URL:`http://127.0.0.1:${mockPort}`,SUPABASE_SECRET_KEY:'sb_secret_test',ADMIN_PASSWORD:'Testing-Secret-123'},stdio:['ignore','pipe','pipe']});
  let error='';child.stderr.on('data',x=>error+=String(x));
  const until=Date.now()+8000;
  while(Date.now()<until){
    if(child.exitCode!==null)throw Error('App exited: '+error);
    try{const res=await fetch(base+'/api/health');if(res.ok)return;}catch{}
    await new Promise(r=>setTimeout(r,75));
  }
  throw Error('Unable to start app: '+error);
}
const request=async(url,method='GET',data,cookie)=>{const options={method,headers:{}};if(cookie) options.headers.Cookie=cookie;if(data!==undefined){options.body=JSON.stringify(data);options.headers['Content-Type']='application/json';}return fetch(base+url,options)};
async function main(){
  try{
    const mockPort=await listen(mock);
    const appPort=31000+Math.floor(Math.random()*20000);base='http://127.0.0.1:'+appPort;
    await start(mockPort,appPort);
    let res=await request('/api/admin/login','POST',{password:'Testing-Secret-123',remember:true});assert.equal(res.status,200);
    let cookie=res.headers.get('set-cookie').split(';')[0];
    let inv=(await(await request('/api/admin/data','GET',undefined,cookie)).json()).invitation;
    inv.bride='Melati';inv.groom='Bagas';inv.published=true;
    res=await request('/api/admin/data','PUT',inv,cookie);assert.equal(res.status,200);
    res=await request('/api/rsvp','POST',{name:'Dewi',attendance:'Hadir',guests:2});assert.equal(res.status,201);
    res=await request('/api/wishes','POST',{name:'Rama',message:'Semoga berbahagia'});assert.equal(res.status,201);
    const media=fs.readFileSync(path.join(root,'public/assets/pasangan-kartun.webp'));
    res=await request('/api/admin/upload','POST',{type:'image/webp',data:media.toString('base64')},cookie);assert.equal(res.status,201);
    const uploaded=(await res.json()).url;assert.ok(uploaded.startsWith(`http://127.0.0.1:${mockPort}/storage/v1/object/public/undangan-media/`));
    // Read-back from URL (no authentication) simulates a guest viewing media.
    const check=await fetch(uploaded);assert.equal(check.status,200);assert.equal((await check.arrayBuffer()).byteLength,media.length);
    const storedHero='https://project.supabase.co/storage/v1/object/public/undangan-media/photo.webp';
    inv.heroImage=storedHero;
    res=await request('/api/admin/data','PUT',inv,cookie);assert.equal(res.status,200);
    await stopChild();await start(mockPort,appPort);
    res=await request('/api/invitation');inv=(await res.json()).invitation;assert.equal(inv.bride,'Melati');assert.equal(inv.published,true);assert.equal(inv.heroImage,storedHero);
    res=await request('/api/admin/login','POST',{password:'Testing-Secret-123'});cookie=res.headers.get('set-cookie').split(';')[0];
    const admin=(await(await request('/api/admin/data','GET',undefined,cookie)).json());assert.equal(admin.rsvps.length,1);assert.equal(admin.wishes.length,1);
    res=await request('/api/admin/export?kind=rsvps','GET',undefined,cookie);assert.equal(res.status,200);assert.match(await res.text(),/Dewi/);
    res=await request('/api/admin/wishes/'+admin.wishes[0].id,'DELETE',undefined,cookie);assert.equal(res.status,200);
    assert.equal((await(await request('/api/wishes')).json()).wishes.length,0);
    console.log('LULUS: Supabase REST & Storage (mock)');
    console.log('LULUS: akun admin, publikasi, RSVP, ucapan, ekspor, dan hapus ucapan (mock)');
    console.log('LULUS: foto online bisa diakses lewat URL publik (mock)');
    console.log('LULUS: pengaturan, RSVP, media tetap ada setelah restart aplikasi (mock)');
  }finally{await stopChild();if(mock.listening)await stopMock();fs.rmSync(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
