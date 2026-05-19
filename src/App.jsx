import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const starterEmployees = [
  { nummer: 1, name: 'Denis', passwort: '0000', rolle: 'Mitarbeiter', mussPasswortAendern: true },
  { nummer: 2, name: 'Michael', passwort: '0000', rolle: 'Chef', mussPasswortAendern: true },
  { nummer: 3, name: 'Chris', passwort: '0000', rolle: 'Stationsleitung', mussPasswortAendern: true },
  { nummer: 4, name: 'Tizi', passwort: '0000', rolle: 'Mitarbeiter', mussPasswortAendern: true },
  { nummer: 5, name: 'Philip', passwort: '0000', rolle: 'Mitarbeiter', mussPasswortAendern: true },
  { nummer: 6, name: 'Anne', passwort: '0000', rolle: 'Mitarbeiter', mussPasswortAendern: true },
  { nummer: 7, name: 'Lars', passwort: '0000', rolle: 'Mitarbeiter', mussPasswortAendern: true },
  { nummer: 8, name: 'Mira', passwort: '0000', rolle: 'Mitarbeiter', mussPasswortAendern: true },
  { nummer: 9, name: 'Christian', passwort: '0000', rolle: 'Stationsleitung', mussPasswortAendern: true },
  { nummer: 19, name: 'Michael', passwort: '0000', rolle: 'Chef', mussPasswortAendern: true },
]

const backwarenListe = [
  { artikelnummer: '1001', name: 'Brötchen normal' },
  { artikelnummer: '1002', name: 'Körnerbrötchen' },
  { artikelnummer: '1003', name: 'Croissant' },
  { artikelnummer: '1004', name: 'Schokobrötchen' },
  { artikelnummer: '1005', name: 'Brezel' },
  { artikelnummer: '1006', name: 'Laugenstange' },
  { artikelnummer: '1007', name: 'Baguette' },
  { artikelnummer: '1008', name: 'Donut' },
]

const categories = ['Kühlung', 'Getränke', 'Milchprodukte', 'Snacks', 'Süßwaren', 'Backshop', 'Sonstiges']
const today = () => new Date().toISOString().slice(0, 10)
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const daysUntil = (date) => Math.ceil((new Date(date + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000)

function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)) }

export default function App() {
  const [employees, setEmployees] = useState(() => load('mhd_employees', starterEmployees))
  const [items, setItems] = useState(() => load('mhd_items', []))
  const [currentUser, setCurrentUser] = useState(() => load('mhd_session', null))
  const [login, setLogin] = useState({ nummer: '', passwort: '', remember: true })
  const [passwordForm, setPasswordForm] = useState({ neu: '', wiederholen: '' })
  const [tab, setTab] = useState('artikel')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ name: '', barcode: '', image: '', category: 'Getränke', mhd: today(), menge: '', employee: '' })
  const [back, setBack] = useState({ artikelnummer: '', name: '', menge: '', employee: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => save('mhd_employees', employees), [employees])
  useEffect(() => save('mhd_items', items), [items])
  useEffect(() => { if (currentUser) save('mhd_session', currentUser) }, [currentUser])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
  }, [])

  const user = currentUser ? employees.find(e => String(e.nummer) === String(currentUser.nummer)) : null
  const filtered = items.filter(i => [i.name, i.barcode, i.employee, i.category, i.artikelnummer].join(' ').toLowerCase().includes(query.toLowerCase()))
  const stats = useMemo(() => ({
    gesamt: items.length,
    abgelaufen: items.filter(i => i.type !== 'backware' && daysUntil(i.mhd) < 0).length,
    bald: items.filter(i => i.type !== 'backware' && daysUntil(i.mhd) >= 0 && daysUntil(i.mhd) <= 2).length,
    woche: items.filter(i => i.type !== 'backware' && daysUntil(i.mhd) >= 0 && daysUntil(i.mhd) <= 7).length,
  }), [items])

  const doLogin = (e) => {
    e.preventDefault()
    const found = employees.find(m => String(m.nummer) === String(login.nummer) && String(m.passwort) === String(login.passwort))
    if (!found) return alert('Login fehlgeschlagen. Nummer oder Passwort prüfen.')
    setCurrentUser({ nummer: found.nummer, name: found.name })
    if (login.remember) save('mhd_session', { nummer: found.nummer, name: found.name })
  }

  const changePassword = () => {
    if (!/^\d{4}$/.test(passwordForm.neu)) return alert('Bitte genau 4 Zahlen eingeben.')
    if (passwordForm.neu !== passwordForm.wiederholen) return alert('Passwörter stimmen nicht überein.')
    setEmployees(employees.map(e => String(e.nummer) === String(user.nummer) ? { ...e, passwort: passwordForm.neu, mussPasswortAendern: false } : e))
    alert('Passwort gespeichert.')
  }

  const lookupProduct = async () => {
    if (!form.barcode) return alert('Bitte zuerst Barcode eingeben/scannen.')
    setBusy(true)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(form.barcode)}.json`)
      const data = await res.json()
      if (data.status !== 1) alert('Produkt nicht gefunden. Bitte manuell eintragen.')
      else {
        const p = data.product
        setForm(f => ({ ...f, name: p.product_name_de || p.product_name || f.name, image: p.image_front_url || p.image_url || f.image, category: mapCategory(p.categories || f.category) }))
      }
    } catch { alert('Online-Suche nicht erreichbar. Manuell eintragen geht weiter.') }
    setBusy(false)
  }

  const addItem = async (e) => {
    e.preventDefault()
    const entry = { id: uid(), ...form, menge: Number(form.menge || 1), employee: form.employee || user.name, created_at: new Date().toISOString(), type: 'artikel' }
    setItems([entry, ...items])
    setForm({ name: '', barcode: '', image: '', category: 'Getränke', mhd: today(), menge: '', employee: '' })
    if (daysUntil(entry.mhd) <= 2 && 'Notification' in window && Notification.permission === 'granted') new Notification('MHD Warnung', { body: `${entry.name} läuft bald ab.` })
    if (supabase) { try { await supabase.from('mhd_artikel').insert(entry) } catch {} }
  }

  const addBackware = (e) => {
    e.preventDefault()
    const selected = backwarenListe.find(b => b.artikelnummer === back.artikelnummer)
    const entry = { id: uid(), type: 'backware', artikelnummer: back.artikelnummer, name: back.name || selected?.name || '', menge: Number(back.menge || 1), employee: back.employee || user.name, created_at: new Date().toISOString(), mhd: today(), category: 'Backshop' }
    setItems([entry, ...items])
    setBack({ artikelnummer: '', name: '', menge: '', employee: '' })
  }

  const removeItem = (id) => setItems(items.filter(i => i.id !== id))
  const logout = () => { localStorage.removeItem('mhd_session'); setCurrentUser(null) }

  if (!currentUser) return <main className="loginPage"><form className="loginCard" onSubmit={doLogin}><h1>MHD Kontrolle</h1><p>Mitarbeiter-Nummer und Passwort</p><input placeholder="Nummer" value={login.nummer} onChange={e=>setLogin({...login, nummer:e.target.value})}/><input placeholder="Passwort" type="password" value={login.passwort} onChange={e=>setLogin({...login, passwort:e.target.value})}/><label className="check"><input type="checkbox" checked={login.remember} onChange={e=>setLogin({...login, remember:e.target.checked})}/> dauerhaft eingeloggt bleiben</label><button>Einloggen</button><small>Erstpasswort für alle: 0000</small></form></main>

  if (user?.mussPasswortAendern || user?.passwort === '0000') return <main className="loginPage"><div className="loginCard"><h1>Passwort ändern</h1><p>Beim ersten Login musst du ein eigenes 4-stelliges Passwort setzen.</p><input type="password" maxLength="4" placeholder="Neues Passwort" value={passwordForm.neu} onChange={e=>setPasswordForm({...passwordForm, neu:e.target.value})}/><input type="password" maxLength="4" placeholder="Wiederholen" value={passwordForm.wiederholen} onChange={e=>setPasswordForm({...passwordForm, wiederholen:e.target.value})}/><button onClick={changePassword}>Speichern</button><button className="secondary" onClick={logout}>Abmelden</button></div></main>

  return <main className="app"><header><div><small>Tankstelle Ludweiler · {user.rolle}</small><h1>MHD Dashboard</h1><p>Barcode, Bilder, MHD-Warnungen und Abschriften.</p></div><div className="topActions"><button onClick={() => Notification?.requestPermission?.()}>🔔 Benachrichtigung</button><button onClick={logout}>↪ Abmelden</button></div></header>
    <section className="stats"><div><span>Gesamt</span><b>{stats.gesamt}</b></div><div><span>Abgelaufen</span><b>{stats.abgelaufen}</b></div><div><span>Heute/Bald</span><b>{stats.bald}</b></div><div><span>Diese Woche</span><b>{stats.woche}</b></div></section>
    <nav><button className={tab==='artikel'?'active':''} onClick={()=>setTab('artikel')}>Artikel</button><button className={tab==='abschriften'?'active':''} onClick={()=>setTab('abschriften')}>Abschriften</button><button className={tab==='backwaren'?'active':''} onClick={()=>setTab('backwaren')}>Backwaren Tagesende</button><button className={tab==='mitarbeiter'?'active':''} onClick={()=>setTab('mitarbeiter')}>Mitarbeiter</button></nav>
    {tab==='artikel' && <form className="panel grid" onSubmit={addItem}><input placeholder="Artikelname" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input placeholder="Barcode" value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})}/><button type="button" onClick={lookupProduct}>{busy?'Suche...':'Bild/Name suchen'}</button><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select><input type="date" value={form.mhd} onChange={e=>setForm({...form,mhd:e.target.value})}/><input type="number" placeholder="Menge" value={form.menge} onChange={e=>setForm({...form,menge:e.target.value})}/><select value={form.employee} onChange={e=>setForm({...form,employee:e.target.value})}><option value="">{user.name}</option>{employees.map(e=><option key={e.nummer}>{e.name}</option>)}</select><label className="upload">Eigenes Bild<input type="file" accept="image/*" onChange={e=>toBase64(e.target.files?.[0], img=>setForm({...form,image:img}))}/></label>{form.image && <img className="preview" src={form.image}/>}<button className="wide">Artikel speichern</button></form>}
    {tab==='backwaren' && <form className="panel grid" onSubmit={addBackware}><select value={back.artikelnummer} onChange={e=>{const s=backwarenListe.find(x=>x.artikelnummer===e.target.value); setBack({...back, artikelnummer:e.target.value, name:s?.name||''})}}><option value="">Artikelnummer auswählen</option>{backwarenListe.map(b=><option key={b.artikelnummer} value={b.artikelnummer}>{b.artikelnummer} · {b.name}</option>)}</select><input placeholder="Name" value={back.name} onChange={e=>setBack({...back,name:e.target.value})}/><input type="number" placeholder="Menge Abschrift" value={back.menge} onChange={e=>setBack({...back,menge:e.target.value})}/><select value={back.employee} onChange={e=>setBack({...back,employee:e.target.value})}><option value="">{user.name}</option>{employees.map(e=><option key={e.nummer}>{e.name}</option>)}</select><button className="wide">Backware abschreiben</button></form>}
    {tab==='mitarbeiter' && <section className="panel"><h2>Mitarbeiter & Rollen</h2>{employees.map(e=><div className="row" key={e.nummer}><b>{e.nummer} · {e.name}</b><select value={e.rolle} disabled={user.rolle!=='Chef'} onChange={ev=>setEmployees(employees.map(x=>x.nummer===e.nummer?{...x,rolle:ev.target.value}:x))}><option>Chef</option><option>Stationsleitung</option><option>Mitarbeiter</option></select><button disabled={user.rolle!=='Chef'} onClick={()=>setEmployees(employees.map(x=>x.nummer===e.nummer?{...x,passwort:'0000',mussPasswortAendern:true}:x))}>PW 0000</button></div>)}</section>}
    <section className="panel"><input className="search" placeholder="Suchen nach Artikel, Barcode oder Mitarbeiter" value={query} onChange={e=>setQuery(e.target.value)}/><div className="list">{filtered.map(i=><article className="item" key={i.id}>{i.image?<img src={i.image}/>:<div className="placeholder">📦</div>}<div><b>{i.name}</b><p>{i.type==='backware'?'Backwaren Tagesende':i.category} · {i.barcode || i.artikelnummer || 'ohne Nummer'}</p><p>MHD: {i.mhd} · Menge: {i.menge} · {i.employee}</p></div><span className={statusFor(i.mhd).cls}>{i.type==='backware'?'Abschrift':statusFor(i.mhd).text}</span><button className="mini" onClick={()=>removeItem(i.id)}>×</button></article>)}</div></section>
  </main>
}

function toBase64(file, cb){ if(!file) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(file) }
function mapCategory(c='') { const x=c.toLowerCase(); if(x.includes('drink')||x.includes('getränk')) return 'Getränke'; if(x.includes('milk')||x.includes('milch')) return 'Milchprodukte'; if(x.includes('snack')) return 'Snacks'; if(x.includes('sweet')||x.includes('süß')) return 'Süßwaren'; return 'Sonstiges' }
function statusFor(mhd){ const d = daysUntil(mhd); if(d < 0) return {text:'Abgelaufen', cls:'danger'}; if(d <= 2) return {text:'Bald fällig', cls:'warn'}; if(d <= 7) return {text:'Diese Woche', cls:'soon'}; return {text:'OK', cls:'ok'} }
