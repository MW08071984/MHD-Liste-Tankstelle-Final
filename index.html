import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const categories = ['Kühlung','Getränke','Milchprodukte','Snacks','Süßwaren','Backshop','Sonstiges']
const reasons = ['Abgelaufen','Backwaren Tagesende','Beschädigt','Kühlkette unterbrochen','Sonstiges']
const roles = ['Chef','Stationsleitung','Mitarbeiter']
function canDelete(role){ return role === 'Chef' || role === 'Stationsleitung' }
function canManageEmployees(role){ return role === 'Chef' }

function daysUntil(dateString){
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateString + 'T00:00:00')
  return Math.ceil((target - today)/(1000*60*60*24))
}
function statusFor(mhd){
  const d = daysUntil(mhd)
  if(d < 0) return {text:'Abgelaufen', cls:'danger'}
  if(d <= 2) return {text:'Bald fällig', cls:'warn'}
  if(d <= 7) return {text:'Diese Woche', cls:'soon'}
  return {text:'OK', cls:'ok'}
}
function catFromProduct(p){
  const t = `${p.categories||''} ${(p.categories_tags||[]).join(' ')}`.toLowerCase()
  if(/drink|beverage|getränk|wasser|cola|energy|juice|saft/.test(t)) return 'Getränke'
  if(/milk|dairy|joghurt|cheese|käse|milch/.test(t)) return 'Milchprodukte'
  if(/snack|chips|nuts|nüsse|cracker/.test(t)) return 'Snacks'
  if(/chocolate|candy|sweet|süß|bonbon|gummi/.test(t)) return 'Süßwaren'
  if(/bakery|bread|sandwich|croissant|brötchen|back/.test(t)) return 'Backshop'
  return 'Sonstiges'
}
async function lookupBarcode(barcode){
  const clean = String(barcode||'').trim()
  if(!clean) return null
  try{
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json?fields=product_name,brands,image_front_url,categories,categories_tags`
    const res = await fetch(url)
    const data = await res.json()
    if(data.status !== 1 || !data.product) return null
    const p = data.product
    const name = [p.brands, p.product_name].filter(Boolean).join(' · ') || p.product_name || clean
    return { artikel:name, bild_url:p.image_front_url || '', kategorie:catFromProduct(p) }
  }catch(e){ console.error(e); return null }
}
async function registerSW(){ if('serviceWorker' in navigator) try{ await navigator.serviceWorker.register('/sw.js') }catch(e){} }
async function showNotification(title, body, tag='mhd-info') {
  if(!('Notification' in window)) return false
  if(Notification.permission !== 'granted'){
    const p = await Notification.requestPermission(); if(p !== 'granted') return false
  }
  await registerSW()
  const reg = await navigator.serviceWorker?.ready
  const options = { body, tag, renotify:true, icon:'/icon-192.png', badge:'/icon-192.png' }
  if(reg?.showNotification) await reg.showNotification(title, options)
  else new Notification(title, options)
  return true
}
async function notify(items, force=false){
  const bad = items.filter(x => daysUntil(x.mhd) <= 2).sort((a,b)=>new Date(a.mhd)-new Date(b.mhd))
  if(!bad.length){
    if(force) await showNotification('MHD Kontrolle', 'Aktuell läuft nichts innerhalb von 2 Tagen ab.', 'mhd-ok')
    return
  }
  const todayKey = new Date().toISOString().slice(0,10)
  const ids = bad.map(x=>x.id).join('-')
  const storageKey = `mhd-notified-${todayKey}-${ids}`
  if(!force && localStorage.getItem(storageKey)) return
  const body = bad.slice(0,5).map(x=>`${x.artikel} · ${new Date(x.mhd).toLocaleDateString('de-DE')} · ${x.menge} Stk.`).join('\n') + (bad.length>5 ? `\n+ ${bad.length-5} weitere Artikel` : '')
  const ok = await showNotification('MHD Warnung', body, 'mhd-warning')
  if(ok) localStorage.setItem(storageKey, '1')
}

export default function App(){
  const [user,setUser]=useState(() => {
    try { return JSON.parse(localStorage.getItem('mhd_user') || 'null') } catch { return null }
  })
  const [num,setNum]=useState('')
  const [pin,setPin]=useState('')
  const [loginMsg,setLoginMsg]=useState('')
  const [mustChangePassword,setMustChangePassword]=useState(false)
  const [newPin,setNewPin]=useState('')
  const [newPin2,setNewPin2]=useState('')
  const [items,setItems]=useState([])
  const [writeoffs,setWriteoffs]=useState([])
  const [view,setView]=useState('dashboard')
  const [search,setSearch]=useState('')
  const [cat,setCat]=useState('alle')
  const [msg,setMsg]=useState('')
  const fileRef=useRef(null)
  const [form,setForm]=useState({artikel:'',barcode:'',kategorie:'Sonstiges',mhd:'',menge:1,bild_url:''})
  const [pushState,setPushState]=useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')

  useEffect(()=>{registerSW()},[])
  useEffect(()=>{ if(user) {loadAll(); const t=setInterval(()=>loadAll(),60000); return()=>clearInterval(t)} },[user])
  useEffect(()=>{ if(user && items.length) notify(items) },[items,user])

  async function login(e){
    e?.preventDefault(); setLoginMsg('')
    if(!supabase) return setLoginMsg('Supabase ENV Variablen fehlen.')
    const n = String(num).trim()
    const p = String(pin).trim()
    const {data,error} = await supabase.from('mitarbeiter').select('*').eq('nummer', n).eq('passwort', p).maybeSingle()
    if(error) { console.error(error); return setLoginMsg('Login-Tabelle prüfen: mitarbeiter, nummer, passwort, RLS aus.') }
    if(!data) return setLoginMsg('Login fehlgeschlagen. Nummer oder Passwort prüfen.')
    setUser(data)
    localStorage.setItem('mhd_user', JSON.stringify(data))
    if(data.passwort === '0000' || data.muss_passwort_aendern){
      setMustChangePassword(true)
      setView('dashboard')
      return
    }
    setView('dashboard')
  }
  async function changePassword(e){
    e?.preventDefault(); setLoginMsg('')
    const a = String(newPin).trim()
    const b = String(newPin2).trim()
    if(!/^\d{4}$/.test(a)) return setLoginMsg('Das neue Passwort muss genau 4 Zahlen haben.')
    if(a === '0000') return setLoginMsg('Bitte nicht wieder 0000 benutzen.')
    if(a !== b) return setLoginMsg('Die Passwörter stimmen nicht überein.')
    const {error} = await supabase.from('mitarbeiter').update({passwort:a, muss_passwort_aendern:false}).eq('id', user.id)
    if(error){ console.error(error); return setLoginMsg('Passwort konnte nicht gespeichert werden.') }
    const updatedUser = {...user, passwort:a, muss_passwort_aendern:false}
    setUser(updatedUser)
    localStorage.setItem('mhd_user', JSON.stringify(updatedUser))
    setMustChangePassword(false)
    setNewPin(''); setNewPin2('')
    setView('dashboard')
  }
  async function loadAll(){ await Promise.all([loadItems(), loadWriteoffs()]) }
  async function enablePush(){
    const ok = await showNotification('MHD Push aktiviert', 'Du bekommst Warnungen, wenn Artikel bald ablaufen.', 'mhd-enabled')
    setPushState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
    if(ok) await notify(items, true)
    else setMsg('Benachrichtigungen wurden nicht erlaubt. Bitte Browser-Berechtigung prüfen.')
  }
  async function loadItems(){
    const {data,error}=await supabase.from('mhd_artikel').select('*').order('mhd',{ascending:true})
    if(error) console.error(error); else setItems(data||[])
  }
  async function loadWriteoffs(){
    const {data,error}=await supabase.from('abschriften').select('*').order('created_at',{ascending:false})
    if(error) console.error(error); else setWriteoffs(data||[])
  }
  async function scan(){
    setMsg('')
    if(!('BarcodeDetector' in window)) return setMsg('Barcode-Scanner wird auf diesem Browser nicht unterstützt. Barcode manuell eingeben oder Chrome/Android testen.')
    try{
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
      const video=document.createElement('video'); video.srcObject=stream; video.playsInline=true; await video.play()
      const overlay=document.createElement('div'); overlay.className='scanOverlay'
      overlay.innerHTML='<div class="scanText">Barcode in den Rahmen halten</div><button class="scanCancel">Abbrechen</button>'
      overlay.insertBefore(video, overlay.querySelector('button'))
      document.body.appendChild(overlay)
      const detector=new window.BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128']})
      let stop=false
      const close=(val)=>{stop=true; stream.getTracks().forEach(t=>t.stop()); overlay.remove(); return val}
      overlay.querySelector('button').onclick=()=>close(null)
      const loop=async()=>{
        if(stop) return
        const codes=await detector.detect(video).catch(()=>[])
        if(codes.length){ const code=close(codes[0].rawValue); await fillBarcode(code); return }
        requestAnimationFrame(loop)
      }; loop()
    }catch(e){ setMsg('Kamera konnte nicht gestartet werden.') }
  }
  async function fillBarcode(code){
    setForm(f=>({...f,barcode:code}))
    setMsg('Suche Produktbild...')
    const p=await lookupBarcode(code)
    if(p){ setForm(f=>({...f,barcode:code,artikel:p.artikel||f.artikel,kategorie:p.kategorie||f.kategorie,bild_url:p.bild_url||f.bild_url})); setMsg('Produkt automatisch gefunden.') }
    else setMsg('Produkt online nicht gefunden. Bitte Name/Bild manuell ergänzen.')
  }
  async function onBarcodeBlur(){ if(form.barcode && !form.artikel) await fillBarcode(form.barcode) }
  async function uploadImage(file){
    if(!file) return
    setMsg('Bild wird hochgeladen...')
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
    const {error}=await supabase.storage.from('artikelbilder').upload(path,file,{upsert:false})
    if(error){ setMsg('Bildspeicher fehlt. Lege in Supabase Storage den Bucket artikelbilder an.'); return }
    const {data}=supabase.storage.from('artikelbilder').getPublicUrl(path)
    setForm(f=>({...f,bild_url:data.publicUrl}))
    setMsg('Eigenes Bild gespeichert.')
  }
  async function addItem(e){
    e?.preventDefault(); setMsg('')
    if(!form.artikel || !form.mhd) return setMsg('Artikelname und MHD eintragen.')
    const row={...form,menge:Number(form.menge||1),mitarbeiter:user?.name||String(user?.nummer||''),created_by:user?.nummer||''}
    const {error}=await supabase.from('mhd_artikel').insert(row)
    if(error){ console.error(error); return setMsg('Artikel konnte nicht gespeichert werden. Tabelle mhd_artikel prüfen.') }
    setForm({artikel:'',barcode:'',kategorie:'Sonstiges',mhd:'',menge:1,bild_url:''}); await loadItems(); setMsg('Artikel gespeichert.')
  }
  async function remove(id){
    if(!canDelete(user?.rolle || 'Mitarbeiter')){ setMsg('Nur Chef oder Stationsleitung dürfen Artikel löschen.'); return }
    await supabase.from('mhd_artikel').delete().eq('id',id); await loadItems()
  }
  async function writeoff(item, grund){
    const row={artikel:item.artikel,barcode:item.barcode,kategorie:item.kategorie,mhd:item.mhd,menge:item.menge,grund,mitarbeiter:user?.name||'',bild_url:item.bild_url}
    const {error}=await supabase.from('abschriften').insert(row)
    if(error){ console.error(error); setMsg('Abschrift konnte nicht gespeichert werden. Tabelle abschriften prüfen.'); return }
    await remove(item.id); await loadWriteoffs(); setMsg('In Abschriften gespeichert.')
  }

  const filtered=useMemo(()=>items.filter(x=>{
    const q=`${x.artikel} ${x.barcode||''} ${x.mitarbeiter||''}`.toLowerCase().includes(search.toLowerCase())
    const c=cat==='alle'||x.kategorie===cat
    return q&&c
  }).sort((a,b)=>new Date(a.mhd)-new Date(b.mhd)),[items,search,cat])
  const stats=useMemo(()=>({total:items.length, expired:items.filter(x=>daysUntil(x.mhd)<0).length, soon:items.filter(x=>daysUntil(x.mhd)>=0&&daysUntil(x.mhd)<=2).length, week:items.filter(x=>daysUntil(x.mhd)>2&&daysUntil(x.mhd)<=7).length}),[items])
  const grouped=useMemo(()=>{
    const m={}; filtered.forEach(x=>{const k=x.barcode||x.artikel; (m[k] ||= {name:x.artikel,img:x.bild_url,rows:[]}).rows.push(x)}); return Object.values(m)
  },[filtered])

  if(!user) return <div className="loginPage"><form className="loginCard" onSubmit={login}><div className="logo">MHD</div><h1>Tankstelle Ludweiler</h1><p>Mitarbeiter-Login</p><input inputMode="numeric" placeholder="Nummer" value={num} onChange={e=>setNum(e.target.value)}/><input inputMode="numeric" type="password" placeholder="4-stelliges Passwort" value={pin} onChange={e=>setPin(e.target.value)}/><button>Einloggen</button>{loginMsg&&<div className="error">{loginMsg}</div>}</form></div>

  if(mustChangePassword) return <div className="loginPage"><form className="loginCard" onSubmit={changePassword}><div className="logo">🔐</div><h1>Neues Passwort setzen</h1><p>Beim ersten Login muss das Standardpasswort 0000 geändert werden.</p><input inputMode="numeric" type="password" maxLength="4" placeholder="Neues 4-stelliges Passwort" value={newPin} onChange={e=>setNewPin(e.target.value)}/><input inputMode="numeric" type="password" maxLength="4" placeholder="Passwort wiederholen" value={newPin2} onChange={e=>setNewPin2(e.target.value)}/><button>Passwort speichern</button>{loginMsg&&<div className="error">{loginMsg}</div>}<button type="button" className="ghost full" onClick={()=>{localStorage.removeItem('mhd_user'); setUser(null);setMustChangePassword(false)}}>Abbrechen</button></form></div>

  return <div className="app">
    <header><div><small>MHD Kontrolle · {user.rolle || 'Mitarbeiter'}</small><h1>Hallo {user.name || user.nummer}</h1></div><button className="ghost" onClick={()=>{localStorage.removeItem('mhd_user'); setUser(null); setMustChangePassword(false)}}>Logout</button></header>
    <nav>{['dashboard','erfassen','artikel','abschriften','backwaren', ...(canManageEmployees(user?.rolle) ? ['mitarbeiter'] : [])].map(v=><button key={v} className={view===v?'active':''} onClick={()=>setView(v)}>{v==='dashboard'?'Übersicht':v==='erfassen'?'Erfassen':v==='artikel'?'Artikel':v==='abschriften'?'Abschriften':v==='backwaren'?'Backwaren':'Mitarbeiter'}</button>)}</nav>
    {msg&&<div className="msg">{msg}</div>}

    {view==='dashboard'&&<section><div className="stats"><Card t="Gesamt" v={stats.total}/><Card t="Abgelaufen" v={stats.expired} danger/><Card t="Bald" v={stats.soon} warn/><Card t="7 Tage" v={stats.week}/></div><div className="dashActions"><button className="primary big" onClick={()=>setView('erfassen')}>+ Schnell erfassen</button><button className="secondary big" onClick={enablePush}>🔔 Push aktivieren/testen</button></div><p className="hint">Push-Status: {pushState === 'granted' ? 'aktiviert' : pushState === 'denied' ? 'blockiert' : 'noch nicht aktiviert'}. Auf iPhone am besten als App zum Home-Bildschirm hinzufügen.</p><List items={filtered.slice(0,6)} onWriteoff={writeoff} onRemove={remove}/></section>}

    {view==='erfassen'&&<section><form className="form" onSubmit={addItem}>
      <div className="scanRow"><input placeholder="Barcode" value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})} onBlur={onBarcodeBlur}/><button type="button" onClick={scan}>📷 Scan</button></div>
      <input placeholder="Artikelname" value={form.artikel} onChange={e=>setForm({...form,artikel:e.target.value})}/>
      <div className="preview">{form.bild_url?<img src={form.bild_url}/>:<div className="noimg">Kein Bild</div>}<button type="button" onClick={()=>fileRef.current.click()}>Eigenes Bild</button><input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>uploadImage(e.target.files?.[0])}/></div>
      <select value={form.kategorie} onChange={e=>setForm({...form,kategorie:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select>
      <div className="two"><input type="date" value={form.mhd} onChange={e=>setForm({...form,mhd:e.target.value})}/><input type="number" min="1" placeholder="Menge" value={form.menge} onChange={e=>setForm({...form,menge:e.target.value})}/></div>
      <button className="primary">Speichern</button><p className="hint">Gleiches Produkt mit anderem MHD einfach erneut speichern. Es bleibt als eigener MHD-Eintrag erhalten.</p>
    </form></section>}

    {view==='artikel'&&<section><Filters search={search} setSearch={setSearch} cat={cat} setCat={setCat}/>{grouped.map(g=><div className="group" key={g.name}><div className="groupHead">{g.img&&<img src={g.img}/>}<b>{g.name}</b><span>{g.rows.length} MHD-Einträge</span></div><List items={g.rows} onWriteoff={writeoff} onRemove={remove}/></div>)}</section>}
    {view==='abschriften'&&<Writeoffs rows={writeoffs}/>} 
    {view==='backwaren'&&<section><h2>Backwaren Tagesende</h2><List items={items.filter(x=>x.kategorie==='Backshop')} onWriteoff={(i)=>writeoff(i,'Backwaren Tagesende')} onRemove={remove} bakery/></section>}
    {view==='mitarbeiter'&&<EmployeeInfo/>}
  </div>
}
function EmployeeInfo(){return <section><h2>Mitarbeiter & Rollen</h2><div className="empty">Mitarbeiter werden in Supabase in der Tabelle <b>mitarbeiter</b> gepflegt. Rollen: Chef, Stationsleitung, Mitarbeiter. Standardpasswort: 0000, danach Passwortwechsel beim ersten Login.</div></section>}
function Card({t,v,danger,warn}){return <div className={`stat ${danger?'danger':warn?'warn':''}`}><span>{t}</span><b>{v}</b></div>}
function Filters({search,setSearch,cat,setCat}){return <div className="filters"><input placeholder="Suche Artikel / Barcode" value={search} onChange={e=>setSearch(e.target.value)}/><select value={cat} onChange={e=>setCat(e.target.value)}><option value="alle">Alle</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>}
function List({items,onWriteoff,onRemove,bakery}){return <div className="list">{items.map(item=><Item key={item.id} item={item} onWriteoff={onWriteoff} onRemove={onRemove} bakery={bakery}/>)}{!items.length&&<div className="empty">Keine Einträge.</div>}</div>}
function Item({item,onWriteoff,onRemove,bakery}){const s=statusFor(item.mhd);return <div className={`item ${s.cls}`}>{item.bild_url&&<img src={item.bild_url}/>}<div className="itemMain"><b>{item.artikel}</b><small>{item.kategorie} {item.barcode?`· ${item.barcode}`:''}</small><div className="meta"><span>MHD {new Date(item.mhd).toLocaleDateString('de-DE')}</span><span>{item.menge} Stk.</span><span>{daysUntil(item.mhd)} Tage</span></div></div><div className="actions"><button onClick={()=>onWriteoff(item,bakery?'Backwaren Tagesende':(daysUntil(item.mhd)<0?'Abgelaufen':'Sonstiges'))}>Abschrift</button><button className="del" onClick={()=>onRemove(item.id)}>×</button></div></div>}
function Writeoffs({rows}){const today=new Date().toISOString().slice(0,10); const r=rows.filter(x=>x.created_at?.slice(0,10)===today); return <section><h2>Abschriften heute</h2><div className="sum">{r.length} Positionen · {r.reduce((a,b)=>a+Number(b.menge||0),0)} Stück</div><div className="list">{r.map(x=><div className="item" key={x.id}>{x.bild_url&&<img src={x.bild_url}/>}<div className="itemMain"><b>{x.artikel}</b><small>{x.grund}</small><div className="meta"><span>{x.menge} Stk.</span><span>{x.mitarbeiter}</span></div></div></div>)}{!r.length&&<div className="empty">Heute keine Abschriften.</div>}</div></section>}
