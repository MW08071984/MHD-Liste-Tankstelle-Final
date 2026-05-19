
import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const START_EMPLOYEES = [
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
  { artikelnummer: '90371', name: 'Brötchen' },
  { artikelnummer: '128501', name: 'Baguette' },
  { artikelnummer: '90506', name: 'Brezel' },
  { artikelnummer: '123284', name: 'Käse Brezel' },
  { artikelnummer: '10006', name: 'Schinken Käse Brezel' },
  { artikelnummer: '123991', name: 'Rustico Lauge Schinken Käse' },
  { artikelnummer: '123347', name: 'Rustico Tomate Mozzarella' },
  { artikelnummer: '123268', name: 'Rustico mit Spianata' },
  { artikelnummer: '123267', name: 'Rustico Farmerschinken' },
  { artikelnummer: '123269', name: 'Rustico Lauge mit Leerdammer' },
  { artikelnummer: '123322', name: 'Rustico Schnitzel' },
  { artikelnummer: '123981', name: 'Chicken Burger' },
  { artikelnummer: '123341', name: 'Brinker/Snack Rustico Ei' },
  { artikelnummer: '123340', name: 'Brinker/Snack Rustico Schinken' },
  { artikelnummer: '123338', name: 'Brinker/Snack Rustico Käse' },
  { artikelnummer: '123345', name: 'Brinker/Snack Rustico Salami' },
  { artikelnummer: '103966', name: 'Butter Croissant' },
  { artikelnummer: '103965', name: 'Nuss Nugat Croissant' },
  { artikelnummer: '103967', name: 'Schokobrötchen' },
  { artikelnummer: '122058', name: 'Kakao Hörnchen' },
  { artikelnummer: '82965', name: 'Berry Donut' },
  { artikelnummer: '200232', name: 'Vanille Donut' },
  { artikelnummer: '90709', name: 'Pink Donut' },
  { artikelnummer: '125260', name: 'Pizza Donut Salami' },
  { artikelnummer: '103964', name: 'Marzipan Croissant' },
  { artikelnummer: '103887', name: 'Mexicostange' },
  { artikelnummer: '125241', name: 'Pizza Salami' },
  { artikelnummer: '82862', name: 'Pizza Classico' },
  { artikelnummer: '103622', name: 'Fußballbrötchen Gouda' },
  { artikelnummer: '103950', name: 'Muschelbrötchen Käse Salami' },
]

const CATS = ['Getränke','Kühlung','Milchprodukte','Snacks','Süßwaren','Backwaren','Sonstiges']

function todayISO() { return new Date().toISOString().slice(0, 10) }
function nowStamp() { return new Date().toISOString() }
function daysUntil(dateString) {
  if (!dateString) return 999
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateString + 'T00:00:00')
  return Math.ceil((target - today) / 86400000)
}
function canEditImages(user) { return ['chef', 'chef_temp', 'stationsleitung'].includes(user?.rolle) }
function roleLabel(role) {
  if (role === 'chef') return 'Chef'
  if (role === 'chef_temp') return 'Chef-Rechte Einrichtung'
  if (role === 'stationsleitung') return 'Stationsleitung'
  return 'Mitarbeiter'
}
function mapCategory(text='') {
  const t = text.toLowerCase()
  if (t.includes('drink') || t.includes('beverage') || t.includes('wasser') || t.includes('cola') || t.includes('juice')) return 'Getränke'
  if (t.includes('milk') || t.includes('dairy') || t.includes('joghurt') || t.includes('cheese')) return 'Milchprodukte'
  if (t.includes('snack') || t.includes('chips') || t.includes('nuts')) return 'Snacks'
  if (t.includes('chocolate') || t.includes('candy') || t.includes('sweet')) return 'Süßwaren'
  if (t.includes('sandwich') || t.includes('bakery') || t.includes('bread')) return 'Backwaren'
  return 'Sonstiges'
}
async function fetchProductByBarcode(barcode) {
  const clean = String(barcode || '').trim()
  if (!clean) return null
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,brands,image_front_url,categories,categories_tags`)
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null
    const p = data.product
    return {
      name: [p.brands, p.product_name].filter(Boolean).join(' · ') || p.product_name || clean,
      bild_url: p.image_front_url || '',
      kategorie: mapCategory(`${p.categories || ''} ${(p.categories_tags || []).join(' ')}`)
    }
  } catch { return null }
}
async function scanBarcode() {
  if (!('BarcodeDetector' in window)) {
    alert('Barcode-Scan wird auf diesem Gerät nicht unterstützt. Bitte Barcode manuell eingeben.')
    return null
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  const video = document.createElement('video')
  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  await video.play()
  const detector = new window.BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128'] })
  return new Promise(resolve => {
    let done = false
    const box = document.createElement('div')
    box.className = 'scannerOverlay'
    box.innerHTML = '<div class="scanTitle">Barcode vor die Kamera halten</div><button class="scanCancel">Abbrechen</button>'
    const cancel = box.querySelector('.scanCancel')
    video.className = 'scanVideo'
    box.insertBefore(video, cancel)
    document.body.appendChild(box)
    const stop = val => {
      if (done) return
      done = true
      stream.getTracks().forEach(t => t.stop())
      box.remove()
      resolve(val)
    }
    cancel.onclick = () => stop(null)
    async function loop() {
      if (done) return
      try {
        const codes = await detector.detect(video)
        if (codes.length) return stop(codes[0].rawValue)
      } catch {}
      requestAnimationFrame(loop)
    }
    loop()
  })
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
async function notify(items) {
  if (!('Notification' in window)) return 'Browser unterstützt keine Benachrichtigungen.'
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return 'Benachrichtigungen nicht erlaubt.'
  const urgent = items.filter(x => daysUntil(x.mhd) <= 2)
  const body = urgent.length
    ? urgent.slice(0, 5).map(x => `${x.name} · MHD ${new Date(x.mhd).toLocaleDateString('de-DE')} · ${x.menge} Stk.`).join('\\n')
    : 'Aktuell keine fälligen MHD-Artikel.'
  const reg = await navigator.serviceWorker?.ready.catch(() => null)
  if (reg?.showNotification) reg.showNotification('MHD Kontrolle', { body, tag: 'mhd-warning', renotify: true })
  else new Notification('MHD Kontrolle', { body })
  return 'Benachrichtigung gesendet.'
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [employees, setEmployees] = useState([])
  const [user, setUser] = useState(null)
  const [remember, setRemember] = useState(true)
  const [login, setLogin] = useState({ nummer: '', passwort: '' })
  const [newPassword, setNewPassword] = useState('')
  const [items, setItems] = useState([])
  const [writeoffs, setWriteoffs] = useState([])
  const [tab, setTab] = useState('dashboard')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ barcode:'', name:'', kategorie:'Sonstiges', mhd:todayISO(), menge:1, bild_url:'' })
  const db = Boolean(supabase)

  useEffect(() => {
    navigator.serviceWorker?.register('/sw.js').catch(() => {})
    const saved = localStorage.getItem('mhd_user')
    if (saved) { try { setUser(JSON.parse(saved)) } catch {} }
    init()
  }, [])

  async function init() {
    if (!db) {
      setEmployees(START_EMPLOYEES)
      setItems(JSON.parse(localStorage.getItem('mhd_items') || '[]'))
      setWriteoffs(JSON.parse(localStorage.getItem('mhd_writeoffs') || '[]'))
      setReady(true)
      return
    }
    try {
      await supabase.from('mitarbeiter').upsert(START_EMPLOYEES, { onConflict: 'nummer' })
      const { data: emps } = await supabase.from('mitarbeiter').select('*').order('nummer')
      const { data: list } = await supabase.from('mhd_artikel').select('*').order('mhd')
      const { data: abs } = await supabase.from('abschriften').select('*').order('created_at', { ascending:false })
      setEmployees(emps || START_EMPLOYEES)
      setItems(list || [])
      setWriteoffs(abs || [])
    } catch (e) { setError('Datenbankfehler: ' + e.message) }
    finally { setReady(true) }
  }

  async function reloadLists() {
    if (!db) return
    const { data: list } = await supabase.from('mhd_artikel').select('*').order('mhd')
    const { data: abs } = await supabase.from('abschriften').select('*').order('created_at', { ascending:false })
    setItems(list || [])
    setWriteoffs(abs || [])
  }
  function localSetItems(next) { setItems(next); localStorage.setItem('mhd_items', JSON.stringify(next)) }
  function localSetWriteoffs(next) { setWriteoffs(next); localStorage.setItem('mhd_writeoffs', JSON.stringify(next)) }

  async function doLogin(e) {
    e.preventDefault()
    setError('')
    const nr = Number(login.nummer)
    const employee = employees.find(x => Number(x.nummer) === nr && String(x.passwort) === String(login.passwort))
    if (!employee) return setError('Nummer oder Passwort falsch.')
    setUser(employee)
    if (remember) localStorage.setItem('mhd_user', JSON.stringify(employee))
    else localStorage.removeItem('mhd_user')
  }

  async function changePassword() {
    setError('')
    if (!/^[0-9]{4}$/.test(newPassword)) return setError('Bitte genau 4 Zahlen eingeben.')
    const updated = { ...user, passwort: newPassword, muss_passwort_aendern: false }
    if (db) {
      const { error } = await supabase.from('mitarbeiter').update({ passwort: newPassword, muss_passwort_aendern: false }).eq('nummer', user.nummer)
      if (error) return setError(error.message)
    }
    setEmployees(prev => prev.map(e => Number(e.nummer) === Number(user.nummer) ? updated : e))
    setUser(updated)
    localStorage.setItem('mhd_user', JSON.stringify(updated))
  }

  function logout() { localStorage.removeItem('mhd_user'); setUser(null) }

  async function barcodeLookup(code=form.barcode) {
    setError(''); setSuccess('')
    const p = await fetchProductByBarcode(code)
    if (!p) return setError('Kein Produkt online gefunden. Bitte manuell eintragen oder Bild hochladen.')
    setForm(f => ({...f, barcode: code, name: p.name || f.name, kategorie: p.kategorie || f.kategorie, bild_url: p.bild_url || f.bild_url}))
    setSuccess('Produktdaten gefunden.')
  }
  async function doScan() {
    const code = await scanBarcode()
    if (code) { setForm(f => ({...f, barcode: code})); await barcodeLookup(code) }
  }
  async function uploadImage(e) {
    setError('')
    if (!canEditImages(user)) return setError('Nur Chef oder Stationsleitung dürfen Bilder ändern.')
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setForm(f => ({...f, bild_url: dataUrl}))
  }
  async function addItem() {
    setError(''); setSuccess('')
    if (!form.name || !form.mhd) return setError('Artikelname und MHD fehlen.')
    const payload = {
      barcode: form.barcode || '', artikelnummer: '', artikel: form.name.trim(), name: form.name.trim(),
      kategorie: form.kategorie, mhd: form.mhd, menge: Number(form.menge || 1), bild_url: form.bild_url || '',
      mitarbeiter: user.name, erstellt_von: Number(user.nummer)
    }
    if (db) {
      const { error } = await supabase.from('mhd_artikel').insert(payload)
      if (error) return setError('Speichern fehlgeschlagen: ' + error.message)
      await reloadLists()
    } else localSetItems([{id: Date.now(), created_at: nowStamp(), ...payload}, ...items])
    setForm({ barcode:'', name:'', kategorie:'Sonstiges', mhd:todayISO(), menge:1, bild_url:'' })
    setSuccess('Artikel gespeichert.')
  }

  async function insertWriteoff(payload) {
    if (db) {
      const { error } = await supabase.from('abschriften').insert(payload)
      if (error) return { error }
      await reloadLists()
      return {}
    }
    localSetWriteoffs([{id: Date.now(), created_at: nowStamp(), ...payload}, ...writeoffs])
    return {}
  }

  async function writeOff(item, grund='Abgelaufen') {
    setError(''); setSuccess('')
    const name = item.name || item.artikel || 'Artikel'
    const payload = {
      artikel_id: item.id || null,
      artikelnummer: item.artikelnummer || '',
      artikel: name,
      barcode: item.barcode || '',
      name,
      kategorie: item.kategorie || '',
      mhd: item.mhd || todayISO(),
      menge: Number(item.menge || 1),
      bild_url: item.bild_url || '',
      grund,
      datum: todayISO(),
      mitarbeiter: user.name,
      mitarbeiter_nummer: Number(user.nummer)
    }
    const res = await insertWriteoff(payload)
    if (res.error) return setError('Abschrift fehlgeschlagen: ' + res.error.message)
    if (db && item.id) { await supabase.from('mhd_artikel').delete().eq('id', item.id); await reloadLists() }
    if (!db && item.id) localSetItems(items.filter(x => x.id !== item.id))
    setSuccess('Abschrift gespeichert.')
  }

  async function addBakeryWriteoff(bw, menge) {
    setError(''); setSuccess('')
    const amount = Number(menge || 0)
    if (!amount || amount < 1) return setError('Bitte Menge größer als 0 eintragen.')
    const payload = {
      artikel_id: null,
      artikelnummer: bw.artikelnummer,
      artikel: bw.name,
      barcode: '',
      name: bw.name,
      kategorie: 'Backwaren',
      mhd: todayISO(),
      menge: amount,
      bild_url: '',
      grund: 'Backwaren Tagesende',
      datum: todayISO(),
      mitarbeiter: user.name,
      mitarbeiter_nummer: Number(user.nummer)
    }
    const res = await insertWriteoff(payload)
    if (res.error) return setError('Abschrift fehlgeschlagen: ' + res.error.message)
    setSuccess(`${bw.name} (${amount}) als Abschrift gespeichert.`)
  }

  async function testNotify() {
    const msg = await notify(items)
    setSuccess(msg || 'Benachrichtigung geprüft.')
  }

  const stats = useMemo(() => ({
    total: items.length,
    expired: items.filter(i => daysUntil(i.mhd) < 0).length,
    urgent: items.filter(i => daysUntil(i.mhd) >= 0 && daysUntil(i.mhd) <= 2).length,
    week: items.filter(i => daysUntil(i.mhd) > 2 && daysUntil(i.mhd) <= 7).length
  }), [items])

  if (!ready) return <div className="center">Lade App...</div>
  if (!db) return <div className="fatal">Supabase ENV Variablen fehlen in Vercel.</div>

  if (!user) return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="brandBadge">MHD</div>
        <h1>Tankstelle Ludweiler</h1>
        <p>Mitarbeiter-Login</p>
        <form onSubmit={doLogin}>
          <label>Mitarbeiternummer</label>
          <input inputMode="numeric" autoComplete="username" value={login.nummer} onChange={e=>setLogin({...login, nummer:e.target.value})} />
          <label>Passwort</label>
          <input inputMode="numeric" autoComplete="current-password" type="password" value={login.passwort} onChange={e=>setLogin({...login, passwort:e.target.value})} />
          <label className="check"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} /> Dauerhaft eingeloggt bleiben</label>
          {error && <div className="error">{error}</div>}
          <button>Einloggen</button>
        </form>
      </section>
    </main>
  )

  if (user.muss_passwort_aendern || user.passwort === '0000') return (
    <main className="loginPage">
      <section className="loginCard">
        <h1>Neues Passwort setzen</h1>
        <p>{user.name}, bitte ein eigenes 4-stelliges Passwort vergeben.</p>
        <input inputMode="numeric" maxLength="4" value={newPassword} onChange={e=>setNewPassword(e.target.value.replace(/\D/g,''))} />
        {error && <div className="error">{error}</div>}
        <button onClick={changePassword}>Speichern</button>
      </section>
    </main>
  )

  return (
    <main className="app">
      <header className="topbar">
        <div><p>MHD Kontrolle · {roleLabel(user.rolle)}</p><h1>Hallo {user.name}</h1></div>
        <button className="ghost" onClick={logout}>Logout</button>
      </header>

      <section className="stats">
        <Card label="Artikel" value={stats.total} />
        <Card label="Abgelaufen" value={stats.expired} danger />
        <Card label="Bald" value={stats.urgent} warn />
        <Card label="Woche" value={stats.week} />
      </section>

      <nav className="tabs">
        {[
          ['dashboard','Übersicht'],
          ['erfassen','Erfassen'],
          ['backwaren','Backwaren'],
          ['abschriften','Abschriften'],
          ['bilder','Bilder']
        ].map(([key,label]) => <button key={key} onClick={()=>setTab(key)} className={tab===key?'active':''}>{label}</button>)}
      </nav>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {tab === 'dashboard' && <section className="list">
        <button className="primary" onClick={()=>setTab('erfassen')}>+ Schnell erfassen</button>
        <button className="notify" onClick={testNotify}>🔔 Push aktivieren/testen</button>
        {items.map(item => <Article key={item.id} item={item} onWriteOff={writeOff} />)}
        {!items.length && <Empty text="Keine Einträge." />}
      </section>}

      {tab === 'erfassen' && <section className="formCard">
        <h2>Schnell erfassen</h2>
        <div className="row"><input placeholder="Barcode" value={form.barcode} onChange={e=>setForm({...form, barcode:e.target.value})} /><button onClick={doScan}>Scan</button><button onClick={()=>barcodeLookup()}>Auto</button></div>
        <input placeholder="Artikelname" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <select value={form.kategorie} onChange={e=>setForm({...form, kategorie:e.target.value})}>{CATS.map(x => <option key={x}>{x}</option>)}</select>
        <div className="row two"><input type="date" value={form.mhd} onChange={e=>setForm({...form, mhd:e.target.value})} /><input type="number" min="1" value={form.menge} onChange={e=>setForm({...form, menge:e.target.value})} /></div>
        {canEditImages(user) && <label className="upload">Bild/Screenshot hochladen<input type="file" accept="image/*" onChange={uploadImage} /></label>}
        {!canEditImages(user) && <p className="hint">Bilder dürfen nur Chef oder Stationsleitung ändern.</p>}
        {form.bild_url && <img className="preview" src={form.bild_url} />}
        <button className="primary" onClick={addItem}>Artikel speichern</button>
      </section>}

      {tab === 'backwaren' && <Backwaren onAdd={addBakeryWriteoff} />}

      {tab === 'abschriften' && <section className="list">
        <h2>Abschriften</h2>
        {writeoffs.map(w => <div className="item" key={w.id || `${w.name}-${w.created_at}`}>
          <div className="artikelnummer small">{w.artikelnummer || 'MHD'}</div>
          <div className="grow"><b>{w.name || w.artikel}</b><p>{w.grund} · {w.menge} Stk. · {w.mitarbeiter} · {new Date(w.datum || w.created_at).toLocaleDateString('de-DE')}</p></div>
        </div>)}
        {!writeoffs.length && <Empty text="Noch keine Abschriften." />}
      </section>}

      {tab === 'bilder' && <section className="formCard">
        <h2>Bilder verwalten</h2>
        <p>{canEditImages(user) ? 'Du darfst Bilder per Auto-Suche oder Upload/Screenshot ändern.' : 'Nur Chef oder Stationsleitung dürfen Bilder ändern.'}</p>
      </section>}
    </main>
  )
}
function Card({label, value, danger, warn}) { return <div className={`stat ${danger?'danger':''} ${warn?'warn':''}`}><span>{label}</span><b>{value}</b></div> }
function Article({ item, onWriteOff }) {
  const days = daysUntil(item.mhd)
  const status = days < 0 ? 'abgelaufen' : days <= 2 ? 'bald' : days <= 7 ? 'woche' : 'ok'
  return <div className={`item ${status}`}>
    <div className="thumb">{item.bild_url ? <img src={item.bild_url} /> : '📦'}</div>
    <div className="grow"><b>{item.name || item.artikel}</b><p>{item.kategorie} · {item.barcode || 'ohne Barcode'}</p><p>MHD {new Date(item.mhd).toLocaleDateString('de-DE')} · {item.menge} Stk. · {days < 0 ? `${Math.abs(days)} Tage drüber` : `${days} Tage`}</p></div>
    <button onClick={()=>onWriteOff(item, days < 0 ? 'Abgelaufen' : 'Sonstiges')}>Abschrift</button>
  </div>
}
function Backwaren({ onAdd }) {
  const [qty, setQty] = useState({})
  return <section className="list"><h2>Backwaren Tagesende</h2>{BACKWAREN.map(b => <div className="item bakery" key={b.artikelnummer}>
    <div className="artikelnummer">{b.artikelnummer}</div>
    <div className="grow"><b>{b.name}</b><p>Artikelnummer {b.artikelnummer}</p></div>
    <input className="qty" inputMode="numeric" value={qty[b.artikelnummer] || ''} onChange={e=>setQty({...qty, [b.artikelnummer]: e.target.value.replace(/\D/g,'')})} placeholder="0" />
    <button onClick={()=>onAdd(b, qty[b.artikelnummer])}>Abschrift</button>
  </div>)}</section>
}
function Empty({text}) { return <div className="empty">{text}</div> }
