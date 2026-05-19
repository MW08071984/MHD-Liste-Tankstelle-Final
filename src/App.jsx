
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
function canManageArticles(user) { return ['chef', 'chef_temp', 'stationsleitung'].includes(user?.rolle) }
function canEditWriteoff(user, writeoff) {
  if (!user) return false
  if (['chef', 'chef_temp', 'stationsleitung'].includes(user.rolle)) return true
  return Number(writeoff?.mitarbeiter_nummer) === Number(user.nummer) || String(writeoff?.mitarbeiter) === String(user.name)
}
function roleLabel(role) {
  if (role === 'chef') return 'Chef'
  if (role === 'chef_temp') return 'Chef-Rechte Einrichtung'
  if (role === 'stationsleitung') return 'Stationsleitung'
  return 'Mitarbeiter'
}
function canSeeOnline(user) {
  return ['chef', 'chef_temp', 'stationsleitung'].includes(user?.rolle)
}
function onlineLabel(lastSeen) {
  if (!lastSeen) return { dot: 'offline', text: 'Offline' }
  const diff = Date.now() - new Date(lastSeen).getTime()
  if (diff < 2 * 60 * 1000) return { dot: 'online', text: 'Online' }
  const min = Math.max(1, Math.round(diff / 60000))
  if (min < 60) return { dot: 'away', text: `vor ${min} Min.` }
  const hours = Math.round(min / 60)
  return { dot: 'offline', text: `vor ${hours} Std.` }
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
  const [onlineUsers, setOnlineUsers] = useState([])
  const [appSettings, setAppSettings] = useState({})
  const [tab, setTab] = useState('dashboard')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ barcode:'', name:'', kategorie:'Sonstiges', mhd:todayISO(), menge:1, bild_url:'' })
  const [editingArticle, setEditingArticle] = useState(null)
  const [editingWriteoff, setEditingWriteoff] = useState(null)
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
      const { data: settings } = await supabase.from('app_settings').select('*')
      setEmployees(emps || START_EMPLOYEES)
      setItems(list || [])
      setWriteoffs(abs || [])
      setAppSettings(Object.fromEntries((settings || []).map(s => [s.key, s.value])))
      if (user && canSeeOnline(user)) {
        const { data: online } = await supabase.from('online_status').select('*').order('name')
        setOnlineUsers(online || [])
      }
    } catch (e) { setError('Datenbankfehler: ' + e.message) }
    finally { setReady(true) }
  }

  async function reloadLists() {
    if (!db) return
    const { data: list } = await supabase.from('mhd_artikel').select('*').order('mhd')
    const { data: abs } = await supabase.from('abschriften').select('*').order('created_at', { ascending:false })
    const { data: settings } = await supabase.from('app_settings').select('*')
    setItems(list || [])
    setWriteoffs(abs || [])
    setAppSettings(Object.fromEntries((settings || []).map(s => [s.key, s.value])))
  }

  async function saveSetting(key, value) {
    setError('')
    setSuccess('')
    if (!canSeeOnline(user)) return setError('Nur Chef oder Stationsleitung dürfen Einstellungen ändern.')
    const { error } = await supabase.from('app_settings').upsert({ key, value, updated_by: user.name }, { onConflict: 'key' })
    if (error) return setError('Einstellung konnte nicht gespeichert werden: ' + error.message)
    setAppSettings(prev => ({ ...prev, [key]: value }))
    setSuccess('Einstellung gespeichert.')
  }

  async function updateItemImage(item, imageUrl) {
    setError('')
    setSuccess('')
    if (!canEditImages(user)) return setError('Nur Chef oder Stationsleitung dürfen Bilder ändern.')
    const { error } = await supabase.from('mhd_artikel').update({ bild_url: imageUrl }).eq('id', item.id)
    if (error) return setError('Bild konnte nicht gespeichert werden: ' + error.message)
    await reloadLists()
    setSuccess('Bild gespeichert.')
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

  
  async function saveArticleEdit(updated) {
    setError('')
    setSuccess('')
    if (!canManageArticles(user)) return setError('Nur Chef oder Stationsleitung dürfen Artikel bearbeiten.')
    const payload = {
      artikelnummer: updated.artikelnummer || '',
      artikel: updated.name || updated.artikel || 'Artikel',
      name: updated.name || updated.artikel || 'Artikel',
      kategorie: updated.kategorie || 'Sonstiges',
      mhd: updated.mhd || todayISO(),
      menge: Number(updated.menge || 1),
      barcode: updated.barcode || '',
      bild_url: updated.bild_url || ''
    }
    if (db) {
      const { error } = await supabase.from('mhd_artikel').update(payload).eq('id', updated.id)
      if (error) return setError('Artikel konnte nicht gespeichert werden: ' + error.message)
      await reloadLists()
    } else {
      localSetItems(items.map(i => i.id === updated.id ? { ...i, ...payload } : i))
    }
    setEditingArticle(null)
    setSuccess('Artikel gespeichert.')
  }

  async function saveWriteoffEdit(updated) {
    setError('')
    setSuccess('')
    if (!canEditWriteoff(user, updated)) return setError('Du darfst diese Abschrift nicht bearbeiten.')
    const payload = {
      artikelnummer: updated.artikelnummer || '',
      artikel: updated.name || updated.artikel || 'Artikel',
      name: updated.name || updated.artikel || 'Artikel',
      kategorie: updated.kategorie || '',
      mhd: updated.mhd || todayISO(),
      menge: Number(updated.menge || 1),
      bild_url: updated.bild_url || '',
      grund: updated.grund || 'Abschrift',
      datum: updated.datum || todayISO(),
      mitarbeiter: updated.mitarbeiter || user.name,
      mitarbeiter_nummer: Number(updated.mitarbeiter_nummer || user.nummer)
    }
    if (db) {
      const { error } = await supabase.from('abschriften').update(payload).eq('id', updated.id)
      if (error) return setError('Abschrift konnte nicht gespeichert werden: ' + error.message)
      await reloadLists()
    } else {
      localSetWriteoffs(writeoffs.map(w => w.id === updated.id ? { ...w, ...payload } : w))
    }
    setEditingWriteoff(null)
    setSuccess('Abschrift gespeichert.')
  }

  async function deleteWriteoff(writeoff) {
    setError('')
    setSuccess('')
    if (!canEditWriteoff(user, writeoff)) return setError('Du darfst diese Abschrift nicht löschen.')
    if (db) {
      const { error } = await supabase.from('abschriften').delete().eq('id', writeoff.id)
      if (error) return setError('Abschrift konnte nicht gelöscht werden: ' + error.message)
      await reloadLists()
    } else {
      localSetWriteoffs(writeoffs.filter(w => w.id !== writeoff.id))
    }
    setSuccess('Abschrift gelöscht.')
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
    navigator.vibrate?.(80)
    setSuccess(`Abschrift gespeichert: ${bw.name} · Menge ${amount}`)
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
        <Card label="Artikel" value={stats.total} onClick={() => setTab('artikel')} />
        <Card label="Abgelaufen" value={stats.expired} danger onClick={() => setTab('artikel')} />
        <Card label="Bald" value={stats.urgent} warn onClick={() => setTab('artikel')} />
        <Card label="Woche" value={stats.week} onClick={() => setTab('artikel')} />
      </section>

      <nav className="tabs">
        {[
          ['dashboard','Übersicht'],
          ['artikel','Artikel'],
          ['erfassen','Erfassen'],
          ['backwaren','Backwaren'],
          ['abschriften','Abschriften'],
          ['bilder','Bilder'],
          ['dienstplan','Dienstplan'],
          ...(canSeeOnline(user) ? [['online','Mitarbeiter'], ['settings','Einstellungen']] : [])
        ].map(([key,label]) => <button key={key} onClick={()=>setTab(key)} className={tab===key?'active':''}>{label}</button>)}
      </nav>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {tab === 'dashboard' && <section className="list">
        <button className="primary" onClick={()=>setTab('erfassen')}>+ Schnell erfassen</button>
        <button className="notify" onClick={testNotify}>🔔 Push aktivieren/testen</button>
        {items.map(item => <Article key={item.id} item={item} user={user} onEdit={setEditingArticle} onWriteOff={writeOff} />)}
        {!items.length && <Empty text="Keine Einträge." />}
      </section>}

      {tab === 'artikel' && <section className="list">
        <h2>Artikel</h2>
        {items.map(item => <Article key={item.id} item={item} user={user} onEdit={setEditingArticle} onWriteOff={writeOff} />)}
        {!items.length && <Empty text="Keine Artikel vorhanden." />}
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
          {canEditWriteoff(user, w) && <div className="editActions"><button onClick={() => setEditingWriteoff(w)}>Bearbeiten</button><button className="dangerBtn" onClick={() => deleteWriteoff(w)}>Löschen</button></div>}
        </div>)}
        {!writeoffs.length && <Empty text="Noch keine Abschriften." />}
      </section>}

      {tab === 'bilder' && <BilderVerwaltung user={user} items={items} onUpdateImage={updateItemImage} />}

      {tab === 'dienstplan' && <Dienstplan user={user} appSettings={appSettings} saveSetting={saveSetting} />}

      {tab === 'online' && canSeeOnline(user) && <OnlineStatus onlineUsers={onlineUsers} />}

      {tab === 'settings' && canSeeOnline(user) && <Einstellungen appSettings={appSettings} saveSetting={saveSetting} />}
          {editingArticle && <ArticleEditModal item={editingArticle} onCancel={() => setEditingArticle(null)} onSave={saveArticleEdit} />}
      {editingWriteoff && <WriteoffEditModal item={editingWriteoff} onCancel={() => setEditingWriteoff(null)} onSave={saveWriteoffEdit} />}
    </main>
  )
}
function Card({label, value, danger, warn, onClick}) { return <button type="button" onClick={onClick} className={`stat statBtn ${danger?'danger':''} ${warn?'warn':''}`}><span>{label}</span><b>{value}</b></button> }
function Article({ item, user, onEdit, onWriteOff }) {
  const days = daysUntil(item.mhd)
  const status = days < 0 ? 'abgelaufen' : days <= 2 ? 'bald' : days <= 7 ? 'woche' : 'ok'
  return <div className={`item ${status}`}>
    <div className="thumb">{item.bild_url ? <img src={item.bild_url} /> : '📦'}</div>
    <div className="grow"><b>{item.name || item.artikel}</b><p>{item.artikelnummer ? `Art.-Nr. ${item.artikelnummer} · ` : ''}{item.kategorie} · {item.barcode || 'ohne Barcode'}</p><p>MHD {new Date(item.mhd).toLocaleDateString('de-DE')} · {item.menge} Stk. · {days < 0 ? `${Math.abs(days)} Tage drüber` : `${days} Tage`}</p></div>
    <div className="editActions">
      {canManageArticles(user) && <button onClick={() => onEdit(item)}>Bearbeiten</button>}
      <button onClick={()=>onWriteOff(item, days < 0 ? 'Abgelaufen' : 'Sonstiges')}>Abschrift</button>
    </div>
  </div>
}

function ArticleEditModal({ item, onCancel, onSave }) {
  const [data, setData] = useState({ ...item, name: item.name || item.artikel || '', artikelnummer: item.artikelnummer || '', bild_url: item.bild_url || '' })
  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setData(d => ({ ...d, bild_url: dataUrl }))
  }
  return <div className="modalOverlay">
    <div className="modalCard">
      <h2>Artikel bearbeiten</h2>
      <label>Artikelnummer</label><input value={data.artikelnummer || ''} onChange={e=>setData({...data, artikelnummer:e.target.value})} />
      <label>Name</label><input value={data.name || ''} onChange={e=>setData({...data, name:e.target.value})} />
      <label>Kategorie</label><select value={data.kategorie || 'Sonstiges'} onChange={e=>setData({...data, kategorie:e.target.value})}>{CATS.map(x => <option key={x}>{x}</option>)}</select>
      <label>MHD</label><input type="date" value={data.mhd || todayISO()} onChange={e=>setData({...data, mhd:e.target.value})} />
      <label>Menge</label><input type="number" min="1" value={data.menge || 1} onChange={e=>setData({...data, menge:e.target.value})} />
      <label>Barcode</label><input value={data.barcode || ''} onChange={e=>setData({...data, barcode:e.target.value})} />
      <label className="upload">Bild hochladen/Screenshot<input type="file" accept="image/*" onChange={upload} /></label>
      {data.bild_url && <img className="preview" src={data.bild_url} />}
      <div className="modalActions"><button className="ghost" onClick={onCancel}>Abbrechen</button><button onClick={()=>onSave(data)}>Speichern</button></div>
    </div>
  </div>
}

function WriteoffEditModal({ item, onCancel, onSave }) {
  const [data, setData] = useState({ ...item, name: item.name || item.artikel || '', artikelnummer: item.artikelnummer || '' })
  return <div className="modalOverlay">
    <div className="modalCard">
      <h2>Abschrift bearbeiten</h2>
      <label>Artikelnummer</label><input value={data.artikelnummer || ''} onChange={e=>setData({...data, artikelnummer:e.target.value})} />
      <label>Name</label><input value={data.name || ''} onChange={e=>setData({...data, name:e.target.value})} />
      <label>Grund</label><input value={data.grund || ''} onChange={e=>setData({...data, grund:e.target.value})} />
      <label>Menge</label><input type="number" min="1" value={data.menge || 1} onChange={e=>setData({...data, menge:e.target.value})} />
      <label>Datum</label><input type="date" value={(data.datum || todayISO()).slice(0,10)} onChange={e=>setData({...data, datum:e.target.value})} />
      <div className="modalActions"><button className="ghost" onClick={onCancel}>Abbrechen</button><button onClick={()=>onSave(data)}>Speichern</button></div>
    </div>
  </div>
}

function Backwaren({ onAdd }) {
  const [qty, setQty] = useState({})
  return <section className="list"><h2>Backwaren Tagesende</h2>{BACKWAREN.map(b => <div className="item bakery" key={b.artikelnummer}>
    <div className="artikelnummer">{b.artikelnummer}</div>
    <div className="grow"><b>{b.name}</b><p>Artikelnummer {b.artikelnummer}</p></div>
    <input className="qty" inputMode="numeric" value={qty[b.artikelnummer] || ''} onChange={e=>setQty({...qty, [b.artikelnummer]: e.target.value.replace(/\D/g,'')})} placeholder="0" />
    <button onClick={async()=>{ await onAdd(b, qty[b.artikelnummer]); setQty({...qty, [b.artikelnummer]: ''}) }}>Abschrift</button>
  </div>)}</section>
}



function BilderVerwaltung({ user, items, onUpdateImage }) {
  const [busy, setBusy] = useState('')
  const allowed = canEditImages(user)

  async function uploadFor(item, e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(item.id)
    const dataUrl = await fileToDataUrl(file)
    await onUpdateImage(item, dataUrl)
    setBusy('')
  }

  async function autoFor(item) {
    if (!item.barcode) return alert('Für Auto-Suche braucht der Artikel einen Barcode.')
    setBusy(item.id)
    const p = await fetchProductByBarcode(item.barcode)
    if (p?.bild_url) await onUpdateImage(item, p.bild_url)
    else alert('Kein Bild gefunden.')
    setBusy('')
  }

  return (
    <section className="formCard">
      <h2>Bilder verwalten</h2>
      <p className="hint">{allowed ? 'Du kannst Artikelbilder per Auto-Suche oder Upload/Screenshot ändern.' : 'Nur Chef oder Stationsleitung dürfen Bilder ändern.'}</p>
      <div className="onlineList">
        {items.map(item => (
          <div className="imageManageItem" key={item.id}>
            <div className="thumb">{item.bild_url ? <img src={item.bild_url} /> : '📦'}</div>
            <div className="grow">
              <b>{item.name || item.artikel}</b>
              <p>{item.barcode || 'ohne Barcode'}</p>
            </div>
            {allowed && <div className="imageActions">
              <button type="button" disabled={busy === item.id} onClick={() => autoFor(item)}>Auto</button>
              <label className="miniUpload">Upload<input type="file" accept="image/*" onChange={(e) => uploadFor(item, e)} /></label>
            </div>}
          </div>
        ))}
        {!items.length && <Empty text="Keine Artikel mit Bildern vorhanden." />}
      </div>
    </section>
  )
}

function Einstellungen({ appSettings, saveSetting }) {
  return (
    <section className="formCard">
      <h2>Einstellungen</h2>
      <p className="hint">Chef, Stationsleitung und Michael können wichtige Inhalte direkt in der App ändern.</p>
      <div className="settingCard">
        <b>Dienstpläne</b>
        <p>Im Tab Dienstplan können Mai/Juni und später neue Pläne direkt ersetzt werden.</p>
      </div>
      <div className="settingCard">
        <b>Artikelbilder</b>
        <p>Im Tab Bilder können Artikelbilder über Auto-Suche oder Upload/Screenshot geändert werden.</p>
      </div>
      <div className="settingCard">
        <b>Mitarbeiter online</b>
        <p>Im Tab Mitarbeiter sieht man Online/zuletzt aktiv.</p>
      </div>
    </section>
  )
}

function OnlineStatus({ onlineUsers }) {
  return (
    <section className="formCard">
      <h2>Mitarbeiter online</h2>
      <p className="hint">Online bedeutet: innerhalb der letzten 2 Minuten aktiv.</p>
      <div className="onlineList">
        {onlineUsers.map(u => {
          const status = onlineLabel(u.last_seen)
          return (
            <div className="onlineItem" key={u.nummer}>
              <span className={`dot ${status.dot}`}></span>
              <div className="grow">
                <b>{u.name}</b>
                <p>{roleLabel(u.rolle)} · {status.text}</p>
              </div>
            </div>
          )
        })}
        {!onlineUsers.length && <Empty text="Noch keine Mitarbeiter aktiv." />}
      </div>
    </section>
  )
}

function Dienstplan({ user, appSettings, saveSetting }) {
  const [month, setMonth] = useState('juni')
  const plans = {
    mai: { label: 'Mai 2026', src: '/dienstplan-mai-2026.jpg' },
    juni: { label: 'Juni 2026', src: '/dienstplan-juni-2026.jpg' },
  }
  const plan = { ...plans[month], src: appSettings?.[`dienstplan_${month}`] || plans[month].src }
  const admin = ['chef', 'chef_temp', 'stationsleitung'].includes(user?.rolle)
  async function uploadPlan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    await saveSetting(`dienstplan_${month}`, dataUrl)
  }

  return (
    <section className="formCard">
      <h2>Dienstplan</h2>
      <div className="planSwitch">
        <button className={month === 'mai' ? 'active' : ''} onClick={() => setMonth('mai')}>Mai 2026</button>
        <button className={month === 'juni' ? 'active' : ''} onClick={() => setMonth('juni')}>Juni 2026</button>
      </div>
      <p className="hint">Aktueller Plan: {plan.label}</p>
      <div className="dienstplanBox">
        {String(plan.src).startsWith('data:application/pdf') || String(plan.src).endsWith('.pdf')
          ? <iframe title={`Dienstplan ${plan.label}`} src={plan.src}></iframe>
          : <img src={plan.src} alt={`Dienstplan ${plan.label}`} />}
      </div>
      <a className="downloadBtn" href={plan.src} target="_blank" rel="noreferrer">Plan groß öffnen / herunterladen</a>
      {admin && <label className="upload">Diesen Monatsplan ersetzen<input type="file" accept="image/*,application/pdf" onChange={uploadPlan} /></label>}
    </section>
  )
}

function Empty({text}) { return <div className="empty">{text}</div> }
