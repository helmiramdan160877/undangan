'use strict';
// Undangan Kartun Studio - server Node.js tanpa dependency eksternal.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeRepository } = require('./persistence');
const { URL } = require('node:url');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(ROOT, 'uploads');

// Membaca .env sederhana untuk pemakaian lokal; variabel environment punya prioritas.
const envFile = path.join(ROOT,'.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g,'');
  }
}
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const credsFile = path.join(DATA_DIR, '.admin-credentials.json');
const defaults = {
  published: false, theme: 'sage',
  groom: 'Arga Pratama', bride: 'Nadia Putri',
  groomParents: 'Bapak & Ibu Mempelai Pria', brideParents: 'Bapak & Ibu Mempelai Wanita',
  greeting: 'Dengan penuh rasa syukur, kami mengundang Bapak/Ibu/Saudara/i untuk hadir dan memberikan doa restu pada hari bahagia kami.',
  quote: 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu merasa tenteram kepadanya.',
  quoteSource: 'QS. Ar-Rum: 21',
  akadDate: '2026-12-20', akadTime: '08:00', akadEnd: 'Selesai',
  receptionDate: '2026-12-20', receptionTime: '11:00', receptionEnd: 'Selesai',
  timezone: 'Asia/Jakarta',
  venue: 'Gedung Serbaguna Bahagia',
  address: 'Jl. Contoh Indah No. 123, Jakarta (alamat contoh)',
  mapsUrl: '',
  heroImage: '/assets/pasangan-kartun.webp', gallery: [], musicUrl: '',
  giftName: '', giftBank: '', giftAccount: '', giftAddress: '',
  storyTitle: 'Kisah Kami', storyText: '',
  whatsapp: '', instagram: ''
};
const repo = makeRepository({root:ROOT,defaults});
let generatedPassword = '';
// Pada hosting online, password wajib eksplisit supaya restart tidak mengganti kredensial.
if (repo.mode === 'supabase' && !process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD wajib diset di Render (minimal 12 karakter).');
}
if (repo.mode === 'local') {
  fs.mkdirSync(DATA_DIR,{recursive:true});
  if (!fs.existsSync(credsFile) && !process.env.ADMIN_PASSWORD) {
    generatedPassword = 'Nikah-' + crypto.randomBytes(9).toString('hex');
    fs.writeFileSync(credsFile,JSON.stringify({password:generatedPassword}),{mode:0o600});
  }
}
const password = process.env.ADMIN_PASSWORD || JSON.parse(fs.readFileSync(credsFile,'utf8')).password;
if (password.length < 8) throw new Error('ADMIN_PASSWORD wajib minimal 8 karakter.');
const sessions = new Map();
const limits = new Map();
const mime = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.webp':'image/webp', '.jpeg':'image/jpeg', '.jpg':'image/jpeg', '.png':'image/png', '.mp3':'audio/mpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

function json(res, status, data, headers={}) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff', ...headers });
  res.end(JSON.stringify(data));
}
function security(res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; media-src 'self' https:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'");
}
function safeTxt(x,max=200){ return String(x == null ? '' : x).trim().slice(0,max); }
function cleanUrl(x, max=700) { const s=safeTxt(x,max); if (!s) return ''; if(s.startsWith('/assets/')||s.startsWith('/uploads/')) return s; try { const u=new URL(s); return u.protocol==='https:' ? u.href : ''; } catch {return '';} }
function ipOf(req){ return process.env.TRUST_PROXY==='1' ? (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket.remoteAddress : req.socket.remoteAddress; }
function throttle(key,max,spanMs){const now=Date.now();const list=(limits.get(key)||[]).filter(t=>now-t<spanMs);if (list.length>=max) { limits.set(key,list);return false;}list.push(now);limits.set(key,list);return true;}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=')).filter(a=>a.length>=2));}
function isAdmin(req){const token=cookies(req).sid;if(!token || !sessions.has(token))return false;const expiry=sessions.get(token);if(expiry<Date.now()){sessions.delete(token);return false;}return true;}
function cookieHeader(req,token,age){const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');return `sid=${token}; HttpOnly; SameSite=Strict; Path=/; ${age ? `Max-Age=${age}; ` : ''}${proto==='https'?'Secure; ':''}`;}
function validOrigin(req){const origin=req.headers.origin; if(!origin)return true; try{const o=new URL(origin);return o.host===req.headers.host;}catch{return false;}}
async function body(req,limit=10*1024*1024){return new Promise((resolve,reject)=>{let size=0;let parts=[];req.on('data',c=>{size+=c.length;if(size>limit){reject(Object.assign(new Error('Data terlalu besar.'),{status:413}));req.destroy();return;}parts.push(c);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')||'{}'));}catch{reject(Object.assign(new Error('Format JSON tidak valid.'),{status:400}));}});req.on('error',reject);});}
function sendFile(res, file) {
  try {
    const stat=fs.statSync(file);if(!stat.isFile())throw new Error('Not file');
    res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':file.includes('/assets/')?'public, max-age=604800':'no-cache'});
    fs.createReadStream(file).pipe(res);
  } catch {json(res,404,{error:'Berkas tidak ditemukan.'});}
}
function cleanInvitation(input,current){
  const fields = ['groom','bride','groomParents','brideParents','greeting','quote','quoteSource','akadDate','akadTime','akadEnd','receptionDate','receptionTime','receptionEnd','timezone','venue','address','mapsUrl','heroImage','musicUrl','giftName','giftBank','giftAccount','giftAddress','storyTitle','storyText','whatsapp','instagram'];
  const max = { greeting:700,quote:500,storyText:1700,address:500,giftAddress:500,mapsUrl:800,heroImage:800,musicUrl:800 };
  const result = {...current};
  for(const f of fields) if(Object.hasOwn(input,f)) result[f] = safeTxt(input[f],max[f]||130);
  for(const f of ['mapsUrl','heroImage','musicUrl','instagram']) result[f]=cleanUrl(result[f]);
  for (const f of ['akadDate','receptionDate']) if(!/^\d{4}-\d{2}-\d{2}$/.test(result[f]) || Number.isNaN(Date.parse(result[f]+'T00:00:00Z')) || new Date(result[f]+'T00:00:00Z').toISOString().slice(0,10)!==result[f])throw new Error('Tanggal acara tidak valid.');
  for (const f of ['akadTime','receptionTime']) if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(result[f]))throw new Error('Jam acara tidak valid.');
  if (!['Asia/Jakarta','Asia/Makassar','Asia/Jayapura'].includes(result.timezone))result.timezone='Asia/Jakarta';
  if (!['sage','rose','navy','maroon','sand'].includes(input.theme))result.theme='sage';else result.theme=input.theme;
  result.published=Boolean(input.published);
  result.gallery=(Array.isArray(input.gallery)?input.gallery:[]).slice(0,6).map(s=>cleanUrl(s)).filter(Boolean);
  if(!result.groom || !result.bride || !result.venue || !result.address)throw new Error('Nama pengantin, gedung, dan alamat wajib diisi.');
  return result;
}
function csvSafe(v){let s=String(v??'').replace(/\r?\n/g,' ');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
async function csvDownload(res,kind){const isWish=kind==='wishes';const rows=await repo.exportRows(kind);const fields=isWish?['date','name','message']:['date','name','attendance','guests'];const header=isWish?['Waktu','Nama','Ucapan']:['Waktu','Nama','Kehadiran','Jumlah tamu'];const content='\uFEFF'+[header.map(csvSafe).join(','),...rows.map(r=>fields.map(k=>csvSafe(r[k])).join(','))].join('\r\n');res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${isWish?'ucapan':'rsvp'}-undangan.csv"`,'Cache-Control':'no-store'});res.end(content);}
function hasMagic(buf,kind){return kind==='image/png'?buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):kind==='image/jpeg'?buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff:kind==='image/webp'?buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP':kind==='audio/mpeg'?buf.toString('ascii',0,3)==='ID3'||(buf[0]===0xff&&(buf[1]&0xe0)===0xe0):false;}

const handler=async(req,res)=>{
  security(res);
  let url;
  try{url=new URL(req.url,`http://${req.headers.host||'localhost'}`);}catch{return json(res,400,{error:'URL salah.'});}
  const p=url.pathname;
  if (req.method==='GET' && ['/','/index.html','/admin','/admin.html','/style.css','/app.js','/admin.js','/admin.css','/favicon.svg'].includes(p)) {
    return sendFile(res,path.join(PUBLIC_DIR,p==='/'? 'index.html': p==='/admin'? 'admin.html' : p.slice(1)));
  }
  if(req.method==='GET' && /^\/(assets|uploads)\/[a-zA-Z0-9_.-]+$/.test(p)){
    const file=path.join(ROOT,p.startsWith('/assets/')?'public':'',p.slice(1));
    return sendFile(res,file);
  }
  if(['POST','PUT','PATCH','DELETE'].includes(req.method) && !validOrigin(req))return json(res,403,{error:'Permintaan ditolak.'});
  try{
    if (req.method==='GET' && p==='/api/health') {await repo.health();return json(res,200,{ok:true,storage:repo.mode});}
    if (req.method==='GET' && p==='/api/invitation') return json(res,200,{invitation:await repo.getInvitation()});
    if (req.method==='GET' && p==='/api/wishes') return json(res,200,{wishes:await repo.getWishes()});
    if (req.method==='POST' && p==='/api/rsvp') {
      if(!throttle('rsvp:'+ipOf(req),12,3600000))return json(res,429,{error:'Terlalu banyak permintaan, coba lagi nanti.'});
      if(!(await repo.getInvitation()).published)return json(res,403,{error:'Undangan belum dipublikasikan.'});
      const d=await body(req,8000);const name=safeTxt(d.name,80);const attendance=safeTxt(d.attendance,30);const guests=Number(d.guests);
      if(!name||!['Hadir','Tidak hadir','Masih ragu'].includes(attendance)||!Number.isInteger(guests)||guests<1||guests>10)return json(res,400,{error:'Mohon isi konfirmasi dengan benar.'});
      await repo.addRsvp({id:crypto.randomUUID(),date:new Date().toISOString(),name,attendance,guests});return json(res,201,{ok:true});
    }
    if (req.method==='POST' && p==='/api/wishes') {
      if(!throttle('wish:'+ipOf(req),8,3600000))return json(res,429,{error:'Batas pengiriman ucapan tercapai, coba lagi nanti.'});
      if(!(await repo.getInvitation()).published)return json(res,403,{error:'Undangan belum dipublikasikan.'});
      const d=await body(req,8000);const name=safeTxt(d.name,65);const message=safeTxt(d.message,500);
      if(name.length<2||message.length<3)return json(res,400,{error:'Nama atau ucapan terlalu pendek.'});
      await repo.addWish({id:crypto.randomUUID(),date:new Date().toISOString(),name,message});return json(res,201,{ok:true});
    }
    if (req.method==='POST' && p==='/api/admin/login') {
      if(!throttle('login:'+ipOf(req),12,600000))return json(res,429,{error:'Terlalu banyak percobaan login. Coba lagi beberapa menit.'});
      const d=await body(req,3000);const attempt=String(d.password||'');
      const expected=crypto.createHash('sha256').update(password).digest();
      const actual=crypto.createHash('sha256').update(attempt).digest();
      if(!crypto.timingSafeEqual(expected,actual))return json(res,401,{error:'Password tidak cocok.'});
      const token=crypto.randomBytes(32).toString('hex'); const age=d.remember?30*86400:0;
      sessions.set(token,Date.now()+(age||86400)*1000);
      return json(res,200,{ok:true},{'Set-Cookie':cookieHeader(req,token,age)});
    }
    if (req.method==='GET' && p==='/api/admin/me')return isAdmin(req)?json(res,200,{ok:true}):json(res,401,{error:'Belum masuk.'});
    if(p.startsWith('/api/admin/')){
      if(!isAdmin(req))return json(res,401,{error:'Silakan login terlebih dahulu.'});
      if(req.method==='POST' && p==='/api/admin/logout'){
        sessions.delete(cookies(req).sid);return json(res,200,{ok:true},{'Set-Cookie':cookieHeader(req,'',0)+'Max-Age=0;'});
      }
      if(req.method==='GET' && p==='/api/admin/data'){
        return json(res,200,await repo.getAdminData());
      }
      if(req.method==='PUT' && p==='/api/admin/data'){
        const d=await body(req,30000);const invite=cleanInvitation(d,await repo.getInvitation());
        await repo.updateInvitation(invite);return json(res,200,{ok:true,invitation:invite});
      }
      if(req.method==='POST' && p==='/api/admin/upload'){
        const d=await body(req,12*1024*1024);const kind=safeTxt(d.type,40);
        const extensions={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','audio/mpeg':'.mp3'};
        if(!extensions[kind])return json(res,400,{error:'Gunakan gambar JPG/PNG/WEBP atau musik MP3.'});
        const encoded=String(d.data||'');if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return json(res,400,{error:'Berkas tidak valid.'});
        const buffer=Buffer.from(encoded,'base64');const max=kind==='audio/mpeg'?8*1024*1024:5*1024*1024;
        if(buffer.length<10||buffer.length>max||!hasMagic(buffer,kind))return json(res,400,{error:`Berkas tidak sesuai atau melebihi ${kind==='audio/mpeg'?'8':'5'} MB.`});
        const filename=crypto.randomBytes(16).toString('hex')+extensions[kind];
        const mediaUrl=await repo.upload(buffer,filename,kind);
        return json(res,201,{url:mediaUrl});
      }
      if(req.method==='GET' && p==='/api/admin/export')return await csvDownload(res,url.searchParams.get('kind')==='wishes'?'wishes':'rsvps');
      if(req.method==='DELETE' && /^\/api\/admin\/wishes\/[a-f0-9-]+$/.test(p)){
        const id=p.split('/').pop();await repo.removeWish(id);return json(res,200,{ok:true});
      }
    }
    return json(res,404,{error:'Halaman tidak ditemukan.'});
  }catch(e){console.error('Error:',e.message);if(!res.headersSent)json(res,e.status||400,{error:e.status?e.message:'Terjadi kesalahan: '+e.message});}
};
http.createServer(handler).listen(PORT,HOST,()=>{
  console.log(`\n💌 Undangan Kartun Studio berjalan: http://localhost:${PORT}`);
  console.log(`🔐 Panel admin: http://localhost:${PORT}/admin`);
  if(generatedPassword)console.log(`🔑 PASSWORD ADMIN BARU: ${generatedPassword}`);
  else if(!process.env.ADMIN_PASSWORD)console.log('🔑 Password admin tersimpan di data/.admin-credentials.json');
  console.log('💾 Penyimpanan: '+repo.mode+(repo.mode==='supabase'?' (data & media permanen)':' (lokal)')+'\n');
});
