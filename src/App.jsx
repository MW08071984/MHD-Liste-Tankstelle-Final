import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const MITARBEITER = [
  { nummer: '1', name: 'Denis', rolle: 'Mitarbeiter', passwort: '0000' },
  { nummer: '2', name: 'Michael', rolle: 'Chef', passwort: '0000' },
  { nummer: '3', name: 'Chris', rolle: 'Stationsleitung', passwort: '0000' },
  { nummer: '4', name: 'Tizi', rolle: 'Mitarbeiter', passwort: '0000' },
  { nummer: '5', name: 'Philip', rolle: 'Mitarbeiter', passwort: '0000' },
  { nummer: '6', name: 'Anne', rolle: 'Mitarbeiter', passwort: '0000' },
  { nummer: '7', name: 'Lars', rolle: 'Mitarbeiter', passwort: '0000' },
  { nummer: '8', name: 'Mira', rolle: 'Mitarbeiter', passwort: '0000' },
  { nummer: '9', name: 'Christian', rolle: 'Mitarbeiter', passwort: '0000' }
]

const BACKWAREN = [
  { name: 'Brötchen', artikelnummer: '90371' },
  { name: 'Baguette', artikelnummer: '128501' },
  { name: 'Brezel', artikelnummer: '90506' },
  { name: 'Käse Brezel', artikelnummer: '123284' },
  { name: 'Schinken Käse Brezel', artikelnummer: '10006' },
  { name: 'Rustico Lauge Schinken Käse', artikelnummer: '123991' },
  { name: 'Rustico Tomate Mozzarella', artikelnummer: '123347' },
  { name: 'Rustico mit Spinata', artikelnummer: '123268' },
  { name: 'Rustico Farmerschinken', artikelnummer: '123267' },
  { name: 'Rustico Lauge mit Leerdammer', artikelnummer: '123269' },
  { name: 'Rustico Schnitzel', artikelnummer: '123322' },
  { name: 'Chicken Burger', artikelnummer: '123981' },
  { name: 'Brinker/Snack Rustico Ei', artikelnummer: '123341' },
  { name: 'Brinker/Snack Rustico Schinken', artikelnummer: '123340' },
  { name: 'Brinker/Snack Rustico Käse', artikelnummer: '123338' },
  { name: 'Brinker/Snack Rustico Salami', artikelnummer: '123345' },
  { name: 'Butter Croissant', artikelnummer: '103966' },
  { name: 'Nuss Nugat Croissant', artikelnummer: '103965' },
  { name: 'Schokobrötchen', artikelnummer: '103967' },
  { name: 'Kakao Hörnchen', artikelnummer: '122058' },
  { name: 'Berry Donut', artikelnummer: '82965' },
  { name: 'Vanille Donut', artikelnummer: '200232' },
  { name: 'Pink Donut', artikelnummer: '90709' },
  { name: 'Pizza Donut Salami', artikelnummer: '125260' },
  { name: 'Marzipan Croissant', artikelnummer: '103964' },
  { name: 'Mexicostange', artikelnummer: '103887' },
  { name: 'Pizza Salami', artikelnummer: '125241' },
  { name: 'Pizza Classico', artikelnummer: '82862' },
  { name: 'Fußballbrötchen Gouda', artikelnummer: '103622', neu: true },
  { name: 'Muschelbrötchen Käse Salami', artikelnummer: '103950', neu: true }
]

const todayISO = () => new Date().toISOString().slice(0, 10)
const daysUntil = (date) => {
  if (!date) return 999
  const start = new Date(); start.setHours(0,0,0,0)
  const end = new Date(date); end.setHours(0,0,0,0)
  return Math.round((end - start) / 86400000)
}
const statusFor = (mhd) => {
  const d = daysUntil(mhd)
  if (d < 0) return { text: 'Abgelaufen', cls: 'danger' }
  if (d <= 2) return { text: 'Bald fällig', cls: 'warn' }
  if (d <= 7) return { text: 'Diese Woche', cls: 'soon' }
  return { text: 'Okay', cls: 'ok' }
}

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initialValue } catch { return initialValue }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key, value])
  return [value, setValue]
}

export default function App() {
  const [session, setSession] = useLocalStorage('mhd_session_v2', null)
  const [users, setUsers] = useLocalStorage('mhd_users_v2', MITARBEITER)
  const [entries, setEntries] = useLocalStorage('mhd_entries_v2', [])
  const [activeTab, setActiveTab] = useState('mhd')
  const [login, setLogin] = useState({ nummer: '', passwort: '', remember: true })
  const [newPw, setNewPw] = useState('')
  const [form, setForm] = useState({ barcode: '', name: '', artikelnummer: '', kategorie: 'Getränke', mhd: '', menge: 1, bild: '', mitarbeiter: '' })
  const [search, setSearch] = useState('')
  const currentUser = users.find(u => u.nummer === session?.nummer)

  useEffect(() => {
    if (currentUser && !form.mitarbeiter) setForm(f => ({ ...f, mitarbeiter: currentUser.name }))
  }, [currentUser])

  const loginSubmit = (e) => {
    e.preventDefault()
    const user = users.find(u => u.nummer === login.nummer && u.passwort === login.passwort)
    if (!user) return alert('Login fehlgeschlagen. Nummer oder Passwort prüfen.')
    setSession({ nummer: user.nummer, name: user.name, rolle: user.rolle, mussPasswortAendern: user.passwort === '0000' })
  }
  const saveNewPassword = () => {
    if (!/^\d{4}$/.test(newPw)) return alert('Bitte genau 4 Zahlen eingeben.')
    setUsers(users.map(u => u.nummer === session.nummer ? { ...u, passwort: newPw } : u))
    setSession({ ...session, mussPasswortAendern: false })
    setNewPw('')
  }
  const logout = () => { localStorage.removeItem('mhd_session_v2'); setSession(null) }

  const lookupBarcode = async () => {
    if (!form.barcode) return
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${form.barcode}.json`)
      const data = await res.json()
      if (data.status === 1 && data.product) {
        setForm(f => ({ ...f, name: data.product.product_name || f.name, bild: data.product.image_front_url || data.product.image_url || f.bild }))
      } else alert('Produkt online nicht gefunden. Manuell eintragen oder eigenes Bild später ergänzen.')
    } catch { alert('Online-Suche gerade nicht erreichbar.') }
  }

  const addEntry = async (e) => {
    e.preventDefault()
    if (!form.name || !form.mhd) return alert('Produktname und MHD eintragen.')
    const item = { id: crypto.randomUUID(), ...form, menge: Number(form.menge || 1), created_at: new Date().toISOString() }
    setEntries([item, ...entries])
    if (supabase) { try { await supabase.from('mhd_artikel').insert(item) } catch {} }
    setForm({ barcode: '', name: '', artikelnummer: '', kategorie: 'Getränke', mhd: '', menge: 1, bild: '', mitarbeiter: currentUser?.name || '' })
  }

  const filtered = entries.filter(e => `${e.name} ${e.barcode} ${e.artikelnummer} ${e.mitarbeiter}`.toLowerCase().includes(search.toLowerCase()))
  const stats = useMemo(() => ({
    total: entries.length,
    expired: entries.filter(e => daysUntil(e.mhd) < 0).length,
    soon: entries.filter(e => daysUntil(e.mhd) >= 0 && daysUntil(e.mhd) <= 2).length,
    week: entries.filter(e => daysUntil(e.mhd) >= 0 && daysUntil(e.mhd) <= 7).length
  }), [entries])

  if (!session) return <div className="loginPage"><form className="loginCard" onSubmit={loginSubmit}><div className="brandStripe"/><h1>MHD Kontrolle</h1><p>Tankstelle Ludweiler</p><input placeholder="Mitarbeiter-Nummer" value={login.nummer} onChange={e=>setLogin({...login, nummer:e.target.value})}/><input placeholder="Passwort" type="password" value={login.passwort} onChange={e=>setLogin({...login, passwort:e.target.value})}/><label className="check"><input type="checkbox" checked={login.remember} onChange={e=>setLogin({...login, remember:e.target.checked})}/> dauerhaft eingeloggt bleiben</label><button>Einloggen</button><small>Erstpasswort: 0000</small></form></div>
  if (session.mussPasswortAendern) return <div className="loginPage"><div className="loginCard"><div className="brandStripe"/><h1>Passwort ändern</h1><p>Beim ersten Login bitte neues 4-stelliges Passwort setzen.</p><input placeholder="Neues Passwort, z. B. 1234" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)}/><button onClick={saveNewPassword}>Speichern</button></div></div>

  return <div className="app"><header><div><small>Shell-Farben · ohne Logo</small><h1>MHD Kontrolle</h1><p>{currentUser?.name} · {currentUser?.rolle}</p></div><button className="logout" onClick={logout}>Abmelden</button></header>
    <section className="stats"><div><b>{stats.total}</b><span>Gesamt</span></div><div><b>{stats.expired}</b><span>Abgelaufen</span></div><div><b>{stats.soon}</b><span>Bald</span></div><div><b>{stats.week}</b><span>Woche</span></div></section>
    <nav><button onClick={()=>setActiveTab('mhd')} className={activeTab==='mhd'?'on':''}>MHD</button><button onClick={()=>setActiveTab('backwaren')} className={activeTab==='backwaren'?'on':''}>Backwaren</button><button onClick={()=>setActiveTab('mitarbeiter')} className={activeTab==='mitarbeiter'?'on':''}>Mitarbeiter</button></nav>

    {activeTab==='mhd' && <><form className="panel form" onSubmit={addEntry}><div className="row"><input placeholder="Barcode" value={form.barcode} onChange={e=>setForm({...form, barcode:e.target.value})}/><button type="button" className="secondary" onClick={lookupBarcode}>Bild/Name suchen</button></div><input placeholder="Produktname" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/><input placeholder="Artikelnummer optional" value={form.artikelnummer} onChange={e=>setForm({...form, artikelnummer:e.target.value})}/><div className="row"><input type="date" value={form.mhd} onChange={e=>setForm({...form, mhd:e.target.value})}/><input type="number" min="1" value={form.menge} onChange={e=>setForm({...form, menge:e.target.value})}/></div><div className="row"><select value={form.kategorie} onChange={e=>setForm({...form, kategorie:e.target.value})}><option>Getränke</option><option>Kühlung</option><option>Milchprodukte</option><option>Snacks</option><option>Süßwaren</option><option>Backshop</option><option>Sonstiges</option></select><select value={form.mitarbeiter} onChange={e=>setForm({...form, mitarbeiter:e.target.value})}>{users.map(u=><option key={u.nummer}>{u.name}</option>)}</select></div><input placeholder="Bild-URL optional, Bilder später möglich" value={form.bild} onChange={e=>setForm({...form, bild:e.target.value})}/><button>Artikel speichern</button></form><input className="search" placeholder="Suchen nach Artikel, Barcode oder Mitarbeiter" value={search} onChange={e=>setSearch(e.target.value)}/><div className="cards">{filtered.map(e=>{ const s=statusFor(e.mhd); return <article className="card" key={e.id}>{e.bild?<img src={e.bild}/>:<div className="placeholder">Bild später</div>}<div><h3>{e.name}</h3><p>{e.kategorie} · Menge {e.menge}</p><p>MHD: {e.mhd} · {e.mitarbeiter}</p>{e.artikelnummer && <p>Art.-Nr. {e.artikelnummer}</p>}<span className={'badge '+s.cls}>{s.text}</span></div></article>})}</div></>}

    {activeTab==='backwaren' && <section className="panel"><h2>Backwaren Tagesende</h2><p className="muted">Exakt aus deiner Liste. Rechts Verderb/Menge eintragen.</p><div className="bakeryList">{BACKWAREN.map(b=><div className={b.neu?'bakery new':'bakery'} key={b.artikelnummer}><div><b>{b.name}</b><span>{b.artikelnummer}</span></div><input type="number" min="0" placeholder="Verderb"/></div>)}</div></section>}

    {activeTab==='mitarbeiter' && <section className="panel"><h2>Mitarbeiter & Rollen</h2>{users.map(u=><div className="employee" key={u.nummer}><div><b>{u.name}</b><span>Nr. {u.nummer}</span></div><select value={u.rolle} onChange={e=>setUsers(users.map(x=>x.nummer===u.nummer?{...x, rolle:e.target.value}:x))}><option>Chef</option><option>Stationsleitung</option><option>Mitarbeiter</option></select></div>)}</section>}
  </div>
}
