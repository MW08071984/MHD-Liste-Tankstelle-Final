
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './main.jsx'

const EMPLOYEES = [
  { nummer: 1, name: 'Lars', rolle: 'chef', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 2, name: 'Philipp', rolle: 'stationsleitung', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 3, name: 'Denis', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 9, name: 'Chris', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 17, name: 'Tizi', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 19, name: 'Michael', rolle: 'chef_temp', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 21, name: 'Mira', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 22, name: 'Anne', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
]

const BACKWAREN = [
  ['90371','Brötchen'], ['128501','Baguette'], ['90506','Brezel'], ['123284','Käse Brezel'],
  ['10006','Schinken Käse Brezel'], ['123991','Rustico Lauge Schinken Käse'], ['123347','Rustico Tomate Mozzarella'],
  ['123268','Rustico mit Spianata'], ['123267','Rustico Farmerschinken'], ['123269','Rustico Lauge mit Leerdammer'],
  ['123322','Rustico Schnitzel'], ['123981','Chicken Burger'], ['123341','Brinker/Snack Rustico Ei'],
  ['123340','Brinker/Snack Rustico Schinken'], ['123338','Brinker/Snack Rustico Käse'], ['123345','Brinker/Snack Rustico Salami'],
  ['103966','Butter Croissant'], ['103965','Nuss Nugat Croissant'], ['103967','Schokobrötchen'], ['122058','Kakao Hörnchen'],
  ['82965','Berry Donut'], ['200232','Vanille Donut'], ['90709','Pink Donut'], ['125260','Pizza Donut Salami'],
  ['103964','Marzipan Croissant'], ['103887','Mexicostange'], ['125241','Pizza Salami'], ['82862','Pizza Classico'],
  ['103622','Fußballbrötchen Gouda'], ['103950','Muschelbrötchen Käse Salami'],
].map(([artikelnummer, name]) => ({ artikelnummer, name }))

const CATS = ['Getränke','Kühlung','Milchprodukte','Snacks','Süßwaren','Backwaren','Sonstiges']
const todayISO = () => new Date().toISOString().slice(0,10)
const nowISO = () => new Date().toISOString()
const isAdmin = u => ['chef','chef_temp','stationsleitung'].includes(u?.rolle)
const roleLabel = r => r === 'chef' ? 'Chef' : r === 'chef_temp' ? 'Chef-Rechte' : r === 'stationsleitung' ? 'Stationsleitung' : 'Mitarbeiter'
function daysUntil(d){ if(!d) return 999; const a=new Date(); a.setHours(0,0,0,0); const b=new Date(d+'T00:00:00'); return Math.ceil((b-a)/86400000) }
function fileToDataUrl(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file) }) }
function onlineState(last){ if(!last) return ['offline','Offline']; const diff=Date.now()-new Date(last).getTime(); if(diff<120000) return ['online','Online']; if(diff<3600000) return ['away',`vor ${Math.round(diff/60000)} Min.`]; return ['offline',`vor ${Math.round(diff/3600000)} Std.`] }

async function openFoodFacts(barcode){
  if(!barcode) return null
  try{
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,image_front_url,categories`)
    const j = await r.json()
    if(j.status !== 1) return null
    const p = j.product || {}
    return { name: [p.brands,p.product_name].filter(Boolean).join(' · ') || p.product_name || barcode, bild_url:p.image_front_url || '', kategorie:'Sonstiges' }
  }catch{ return null }
}

export default function App(){
  const [ready,setReady]=useState(false), [user,setUser]=useState(null), [employees,setEmployees]=useState([])
  const [items,setItems]=useState([]), [writeoffs,setWriteoffs]=useState([]), [online,setOnline]=useState([]), [settings,setSettings]=useState({})
  const [tab,setTab]=useState('dashboard'), [error,setError]=useState(''), [success,setSuccess]=useState('')
  const [login,setLogin]=useState({nummer:'',passwort:'',remember:true}), [newPassword,setNewPassword]=useState('')
  const [form,setForm]=useState({barcode:'',artikelnummer:'',name:'',kategorie:'Sonstiges',mhd:todayISO(),menge:1,bild_url:''})
  const [editArticle,setEditArticle]=useState(null), [editWriteoff,setEditWriteoff]=useState(null)
  const db = !!supabase

  useEffect(()=>{ navigator.serviceWorker?.register('/sw.js').catch(()=>{}); const saved=localStorage.getItem('mhd_user'); if(saved){try{setUser(JSON.parse(saved))}catch{}}; init() },[])
  useEffect(()=>{ if(!db||!user) return; let stop=false; async function beat(){ if(stop) return; await supabase.from('online_status').upsert({nummer:Number(user.nummer),name:user.name,rolle:user.rolle,last_seen:nowISO()},{onConflict:'nummer'}); if(isAdmin(user)){ const {data}=await supabase.from('online_status').select('*').order('name'); setOnline(data||[]) } } beat(); const t=setInterval(beat,30000); return()=>{stop=true;clearInterval(t)} },[user])

  async function init(){
    if(!db){ setEmployees(EMPLOYEES); setReady(true); return }
    try{
      const {data:emps, error:empErr}=await supabase.from('mitarbeiter').select('*').order('nummer')
      if(empErr || !emps || !emps.length){
        setEmployees(EMPLOYEES)
      } else {
        setEmployees(emps)
      }
      const {data:its}=await supabase.from('mhd_artikel').select('*').order('mhd')
      const {data:abs}=await supabase.from('abschriften').select('*').order('created_at',{ascending:false})
      const {data:setts}=await supabase.from('app_settings').select('*')
      setItems(its||[])
      setWriteoffs(abs||[])
      setSettings(Object.fromEntries((setts||[]).map(s=>[s.key,s.value])))
    }catch(e){
      setEmployees(EMPLOYEES)
      console.warn(e)
    }
    setReady(true)
  }
  async function reload(){
    if(!db) return
    const {data:its}=await supabase.from('mhd_artikel').select('*').order('mhd')
    const {data:abs}=await supabase.from('abschriften').select('*').order('created_at',{ascending:false})
    const {data:setts}=await supabase.from('app_settings').select('*')
    setItems(its||[]); setWriteoffs(abs||[]); setSettings(Object.fromEntries((setts||[]).map(s=>[s.key,s.value])))
  }
  function localItems(next){setItems(next);localStorage.setItem('mhd_items',JSON.stringify(next))}
  function localAbs(next){setWriteoffs(next);localStorage.setItem('mhd_abs',JSON.stringify(next))}

  async function doLogin(e){
    e.preventDefault()
    setError('')
    const nr = Number(login.nummer)
    let emp = employees.find(x=>Number(x.nummer)===nr && String(x.passwort)===String(login.passwort))
    if(!emp){
      const fallback = EMPLOYEES.find(x=>Number(x.nummer)===nr && String(x.passwort)===String(login.passwort))
      if(fallback && (!employees || !employees.some(x=>Number(x.nummer)===nr))) emp = fallback
    }
    if(!emp) return setError('Nummer oder Passwort falsch.')
    setUser(emp)
    if(login.remember)localStorage.setItem('mhd_user',JSON.stringify(emp))
  }
  async function changePassword(){ if(!/^[0-9]{4}$/.test(newPassword)) return setError('Bitte genau 4 Zahlen eingeben.'); const updated={...user,passwort:newPassword,muss_passwort_aendern:false}; if(db){const {error}=await supabase.from('mitarbeiter').update({passwort:newPassword,muss_passwort_aendern:false}).eq('nummer',user.nummer); if(error)return setError(error.message)} setUser(updated); localStorage.setItem('mhd_user',JSON.stringify(updated)) }
  function logout(){ localStorage.removeItem('mhd_user'); setUser(null) }

  async function saveSetting(key,value){ if(!isAdmin(user)) return setError('Keine Rechte.'); const {error}=await supabase.from('app_settings').upsert({key,value,updated_by:user.name},{onConflict:'key'}); if(error)return setError(error.message); setSettings(p=>({...p,[key]:value})); setSuccess('Einstellung gespeichert.') }

  async function addItem(){ setError(''); if(!form.name||!form.mhd) return setError('Name und MHD fehlen.'); const payload={...form,artikel:form.name,name:form.name,menge:Number(form.menge||1),mitarbeiter:user.name,erstellt_von:Number(user.nummer)}; if(db){const {error}=await supabase.from('mhd_artikel').insert(payload); if(error)return setError(error.message); await reload()} else localItems([{id:Date.now(),created_at:nowISO(),...payload},...items]); setForm({barcode:'',artikelnummer:'',name:'',kategorie:'Sonstiges',mhd:todayISO(),menge:1,bild_url:''}); setSuccess('Artikel gespeichert.') }
  async function lookupBarcode(){ const p=await openFoodFacts(form.barcode); if(!p)return setError('Kein Produkt gefunden.'); setForm(f=>({...f,...p})); setSuccess('Produkt gefunden.') }
  async function uploadFormImg(e){ const f=e.target.files?.[0]; if(!f)return; const imageUrl=await fileToDataUrl(f); setForm(p=>({...p,bild_url:imageUrl})) }

  async function writeOff(payload){
    const final={artikel_id:payload.artikel_id||null,artikelnummer:payload.artikelnummer||'',artikel:payload.name||payload.artikel||'Artikel',name:payload.name||payload.artikel||'Artikel',kategorie:payload.kategorie||'',mhd:payload.mhd||todayISO(),menge:Number(payload.menge||1),bild_url:payload.bild_url||'',grund:payload.grund||'Abschrift',datum:todayISO(),mitarbeiter:user.name,mitarbeiter_nummer:Number(user.nummer),status:'abgeschlossen'}
    if(db){ const {error}=await supabase.from('abschriften').insert(final); if(error){setError('Abschrift fehlgeschlagen: '+error.message); return false} await reload() } else localAbs([{id:Date.now(),created_at:nowISO(),...final},...writeoffs])
    setSuccess(`Abschrift gespeichert: ${final.name} · Menge ${final.menge}`); navigator.vibrate?.(80); return true
  }
  async function writeOffArticle(item){ const ok=await writeOff({...item,artikel_id:item.id,grund:daysUntil(item.mhd)<0?'Abgelaufen':'Sonstiges'}); if(ok&&db&&item.id){await supabase.from('mhd_artikel').delete().eq('id',item.id); await reload()} }

  async function saveArticle(a){ if(!isAdmin(user))return setError('Keine Rechte.'); const payload={artikelnummer:a.artikelnummer||'',artikel:a.name||a.artikel,name:a.name||a.artikel,kategorie:a.kategorie,mhd:a.mhd,menge:Number(a.menge||1),barcode:a.barcode||'',bild_url:a.bild_url||''}; const {error}=await supabase.from('mhd_artikel').update(payload).eq('id',a.id); if(error)return setError(error.message); setEditArticle(null); await reload(); setSuccess('Artikel gespeichert.') }
  async function saveWriteoff(w){ if(!isAdmin(user))return setError('Abgeschickte Abschriften dürfen nur Chef/Stationsleitung bearbeiten.'); const payload={artikelnummer:w.artikelnummer||'',artikel:w.name||w.artikel,name:w.name||w.artikel,grund:w.grund,menge:Number(w.menge||1),datum:w.datum||todayISO(),status:'abgeschlossen'}; const {error}=await supabase.from('abschriften').update(payload).eq('id',w.id); if(error)return setError(error.message); setEditWriteoff(null); await reload(); setSuccess('Abschrift gespeichert.') }
  async function deleteWriteoff(w){ if(!isAdmin(user))return setError('Abgeschickte Abschriften dürfen nur Chef/Stationsleitung löschen.'); const {error}=await supabase.from('abschriften').delete().eq('id',w.id); if(error)return setError(error.message); await reload(); setSuccess('Abschrift gelöscht.') }

  const stats=useMemo(()=>({total:items.length,expired:items.filter(i=>daysUntil(i.mhd)<0).length,urgent:items.filter(i=>daysUntil(i.mhd)>=0&&daysUntil(i.mhd)<=2).length,week:items.filter(i=>daysUntil(i.mhd)>2&&daysUntil(i.mhd)<=7).length}),[items])

  if(!ready) return <main className="center">Lade App...</main>
  if(!db) return <main className="center">Supabase ENV fehlt.</main>
  if(!user) return <Login login={login} setLogin={setLogin} error={error} doLogin={doLogin}/>
  if(user.muss_passwort_aendern||user.passwort==='0000') return <main className="loginPage"><section className="loginCard"><h1>Neues Passwort setzen</h1><p>{user.name}, bitte eigenes 4-stelliges Passwort vergeben.</p><input inputMode="numeric" maxLength="4" value={newPassword} onChange={e=>setNewPassword(e.target.value.replace(/\D/g,''))}/>{error&&<div className="error">{error}</div>}<button onClick={changePassword}>Speichern</button></section></main>

  return <main className="app">
    <header className="topbar"><div><p>MHD Kontrolle · {roleLabel(user.rolle)}</p><h1>Hallo {user.name}</h1></div><button className="logout" onClick={logout}>Logout</button></header>
    <section className="stats"><Stat label="Artikel" value={stats.total} click={()=>setTab('artikel')}/><Stat label="Abgelaufen" value={stats.expired}/><Stat label="Bald" value={stats.urgent}/><Stat label="Woche" value={stats.week}/></section>
    <nav className="tabs">{[['dashboard','Übersicht'],['artikel','Artikel'],['erfassen','Erfassen'],['backwaren','Backwaren'],['abschriften','Abschriften'],['bilder','Bilder'],['dienstplan','Dienstplan'],...(isAdmin(user)?[['online','Mitarbeiter'],['settings','Einstellungen']]:[])].map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}</nav>
    {error&&<div className="error">{error}</div>}{success&&<div className="success">{success}</div>}
    {tab==='dashboard'&&<Dashboard items={items} setTab={setTab} writeOffArticle={writeOffArticle} user={user} setEditArticle={setEditArticle}/>}
    {tab==='artikel'&&<ArticleList items={items} user={user} setEditArticle={setEditArticle} writeOffArticle={writeOffArticle}/>}
    {tab==='erfassen'&&<Erfassen form={form} setForm={setForm} addItem={addItem} lookupBarcode={lookupBarcode} uploadFormImg={uploadFormImg} user={user}/>}
    {tab==='backwaren'&&<Backwaren writeOff={writeOff}/>}
    {tab==='abschriften'&&<Abschriften writeoffs={writeoffs} user={user} setEditWriteoff={setEditWriteoff} deleteWriteoff={deleteWriteoff}/>}
    {tab==='bilder'&&<Bilder items={items} user={user} reload={reload}/>}
    {tab==='dienstplan'&&<Dienstplan settings={settings} saveSetting={saveSetting} user={user}/>}
    {tab==='online'&&isAdmin(user)&&<Online online={online}/>}
    {tab==='settings'&&isAdmin(user)&&<Settings/>}
    {editArticle&&<ArticleModal data={editArticle} close={()=>setEditArticle(null)} save={saveArticle}/>}
    {editWriteoff&&<WriteoffModal data={editWriteoff} close={()=>setEditWriteoff(null)} save={saveWriteoff}/>}
  </main>
}

function Login({login,setLogin,error,doLogin}){return <main className="loginPage"><section className="loginCard"><div className="brandBadge">MHD</div><h1>Tankstelle Ludweiler</h1><p>Mitarbeiter-Login</p><form onSubmit={doLogin}><label>Mitarbeiternummer</label><input inputMode="numeric" value={login.nummer} onChange={e=>setLogin({...login,nummer:e.target.value})}/><label>Passwort</label><input type="password" inputMode="numeric" value={login.passwort} onChange={e=>setLogin({...login,passwort:e.target.value})}/><label className="check"><input type="checkbox" checked={login.remember} onChange={e=>setLogin({...login,remember:e.target.checked})}/> Dauerhaft eingeloggt bleiben</label>{error&&<div className="error">{error}</div>}<button>Einloggen</button></form></section></main>}
function Stat({label,value,click}){return <button className="stat" onClick={click}><span>{label}</span><b>{value}</b></button>}
function Dashboard(p){return <section className="list"><button className="primary" onClick={()=>p.setTab('erfassen')}>+ Schnell erfassen</button>{p.items.map(i=><Article key={i.id} item={i} {...p}/>)}</section>}
function ArticleList(p){return <section className="list"><h2>Artikel</h2>{p.items.map(i=><Article key={i.id} item={i} {...p}/>)}</section>}
function Article({item,user,setEditArticle,writeOffArticle}){const d=daysUntil(item.mhd);return <div className="item"><div className="thumb">{item.bild_url?<img src={item.bild_url}/>: '📦'}</div><div className="grow"><b>{item.name||item.artikel}</b><p>{item.artikelnummer?`Art.-Nr. ${item.artikelnummer} · `:''}{item.kategorie} · {item.barcode||'ohne Barcode'}</p><p>MHD {item.mhd?new Date(item.mhd).toLocaleDateString('de-DE'):''} · {item.menge} Stk. · {d<0?`${Math.abs(d)} Tage drüber`:`${d} Tage`}</p></div><div className="actions">{isAdmin(user)&&<button onClick={()=>setEditArticle(item)}>Bearbeiten</button>}<button onClick={()=>writeOffArticle(item)}>Abschrift</button></div></div>}
function Erfassen({form,setForm,addItem,lookupBarcode,uploadFormImg,user}){return <section className="formCard"><h2>Artikel erfassen</h2><input placeholder="Barcode" value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})}/><button onClick={lookupBarcode}>Auto-Suche</button><input placeholder="Artikelnummer" value={form.artikelnummer} onChange={e=>setForm({...form,artikelnummer:e.target.value})}/><input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><select value={form.kategorie} onChange={e=>setForm({...form,kategorie:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select><input type="date" value={form.mhd} onChange={e=>setForm({...form,mhd:e.target.value})}/><input type="number" min="1" value={form.menge} onChange={e=>setForm({...form,menge:e.target.value})}/>{isAdmin(user)&&<label className="upload">Bild/Screenshot hochladen<input type="file" accept="image/*" onChange={uploadFormImg}/></label>}{form.bild_url&&<img className="preview" src={form.bild_url}/>}<button className="primary" onClick={addItem}>Speichern</button></section>}
function Backwaren({writeOff}){const [qty,setQty]=useState({}); const [sent,setSent]=useState(false); const entries=BACKWAREN.map(b=>({...b,menge:Number(qty[b.artikelnummer]||0)})).filter(b=>b.menge>0); const total=entries.reduce((s,b)=>s+b.menge,0); async function submit(){if(!entries.length)return alert('Bitte Mengen eintragen.'); setSent(true); for(const e of entries) await writeOff({artikelnummer:e.artikelnummer,name:e.name,kategorie:'Backwaren',mhd:todayISO(),menge:e.menge,grund:'Backwaren Tagesende'}); setQty({}); setSent(false)} return <section className="list backwarenPage"><div className="stickySubmit"><div><h2>Backwaren Tagesende</h2><p>{entries.length} Positionen · {total} Stück</p></div><button disabled={!entries.length||sent} onClick={submit}>{sent?'Speichern...':'Alles absenden'}</button></div><div className="submitHint">Erst Mengen eintragen. Bis zum Absenden kannst du alles ändern. Nach dem Absenden kann nur Chef/Stationsleitung ändern.</div>{BACKWAREN.map(b=><div className={'item bakery '+(Number(qty[b.artikelnummer]||0)>0?'selectedBakery':'')} key={b.artikelnummer}><div className="artikelnummer">{b.artikelnummer}</div><div className="grow"><b>{b.name}</b><p>Artikelnummer {b.artikelnummer}</p></div><input className="qty" inputMode="numeric" value={qty[b.artikelnummer]||''} onChange={e=>setQty({...qty,[b.artikelnummer]:e.target.value.replace(/\D/g,'')})} placeholder="0"/></div>)}<button className="fixedSubmit" disabled={!entries.length||sent} onClick={submit}>{sent?'Speichern...':`Backwaren absenden (${total})`}</button></section>}
function Abschriften({writeoffs,user,setEditWriteoff,deleteWriteoff}){return <section className="list"><h2>Abschriften</h2>{writeoffs.map(w=><div className="item" key={w.id}><div className="artikelnummer small">{w.artikelnummer||'MHD'}</div><div className="grow"><b>{w.name||w.artikel}</b><p>{w.grund} · {w.menge} Stk. · {w.mitarbeiter} · {new Date(w.datum||w.created_at).toLocaleDateString('de-DE')}</p></div>{isAdmin(user)&&<div className="actions"><button onClick={()=>setEditWriteoff(w)}>Bearbeiten</button><button onClick={()=>deleteWriteoff(w)}>Löschen</button></div>}</div>)}</section>}
function Bilder({items,user,reload}){async function upload(item,e){const f=e.target.files?.[0]; if(!f)return; const url=await fileToDataUrl(f); const {error}=await supabase.from('mhd_artikel').update({bild_url:url}).eq('id',item.id); if(!error) reload()} return <section className="formCard"><h2>Bilder verwalten</h2><p>Nur Chef/Stationsleitung kann Bilder ändern.</p>{items.map(i=><div className="item" key={i.id}><div className="thumb">{i.bild_url?<img src={i.bild_url}/>: '📦'}</div><div className="grow"><b>{i.name}</b></div>{isAdmin(user)&&<label className="miniUpload">Upload<input type="file" accept="image/*" onChange={e=>upload(i,e)}/></label>}</div>)}</section>}
function Dienstplan({settings,saveSetting,user}){const [m,setM]=useState('juni'); const src=settings['dienstplan_'+m]||`/dienstplan-${m}-2026.jpg`; async function up(e){const f=e.target.files?.[0]; if(f) saveSetting('dienstplan_'+m,await fileToDataUrl(f))} return <section className="formCard"><h2>Dienstplan</h2><div className="planSwitch"><button className={m==='mai'?'active':''} onClick={()=>setM('mai')}>Mai 2026</button><button className={m==='juni'?'active':''} onClick={()=>setM('juni')}>Juni 2026</button></div><div className="dienstplanBox"><img src={src}/></div><a className="downloadBtn" href={src} target="_blank">Plan groß öffnen</a>{isAdmin(user)&&<label className="upload">Diesen Plan ersetzen<input type="file" accept="image/*,application/pdf" onChange={up}/></label>}</section>}
function Online({online}){return <section className="formCard"><h2>Mitarbeiter online</h2>{online.map(o=>{const [cls,txt]=onlineState(o.last_seen); return <div className="onlineItem" key={o.nummer}><span className={'dot '+cls}></span><div><b>{o.name}</b><p>{roleLabel(o.rolle)} · {txt}</p></div></div>})}</section>}
function Settings(){return <section className="formCard"><h2>Einstellungen</h2><div className="settingCard"><b>Artikel/Bilder</b><p>Chef/Stationsleitung kann Artikel und Bilder direkt in der App ändern.</p></div><div className="settingCard"><b>Dienstplan</b><p>Dienstpläne können im Dienstplan-Tab ersetzt werden.</p></div></section>}
function ArticleModal({data,close,save}){const [d,setD]=useState({...data}); async function up(e){const f=e.target.files?.[0]; if(f)setD({...d,bild_url:await fileToDataUrl(f)})} return <div className="modalOverlay"><div className="modalCard"><h2>Artikel bearbeiten</h2><input placeholder="Artikelnummer" value={d.artikelnummer||''} onChange={e=>setD({...d,artikelnummer:e.target.value})}/><input placeholder="Name" value={d.name||''} onChange={e=>setD({...d,name:e.target.value})}/><select value={d.kategorie||'Sonstiges'} onChange={e=>setD({...d,kategorie:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select><input type="date" value={d.mhd||todayISO()} onChange={e=>setD({...d,mhd:e.target.value})}/><input type="number" value={d.menge||1} onChange={e=>setD({...d,menge:e.target.value})}/><input placeholder="Barcode" value={d.barcode||''} onChange={e=>setD({...d,barcode:e.target.value})}/><label className="upload">Bild hochladen<input type="file" accept="image/*" onChange={up}/></label>{d.bild_url&&<img className="preview" src={d.bild_url}/>}<div className="modalActions"><button onClick={close}>Abbrechen</button><button onClick={()=>save(d)}>Speichern</button></div></div></div>}
function WriteoffModal({data,close,save}){const [d,setD]=useState({...data}); return <div className="modalOverlay"><div className="modalCard"><h2>Abschrift bearbeiten</h2><input value={d.artikelnummer||''} onChange={e=>setD({...d,artikelnummer:e.target.value})}/><input value={d.name||d.artikel||''} onChange={e=>setD({...d,name:e.target.value})}/><input value={d.grund||''} onChange={e=>setD({...d,grund:e.target.value})}/><input type="number" value={d.menge||1} onChange={e=>setD({...d,menge:e.target.value})}/><input type="date" value={(d.datum||todayISO()).slice(0,10)} onChange={e=>setD({...d,datum:e.target.value})}/><div className="modalActions"><button onClick={close}>Abbrechen</button><button onClick={()=>save(d)}>Speichern</button></div></div></div>}
