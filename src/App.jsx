
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './main.jsx'

const DEFAULT_EMPLOYEES = [
  { nummer: 1, name: 'Lars', rolle: 'chef', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 2, name: 'Philipp', rolle: 'stationsleitung', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 3, name: 'Denis', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 9, name: 'Chris', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 17, name: 'Tizi', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 19, name: 'Michael', rolle: 'chef_temp', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 21, name: 'Mira', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
  { nummer: 22, name: 'Anne', rolle: 'mitarbeiter', passwort: '0000', muss_passwort_aendern: true },
]

const DEFAULT_BACKWAREN = [
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

const CATEGORIES = [
  '🥤 Große Kühlung',
  '🍕 Pizza & Tiefkühltruhe',
  '⚡ Red Bull Zapfsäule',
  '🥨 Chips & Snacks',
  '🍺 Biergondel',
  '🧴 Haushalt',
  '🥪 Go Fresh Kühlung',
  '⚡ Red Bull Kühler Groß',
  '🍫 Süßwaren Kassenbereich',
  '🍬 Gummibärchen & Candy',
  '🥐 Backwaren',
  '🥗 Frischekühlschrank zum Belegen',
  'Sonstiges'
]

const todayISO = () => new Date().toISOString().slice(0,10)
const nowISO = () => new Date().toISOString()
const isAdmin = u => ['chef','chef_temp','stationsleitung'].includes(u?.rolle)
const roleLabel = r => r === 'chef' ? 'Chef' : r === 'chef_temp' ? 'Chef-Rechte' : r === 'stationsleitung' ? 'Stationsleitung' : 'Mitarbeiter'
function daysUntil(dateStr){
  if(!dateStr) return 999
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target - today) / 86400000)
}
function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function openFoodFacts(barcode){
  if(!barcode) return null
  try{
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,image_front_url,categories`)
    const data = await res.json()
    if(data.status !== 1) return null
    const p = data.product || {}
    return {
      name: [p.brands, p.product_name].filter(Boolean).join(' · ') || p.product_name || barcode,
      bild_url: p.image_front_url || '',
      kategorie: 'Sonstiges'
    }
  }catch{
    return null
  }
}

export default function App(){
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [employees, setEmployees] = useState([])
  const [items, setItems] = useState([])
  const [writeoffs, setWriteoffs] = useState([])
  const [settings, setSettings] = useState({})
  const [online, setOnline] = useState([])
  const [backwaren, setBackwaren] = useState(DEFAULT_BACKWAREN)
  const [tab, setTab] = useState('dashboard')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [login, setLogin] = useState({ nummer:'', passwort:'', remember:true })
  const [newPassword, setNewPassword] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [editArticle, setEditArticle] = useState(null)
  const [editWriteoff, setEditWriteoff] = useState(null)
  const [form, setForm] = useState({
    barcode:'',
    artikelnummer:'',
    name:'',
    kategorie:'Sonstiges',
    mhd:todayISO(),
    menge:1,
    bild_url:''
  })

  const db = !!supabase

  useEffect(() => {
    navigator.serviceWorker?.register('/sw.js').catch(()=>{})
    const saved = localStorage.getItem('mhd_user')
    if(saved){
      try{ setUser(JSON.parse(saved)) }catch{}
    }
    loadAll()
  }, [])

  useEffect(() => {
    if(!db || !user) return
    let stop = false
    async function heartbeat(){
      if(stop) return
      await supabase.from('online_status').upsert({
        nummer:Number(user.nummer),
        name:user.name,
        rolle:user.rolle,
        last_seen:nowISO()
      }, { onConflict:'nummer' })
      if(isAdmin(user)){
        const { data } = await supabase.from('online_status').select('*').order('name')
        setOnline(data || [])
      }
    }
    heartbeat()
    const timer = setInterval(heartbeat, 30000)
    return () => { stop = true; clearInterval(timer) }
  }, [user])

  async function loadAll(){
    if(!db){
      setEmployees(DEFAULT_EMPLOYEES)
      setReady(true)
      return
    }
    try{
      const { data: empData } = await supabase.from('mitarbeiter').select('*').order('nummer')
      setEmployees(empData?.length ? empData : DEFAULT_EMPLOYEES)

      const { data: itemData } = await supabase.from('mhd_artikel').select('*').order('mhd')
      setItems(itemData || [])

      const { data: absData } = await supabase.from('abschriften').select('*').order('created_at', { ascending:false })
      setWriteoffs(absData || [])

      const { data: settingsData } = await supabase.from('app_settings').select('*')
      const obj = Object.fromEntries((settingsData || []).map(s => [s.key, s.value]))
      setSettings(obj)
      if(obj.backwaren_liste){
        try{ setBackwaren(JSON.parse(obj.backwaren_liste)) }catch{}
      }
    }catch(e){
      console.warn(e)
      setEmployees(DEFAULT_EMPLOYEES)
    }
    setReady(true)
  }

  async function saveSetting(key, value){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    if(db){
      const { error } = await supabase.from('app_settings').upsert({ key, value, updated_by:user.name }, { onConflict:'key' })
      if(error) return setError(error.message)
    }
    setSettings(p => ({...p, [key]:value}))
    setSuccess('Einstellung gespeichert.')
  }

  async function saveBackwarenList(next){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    setBackwaren(next)
    if(db){
      const { error } = await supabase.from('app_settings').upsert({ key:'backwaren_liste', value:JSON.stringify(next), updated_by:user.name }, { onConflict:'key' })
      if(error) return setError(error.message)
    }
    setSuccess('Backwarenliste gespeichert.')
  }

  async function doLogin(e){
    e.preventDefault()
    setError('')
    const found = employees.find(x => Number(x.nummer) === Number(login.nummer) && String(x.passwort) === String(login.passwort))
    if(!found) return setError('Nummer oder Passwort falsch.')
    setUser(found)
    if(login.remember) localStorage.setItem('mhd_user', JSON.stringify(found))
  }

  async function changePassword(){
    if(!/^[0-9]{4}$/.test(newPassword)) return setError('Bitte genau 4 Zahlen eingeben.')
    const updated = { ...user, passwort:newPassword, muss_passwort_aendern:false }
    if(db){
      const { error } = await supabase.from('mitarbeiter').update({ passwort:newPassword, muss_passwort_aendern:false }).eq('nummer', user.nummer)
      if(error) return setError(error.message)
    }
    setUser(updated)
    localStorage.setItem('mhd_user', JSON.stringify(updated))
  }

  function logout(){
    localStorage.removeItem('mhd_user')
    setUser(null)
  }

  async function lookupBarcode(){
    setError('')
    const result = await openFoodFacts(form.barcode)
    if(!result) return setError('Kein Produkt gefunden.')
    setForm(f => ({ ...f, ...result }))
    setSuccess('Produkt gefunden.')
  }

  async function uploadFormImg(e){
    const file = e.target.files?.[0]
    if(!file) return
    const url = await fileToDataUrl(file)
    setForm(f => ({ ...f, bild_url:url }))
  }

  async function addItem(){
    setError('')
    if(!form.name || !form.mhd) return setError('Name und MHD fehlen.')
    const payload = {
      barcode:form.barcode || '',
      artikelnummer:form.artikelnummer || form.barcode || '',
      artikel:form.name,
      name:form.name,
      kategorie:form.kategorie,
      mhd:form.mhd,
      menge:Number(form.menge || 1),
      bild_url:form.bild_url || '',
      mitarbeiter:user.name,
      erstellt_von:Number(user.nummer)
    }
    if(db){
      const { error } = await supabase.from('mhd_artikel').insert(payload)
      if(error) return setError(error.message)
      await loadAll()
    }
    setForm({ barcode:'', artikelnummer:'', name:'', kategorie:'Sonstiges', mhd:todayISO(), menge:1, bild_url:'' })
    setSuccess('Artikel gespeichert.')
  }

  async function writeOff(payload){
    const finalPayload = {
      artikel_id: payload.artikel_id || null,
      barcode: payload.barcode || '',
      artikelnummer: payload.artikelnummer || '',
      artikel: payload.name || payload.artikel || 'Artikel',
      name: payload.name || payload.artikel || 'Artikel',
      kategorie: payload.kategorie || '',
      mhd: payload.mhd || todayISO(),
      menge: Number(payload.menge || 1),
      bild_url: payload.bild_url || '',
      grund: payload.grund || 'Abschrift',
      datum: todayISO(),
      mitarbeiter: user.name,
      mitarbeiter_nummer: Number(user.nummer),
      status: 'abgeschlossen'
    }
    if(db){
      const { error } = await supabase.from('abschriften').insert(finalPayload)
      if(error){
        setError('Abschrift fehlgeschlagen: ' + error.message)
        return false
      }
      await loadAll()
    }
    setSuccess(`Abschrift gespeichert: ${finalPayload.name} · Menge ${finalPayload.menge}`)
    navigator.vibrate?.(80)
    return true
  }

  async function writeOffArticle(item, amount){
    const qty = Number(amount || 0)
    if(qty < 1) return setError('Bitte Menge größer als 0 eingeben.')
    const ok = await writeOff({ ...item, artikel_id:item.id, menge:qty, grund: daysUntil(item.mhd) < 0 ? 'Abgelaufen' : 'MHD Abschrift' })
    if(ok && db){
      const rest = Math.max(0, Number(item.menge || 0) - qty)
      if(rest <= 0) await supabase.from('mhd_artikel').delete().eq('id', item.id)
      else await supabase.from('mhd_artikel').update({ menge:rest }).eq('id', item.id)
      await loadAll()
    }
  }

  async function saveArticle(data){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    const payload = {
      barcode:data.barcode || '',
      artikelnummer:data.artikelnummer || '',
      artikel:data.name || data.artikel || 'Artikel',
      name:data.name || data.artikel || 'Artikel',
      kategorie:data.kategorie || 'Sonstiges',
      mhd:data.mhd,
      menge:Number(data.menge || 1),
      bild_url:data.bild_url || ''
    }
    const { error } = await supabase.from('mhd_artikel').update(payload).eq('id', data.id)
    if(error) return setError(error.message)
    setEditArticle(null)
    await loadAll()
    setSuccess('Artikel gespeichert.')
  }

  async function saveWriteoff(data){
    if(!isAdmin(user)) return setError('Nur Chef/Stationsleitung darf Abschriften ändern.')
    const payload = {
      artikelnummer:data.artikelnummer || '',
      artikel:data.name || data.artikel || 'Artikel',
      name:data.name || data.artikel || 'Artikel',
      grund:data.grund || 'Abschrift',
      menge:Number(data.menge || 1),
      datum:data.datum || todayISO(),
      status:'abgeschlossen'
    }
    const { error } = await supabase.from('abschriften').update(payload).eq('id', data.id)
    if(error) return setError(error.message)
    setEditWriteoff(null)
    await loadAll()
    setSuccess('Abschrift gespeichert.')
  }

  async function deleteWriteoff(item){
    if(!isAdmin(user)) return setError('Nur Chef/Stationsleitung darf löschen.')
    if(!confirm('Abschrift löschen?')) return
    const { error } = await supabase.from('abschriften').delete().eq('id', item.id)
    if(error) return setError(error.message)
    await loadAll()
    setSuccess('Abschrift gelöscht.')
  }

  async function saveEmployee(emp){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    const payload = {
      nummer:Number(emp.nummer),
      name:emp.name,
      rolle:emp.rolle || 'mitarbeiter',
      passwort:emp.passwort || '0000',
      muss_passwort_aendern: true
    }
    const { error } = await supabase.from('mitarbeiter').upsert(payload, { onConflict:'nummer' })
    if(error) return setError(error.message)
    await loadAll()
    setSuccess('Mitarbeiter gespeichert.')
  }

  async function deleteEmployee(emp){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    if(!confirm(`${emp.name} löschen?`)) return
    const { error } = await supabase.from('mitarbeiter').delete().eq('nummer', emp.nummer)
    if(error) return setError(error.message)
    await loadAll()
    setSuccess('Mitarbeiter gelöscht.')
  }

  async function resetPassword(emp){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    const { error } = await supabase.from('mitarbeiter').update({ passwort:'0000', muss_passwort_aendern:true }).eq('nummer', emp.nummer)
    if(error) return setError(error.message)
    setSuccess(`Passwort für ${emp.name} auf 0000 zurückgesetzt.`)
  }

  async function enablePush(){
    if(!('Notification' in window)) return alert('Push wird nicht unterstützt.')
    const permission = await Notification.requestPermission()
    if(permission !== 'granted') return alert('Benachrichtigungen wurden nicht erlaubt.')
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification('MHD Kontrolle aktiviert', {
      body:'Benachrichtigungen sind aktiv.',
      icon:'/icon-192.png'
    })
  }

  const stats = useMemo(() => ({
    total:items.length,
    expired:items.filter(i => daysUntil(i.mhd) < 0).length,
    urgent:items.filter(i => daysUntil(i.mhd) >= 0 && daysUntil(i.mhd) <= 2).length,
    week:items.filter(i => daysUntil(i.mhd) > 2 && daysUntil(i.mhd) <= 7).length
  }), [items])

  if(!ready) return <main className="center">Lade App...</main>
  if(!db) return <main className="center">Supabase ENV fehlt.</main>
  if(!user) return <Login login={login} setLogin={setLogin} error={error} doLogin={doLogin}/>
  if(user.muss_passwort_aendern || user.passwort === '0000'){
    return <main className="loginPage">
      <section className="loginCard">
        <div className="brandBadge">MHD</div>
        <h1>Neues Passwort setzen</h1>
        <p>{user.name}, bitte eigenes 4-stelliges Passwort vergeben.</p>
        <input inputMode="numeric" maxLength="4" value={newPassword} onChange={e => setNewPassword(e.target.value.replace(/\D/g,''))}/>
        {error && <div className="error">{error}</div>}
        <button onClick={changePassword}>Speichern</button>
      </section>
    </main>
  }

  const tabs = [
    ['dashboard','Übersicht'],
    ['artikel','Artikel'],
    ['erfassen','Erfassen'],
    ['backwaren','Backwaren'],
    ['abschriften','Abschriften'],
    ...(isAdmin(user) ? [['bilder','Bilder']] : []),
    ['dienstplan','Dienstplan'],
    ...(isAdmin(user) ? [['online','Online'], ['verwaltung','Verwaltung'], ['settings','Einstellungen']] : [])
  ]

  return <main className="app">
    <header className="topbar">
      <div>
        <p>MHD Kontrolle · {roleLabel(user.rolle)}</p>
        <h1>Hallo {user.name}</h1>
      </div>
      <button className="logout" onClick={logout}>Logout</button>
    </header>

    <section className="stats">
      <Stat label="Artikel" value={stats.total} onClick={() => setTab('artikel')}/>
      <Stat label="Abgelaufen" value={stats.expired}/>
      <Stat label="Bald" value={stats.urgent}/>
      <Stat label="Woche" value={stats.week}/>
    </section>

    <nav className="tabs">
      {tabs.map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
    </nav>

    {error && <div className="error">{error}</div>}
    {success && <div className="success">{success}</div>}

    {tab === 'dashboard' && <Dashboard items={items} setTab={setTab} user={user} writeOffArticle={writeOffArticle} setEditArticle={setEditArticle}/>}
    {tab === 'artikel' && <ArticleList items={items} user={user} writeOffArticle={writeOffArticle} setEditArticle={setEditArticle}/>}
    {tab === 'erfassen' && <Erfassen form={form} setForm={setForm} setScannerOpen={setScannerOpen} lookupBarcode={lookupBarcode} uploadFormImg={uploadFormImg} addItem={addItem} user={user}/>}
    {tab === 'backwaren' && <Backwaren backwaren={backwaren} saveBackwarenList={saveBackwarenList} writeOff={writeOff} user={user}/>}
    {tab === 'abschriften' && <Abschriften writeoffs={writeoffs} user={user} setEditWriteoff={setEditWriteoff} deleteWriteoff={deleteWriteoff}/>}
    {tab === 'bilder' && isAdmin(user) && <Bilder items={items} reload={loadAll}/>}
    {tab === 'dienstplan' && <Dienstplan settings={settings} saveSetting={saveSetting} user={user}/>}
    {tab === 'online' && isAdmin(user) && <Online online={online}/>}
    {tab === 'verwaltung' && isAdmin(user) && <Verwaltung employees={employees} saveEmployee={saveEmployee} deleteEmployee={deleteEmployee} resetPassword={resetPassword}/>}
    {tab === 'settings' && isAdmin(user) && <Settings enablePush={enablePush}/>}

    {scannerOpen && <Scanner onClose={() => setScannerOpen(false)} onDetected={(code) => { setForm(f => ({...f, barcode:code, artikelnummer:f.artikelnummer || code})); setScannerOpen(false) }}/>}
    {editArticle && <ArticleModal item={editArticle} close={() => setEditArticle(null)} save={saveArticle}/>}
    {editWriteoff && <WriteoffModal item={editWriteoff} close={() => setEditWriteoff(null)} save={saveWriteoff}/>}
  </main>
}

function Login({login,setLogin,error,doLogin}){
  return <main className="loginPage">
    <section className="loginCard">
      <div className="brandBadge">MHD</div>
      <h1>Tankstelle Ludweiler</h1>
      <p>Mitarbeiter-Login</p>
      <form onSubmit={doLogin}>
        <label>Mitarbeiternummer</label>
        <input inputMode="numeric" value={login.nummer} onChange={e => setLogin({...login, nummer:e.target.value.replace(/\D/g,'')})}/>
        <label>Passwort</label>
        <input type="password" inputMode="numeric" value={login.passwort} onChange={e => setLogin({...login, passwort:e.target.value})}/>
        <label className="check"><input type="checkbox" checked={login.remember} onChange={e => setLogin({...login, remember:e.target.checked})}/> Dauerhaft eingeloggt bleiben</label>
        {error && <div className="error">{error}</div>}
        <button>Einloggen</button>
      </form>
    </section>
  </main>
}

function Stat({label,value,onClick}){ return <button className="stat" onClick={onClick}><span>{label}</span><b>{value}</b></button> }

function Dashboard({items,setTab,user,writeOffArticle,setEditArticle}){
  return <section className="list">
    <button className="primary" onClick={() => setTab('erfassen')}>+ Schnell erfassen</button>
    {items.slice(0,8).map(item => <Article key={item.id} item={item} user={user} writeOffArticle={writeOffArticle} setEditArticle={setEditArticle}/>)}
  </section>
}

function ArticleList({items,user,writeOffArticle,setEditArticle}){
  return <section className="list">
    <h2>Artikel</h2>
    {items.map(item => <Article key={item.id} item={item} user={user} writeOffArticle={writeOffArticle} setEditArticle={setEditArticle}/>)}
  </section>
}

function Article({item,user,writeOffArticle,setEditArticle}){
  const [amount, setAmount] = useState(String(item.menge || 1))
  const days = daysUntil(item.mhd)
  function step(delta){
    const next = Math.max(0, Number(amount || 0) + delta)
    setAmount(String(next))
  }
  return <div className="item articleItem">
    <div className="thumb">{item.bild_url ? <img src={item.bild_url}/> : '📦'}</div>
    <div className="grow">
      <b>{item.name || item.artikel}</b>
      <p>{item.artikelnummer ? `Art.-Nr. ${item.artikelnummer} · ` : ''}{item.kategorie || 'Sonstiges'}</p>
      <p>MHD {item.mhd ? new Date(item.mhd).toLocaleDateString('de-DE') : '-'} · Bestand {item.menge || 1} Stk. · {days < 0 ? `${Math.abs(days)} Tage drüber` : `${days} Tage`}</p>
    </div>
    <div className="writeBox">
      <div className="stepper">
        <button onClick={() => step(-1)}>−</button>
        <input className="qty" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g,''))}/>
        <button onClick={() => step(1)}>+</button>
      </div>
      <div className="actions">
        {isAdmin(user) && <button onClick={() => setEditArticle(item)}>Bearbeiten</button>}
        <button onClick={() => writeOffArticle(item, Number(amount || 0))}>Abschreiben</button>
      </div>
    </div>
  </div>
}

function Erfassen({form,setForm,setScannerOpen,lookupBarcode,uploadFormImg,addItem,user}){
  return <section className="formCard">
    <h2>Artikel erfassen</h2>
    <button className="scannerButton" onClick={() => setScannerOpen(true)}>📷 Barcode scannen</button>
    <input placeholder="Barcode" value={form.barcode} onChange={e => setForm({...form, barcode:e.target.value.replace(/\D/g,''), artikelnummer:e.target.value.replace(/\D/g,'')})}/>
    <button onClick={lookupBarcode}>Auto-Suche</button>
    <input placeholder="Artikelnummer" value={form.artikelnummer} onChange={e => setForm({...form, artikelnummer:e.target.value})}/>
    <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
    <select value={form.kategorie} onChange={e => setForm({...form, kategorie:e.target.value})}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
    <input type="date" value={form.mhd} onChange={e => setForm({...form, mhd:e.target.value})}/>
    <input type="number" min="1" value={form.menge} onChange={e => setForm({...form, menge:e.target.value})}/>
    {isAdmin(user) && <label className="upload">Bild/Screenshot hochladen<input type="file" accept="image/*" onChange={uploadFormImg}/></label>}
    {form.bild_url && <img className="preview" src={form.bild_url}/>}
    <button className="primary" onClick={addItem}>Speichern</button>
  </section>
}

function Backwaren({backwaren,saveBackwarenList,writeOff,user}){
  const [qty, setQty] = useState({})
  const [newItem, setNewItem] = useState({ artikelnummer:'', name:'' })
  const [sending, setSending] = useState(false)

  const entries = backwaren.map(b => ({...b, menge:Number(qty[b.artikelnummer] || 0)})).filter(b => b.menge > 0)
  const total = entries.reduce((sum, b) => sum + b.menge, 0)

  function step(num, delta){
    const next = Math.max(0, Number(qty[num] || 0) + delta)
    setQty({...qty, [num]: next ? String(next) : ''})
  }

  async function submit(){
    if(!entries.length) return alert('Bitte erst Mengen eintragen.')
    setSending(true)
    for(const entry of entries){
      await writeOff({ artikelnummer:entry.artikelnummer, name:entry.name, kategorie:'🥐 Backwaren', mhd:todayISO(), menge:entry.menge, grund:'Backwaren Tagesende' })
    }
    setQty({})
    setSending(false)
  }

  function addBackware(){
    if(!newItem.artikelnummer || !newItem.name) return
    saveBackwarenList([...backwaren, { artikelnummer:newItem.artikelnummer, name:newItem.name }])
    setNewItem({ artikelnummer:'', name:'' })
  }

  function deleteBackware(num){
    if(confirm('Backware löschen?')) saveBackwarenList(backwaren.filter(b => b.artikelnummer !== num))
  }

  return <section className="list backwarenPage">
    <div className="stickySubmit">
      <div><h2>Backwaren Tagesende</h2><p>{entries.length} Positionen · {total} Stück</p></div>
      <button disabled={!entries.length || sending} onClick={submit}>{sending ? 'Speichern...' : 'Alles absenden'}</button>
    </div>
    <div className="submitHint">Menge mit +/− ändern. Bis zum Absenden kann alles geändert werden. Danach nur Chef/Stationsleitung.</div>

    {isAdmin(user) && <div className="adminBox">
      <h3>Backwaren verwalten</h3>
      <input placeholder="Artikelnummer" value={newItem.artikelnummer} onChange={e => setNewItem({...newItem, artikelnummer:e.target.value})}/>
      <input placeholder="Name" value={newItem.name} onChange={e => setNewItem({...newItem, name:e.target.value})}/>
      <button onClick={addBackware}>Backware hinzufügen</button>
    </div>}

    {backwaren.map(b => <div className={'item bakery ' + (Number(qty[b.artikelnummer] || 0) > 0 ? 'selectedBakery' : '')} key={b.artikelnummer}>
      <div className="artikelnummer">{b.artikelnummer}</div>
      <div className="grow"><b>{b.name}</b><p>Artikelnummer {b.artikelnummer}</p>{isAdmin(user) && <button className="ghostSmall" onClick={() => deleteBackware(b.artikelnummer)}>Löschen</button>}</div>
      <div className="stepper">
        <button onClick={() => step(b.artikelnummer, -1)}>−</button>
        <input className="qty" inputMode="numeric" value={qty[b.artikelnummer] || ''} onChange={e => setQty({...qty, [b.artikelnummer]:e.target.value.replace(/\D/g,'')})} placeholder="0"/>
        <button onClick={() => step(b.artikelnummer, 1)}>+</button>
      </div>
    </div>)}

    <button className="fixedSubmit" disabled={!entries.length || sending} onClick={submit}>{sending ? 'Speichern...' : `Backwaren absenden (${total})`}</button>
  </section>
}

function Abschriften({writeoffs,user,setEditWriteoff,deleteWriteoff}){
  return <section className="list">
    <h2>Abschriften</h2>
    {writeoffs.map(w => <div className="item" key={w.id}>
      <div className="artikelnummer small">{w.artikelnummer || 'MHD'}</div>
      <div className="grow"><b>{w.name || w.artikel}</b><p>{w.grund} · {w.menge} Stk. · {w.mitarbeiter} · {new Date(w.datum || w.created_at).toLocaleDateString('de-DE')}</p></div>
      {isAdmin(user) && <div className="actions"><button onClick={() => setEditWriteoff(w)}>Bearbeiten</button><button onClick={() => deleteWriteoff(w)}>Löschen</button></div>}
    </div>)}
  </section>
}

function Bilder({items,reload}){
  async function upload(item,e){
    const file = e.target.files?.[0]
    if(!file) return
    const url = await fileToDataUrl(file)
    const { error } = await supabase.from('mhd_artikel').update({ bild_url:url }).eq('id', item.id)
    if(!error) reload()
  }
  return <section className="formCard">
    <h2>Bilder verwalten</h2>
    <p>Nur Chef/Stationsleitung/Michael sieht diesen Bereich.</p>
    {items.map(i => <div className="item" key={i.id}>
      <div className="thumb">{i.bild_url ? <img src={i.bild_url}/> : '📦'}</div>
      <div className="grow"><b>{i.name}</b><p>{i.artikelnummer}</p></div>
      <label className="miniUpload">Upload<input type="file" accept="image/*" onChange={e => upload(i,e)}/></label>
    </div>)}
  </section>
}

function Dienstplan({settings,saveSetting,user}){
  const [month, setMonth] = useState('juni')
  const src = settings['dienstplan_' + month] || ''
  async function upload(e){
    const file = e.target.files?.[0]
    if(file) saveSetting('dienstplan_' + month, await fileToDataUrl(file))
  }
  return <section className="formCard">
    <h2>Dienstplan</h2>
    <div className="planSwitch"><button className={month === 'mai' ? 'active' : ''} onClick={() => setMonth('mai')}>Mai</button><button className={month === 'juni' ? 'active' : ''} onClick={() => setMonth('juni')}>Juni</button></div>
    {src ? <div className="dienstplanBox"><img src={src}/></div> : <div className="empty">Noch kein Dienstplan hinterlegt.</div>}
    {src && <a className="downloadBtn" href={src} target="_blank">Plan groß öffnen</a>}
    {isAdmin(user) && <label className="upload">Plan hochladen/ersetzen<input type="file" accept="image/*,application/pdf" onChange={upload}/></label>}
  </section>
}

function Online({online}){
  return <section className="formCard">
    <h2>Mitarbeiter online</h2>
    {online.map(o => <div className="onlineItem" key={o.nummer}><span className="dot online"></span><div><b>{o.name}</b><p>{roleLabel(o.rolle)}</p></div></div>)}
  </section>
}

function Verwaltung({employees,saveEmployee,deleteEmployee,resetPassword}){
  const [emp, setEmp] = useState({ nummer:'', name:'', rolle:'mitarbeiter' })
  return <section className="formCard">
    <h2>Mitarbeiter verwalten</h2>
    <div className="adminBox">
      <input placeholder="Nummer" value={emp.nummer} onChange={e => setEmp({...emp, nummer:e.target.value.replace(/\D/g,'')})}/>
      <input placeholder="Name" value={emp.name} onChange={e => setEmp({...emp, name:e.target.value})}/>
      <select value={emp.rolle} onChange={e => setEmp({...emp, rolle:e.target.value})}>
        <option value="mitarbeiter">Mitarbeiter</option>
        <option value="stationsleitung">Stationsleitung</option>
        <option value="chef">Chef</option>
        <option value="chef_temp">Michael / Chef-Rechte</option>
      </select>
      <button onClick={() => { saveEmployee(emp); setEmp({ nummer:'', name:'', rolle:'mitarbeiter' }) }}>Mitarbeiter speichern</button>
    </div>
    {employees.map(e => <div className="item" key={e.nummer}>
      <div className="artikelnummer small">{e.nummer}</div>
      <div className="grow"><b>{e.name}</b><p>{roleLabel(e.rolle)}</p></div>
      <div className="actions"><button onClick={() => resetPassword(e)}>PW 0000</button><button onClick={() => deleteEmployee(e)}>Löschen</button></div>
    </div>)}
  </section>
}

function Settings({enablePush}){
  return <section className="formCard">
    <h2>Einstellungen</h2>
    <button onClick={enablePush}>🔔 Push aktivieren/testen</button>
    <div className="adminBox"><b>Verwaltung</b><p>Backwaren, Mitarbeiter, Bilder und Artikel sind nur für Chef/Stationsleitung/Michael vollständig bearbeitbar.</p></div>
  </section>
}

function ArticleModal({item,close,save}){
  const [data,setData] = useState({...item})
  async function upload(e){
    const file = e.target.files?.[0]
    if(file) setData({...data, bild_url:await fileToDataUrl(file)})
  }
  return <div className="modalOverlay"><div className="modalCard">
    <h2>Artikel bearbeiten</h2>
    <input placeholder="Artikelnummer" value={data.artikelnummer || ''} onChange={e => setData({...data, artikelnummer:e.target.value})}/>
    <input placeholder="Name" value={data.name || data.artikel || ''} onChange={e => setData({...data, name:e.target.value})}/>
    <select value={data.kategorie || 'Sonstiges'} onChange={e => setData({...data, kategorie:e.target.value})}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
    <input type="date" value={data.mhd || todayISO()} onChange={e => setData({...data, mhd:e.target.value})}/>
    <input type="number" min="1" value={data.menge || 1} onChange={e => setData({...data, menge:e.target.value})}/>
    <input placeholder="Barcode" value={data.barcode || ''} onChange={e => setData({...data, barcode:e.target.value})}/>
    <label className="upload">Bild hochladen<input type="file" accept="image/*" onChange={upload}/></label>
    {data.bild_url && <img className="preview" src={data.bild_url}/>}
    <div className="modalActions"><button onClick={close}>Abbrechen</button><button onClick={() => save(data)}>Speichern</button></div>
  </div></div>
}

function WriteoffModal({item,close,save}){
  const [data,setData] = useState({...item})
  return <div className="modalOverlay"><div className="modalCard">
    <h2>Abschrift bearbeiten</h2>
    <input value={data.artikelnummer || ''} onChange={e => setData({...data, artikelnummer:e.target.value})}/>
    <input value={data.name || data.artikel || ''} onChange={e => setData({...data, name:e.target.value})}/>
    <input value={data.grund || ''} onChange={e => setData({...data, grund:e.target.value})}/>
    <input type="number" min="1" value={data.menge || 1} onChange={e => setData({...data, menge:e.target.value})}/>
    <input type="date" value={(data.datum || todayISO()).slice(0,10)} onChange={e => setData({...data, datum:e.target.value})}/>
    <div className="modalActions"><button onClick={close}>Abbrechen</button><button onClick={() => save(data)}>Speichern</button></div>
  </div></div>
}

function Scanner({onClose,onDetected}){
  const videoRef = useRef(null)
  const [manual, setManual] = useState('')
  const [message, setMessage] = useState('Kamera wird gestartet...')
  useEffect(() => {
    let cancelled = false
    let reader
    async function load(){
      if(!window.ZXing){
        await new Promise((resolve,reject) => {
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js'
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }
      if(cancelled) return
      reader = new window.ZXing.BrowserMultiFormatReader()
      setMessage('Barcode vor die Kamera halten.')
      await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if(result){
          const code = result.getText()
          try{ reader.reset() }catch{}
          onDetected(code)
        }
      })
    }
    load().catch(() => setMessage('Kamera konnte nicht gestartet werden. Bitte Berechtigung erlauben oder Code manuell eingeben.'))
    return () => { cancelled = true; try{ reader?.reset() }catch{} }
  }, [])
  return <div className="modalOverlay"><div className="modalCard scannerCard">
    <h2>Barcode scannen</h2>
    <p>{message}</p>
    <video ref={videoRef} className="scannerVideo" autoPlay muted playsInline></video>
    <input inputMode="numeric" placeholder="Barcode manuell eingeben" value={manual} onChange={e => setManual(e.target.value.replace(/\D/g,''))}/>
    <button disabled={!manual} onClick={() => onDetected(manual)}>Übernehmen</button>
    <button onClick={onClose}>Schließen</button>
  </div></div>
}
