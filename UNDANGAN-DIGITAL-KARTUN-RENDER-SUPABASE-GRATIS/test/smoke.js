'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'undangan-test-'));
fs.cpSync(path.join(root,'public'),path.join(tmp,'public'),{recursive:true});
fs.copyFileSync(path.join(root,'server.js'),path.join(tmp,'server.js'));
fs.copyFileSync(path.join(root,'persistence.js'),path.join(tmp,'persistence.js'));
const port = 31000 + Math.floor(Math.random()*20000);
const base = 'http://127.0.0.1:'+port;
let child;
function start(){
  child = spawn(process.execPath,['server.js'],{cwd:tmp,env:{...process.env,ADMIN_PASSWORD:'Testing-Secret-123',HOST:'127.0.0.1',PORT:String(port)},stdio:'ignore'});
  return new Promise((resolve,reject)=>{
    const until = Date.now()+7500;
    (async function wait(){
      while(Date.now()<until){
        if(child.exitCode!==null)return reject(Error('Server berhenti lebih awal'));
        try{const r=await fetch(base+'/api/invitation');if(r.ok)return resolve();}catch{}
        await new Promise(r=>setTimeout(r,100));
      }
      reject(Error('Server gagal dibuka'));
    })();
  });
}
async function stop(){if(child && child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}}
async function call(endpoint,method='GET',data,headers={}){const opts={method,headers:{...headers}};if(data!==undefined){opts.body=JSON.stringify(data);opts.headers['Content-Type']='application/json';}return fetch(base+endpoint,opts);}
async function main(){
 try{
  await start();
  let res=await call('/');assert.equal(res.status,200);assert.match(await res.text(),/Buka Undangan/);
  res=await call('/admin');assert.equal(res.status,200);assert.match(await res.text(),/loginForm/);
  res=await call('/assets/pasangan-kartun.webp');assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'image/webp');
  let inv=(await (await call('/api/invitation')).json()).invitation;assert.equal(inv.published,false);
  res=await call('/api/rsvp','POST',{name:'Tes',attendance:'Hadir',guests:2});assert.equal(res.status,403);
  res=await call('/api/admin/data','PUT',{groom:'Salah'});assert.equal(res.status,401);
  res=await call('/api/admin/login','POST',{password:'salah'});assert.equal(res.status,401);
  res=await call('/api/admin/login','POST',{password:'Testing-Secret-123',remember:true});assert.equal(res.status,200);
  const cookie=res.headers.get('set-cookie').split(';')[0];assert.ok(cookie.startsWith('sid='));
  const auth={'Cookie':cookie};
  res=await call('/api/admin/data','GET',undefined,auth);assert.equal(res.status,200);
  const payload=(await res.json()).invitation;
  payload.bride='Rina';payload.groom='Dimas';payload.receptionDate='2026-12-12';payload.akadDate='2026-12-12';payload.venue='Gedung Mawar';payload.address='Jl. Kenanga 8, Bandung';payload.published=true;payload.theme='rose';
  res=await call('/api/admin/data','PUT',payload,{...auth,'Origin':'https://jahat.example'});assert.equal(res.status,403);
  res=await call('/api/admin/data','PUT',{...payload,akadDate:'2026-02-31'},auth);assert.equal(res.status,400);
  res=await call('/api/admin/data','PUT',payload,auth);assert.equal(res.status,200);
  inv=(await (await call('/api/invitation')).json()).invitation;assert.equal(inv.bride,'Rina');assert.equal(inv.published,true);
  res=await call('/api/rsvp','POST',{name:'Budi',attendance:'Hadir',guests:3});assert.equal(res.status,201);
  res=await call('/api/wishes','POST',{name:'Tamu baik',message:'Selamat menikah!'});assert.equal(res.status,201);
  let wishes=(await (await call('/api/wishes')).json()).wishes;assert.equal(wishes.length,1);
  res=await call('/api/admin/data','GET',undefined,auth);let contents=await res.json();assert.equal(contents.rsvps.length,1);assert.equal(contents.wishes.length,1);
  res=await call('/api/admin/export?kind=rsvps','GET',undefined,auth);assert.equal(res.status,200);assert.match(await res.text(),/Budi/);
  const jpg=fs.readFileSync(path.join(root,'public/assets/pasangan-kartun.webp'));
  res=await call('/api/admin/upload','POST',{type:'image/webp',data:jpg.toString('base64')},auth);assert.equal(res.status,201);
  const uploaded=(await res.json()).url;res=await call(uploaded);assert.equal(res.status,200);assert.equal((await res.arrayBuffer()).byteLength,jpg.length);
  res=await call('/api/admin/wishes/'+wishes[0].id,'DELETE',undefined,auth);assert.equal(res.status,200);
  wishes=(await (await call('/api/wishes')).json()).wishes;assert.equal(wishes.length,0);
  await stop();await start();
  inv=(await (await call('/api/invitation')).json()).invitation;assert.equal(inv.bride,'Rina');assert.equal(inv.published,true);
  res=await call('/api/admin/login','POST',{password:'Testing-Secret-123'});assert.equal(res.status,200);
  res=await call('/api/admin/data','GET',undefined,{'Cookie':res.headers.get('set-cookie').split(';')[0]});contents=await res.json();assert.equal(contents.rsvps.length,1);
  console.log('LULUS: halaman tamu dan admin');
  console.log('LULUS: aset kartun');
  console.log('LULUS: login dan proteksi admin');
  console.log('LULUS: validasi data dan origin');
  console.log('LULUS: simpan dan publikasi undangan');
  console.log('LULUS: RSVP, ucapan, hapus ucapan, ekspor CSV');
  console.log('LULUS: upload gambar dan akses gambar');
  console.log('LULUS: data undangan dan RSVP tetap ada setelah server restart');
 }finally{await stop();fs.rmSync(tmp,{recursive:true,force:true});}
}
main().catch(err=>{console.error(err);process.exitCode=1});
