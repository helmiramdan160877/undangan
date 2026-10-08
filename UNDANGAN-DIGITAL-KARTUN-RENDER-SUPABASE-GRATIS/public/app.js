'use strict';
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const guest = (query.get('to') || '').trim().slice(0,100);
let config = null;
let countdownTimer = null;
const zoneSuffix = {'Asia/Jakarta':'+07:00','Asia/Makassar':'+08:00','Asia/Jayapura':'+09:00'};
const zoneShort = {'Asia/Jakarta':'WIB','Asia/Makassar':'WITA','Asia/Jayapura':'WIT'};
const dateLong = iso => { try { return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z')); } catch { return iso; } };
function fill(id,val){ $(id).textContent = val || ''; }
function elementUrl(link){try{const u = new URL(link,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'#lokasi';}catch{return '#lokasi';}}
function names(a,b){ const frag=document.createDocumentFragment();frag.append(document.createTextNode(a));const span=document.createElement('span');span.textContent='&';frag.append(span,document.createTextNode(b));return frag; }
function startCountdown(d){
  if(countdownTimer)clearInterval(countdownTimer);
  const ending = new Date(d.akadDate+'T'+d.akadTime+':00'+(zoneSuffix[d.timezone]||'+07:00')).getTime();
  const tick=()=>{const remaining=Math.max(0,Math.floor((ending-Date.now())/1000));fill('days',String(Math.floor(remaining/86400)).padStart(2,'0'));fill('hours',String(Math.floor(remaining/3600)%24).padStart(2,'0'));fill('minutes',String(Math.floor(remaining/60)%60).padStart(2,'0'));fill('seconds',String(remaining%60).padStart(2,'0'));};tick();countdownTimer=setInterval(tick,1000);
}
function gcalDate(date,time,timezone){const d=new Date(date+'T'+time+':00'+(zoneSuffix[timezone]||'+07:00'));return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');}
function renderInvitation(d){
  config=d;document.body.dataset.theme=d.theme||'sage';document.title=`The Wedding of ${d.bride} & ${d.groom}`;
  fill('guestName',guest||'Bapak/Ibu/Saudara/i');
  ['coverTitle','heroNames','footerNames'].forEach(id=>$(id).replaceChildren(names(d.groom,d.bride)));
  $('heroImage').src=d.heroImage||'/assets/pasangan-kartun.webp';
  $('heroImage').onerror=()=>{$('heroImage').onerror=null;$('heroImage').src='/assets/pasangan-kartun.webp';};
  $('coverImage').style.backgroundImage=`url(${JSON.stringify(d.heroImage||'/assets/pasangan-kartun.webp')})`;
  fill('heroDay',dateLong(d.receptionDate));fill('heroGreeting',d.greeting);fill('greeting',d.greeting);
  fill('brideName',d.bride);fill('groomName',d.groom);fill('brideParents',d.brideParents);fill('groomParents',d.groomParents);
  fill('quoteText',d.quote);fill('quoteSource',d.quoteSource);
  const tz=zoneShort[d.timezone]||'WIB';
  fill('akadDay',dateLong(d.akadDate));fill('receptionDay',dateLong(d.receptionDate));
  fill('akadHours',d.akadTime.replace(':','.')+' '+tz+' – '+(d.akadEnd||'Selesai'));
  fill('receptionHours',d.receptionTime.replace(':','.')+' '+tz+' – '+(d.receptionEnd||'Selesai'));
  fill('venueName',d.venue);fill('venueAddress',d.address);$('mapsLink').href=elementUrl(d.mapsUrl||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}`);
  const start = gcalDate(d.receptionDate,d.receptionTime,d.timezone), endDate = new Date(new Date(d.receptionDate+'T'+d.receptionTime+':00'+(zoneSuffix[d.timezone]||'+07:00')).getTime()+3*3600000).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const cal=new URL('https://calendar.google.com/calendar/render'); cal.searchParams.set('action','TEMPLATE');cal.searchParams.set('text',`Pernikahan ${d.bride} & ${d.groom}`);cal.searchParams.set('dates',`${start}/${endDate}`);cal.searchParams.set('details',d.greeting);cal.searchParams.set('location',d.venue+' - '+d.address);$('calendarLink').href=cal.href;
  const hasStory=!!(d.storyText||'').trim();$('kisah').hidden=!hasStory;fill('storyTitle',d.storyTitle||'Kisah Kami');fill('storyText',d.storyText);
  const photos=Array.isArray(d.gallery)?d.gallery:[];$('galeri').hidden=photos.length===0;$('galleryGrid').replaceChildren();photos.forEach(url=>{const img=document.createElement('img');img.src=url;img.alt='Foto kenangan pasangan pengantin';img.loading='lazy';$('galleryGrid').append(img);});
  const hasBank=Boolean(d.giftAccount && d.giftBank),hasAddr=Boolean(d.giftAddress);$('hadiah').hidden=!(hasBank||hasAddr);$('bankGift').hidden=!hasBank;$('addressGift').hidden=!hasAddr;fill('giftBank',d.giftBank);fill('giftAccount',d.giftAccount);fill('giftName',d.giftName);fill('giftAddress',d.giftAddress);
  $('musicButton').hidden=!d.musicUrl;if(d.musicUrl)$('musicAudio').src=d.musicUrl;
  $('draftBanner').hidden=!!d.published;fill('rsvpStatus',d.published?'':'RSVP aktif setelah admin menerbitkan undangan.');fill('wishStatus',d.published?'':'Ucapan aktif setelah admin menerbitkan undangan.');
  $('rsvpForm').querySelector('button').disabled=!d.published;$('wishForm').querySelector('button').disabled=!d.published;
  $('rsvpName').value=guest;$('wishName').value=guest;startCountdown(d);
}
async function api(url,options){const res=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options?.headers||{})}});let data;try{data=await res.json();}catch{throw new Error('Server tidak merespons dengan benar.');}if(!res.ok)throw new Error(data.error||'Permintaan gagal.');return data;}
async function loadWishes(){try{const {wishes}=await api('/api/wishes');const holder=$('wishesList');holder.replaceChildren();if(!wishes.length){const p=document.createElement('p');p.className='lead';p.textContent='Jadilah yang pertama mengirim ucapan ♡';holder.append(p);}wishes.forEach(w=>{const article=document.createElement('article');article.className='wish-card';const strong=document.createElement('strong');strong.textContent=w.name;const time=document.createElement('small');time.textContent=new Date(w.date).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});const p=document.createElement('p');p.textContent=w.message;article.append(strong,time,p);holder.append(article);});}catch{$('wishesList').textContent='Ucapan belum dapat dimuat.';}}
$('openInvitation').addEventListener('click',()=>{$('cover').classList.add('closed');document.body.style.overflow='';if(config?.musicUrl){$('musicAudio').play().then(()=>$('musicButton').classList.add('playing')).catch(()=>{});}});
$('musicButton').addEventListener('click',()=>{const a=$('musicAudio');if(a.paused)a.play().then(()=>$('musicButton').classList.add('playing')).catch(()=>{});else{a.pause();$('musicButton').classList.remove('playing');}});
$('rsvpForm').addEventListener('submit',async e=>{e.preventDefault();if(!config?.published)return;const button=e.target.querySelector('button');button.disabled=true;fill('rsvpStatus','Mengirim konfirmasi...');try{await api('/api/rsvp',{method:'POST',body:JSON.stringify({name:$('rsvpName').value,attendance:$('attendance').value,guests:Number($('guests').value)})});fill('rsvpStatus','Terima kasih! Konfirmasi Anda berhasil tersimpan.');e.target.reset();$('rsvpName').value=guest;}catch(err){fill('rsvpStatus',err.message);}finally{button.disabled=false;}});
$('wishForm').addEventListener('submit',async e=>{e.preventDefault();if(!config?.published)return;const button=e.target.querySelector('button');button.disabled=true;fill('wishStatus','Menyimpan ucapan...');try{await api('/api/wishes',{method:'POST',body:JSON.stringify({name:$('wishName').value,message:$('wishMessage').value})});fill('wishStatus','Ucapan berhasil terkirim. Terima kasih!');e.target.reset();$('wishName').value=guest;await loadWishes();}catch(err){fill('wishStatus',err.message);}finally{button.disabled=false;}});
$('copyBank').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(config.giftAccount);$('copyBank').textContent='✓ Nomor disalin';}catch{prompt('Salin rekening:',config.giftAccount);}});
$('shareInvitation').addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.delete('to');url.searchParams.delete('preview');if(navigator.share){try{await navigator.share({title:document.title,url:url.href});}catch{}}else if(navigator.clipboard&&window.isSecureContext){try{await navigator.clipboard.writeText(url.href);alert('Link undangan berhasil disalin.');}catch{prompt('Salin link undangan:',url.href);}}else prompt('Salin link undangan:',url.href);});
(async()=>{document.body.style.overflow='hidden';try{const {invitation}=await api('/api/invitation');renderInvitation(invitation);}catch(err){fill('guestName','Gagal memuat undangan');fill('coverTitle','Maaf, ada kendala');$('openInvitation').disabled=true;const note=document.createElement('p');note.className='lead';note.textContent=err.message;document.querySelector('.cover-content').append(note);}await loadWishes();})();
