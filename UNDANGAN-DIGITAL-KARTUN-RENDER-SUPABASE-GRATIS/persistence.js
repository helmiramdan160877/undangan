'use strict';
/**
 * Two persistence modes:
 * - Local, on a personal machine (JSON + local uploads).
 * - Supabase REST + Storage for Render's ephemeral free web services.
 * No secret is ever sent to the browser. Requires Node >= 20.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function makeRepository({root, defaults}) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY || '';
  const usingRemote = Boolean(url || secret);
  if (usingRemote && (!url || !secret)) throw new Error('SUPABASE_URL dan SUPABASE_SECRET_KEY harus diisi keduanya.');
  if (!usingRemote && (process.env.RENDER || process.env.REQUIRE_SUPABASE === '1')) {
    throw new Error('Hosting membutuhkan SUPABASE_URL dan SUPABASE_SECRET_KEY. Menolak penyimpanan sementara agar data tidak hilang.');
  }
  if (usingRemote) {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && process.env.NODE_ENV !== 'test') {
      throw new Error('SUPABASE_URL harus berupa alamat resmi https://....supabase.co.');
    }
    const bucket = 'undangan-media';
    const headers = {'apikey': secret};
    // JWT legacy keys require Bearer; modern sb_secret_* goes in apikey only.
    if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;
    async function request(route, options = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const resp = await fetch(url + route, {
          ...options,
          headers: {...headers, ...(options.headers || {})},
          signal: controller.signal,
        });
        const responseText = await resp.text();
        if (!resp.ok) {
          console.error('Supabase API', resp.status, route.split('?')[0], responseText.slice(0,500));
          const err = new Error(resp.status === 404 ? 'Tabel atau bucket Supabase tidak ditemukan. Jalankan database/init.sql dan buat bucket undangan-media.' : 'Penyimpanan online sedang bermasalah. Cek konfigurasi Supabase dan coba lagi.');
          err.status = 503;
          throw err;
        }
        if (!responseText) return null;
        try { return JSON.parse(responseText); } catch { return responseText; }
      } catch (err) {
        if (err.status === 503) throw err;
        console.error('Supabase connection error:', err.message);
        throw Object.assign(new Error('Tidak dapat menghubungi database online. Coba lagi atau periksa Supabase.'),{status:503});
      } finally { clearTimeout(timer); }
    }
    const jsonHeaders = {'Content-Type':'application/json'};
    const rest = (route,opts) => request('/rest/v1/'+route,opts);
    const fetchInvitation = async () => {
      const rows = await rest('invitation_config?select=data&id=eq.1&limit=1');
      if (!Array.isArray(rows)) throw Object.assign(new Error('Format data undangan tidak valid.'),{status:503});
      return {...defaults, ...(rows[0]?.data || {})};
    };
    const fetchEntries = (table,limit=2000) => rest(`${table}?select=*&order=date.desc&limit=${limit}`);
    return {
      mode: 'supabase',
      getInvitation: fetchInvitation,
      getWishes: async () => fetchEntries('wish_entries',50),
      getAdminData: async () => {
        const [invitation,rsvps,wishes] = await Promise.all([fetchInvitation(),fetchEntries('rsvp_entries'),fetchEntries('wish_entries')]);
        return {invitation,rsvps,wishes};
      },
      async updateInvitation(invitation){
        const updated = await rest('invitation_config?on_conflict=id',{
          method:'POST',headers:{...jsonHeaders,Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify({id:1,data:invitation})
        });
        return invitation;
      },
      addRsvp: entry => rest('rsvp_entries',{method:'POST',headers:{...jsonHeaders,Prefer:'return=minimal'},body:JSON.stringify(entry)}),
      addWish: entry => rest('wish_entries',{method:'POST',headers:{...jsonHeaders,Prefer:'return=minimal'},body:JSON.stringify(entry)}),
      removeWish: id => rest('wish_entries?id=eq.'+encodeURIComponent(id),{method:'DELETE'}),
      async exportRows(kind) { return fetchEntries(kind === 'wishes' ? 'wish_entries':'rsvp_entries'); },
      async upload(buffer, filename, kind) {
        await request('/storage/v1/object/'+bucket+'/'+filename,{
          method:'POST',headers:{'Content-Type':kind,'Cache-Control':'3600','x-upsert':'false'},body:buffer
        });
        return `${url}/storage/v1/object/public/${bucket}/${encodeURIComponent(filename)}`;
      },
      async health(){ await rest('invitation_config?select=id&limit=1'); return true; }
    };
  }
  const dataDir=path.join(root,'data'), uploadDir=path.join(root,'uploads');
  for (const d of [dataDir,uploadDir]) fs.mkdirSync(d,{recursive:true});
  const file=path.join(dataDir,'store.json');
  let store;
  try { store=JSON.parse(fs.readFileSync(file,'utf8')); } catch { store={invitation:defaults,rsvps:[],wishes:[]}; }
  store.invitation={...defaults,...(store.invitation||{})};
  store.rsvps=Array.isArray(store.rsvps)?store.rsvps:[];
  store.wishes=Array.isArray(store.wishes)?store.wishes:[];
  function save() {const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(store,null,2));fs.renameSync(temp,file);}
  if(!fs.existsSync(file))save();
  return {
    mode:'local',
    getInvitation:async()=>({...store.invitation}),
    getWishes:async()=>store.wishes.slice(-50).reverse(),
    getAdminData:async()=>({invitation:{...store.invitation},rsvps:store.rsvps.slice().reverse(),wishes:store.wishes.slice().reverse()}),
    async updateInvitation(invitation){store.invitation=invitation;save();return invitation;},
    async addRsvp(entry){store.rsvps.push(entry);store.rsvps=store.rsvps.slice(-2000);save();},
    async addWish(entry){store.wishes.push(entry);store.wishes=store.wishes.slice(-2000);save();},
    async removeWish(id){store.wishes=store.wishes.filter(x=>x.id!==id);save();},
    async exportRows(kind){return kind==='wishes'?store.wishes.slice():store.rsvps.slice();},
    async upload(buffer,filename){fs.writeFileSync(path.join(uploadDir,filename),buffer,{flag:'wx'});return '/uploads/'+filename;},
    async health(){return true;}
  };
}
module.exports={makeRepository};
