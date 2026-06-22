
import React, { useEffect, useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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
function normalizeMhdInput(value){
  const raw = String(value || '').trim()
  if(!raw) return ''
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const match = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2}|\d{4})$/)
  if(!match) return ''
  const day = match[1].padStart(2,'0')
  const month = match[2].padStart(2,'0')
  const year = match[3].length === 2 ? '20' + match[3] : match[3]
  const iso = `${year}-${month}-${day}`
  const d = new Date(iso + 'T00:00:00')
  if(Number.isNaN(d.getTime())) return ''
  if(d.getFullYear() !== Number(year) || d.getMonth()+1 !== Number(month) || d.getDate() !== Number(day)) return ''
  return iso
}
function toGermanDate(value){
  const iso = normalizeMhdInput(value)
  if(!iso) return String(value || '')
  const [y,m,d] = iso.split('-')
  return `${d}.${m}.${y}`
}
const isAdmin = u => ['chef','chef_temp','stationsleitung'].includes(u?.rolle)
const roleLabel = r => r === 'chef' ? 'Chef' : r === 'chef_temp' ? 'Chef-Rechte' : r === 'stationsleitung' ? 'Stationsleitung' : 'Mitarbeiter'
const isMissingArticlesTableError = error => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('fehlende_artikel') || (error?.code === 'PGRST205' && msg.includes('fehlende'))
}
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

function removeImageBackground(src){
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try{
        const maxSize = 900
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently:true })
        ctx.drawImage(img, 0, 0, w, h)
        const image = ctx.getImageData(0, 0, w, h)
        const data = image.data

        function get(x,y){
          const i = (y*w+x)*4
          return [data[i], data[i+1], data[i+2]]
        }

        const samples = [
          get(0,0), get(w-1,0), get(0,h-1), get(w-1,h-1),
          get(Math.floor(w/2),0), get(Math.floor(w/2),h-1),
          get(0,Math.floor(h/2)), get(w-1,Math.floor(h/2))
        ]
        const bg = samples.reduce((a,c)=>[a[0]+c[0],a[1]+c[1],a[2]+c[2]],[0,0,0]).map(v=>v/samples.length)

        const visited = new Uint8Array(w*h)
        const q = []
        function push(x,y){
          if(x<0||y<0||x>=w||y>=h) return
          const idx = y*w+x
          if(visited[idx]) return
          visited[idx] = 1
          q.push([x,y])
        }
        for(let x=0;x<w;x++){ push(x,0); push(x,h-1) }
        for(let y=0;y<h;y++){ push(0,y); push(w-1,y) }

        function isBg(x,y){
          const i = (y*w+x)*4
          const dr=data[i]-bg[0], dg=data[i+1]-bg[1], db=data[i+2]-bg[2]
          const dist = Math.sqrt(dr*dr+dg*dg+db*db)
          const bright = (data[i]+data[i+1]+data[i+2])/3
          return dist < 65 || (bright > 225 && dist < 95)
        }

        let head = 0
        while(head < q.length){
          const [x,y] = q[head++]
          if(!isBg(x,y)) continue
          const i = (y*w+x)*4
          data[i+3] = 0
          push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1)
        }

        ctx.putImageData(image, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }catch(err){ reject(err) }
    }
    img.onerror = reject
    img.src = src
  })
}


function InlineFeedback({msg}){
  if(!msg) return null
  return <div className={'inlineFeedback ' + msg.type}>{msg.text}</div>
}

async function openFoodFacts(barcode){
  try{
    if(!barcode) return null
    const urls = [
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,image_front_url,image_url`,
      `https://de.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,image_front_url,image_url`
    ]

    for(const url of urls){
      const res = await fetch(url)
      const data = await res.json()
      if(data.status !== 1) continue
      const p = data.product || {}
      return {
        name: [p.brands, p.product_name].filter(Boolean).join(' · ') || p.product_name || barcode,
        bild_url: p.image_front_url || p.image_url || ''
      }
    }
    return null
  }catch(e){
    console.warn('Produktsuche fehlgeschlagen', e)
    return null
  }
}



function entryDateKey(item){
  const raw = item.datum || item.created_at || todayISO()
  return String(raw).slice(0,10)
}

function formatDateDE(dateKey){
  try{ return new Date(dateKey + 'T00:00:00').toLocaleDateString('de-DE') }catch{ return dateKey }
}

function groupByDay(entries = []){
  const grouped = {}
  entries.forEach(item => {
    const key = entryDateKey(item)
    if(!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  })
  return Object.entries(grouped).sort((a,b) => b[0].localeCompare(a[0]))
}

function appFeedback(type = 'success'){
  try{
    const patterns = { success:[120], warning:[80,60,80], error:[70,50,70,50,70], click:[50], alarm:[700,250,700,250,700] }
    navigator.vibrate?.(patterns[type] || patterns.success)
  }catch{}
  if(type === 'success'){
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if(!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.14)
      setTimeout(() => ctx.close?.(), 250)
    }catch{}
  }
}

let mhdAlarmTimer = null
let mhdAlarmCtx = null

function stopMhdOpenAlarm(){
  try{ if(mhdAlarmTimer) clearInterval(mhdAlarmTimer) }catch{}
  mhdAlarmTimer = null
  try{ navigator.vibrate?.(0) }catch{}
  try{ mhdAlarmCtx?.close?.() }catch{}
  mhdAlarmCtx = null
}

function mhdOpenAlarm(){
  try{
    stopMhdOpenAlarm()
    const started = Date.now()
    const vibrateStrong = () => { try{ navigator.vibrate?.([700,180,700,180,700]) }catch{} }
    vibrateStrong()
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if(AudioCtx){
      const ctx = new AudioCtx()
      mhdAlarmCtx = ctx
      const gain = ctx.createGain()
      gain.gain.value = 0.10
      gain.connect(ctx.destination)
      const beep = () => {
        if(Date.now() - started > 15000) return stopMhdOpenAlarm()
        ;[0, 250, 500].forEach((delay) => {
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = delay === 250 ? 1040 : 880
          osc.connect(gain)
          osc.start(ctx.currentTime + delay/1000)
          osc.stop(ctx.currentTime + delay/1000 + 0.16)
        })
      }
      beep()
      mhdAlarmTimer = setInterval(() => { vibrateStrong(); beep() }, 1500)
      setTimeout(stopMhdOpenAlarm, 15000)
    }else{
      mhdAlarmTimer = setInterval(vibrateStrong, 1500)
      setTimeout(stopMhdOpenAlarm, 15000)
    }
  }catch(e){ console.warn('Alarm konnte nicht abgespielt werden', e) }
}

function exportAbschriftenPDF(abschriften = [], title = 'MHD Liste', dateKey = ''){
  try{
    const doc = new jsPDF()
    const now = new Date().toLocaleDateString('de-DE')

    doc.setFontSize(18)
    doc.text(title, 14, 18)

    doc.setFontSize(10)
    doc.text('Erstellt am: ' + now, 14, 26)
    if(dateKey) doc.text('Liste vom: ' + formatDateDE(dateKey), 14, 32)

    const rows = abschriften.map((item) => [
      item.artikelnummer || '',
      item.name || item.artikel || '',
      item.typ === 'kontrolle' ? '0 / kontrolliert' : String(item.menge || 0),
      item.mhd ? new Date(item.mhd).toLocaleDateString('de-DE') : '',
      item.typ === 'kontrolle' ? 'Kontrolliert – Bestand 0' : (item.grund || ''),
      item.mitarbeiter || '',
      item.datum ? new Date(item.datum).toLocaleDateString('de-DE') : (item.created_at ? new Date(item.created_at).toLocaleDateString('de-DE') : '')
    ])

    autoTable(doc, {
      startY: dateKey ? 40 : 34,
      head: [['Artikelnummer', 'Name', 'Menge', 'MHD', 'Typ/Grund', 'Mitarbeiter', 'Datum']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [215, 25, 32], textColor: [255, 217, 0] },
      alternateRowStyles: { fillColor: [255, 248, 210] }
    })

    const suffix = dateKey ? '-' + dateKey : ''
    doc.save((title || 'mhd-liste').toLowerCase().replaceAll(' ', '-') + suffix + '.pdf')
  }catch(err){
    alert('PDF Fehler: ' + err.message)
    console.error(err)
  }
}

export default function App(){
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [employees, setEmployees] = useState([])
  const [items, setItems] = useState([])
  const [masterArticles, setMasterArticles] = useState([])
  const [missingArticles, setMissingArticles] = useState([])
  const [writeoffs, setWriteoffs] = useState([])
  const [settings, setSettings] = useState({})
  const [online, setOnline] = useState([])
  const [backwaren, setBackwaren] = useState(DEFAULT_BACKWAREN)
  const [tab, setTab] = useState('dashboard')
  const [articleFilter, setArticleFilter] = useState('all')
  const [itemsLimited, setItemsLimited] = useState(true)
  const [allMhdLoaded, setAllMhdLoaded] = useState(false)
  const [openWarningKey, setOpenWarningKey] = useState('')
  const [loadedTabs, setLoadedTabs] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [login, setLogin] = useState({ nummer:'', passwort:'', remember:true })
  const [newPassword, setNewPassword] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [masterScannerOpen, setMasterScannerOpen] = useState(false)
  const [editArticle, setEditArticle] = useState(null)
  const [editWriteoff, setEditWriteoff] = useState(null)
  const [inlineMsg, setInlineMsg] = useState({})
  const [form, setForm] = useState({
    barcode:'',
    artikelnummer:'',
    name:'',
    kategorie:'Sonstiges',
    mhd:'',
    menge:'',
    bild_url:''
  })

  const db = !!supabase

  function msgAt(key, type, text){
    setInlineMsg(prev => ({...prev, [key]: {type, text}}))
    setTimeout(() => setInlineMsg(prev => {
      const next = {...prev}
      delete next[key]
      return next
    }), 5000)
  }



  useEffect(() => {
    if(success) appFeedback('success')
  }, [success])

  useEffect(() => {
    if(error) appFeedback('error')
  }, [error])

  function handleGlobalActionFeedback(e){
    const el = e.target?.closest?.('button, input, select, textarea, label')
    if(!el) return
    if(el.disabled) return
    appFeedback('click')
  }

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


  function checkDueNotifications(){
    try{
      const today = todayISO()
      const dueToday = (items || []).filter(x => String(x.mhd || '').slice(0,10) === today)
      const expired = (items || []).filter(x => String(x.mhd || '').slice(0,10) < today)
      const count = dueToday.length + expired.length
      if(!count) return

      const key = `mhd-open-alarm-${today}-${count}`
      if(openWarningKey === key) return
      setOpenWarningKey(key)

      const text = dueToday.length === 1
        ? `Achtung: 1 Artikel läuft heute ab.${expired.length ? ` Zusätzlich ${expired.length} abgelaufen.` : ''}`
        : `Achtung: ${dueToday.length} Artikel laufen heute ab.${expired.length ? ` Zusätzlich ${expired.length} abgelaufen.` : ''}`
      setSuccess(text)
      mhdOpenAlarm()

      if('Notification' in window){
        if(Notification.permission === 'granted'){
          new Notification('MHD Kontrolle', { body:text, icon:'/icon-192.png' })
        }else if(Notification.permission !== 'denied'){
          Notification.requestPermission().then(p => {
            if(p === 'granted') new Notification('MHD Kontrolle', { body:text, icon:'/icon-192.png' })
          })
        }
      }
    }catch(e){
      console.warn('Benachrichtigung konnte nicht geprüft werden', e)
    }
  }

  function next30ISO(){
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate()+30)
    return limitDate.toISOString().slice(0,10)
  }

  function isVisibleInFastOverview(item){
    const mhd = String(item?.mhd || '').slice(0,10)
    return !mhd || mhd <= next30ISO()
  }

  function sameMhdArticle(a, b){
    const sameDate = String(a?.mhd || '').slice(0,10) === String(b?.mhd || '').slice(0,10)
    if(!sameDate) return false
    const aBarcode = String(a?.barcode || '').trim()
    const bBarcode = String(b?.barcode || '').trim()
    if(aBarcode && bBarcode) return aBarcode === bBarcode
    const aNum = String(a?.artikelnummer || '').trim()
    const bNum = String(b?.artikelnummer || '').trim()
    if(aNum && bNum) return aNum === bNum
    const aName = String(a?.name || a?.artikel || '').trim().toLowerCase()
    const bName = String(b?.name || b?.artikel || '').trim().toLowerCase()
    return !!aName && !!bName && aName === bName
  }

  async function findDuplicateMhdEntry(payload){
    const localDuplicate = (items || []).find(x => sameMhdArticle(x, payload))
    if(localDuplicate) return localDuplicate
    if(!db) return null

    let query = supabase.from('mhd_artikel').select('id,barcode,artikelnummer,name,artikel,mhd').eq('mhd', payload.mhd).limit(1)
    if(payload.barcode){
      query = query.eq('barcode', payload.barcode)
    }else if(payload.artikelnummer){
      query = query.eq('artikelnummer', payload.artikelnummer)
    }else{
      query = query.eq('name', payload.name)
    }
    const { data, error } = await query
    if(error){
      console.warn('Duplikat-Prüfung fehlgeschlagen', error)
      return null
    }
    return data?.[0] || null
  }

  async function loadItems({ all = false, force = false } = {}){
    if(!db) return

    // Wichtig für Chef/Stationsleitung:
    // Wenn die komplette MHD-Liste einmal geladen wurde, bleibt sie im Speicher.
    // Dadurch lädt sie beim Zurückwechseln in die Übersicht nicht jedes Mal neu.
    if(all && allMhdLoaded && !force){
      setItemsLimited(false)
      return
    }

    // FINAL SPEED: Übersicht ohne Bilddaten laden. Bilder/Base64 sind die größte Bremse.
    let query = supabase.from('mhd_artikel').select('id,barcode,artikelnummer,name,artikel,kategorie,mhd,created_at,mitarbeiter').order('mhd')
    if(!all) query = query.lte('mhd', next30ISO())
    const { data, error } = await query
    if(error){
      console.warn(error)
      setError('MHD-Übersicht konnte nicht geladen werden: ' + error.message)
      return
    }
    setItems(data || [])
    setItemsLimited(!all)
    setAllMhdLoaded(!!all)
  }

  async function loadEmployees(){
    if(!db){
      setEmployees(DEFAULT_EMPLOYEES)
      return
    }
    const { data: empData } = await supabase.from('mitarbeiter').select('*').order('nummer')
    setEmployees(empData?.length ? empData : DEFAULT_EMPLOYEES)
  }

  async function loadMasterArticles(){
    if(!db) return
    setError('')
    // SPEED-FIX: Artikelliste ohne große Bilddaten laden.
    // Bilder/Base64 machen die Liste auf Handys langsam. Für Suche/Erfassung reichen diese Felder.
    const { data, error } = await supabase
      .from('artikel_stammdaten')
      .select('id,barcode,artikelnummer,name,kategorie,updated_at')
      .order('name')
    if(error){
      console.warn('Artikelliste konnte nicht geladen werden:', error)
      setMasterArticles([])
      setLoadedTabs(prev => ({...prev, master:true}))
      return setError('Artikelliste konnte nicht geladen werden: ' + error.message)
    }
    setMasterArticles(data || [])
    setLoadedTabs(prev => ({...prev, master:true}))
  }

  async function loadMissingArticles(){
    if(!db) return
    const { data, error } = await supabase.from('fehlende_artikel').select('*').order('created_at', { ascending:false })
    if(error){
      console.warn('Fehlende Artikel konnten nicht geladen werden:', error)
      if(isMissingArticlesTableError(error)){
        // Tabelle ist in Supabase noch nicht angelegt. Nicht als Dauerfehler auf jeder Seite anzeigen.
        setMissingArticles([])
        setLoadedTabs(prev => ({...prev, missing:true}))
        setError('')
        return
      }
      return setError(error.message)
    }
    setMissingArticles(data || [])
    setLoadedTabs(prev => ({...prev, missing:true}))
  }

  async function loadWriteoffs(){
    if(!db) return
    const { data, error } = await supabase.from('abschriften').select('*').order('created_at', { ascending:false })
    if(error) return setError(error.message)
    setWriteoffs(data || [])
    setLoadedTabs(prev => ({...prev, writeoffs:true}))
  }

  async function loadSettings(){
    if(!db) return
    const { data: settingsData } = await supabase.from('app_settings').select('*')
    const obj = Object.fromEntries((settingsData || []).map(s => [s.key, s.value]))
    setSettings(obj)
    if(obj.backwaren_liste){
      try{ setBackwaren(JSON.parse(obj.backwaren_liste)) }catch{}
    }
  }

  async function loadAll(){
    if(!db){
      setEmployees(DEFAULT_EMPLOYEES)
      setReady(true)
      return
    }
    try{
      await Promise.all([loadEmployees(), loadSettings(), loadItems({ all:false })])
    }catch(e){
      console.warn(e)
      setEmployees(DEFAULT_EMPLOYEES)
    }
    setReady(true)
  }

  useEffect(() => {
    if(!db || !user) return
    if((tab === 'erfassen' || tab === 'stammdaten') && !loadedTabs.master) loadMasterArticles()
    if(tab === 'fehlende' && isAdmin(user) && !loadedTabs.missing) loadMissingArticles()
    if((tab === 'abschriften' || tab === 'kontrollen') && isAdmin(user) && !loadedTabs.writeoffs) loadWriteoffs()
  }, [tab, user, db, loadedTabs.master, loadedTabs.missing, loadedTabs.writeoffs])


  useEffect(() => {
    if(!user || !items.length) return
    checkDueNotifications()
  }, [user, items])

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
    requestPushOnceAfterLogin(found)
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

  async function reportMissingArticle(barcode, hinweis='Artikel nicht in Artikelliste gefunden', artikelname=''){
    const clean = String(barcode || '').replace(/\D/g,'')
    if(!clean) return

    const cleanName = String(artikelname || '').trim()
    const finalHinweis = cleanName ? ('Artikelname: ' + cleanName + ' · ' + hinweis) : hinweis

    const payload = {
      barcode: clean,
      hinweis: finalHinweis,
      gemeldet_von: user?.name || '',
      gemeldet_von_nummer: Number(user?.nummer || 0),
      status: 'offen'
    }

    if(db){
      const { data: existing, error: findError } = await supabase.from('fehlende_artikel').select('*').eq('barcode', clean).eq('status','offen').maybeSingle()
      if(findError && isMissingArticlesTableError(findError)){
        console.warn('Tabelle fehlende_artikel fehlt noch:', findError)
        return
      }
      if(existing){
        if(cleanName && !String(existing.hinweis || '').includes(cleanName)){
          const updatedHinweis = finalHinweis
          await supabase.from('fehlende_artikel').update({ hinweis: updatedHinweis }).eq('id', existing.id)
          existing.hinweis = updatedHinweis
        }
        setMissingArticles(prev => prev.some(x => x.id === existing.id) ? prev.map(x => x.id === existing.id ? existing : x) : [existing, ...prev])
        return
      }
      const { data, error } = await supabase.from('fehlende_artikel').insert(payload).select().single()
      if(error){
        if(isMissingArticlesTableError(error)){
          console.warn('Tabelle fehlende_artikel fehlt noch:', error)
          return
        }
        return setError(error.message)
      }
      if(data) setMissingArticles(prev => [data, ...prev])
    }else{
      setMissingArticles(prev => prev.some(x => x.barcode === clean && x.status === 'offen') ? prev : [{...payload, id:clean, created_at:nowISO()}, ...prev])
    }
  }

  async function markMissingDone(row){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    if(db){
      const { error } = await supabase.from('fehlende_artikel').delete().eq('id', row.id)
      if(error){
        if(isMissingArticlesTableError(error)){
          setMissingArticles(prev => prev.filter(x => x.id !== row.id && x.barcode !== row.barcode))
          return setSuccess('Vorschlag gelöscht.')
        }
        return setError(error.message)
      }
      setMissingArticles(prev => prev.filter(x => x.id !== row.id))
    }else{
      setMissingArticles(prev => prev.filter(x => x.id !== row.id && x.barcode !== row.barcode))
    }
    setSuccess('Vorschlag gelöscht.')
  }

  async function lookupBarcode(){
    setError('')
    if(!form.barcode){
      msgAt('erfassen','error','Bitte erst Barcode eingeben oder scannen.')
      return
    }

    const localMaster = masterArticles.find(a => String(a.barcode || '') === String(form.barcode || ''))
    if(localMaster){
      setForm(f => ({
        ...f,
        barcode: localMaster.barcode || f.barcode,
        artikelnummer: localMaster.artikelnummer || f.artikelnummer || f.barcode,
        name: localMaster.name || f.name,
        kategorie: localMaster.kategorie || f.kategorie,
        bild_url: localMaster.bild_url || f.bild_url
      }))
      msgAt('erfassen','success','✓ Artikel aus Artikelliste übernommen. Nur MHD eingeben.')
      return
    }

    if(db){
      const { data: master } = await supabase.from('artikel_stammdaten').select('*').eq('barcode', form.barcode).maybeSingle()
      if(master){
        setForm(f => ({
          ...f,
          artikelnummer: master.artikelnummer || f.artikelnummer || f.barcode,
          name: master.name || f.name,
          kategorie: master.kategorie || f.kategorie,
          bild_url: master.bild_url || f.bild_url
        }))
        setMasterArticles(prev => prev.some(x => x.id === master.id) ? prev : [...prev, master])
        msgAt('erfassen','success','✓ Artikel aus Artikelliste übernommen. Nur MHD eingeben.')
        return
      }
    }

    const result = await openFoodFacts(form.barcode)
    if(!result){
      await reportMissingArticle(form.barcode, 'EAN wurde beim Erfassen gescannt, aber nicht in der Artikelliste gefunden.')
      msgAt('erfassen','warning','Artikel nicht in Artikelliste gefunden. Chef/Stationsleitung sieht ihn unter Fehlende Artikel.')
      return
    }

    const next = {
      barcode: form.barcode,
      artikelnummer: form.artikelnummer || form.barcode,
      name: result.name || form.name,
      
      bild_url: result.bild_url || form.bild_url
    }

    setForm(f => ({...f, ...next}))

    if(db && next.barcode){
      await supabase.from('artikel_stammdaten').upsert({
        barcode: next.barcode,
        artikelnummer: next.artikelnummer,
        name: next.name,
        kategorie: form.kategorie || 'Sonstiges',
        bild_url: next.bild_url,
        updated_at: nowISO()
      }, { onConflict:'barcode' })
      setMasterArticles(prev => prev.some(x => String(x.barcode || '') === String(next.barcode || '')) ? prev : [...prev, {...next, kategorie:form.kategorie || 'Sonstiges'}])
    }

    msgAt('erfassen','success', next.bild_url ? '✓ Produkt im Internet gefunden, Bild übernommen und Artikelliste gespeichert.' : '✓ Produkt im Internet gefunden und Artikelliste gespeichert.')
  }

  async function uploadFormImg(e){
    const file = await compressImageFile(e.target.files?.[0])
    if(!file) return
    const url = await fileToDataUrl(file)
    setForm(f => ({ ...f, bild_url:url }))
  }


  function safeEditOverviewItem(item){
    if(!item) return
    try{
      setForm({
        id:item.id,
        barcode:item.barcode || '',
        artikelnummer:item.artikelnummer || '',
        name:item.name || item.artikel || item.artikelname || '',
        kategorie:item.kategorie || 'Sonstiges',
        mhd:String(item.mhd || todayISO()).slice(0,10),
        menge:'',
        bild_url:item.bild_url || ''
      })
      setTab('erfassen')
      setSuccess('Eintrag zum Bearbeiten geladen.')
    }catch(e){
      console.error(e)
      setTab('erfassen')
    }
  }

  async function addItem(){
    setError('')
    const normalizedMhd = normalizeMhdInput(form.mhd)
    if(!form.name){
      appFeedback('error')
      msgAt('erfassen','error','Artikel fehlt.')
      return
    }
    if(!String(form.mhd || '').trim()){
      appFeedback('error')
      msgAt('erfassen','error','Bitte MHD eingeben.')
      return setError('Bitte MHD eingeben.')
    }
    if(!normalizedMhd){
      appFeedback('error')
      msgAt('erfassen','error','Bitte MHD im Format TT.MM.JJJJ eingeben oder Kalender nutzen.')
      return setError('Bitte MHD im Format TT.MM.JJJJ eingeben oder Kalender nutzen.')
    }
    if(normalizedMhd < todayISO()){
      appFeedback('error')
      msgAt('erfassen','error','MHD liegt bereits in der Vergangenheit.')
      return setError('MHD liegt bereits in der Vergangenheit.')
    }
    const payload = {
      barcode:form.barcode || '',
      artikelnummer:form.artikelnummer || form.barcode || '',
      artikel:form.name,
      name:form.name,
      kategorie:form.kategorie,
      mhd:normalizedMhd,
      menge:0,
      bild_url:form.bild_url || '',
      mitarbeiter:user.name,
      erstellt_von:Number(user.nummer)
    }
    if(db){
      const duplicate = await findDuplicateMhdEntry(payload)
      if(duplicate){
        appFeedback('error')
        msgAt('erfassen','error','Artikel wurde schon mit diesem Datum erfasst.')
        return setError('Artikel wurde schon mit diesem Datum erfasst.')
      }
      if(payload.barcode){
        await supabase.from('artikel_stammdaten').upsert({
          barcode: payload.barcode,
          artikelnummer: payload.artikelnummer,
          name: payload.name,
          kategorie: payload.kategorie,
          bild_url: payload.bild_url,
          updated_at: nowISO()
        }, { onConflict:'barcode' })
      }
      const { data:newRow, error } = await supabase.from('mhd_artikel').insert(payload).select().single()
      if(error){
        appFeedback('error')
        msgAt('erfassen','error', error.message)
        return setError(error.message)
      }
      if(newRow && (!itemsLimited || isVisibleInFastOverview(newRow))){
        setItems(prev => [...prev, newRow].sort((a,b) => String(a.mhd || '').localeCompare(String(b.mhd || ''))))
      }
    }
    setForm({ barcode:'', artikelnummer:'', name:'', kategorie:'Sonstiges', mhd:'', menge:'', bild_url:'' })
    msgAt('erfassen','success','✓ MHD-Eintrag gespeichert. Der Artikel wurde in die Übersicht übernommen.')
    setSuccess('✓ MHD-Eintrag gespeichert.')
    appFeedback('success')
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
      if(finalPayload.typ === 'kontrolle' || loadedTabs.writeoffs) setWriteoffs(prev => [{...finalPayload, id:crypto.randomUUID?.() || String(Date.now()), created_at:nowISO()}, ...prev])
    }
    setSuccess(`Abschrift gespeichert: ${finalPayload.name} · Menge ${finalPayload.menge}`)
    appFeedback('success')
    return true
  }

  async function writeOffArticle(item, amount, reason='MHD'){
    const qty = Math.max(0, Number(amount || 0))
    const cleanReason = ['MHD','Bruch','Eigenbedarf'].includes(reason) ? reason : 'MHD'

    let ok = true
    if(qty > 0){
      ok = await writeOff({ ...item, artikel_id:item.id, menge:qty, grund:cleanReason })
    }

    if(ok && db && item.id){
      const { error:deleteError } = await supabase.from('mhd_artikel').delete().eq('id', item.id)
      if(deleteError) return setError(deleteError.message)
      setItems(prev => prev.filter(x => x.id !== item.id))
    }else if(ok){
      setItems(prev => prev.filter(x => x.id !== item.id))
    }

    if(ok){
      setSuccess(qty > 0 ? 'Kontrolle gespeichert. Abschrift wurde erfasst und der Eintrag entfernt.' : 'Kontrolle gespeichert. Menge 0: keine Abschrift erstellt, Eintrag wurde entfernt.')
      appFeedback('success')
    }
  }

  async function markArticleCheckedZero(item){
    if(!confirm('Artikel kontrolliert mit Menge 0? Der Eintrag verschwindet aus der Übersicht und es wird keine Abschrift erstellt.')) return
    return writeOffArticle(item, 0, 'MHD')
  }


  async function quickMhdFromMaster(masterArticle){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    if(!masterArticle) return setError('Kein Artikel ausgewählt.')

    const articleName = masterArticle.name || masterArticle.artikel || masterArticle.artikelname || masterArticle.bezeichnung || masterArticle.barcode || 'Artikel'

    const rows = []
    let round = 1

    while(true){
      const mhd = prompt('MHD ' + round + ' für "' + articleName + '" eingeben (Format: JJJJ-MM-TT)')
      if(!mhd || !/^\d{4}-\d{2}-\d{2}$/.test(mhd)){
        if(rows.length === 0) return setError('Kein gültiges MHD eingetragen. Es wurde kein Eintrag erstellt.')
        break
      }

      rows.push({ mhd, menge:0 })

      const more = confirm('Weiteres MHD für "' + articleName + '" hinzufügen?')
      if(!more) break
      round++
    }

    if(rows.length === 0) return setError('Ohne MHD wurde kein Eintrag erstellt.')

    const duplicateDate = rows.find((row, index) => rows.findIndex(x => x.mhd === row.mhd) !== index)
    if(duplicateDate){ appFeedback('error'); return setError('Artikel wurde schon mit diesem Datum erfasst.') }

    const entries = rows.map(r => ({
      barcode: masterArticle.barcode || masterArticle.ean || '',
      artikelnummer: masterArticle.artikelnummer || masterArticle.nr || '',
      name: articleName,
      kategorie: masterArticle.kategorie || 'Sonstiges',
      mhd: r.mhd,
      menge: r.menge,
      bild_url: masterArticle.bild_url || masterArticle.image || masterArticle.bild || ''
    }))

    if(db){
      for(const entry of entries){
        const duplicate = await findDuplicateMhdEntry(entry)
        if(duplicate){ appFeedback('error'); return setError('Artikel wurde schon mit diesem Datum erfasst.') }
      }
      const { data:newRows, error } = await supabase.from('mhd_artikel').insert(entries).select()
      if(error) return setError(error.message || 'MHD-Einträge konnten nicht gespeichert werden.')
      const rowsToShow = (newRows || []).filter(r => !itemsLimited || isVisibleInFastOverview(r))
      if(rowsToShow.length) setItems(prev => [...prev, ...rowsToShow].sort((a,b) => String(a.mhd || '').localeCompare(String(b.mhd || ''))))
    }else{
      setItems(prev => [...entries.map(e => ({...e, id:crypto.randomUUID?.() || String(Date.now()+Math.random())})), ...prev])
    }

    setSuccess('✓ ' + entries.length + ' MHD-Eintrag/Einträge aus Artikelliste erstellt.')
    try{ msgAt?.('stammdaten','success','✓ ' + entries.length + ' MHD-Eintrag/Einträge erstellt und in der Übersicht gespeichert.') }catch{}
  }

  async function saveMasterArticle(data){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    const payload = {
      barcode:String(data.barcode || '').replace(/\D/g,''),
      artikelnummer:data.artikelnummer || '',
      name:data.name || data.artikel || '',
      kategorie:data.kategorie || 'Sonstiges',
      bild_url:data.bild_url || '',
      updated_at:nowISO()
    }
    // Wenn die Artikelliste im Schnellmodus ohne Bilddaten geladen wurde, beim Bearbeiten vorhandenes Bild nicht löschen.
    if(db && data.id && !payload.bild_url){
      try{
        const { data:oldArticle } = await supabase.from('artikel_stammdaten').select('bild_url').eq('id', data.id).maybeSingle()
        if(oldArticle?.bild_url) payload.bild_url = oldArticle.bild_url
      }catch(e){ console.warn('Bild-Erhalt konnte nicht geprüft werden:', e) }
    }
    if(!payload.barcode) return setError('EAN / Barcode fehlt.')
    if(!payload.name) return setError('Artikelname fehlt.')

    const duplicate = masterArticles.find(a => {
      if(data.id && a.id === data.id) return false
      const sameEan = payload.barcode && String(a.barcode || '') === payload.barcode
      const sameArtNr = payload.artikelnummer && String(a.artikelnummer || '').trim() === String(payload.artikelnummer).trim()
      return sameEan || sameArtNr
    })
    if(duplicate) return setError('Artikel existiert bereits: ' + (duplicate.name || duplicate.barcode))

    if(db){
      const { data:saved, error } = await supabase.from('artikel_stammdaten').upsert(payload, { onConflict:'barcode' }).select().single()
      if(error) return setError(error.message)
      setMasterArticles(prev => {
        const without = prev.filter(x => String(x.barcode || '') !== String(payload.barcode || ''))
        return [...without, saved || payload].sort((a,b) => String(a.name).localeCompare(String(b.name)))
      })
    }else{
      setMasterArticles(prev => {
        const without = prev.filter(x => x.barcode !== payload.barcode)
        return [...without, {...payload, id:payload.barcode}].sort((a,b) => String(a.name).localeCompare(String(b.name)))
      })
    }
    setSuccess('Artikel in Artikelliste gespeichert.')
    appFeedback('success')
  }

  async function deleteMasterArticle(article){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    if(!confirm('Artikel aus Artikelliste löschen? Bestehende MHD-Einträge bleiben erhalten.')) return
    if(db){
      const { error } = await supabase.from('artikel_stammdaten').delete().eq('id', article.id)
      if(error) return setError(error.message)
      setMasterArticles(prev => prev.filter(x => x.id !== article.id))
    }else{
      setMasterArticles(prev => prev.filter(x => x.id !== article.id))
    }
    setSuccess('Artikel aus Artikelliste gelöscht.')
    appFeedback('success')
  }


  async function deleteMhdEntry(item){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    const name = item?.name || item?.artikel || 'Artikel'
    if(!confirm('Diesen MHD-Eintrag wirklich aus der Übersicht löschen?\n\n' + name + '\n\nNur diesen erfassten MHD-Eintrag löschen, die Artikelliste bleibt unverändert.')) return

    if(db){
      const { error } = await supabase.from('mhd_artikel').delete().eq('id', item.id)
      if(error) return setError(error.message)
      setItems(prev => prev.filter(x => x.id !== item.id))
    }else{
      setItems(prev => prev.filter(x => x.id !== item.id))
    }
    setSuccess('MHD-Eintrag aus der Übersicht gelöscht.')
    appFeedback('success')
  }


  function normalizeBarcodeValue(v){
    return String(v || '').replace(/\D/g,'').trim()
  }

  function findMasterByBarcodeOrNumber(code){
    const c = normalizeBarcodeValue(code)
    if(!c) return null
    return (masterArticles || []).find(a =>
      normalizeBarcodeValue(a.barcode || a.ean) === c ||
      normalizeBarcodeValue(a.artikelnummer) === c ||
      normalizeBarcodeValue(a.nr) === c
    ) || null
  }

  function applyScannedArticle(code){
    const c = normalizeBarcodeValue(code)
    if(!c) return false
    const found = findMasterByBarcodeOrNumber(c)
    if(found){
      setForm(f => ({
        ...f,
        barcode: found.barcode || found.ean || c,
        artikelnummer: found.artikelnummer || found.nr || f.artikelnummer || '',
        name: found.name || found.artikel || found.artikelname || found.bezeichnung || f.name || '',
        kategorie: found.kategorie || f.kategorie || 'Sonstiges',
        bild_url: found.bild_url || found.image || found.bild || f.bild_url || ''
      }))
      setSuccess('✓ Artikel aus Artikelliste übernommen. Jetzt nur noch MHD eingeben.')
      try{ msgAt?.('erfassen','success','✓ Artikel aus Artikelliste übernommen. Jetzt nur noch MHD eingeben.') }catch{}
      return true
    }

    setForm(f => ({...f, barcode:c}))
    try{ msgAt?.('erfassen','warning','Artikel nicht gefunden. EAN wurde übernommen und kann weitergeleitet werden.') }catch{}
    return false
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
      bild_url:data.bild_url || ''
    }
    const { error } = await supabase.from('mhd_artikel').update(payload).eq('id', data.id)
    if(error) return setError(error.message)
    setEditArticle(null)
    setItems(prev => prev.map(x => x.id === data.id ? {...x, ...payload, id:data.id} : x).filter(x => !itemsLimited || isVisibleInFastOverview(x)))
    setSuccess('Artikel gespeichert.')
    appFeedback('success')
  }

  async function saveWriteoff(data){
    if(!isAdmin(user)) return setError('Nur Chef/Stationsleitung darf Abschriften ändern.')
    const payload = {
      artikelnummer:data.artikelnummer || '',
      artikel:data.name || data.artikel || 'Artikel',
      name:data.name || data.artikel || 'Artikel',
      grund:data.grund || 'MHD',
      menge:Number(data.menge || 1),
      datum:data.datum || todayISO(),
      status:'abgeschlossen'
    }
    const { error } = await supabase.from('abschriften').update(payload).eq('id', data.id)
    if(error) return setError(error.message)
    setEditWriteoff(null)
    setWriteoffs(prev => prev.map(x => x.id === data.id ? {...x, ...payload, id:data.id} : x))
    setSuccess('Abschrift gespeichert.')
    appFeedback('success')
  }

  async function deleteWriteoff(item){
    if(!isAdmin(user)) return setError('Nur Chef/Stationsleitung darf löschen.')
    if(!confirm('Abschrift löschen?')) return
    const { error } = await supabase.from('abschriften').delete().eq('id', item.id)
    if(error) return setError(error.message)
    setWriteoffs(prev => prev.filter(x => x.id !== item.id))
    setSuccess('Abschrift gelöscht.')
    appFeedback('success')
  }

  async function undoWriteoff(item){
    if(!isAdmin(user)) return setError('Nur Chef/Stationsleitung darf Abschriften rückgängig machen.')
    if(!confirm('Abschrift rückgängig machen und Bestand wiederherstellen?')) return

    const qty = Number(item.menge || 0)
    if(qty < 1) return setError('Keine gültige Menge zum Rückgängig machen.')

    const artikelNummer = item.artikelnummer || ''
    const barcode = item.barcode || ''
    let existing = null
    let restoredRow = null
    let updatedQty = null

    if(artikelNummer){
      const { data } = await supabase.from('mhd_artikel').select('*').eq('artikelnummer', artikelNummer).eq('mhd', item.mhd).maybeSingle()
      existing = data
    }

    if(!existing && barcode){
      const { data } = await supabase.from('mhd_artikel').select('*').eq('barcode', barcode).eq('mhd', item.mhd).maybeSingle()
      existing = data
    }

    if(existing){
      updatedQty = Number(existing.menge || 0) + qty
      const { error:updateError } = await supabase.from('mhd_artikel').update({ menge:updatedQty }).eq('id', existing.id)
      if(updateError) return setError(updateError.message)
    } else {
      const payload = {
        barcode: item.barcode || '',
        artikelnummer: item.artikelnummer || '',
        artikel: item.name || item.artikel || 'Artikel',
        name: item.name || item.artikel || 'Artikel',
        kategorie: item.kategorie || 'Sonstiges',
        mhd: item.mhd || todayISO(),
        menge: qty,
        bild_url: item.bild_url || '',
        mitarbeiter: user.name,
        erstellt_von: Number(user.nummer)
      }
      const { data:inserted, error:insertError } = await supabase.from('mhd_artikel').insert(payload).select().single()
      if(insertError) return setError(insertError.message)
      restoredRow = inserted || payload
    }

    const { error:deleteError } = await supabase.from('abschriften').delete().eq('id', item.id)
    if(deleteError) return setError(deleteError.message)

    setItems(prev => {
      let next = prev
      if(existing){
        next = prev.map(x => x.id === existing.id ? {...x, menge:updatedQty} : x)
      }else if(restoredRow){
        next = (!itemsLimited || isVisibleInFastOverview(restoredRow)) ? [...prev, restoredRow] : prev
      }
      return next.sort((a,b) => String(a.mhd || '').localeCompare(String(b.mhd || '')))
    })
    setWriteoffs(prev => prev.filter(x => x.id !== item.id))
    setSuccess('Abschrift rückgängig gemacht. Artikel ist wieder im Bestand.')
    appFeedback('success')
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
    setEmployees(prev => {
      const without = prev.filter(x => Number(x.nummer) !== Number(payload.nummer))
      return [...without, payload].sort((a,b) => Number(a.nummer)-Number(b.nummer))
    })
    setSuccess('Mitarbeiter gespeichert.')
    appFeedback('success')
  }

  async function deleteEmployee(emp){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    if(!confirm(`${emp.name} löschen?`)) return
    const { error } = await supabase.from('mitarbeiter').delete().eq('nummer', emp.nummer)
    if(error) return setError(error.message)
    setEmployees(prev => prev.filter(x => Number(x.nummer) !== Number(emp.nummer)))
    setSuccess('Mitarbeiter gelöscht.')
    appFeedback('success')
  }

  async function resetPassword(emp){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    const { error } = await supabase.from('mitarbeiter').update({ passwort:'0000', muss_passwort_aendern:true }).eq('nummer', emp.nummer)
    if(error) return setError(error.message)
    setEmployees(prev => prev.map(x => Number(x.nummer) === Number(emp.nummer) ? {...x, passwort:'0000', muss_passwort_aendern:true} : x))
    setSuccess(`Passwort für ${emp.name} auf 0000 zurückgesetzt.`)
    appFeedback('success')
  }

  async function enablePush(){
    if(!('Notification' in window)) return alert('Push wird auf diesem Gerät/Browser nicht unterstützt.')
    try{ await navigator.serviceWorker?.register('/sw.js') }catch{}
    const permission = await Notification.requestPermission()
    localStorage.setItem('mhd_push_permission_clicked', '1')
    if(permission !== 'granted'){
      alert('Benachrichtigungen wurden nicht erlaubt. Du kannst es später über den 🔔 Push-Button erneut versuchen. Wenn Android die Frage nicht mehr zeigt, bitte in den App-/Browser-Einstellungen Benachrichtigungen erlauben.')
      return
    }
    try{
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('MHD Kontrolle aktiviert', {
        body:'Benachrichtigungen sind aktiv.',
        icon:'/icon-192.png',
        badge:'/icon-192.png'
      })
    }catch{
      new Notification('MHD Kontrolle aktiviert', { body:'Benachrichtigungen sind aktiv.', icon:'/icon-192.png' })
    }
    setSuccess('Push-Benachrichtigungen sind aktiv.')
  }

  async function requestPushOnceAfterLogin(currentUser){
    try{
      if(!('Notification' in window)) return
      const key = `mhd_push_login_abfrage_${currentUser?.nummer || 'user'}`
      if(localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      if(Notification.permission === 'default'){
        setTimeout(() => enablePush(), 600)
      }
    }catch{}
  }

  const stats = useMemo(() => {
    const expiredItems = items.filter(i => daysUntil(i.mhd) <= 0)
    const urgentItems = items.filter(i => daysUntil(i.mhd) >= 1 && daysUntil(i.mhd) <= 3)
    const weekItems = items.filter(i => daysUntil(i.mhd) >= 1 && daysUntil(i.mhd) <= 7)
    const nextDue = [...weekItems].sort((a,b) => daysUntil(a.mhd) - daysUntil(b.mhd))[0]
    return {
      total:items.length,
      expired:expiredItems.length,
      urgent:urgentItems.length,
      week:weekItems.length,
      totalText: items.length === 1 ? '1 Artikel gesamt' : `${items.length} Artikel gesamt`,
      expiredText: expiredItems.length === 1 ? '1 Artikel abgelaufen' : `${expiredItems.length} Artikel abgelaufen`,
      urgentText: urgentItems.length === 1 ? '1 Artikel in 1-3 Tagen' : `${urgentItems.length} Artikel in 1-3 Tagen`,
      weekText: nextDue ? `${weekItems.length} Artikel · nächster in ${daysUntil(nextDue.mhd)} Tagen` : '0 Artikel',
      todayWriteoffs: writeoffs.filter(w => entryDateKey(w) === todayISO() && w.typ !== 'kontrolle').length,
      todayControls: writeoffs.filter(w => entryDateKey(w) === todayISO() && w.typ === 'kontrolle').length
    }
  }, [items])

  function openArticleFilter(filter){
    setArticleFilter(filter)
    setTab('artikel')
    window.scrollTo({top:0, behavior:'smooth'})
  }

  const filteredItems = useMemo(() => {
    if(articleFilter === 'expired') return items.filter(i => daysUntil(i.mhd) <= 0)
    if(articleFilter === 'urgent') return items.filter(i => daysUntil(i.mhd) >= 1 && daysUntil(i.mhd) <= 3)
    if(articleFilter === 'week') return items.filter(i => daysUntil(i.mhd) >= 1 && daysUntil(i.mhd) <= 7)
    return items
  }, [items, articleFilter])

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
    ['erfassen','Erfassen'],
    ['backwaren','Backwaren'],
    ...(isAdmin(user) ? [...(isAdmin(user) ? [['abschriften','Abschriften']] : []), ['kontrollen','Kontrollen']] : []),
    ...(isAdmin(user) ? [['artikel','Alle MHD'], ['stammdaten','Artikelliste'], ['fehlende','Fehlende Artikel'],] : []),
    ['dienstplan','Dienstplan'],
    ...(isAdmin(user) ? [['online','Online'], ['verwaltung','Verwaltung'], ['settings','Einstellungen']] : [])
  ]

  return <main className="app" onClickCapture={handleGlobalActionFeedback} onChangeCapture={handleGlobalActionFeedback}>
    <header className="topbar">
      <div>
        <p>MHD Kontrolle · {roleLabel(user.rolle)}</p>
        <h1>Hallo {user.name}</h1>
      </div>
      <div className="topActions">
        <button className="pushBtn" onClick={enablePush} title="Push-Benachrichtigungen aktivieren/testen">🔔 Push</button>
        <button className="logout" onClick={logout}>Logout</button>
      </div>
    </header>

    <section className="stats">
      <Stat label="Artikel" value={stats.totalText} tone="normal" onClick={() => openArticleFilter('all')}/>
      <Stat label="Abgelaufen" value={stats.expiredText} tone="expired" onClick={() => openArticleFilter('expired')}/>
      <Stat label="Bald" value={stats.urgentText} tone="urgent" onClick={() => openArticleFilter('urgent')}/>
      <Stat label="Woche" value={stats.weekText} tone="week" onClick={() => openArticleFilter('week')}/>
    </section>

    {isAdmin(user) && <section className="todayStats">
      <button onClick={() => setTab('abschriften')}>Heute ❌ Abschriften: <b>{stats.todayWriteoffs || 0}</b></button>
      <button onClick={() => setTab('kontrollen')}>Heute ✅ Kontrollen: <b>{stats.todayControls || 0}</b></button>
    </section>}

    <nav className="tabs">
      {tabs.map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setError(''); setTab(key) }}>{label}</button>)}
    </nav>

    {error && <div className="error">{error}</div>}
    {success && <div className="success" onClick={stopMhdOpenAlarm} title="Alarm stoppen">{success}</div>}

    {tab === 'artikel' && isAdmin(user) && <ArticleList items={filteredItems} allCount={items.length} articleFilter={articleFilter} setArticleFilter={setArticleFilter} itemsLimited={itemsLimited} allMhdLoaded={allMhdLoaded} loadAllItems={() => loadItems({all:true})} user={user} writeOffArticle={writeOffArticle} markArticleCheckedZero={markArticleCheckedZero} setEditArticle={setEditArticle} deleteMhdEntry={deleteMhdEntry} inlineMsg={inlineMsg} safeEditOverviewItem={safeEditOverviewItem}/>}
    {tab === 'dashboard' && <Dashboard safeEditOverviewItem={safeEditOverviewItem} items={items} setTab={setTab} user={user} writeOffArticle={writeOffArticle} markArticleCheckedZero={markArticleCheckedZero} setEditArticle={setEditArticle} deleteMhdEntry={deleteMhdEntry} inlineMsg={inlineMsg}/>}
    {tab === 'erfassen' && <Erfassen form={form} setForm={setForm} setScannerOpen={setScannerOpen} lookupBarcode={lookupBarcode} uploadFormImg={uploadFormImg} addItem={addItem} user={user} inlineMsg={inlineMsg} masterArticles={masterArticles} reportMissingArticle={reportMissingArticle}/>}
    {tab === 'backwaren' && <Backwaren backwaren={backwaren} saveBackwarenList={saveBackwarenList} writeOff={writeOff} user={user}/>}
    {tab === 'abschriften' && isAdmin(user) && <Abschriften writeoffs={writeoffs.filter(w => w.typ !== 'kontrolle')} user={user} setEditWriteoff={setEditWriteoff} deleteWriteoff={deleteWriteoff} undoWriteoff={undoWriteoff}/>}
    {tab === 'kontrollen' && isAdmin(user) && <Kontrollen controls={writeoffs.filter(w => w.typ === 'kontrolle')} user={user} deleteWriteoff={deleteWriteoff}/>}
    {tab === 'fehlende' && isAdmin(user) && <MissingArticles missingArticles={missingArticles} markMissingDone={markMissingDone}/>}    {tab === 'stammdaten' && isAdmin(user) && <MasterArticles quickMhdFromMaster={quickMhdFromMaster} masterArticles={masterArticles} saveMasterArticle={saveMasterArticle} deleteMasterArticle={deleteMasterArticle} setMasterScannerOpen={setMasterScannerOpen}/>}
    {tab === 'dienstplan' && <Dienstplan settings={settings} saveSetting={saveSetting} user={user}/>}
    {tab === 'online' && isAdmin(user) && <Online online={online}/>}
    {tab === 'verwaltung' && isAdmin(user) && <Verwaltung employees={employees} saveEmployee={saveEmployee} deleteEmployee={deleteEmployee} resetPassword={resetPassword}/>}
    {tab === 'settings' && isAdmin(user) && <Settings enablePush={enablePush}/>}

    {masterScannerOpen && <Scanner onClose={() => setMasterScannerOpen(false)} onDetected={(code) => { localStorage.setItem('mhd_master_scanned_ean', code); window.dispatchEvent(new CustomEvent('mhd-master-scan', {detail:code})); setMasterScannerOpen(false) }}/>} 
    {scannerOpen && <Scanner onClose={() => setScannerOpen(false)} onDetected={(code) => {
      const clean = String(code || '').replace(/\D/g,'')
      if(clean){
        setForm(f => ({...f, barcode:clean, artikelnummer:f.artikelnummer || clean}))
        window.dispatchEvent(new CustomEvent('mhd-scan-code', {detail:clean}))
        msgAt('erfassen','success','✓ Barcode übernommen. Artikelliste wird durchsucht...')
      }
      setScannerOpen(false)
    }}/>}
    {editArticle && <ArticleModal item={editArticle} close={() => setEditArticle(null)} save={saveArticle}/>}
    {editWriteoff && <WriteoffModal item={editWriteoff} close={() => setEditWriteoff(null)} save={saveWriteoff}/>}
  </main>
}


async function compressImageFile(file, maxSize = 360, quality = 0.55){
  if(!file || !file.type || !file.type.startsWith('image/')) return file
  try{
    const img = new Image()
    const url = URL.createObjectURL(file)
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = url
    })
    let w = img.width
    let h = img.height
    const scale = Math.min(1, maxSize / Math.max(w, h))
    w = Math.round(w * scale)
    h = Math.round(h * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if(!blob) return file
    return new File([blob], (file.name || 'bild') + '.jpg', { type:'image/jpeg' })
  }catch{
    return file
  }
}

function LazyArticleImage({src,alt='Artikelbild'}){
  const [show,setShow] = useState(false)
  if(!src) return <div className="lazyImgPlaceholder">📦</div>
  if(!show) return <button type="button" className="lazyImgButton" onClick={() => setShow(true)}>Bild anzeigen</button>
  return <img className="thumb" src={src} alt={alt} loading="lazy" decoding="async"/>
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

function Stat({label,value,onClick,tone='normal'}){ return <button className={'stat '+tone} onClick={onClick}><span>{label}</span><b>{value}</b></button> }

function Dashboard({items,setTab,user,writeOffArticle,markArticleCheckedZero,setEditArticle,deleteMhdEntry,safeEditOverviewItem}){
  return <section className="list">
    <button className="primary" onClick={() => { setTab('erfassen'); window.scrollTo({top:0, behavior:'smooth'}) }}>+ Schnell erfassen</button>
    {items.slice(0,8).map(item => <Article key={item.id} item={item} user={user} writeOffArticle={writeOffArticle} markArticleCheckedZero={markArticleCheckedZero} setEditArticle={setEditArticle} deleteMhdEntry={deleteMhdEntry}/>)}
  </section>
}

function ArticleList({items,allCount,articleFilter,setArticleFilter,itemsLimited,allMhdLoaded,loadAllItems,user,writeOffArticle,markArticleCheckedZero,setEditArticle,deleteMhdEntry,inlineMsg,safeEditOverviewItem}){
  const [search, setSearch] = useState('')
  const title = articleFilter === 'expired' ? 'Abgelaufene Artikel' : articleFilter === 'urgent' ? 'Bald ablaufende Artikel' : articleFilter === 'week' ? 'Artikel diese Woche' : 'Artikel'
  const term = search.trim().toLowerCase()
  const shownItems = term ? items.filter(item => {
    const hay = `${item.name || item.artikel || ''} ${item.artikelnummer || ''} ${item.barcode || ''}`.toLowerCase()
    return hay.includes(term) || String(item.name || item.artikel || '').toLowerCase().startsWith(term)
  }) : items
  return <section className="list">
    <div className="sectionHeader">
      <div>
        <h2>{title}</h2>
        <p className="filterInfo">{shownItems.length} von {items.length} angezeigt · {allCount} Artikeln · Chef/Stationsleitung kann hier Einträge bearbeiten oder löschen.</p>
      </div>
      {itemsLimited && <button className="ghostSmall" onClick={loadAllItems}>Alle MHD laden</button>}
      {articleFilter !== 'all' && <button className="ghostSmall" onClick={() => setArticleFilter('all')}>Filter zurücksetzen</button>}
    </div>
    <input className="realInput" placeholder="Artikel suchen: Name, Art.-Nr. oder EAN" value={search} onChange={e => setSearch(e.target.value)} />
    {shownItems.length === 0 && <div className="empty">Keine passenden Artikel vorhanden.</div>}
    {shownItems.map(item => <Article key={item.id} item={item} user={user} writeOffArticle={writeOffArticle} markArticleCheckedZero={markArticleCheckedZero} setEditArticle={setEditArticle} deleteMhdEntry={deleteMhdEntry} inlineMsg={inlineMsg}/>)}
  </section>
}

function Article({item,user,writeOffArticle,markArticleCheckedZero,setEditArticle,deleteMhdEntry}){
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('MHD')
  const days = daysUntil(item.mhd)

  function setSafeAmount(value){
    const cleaned = String(value || '').replace(/[^0-9]/g,'')
    setAmount(cleaned)
  }

  function step(delta){
    const current = Number(amount || 0)
    const next = Math.max(0, current + delta)
    setAmount(next ? String(next) : '')
  }

  const qty = Number(amount || 0)
  const stateClass = days <= 0 ? 'expiredArticle' : (days >= 1 && days <= 3 ? 'urgentArticle' : '')
  return <div className={'item articleItem ' + stateClass}>
    <div className="thumb"><LazyArticleImage src={item.bild_url} alt={item.name || item.artikel || 'Artikelbild'}/></div>
    <div className="grow">
      <b>{item.name || item.artikel}</b>
      <p>{item.artikelnummer ? `Art.-Nr. ${item.artikelnummer}` : ''}</p>
      <p>MHD {item.mhd ? new Date(item.mhd).toLocaleDateString('de-DE') : '-'} · {days <= 0 ? (days === 0 ? 'heute fällig' : `${Math.abs(days)} Tage drüber`) : `${days} Tage`}</p>
    </div>
    <div className="writeBox">
      <label className="smallLabel">Menge für Abschrift</label>
      <div className="stepper">
        <button onClick={() => step(-1)} disabled={qty <= 0}>−</button>
        <input
          className="qty"
          inputMode="numeric"
          type="number"
          min="0"
          value={amount}
          placeholder="0"
          onChange={e => setSafeAmount(e.target.value)}
        />
        <button onClick={() => step(1)}>+</button>
      </div>
      <label className="smallLabel">Grund</label>
      <select className="realInput" value={reason} onChange={e => setReason(e.target.value)}>
        <option value="MHD">MHD</option>
        <option value="Bruch">Bruch</option>
        <option value="Eigenbedarf">Eigenbedarf</option>
      </select>
      <div className="actions">
        {isAdmin(user) && <button onClick={() => setEditArticle(item)}>Bearbeiten</button>}
        {isAdmin(user) && <button className="danger" onClick={() => deleteMhdEntry(item)}>Löschen</button>}
        <button onClick={() => writeOffArticle(item, qty, reason)} title="Kontrolle speichern: Menge 0 entfernt nur den Eintrag, Menge größer 0 erstellt eine Abschrift">Kontrolle speichern</button>
      </div>
    </div>
  </div>
}


function Erfassen({form,setForm,setScannerOpen,lookupBarcode,uploadFormImg,addItem,user,inlineMsg,masterArticles=[],reportMissingArticle}){
  const [searchTerm, setSearchTerm] = useState('')
  const [searchMsg, setSearchMsg] = useState(null)
  const [missingMode, setMissingMode] = useState(false)
  const [missingDialog, setMissingDialog] = useState({ open:false, ean:'', name:'' })

  function übernehmen(article){
    if(!article) return false
    setForm(f => ({
      ...f,
      barcode: article.barcode || '',
      artikelnummer: article.artikelnummer || '',
      name: article.name || '',
      kategorie: article.kategorie || 'Sonstiges',
      bild_url: article.bild_url || '',
      mhd: f.mhd || '',
      menge: ''
    }))
    setMissingMode(false)
    appFeedback('click')
    setSearchMsg({type:'success', text:'✓ Artikel gefunden: ' + (article.name || article.barcode)})
    return true
  }

  function suche(value){
    const term = String(value || '').trim()
    if(!term) return false

    const found = masterArticles.find(a =>
      String(a.artikelnummer || '').trim() === term ||
      String(a.barcode || '').trim() === term
    )

    if(found) return übernehmen(found)

    appFeedback('warning')
    setMissingMode(true)
    const clean = term.replace(/\D/g,'')
    if(clean){
      setForm(f => ({...f, barcode:f.barcode || clean, artikelnummer:f.artikelnummer || clean}))
      setMissingDialog({ open:true, ean:clean, name:'' })
    }
    setSearchMsg({type:'warning', text:'Artikel nicht in Artikelliste gefunden. Bitte Namen eingeben und als fehlenden Artikel melden.'})
    return false
  }

  function handleSearch(value){
    setSearchTerm(value)
    const term = String(value || '').trim()
    if(term.length >= 3) suche(term)
  }

  function handleBarcode(value){
    const clean = String(value || '').replace(/\D/g,'')
    setForm(f => ({...f, barcode:clean, artikelnummer:f.artikelnummer || clean}))
    if(clean.length >= 8) suche(clean)
  }

  useEffect(() => {
    function onScan(e){
      const code = String(e.detail || '').replace(/\D/g,'')
      if(code){
        setSearchTerm(code)
        setForm(f => ({...f, barcode:code, artikelnummer:f.artikelnummer || code}))
        setTimeout(() => suche(code), 50)
      }
    }
    window.addEventListener('mhd-scan-code', onScan)
    return () => window.removeEventListener('mhd-scan-code', onScan)
  }, [masterArticles])

  async function meldenFehlendenArtikel(eanOverride, nameOverride){
    const clean = String(eanOverride || form.barcode || searchTerm || '').replace(/\D/g,'')
    const name = String(nameOverride || form.name || '').trim()
    if(!clean){ appFeedback('error'); setSearchMsg({type:'error', text:'Bitte erst EAN scannen oder eingeben.'}); return }
    if(!name){ appFeedback('error'); setSearchMsg({type:'error', text:'Bitte Artikelnamen eingeben.'}); return }
    await reportMissingArticle?.(clean, 'EAN wurde beim Erfassen gescannt, aber nicht in der Artikelliste gefunden.', name)
    setSearchMsg({type:'success', text:'✓ Fehlender Artikel wurde an Chef/Stationsleitung gemeldet.'})
    setForm(f => ({...f, barcode:'', artikelnummer:'', name:''}))
    setSearchTerm('')
    setMissingMode(false)
    setMissingDialog({ open:false, ean:'', name:'' })
    appFeedback('success')
  }

  function closeMissingDialog(){
    setMissingDialog({ open:false, ean:'', name:'' })
  }

  const nameReadOnly = !isAdmin(user) && !missingMode

  return <section className="formCard">
    <h2>Artikel erfassen</h2>

    {missingDialog.open && <div className="modalOverlay">
      <div className="modalCard missingArticleDialog">
        <h2>Artikel nicht gefunden</h2>
        <div className="submitHint">Diese EAN ist nicht in der Artikelliste. Bitte Artikelnamen eingeben und an Chef/Stationsleitung melden.</div>
        <label>EAN / Barcode</label>
        <input className="realInput" value={missingDialog.ean} readOnly />
        <label>Artikelname</label>
        <input
          className="realInput"
          autoFocus
          placeholder="Name des Artikels eingeben"
          value={missingDialog.name}
          onChange={e => setMissingDialog(d => ({...d, name:e.target.value}))}
          onKeyDown={e => { if(e.key === 'Enter'){ e.preventDefault(); meldenFehlendenArtikel(missingDialog.ean, missingDialog.name) } }}
        />
        <div className="modalActions">
          <button className="ghostSmall" type="button" onClick={closeMissingDialog}>Abbrechen</button>
          <button type="button" onClick={() => meldenFehlendenArtikel(missingDialog.ean, missingDialog.name)}>An fehlende Artikel senden</button>
        </div>
      </div>
    </div>}

    <button className="scannerButton" type="button" onClick={() => setScannerOpen(true)}>📷 Barcode scannen</button>

    <label>Artikelnummer oder EAN suchen</label>
    <input
      className="realInput"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="Artikelnummer oder EAN"
      value={searchTerm}
      onChange={e => handleSearch(e.target.value)}
      onKeyDown={e => { if(e.key === 'Enter'){ e.preventDefault(); suche(searchTerm) } }}
    />
    <InlineFeedback msg={searchMsg}/>

    <label>Artikel aus Artikelliste</label>
    <select
      className="realInput"
      value={form.barcode || ''}
      onChange={e => {
        const found = masterArticles.find(a => String(a.barcode || '') === String(e.target.value || ''))
        übernehmen(found)
      }}
    >
      <option value="">Artikel auswählen...</option>
      {masterArticles.map(a => <option key={a.id || a.barcode} value={a.barcode}>{a.name || a.barcode} · {a.artikelnummer || a.barcode}</option>)}
    </select>

    <label>EAN / Barcode</label>
    <input
      className="realInput"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="EAN / Barcode"
      value={form.barcode || ''}
      onChange={e => handleBarcode(e.target.value)}
    />

    <label>Artikelnummer</label>
    <input
      className="realInput"
      placeholder="wird aus Artikelliste übernommen"
      value={form.artikelnummer || ''}
      readOnly={!isAdmin(user)}
      onChange={e => setForm({...form, artikelnummer:e.target.value})}
    />

    <label>Artikelname</label>
    <input
      className="realInput"
      placeholder={missingMode ? 'Name für fehlenden Artikel eingeben' : 'wird aus Artikelliste übernommen'}
      value={form.name || ''}
      readOnly={nameReadOnly}
      onChange={e => setForm({...form, name:e.target.value})}
    />



    <label>MHD</label>
    <div className="mhdInputRow">
      <input
        className="realInput"
        type="text"
        inputMode="numeric"
        placeholder="TT.MM.JJJJ"
        value={toGermanDate(form.mhd || '')}
        onChange={e => setForm({...form, mhd:e.target.value})}
        onBlur={e => {
          const iso = normalizeMhdInput(e.target.value)
          if(iso) setForm({...form, mhd:iso})
        }}
      />
      <input
        className="realInput calendarInput"
        type="date"
        aria-label="MHD per Kalender auswählen"
        value={normalizeMhdInput(form.mhd) || ''}
        onChange={e => setForm({...form, mhd:e.target.value})}
      />
    </div>

    {isAdmin(user) && <label className="upload">Bild/Screenshot hochladen<input type="file" accept="image/*" onChange={uploadFormImg}/></label>}
    {form.bild_url && <img className="preview" src={form.bild_url} loading="lazy" decoding="async"/>}
    <InlineFeedback msg={inlineMsg?.erfassen}/>
    <button className="primary" onClick={addItem}>Speichern</button>
  </section>
}

function Backwaren({backwaren,saveBackwarenList,writeOff,user}){
  const [qty, setQty] = useState({})
  const [newItem, setNewItem] = useState({ artikelnummer:'', name:'' })
  const [sending, setSending] = useState(false)
  const [specialOpen, setSpecialOpen] = useState(false)
  const [special, setSpecial] = useState({ artikelnummer:'', menge:'', grund:'MHD' })

  const entries = backwaren.map(b => ({...b, menge:Number(qty[b.artikelnummer] || 0)})).filter(b => b.menge > 0)
  const total = entries.reduce((sum, b) => sum + b.menge, 0)

  function step(num, delta){
    const next = Math.max(0, Number(qty[num] || 0) + delta)
    setQty({...qty, [num]: next ? String(next) : ''})
  }

  async function submit(){
    if(!entries.length){ appFeedback('error'); return alert('Bitte erst Mengen eintragen.') }
    setSending(true)
    for(const entry of entries){
      await writeOff({ artikelnummer:entry.artikelnummer, name:entry.name, kategorie:'🥐 Backwaren', mhd:todayISO(), menge:entry.menge, grund:'Backwaren Tagesende' })
    }
    setQty({})
    setSending(false)
  }

  async function submitSpecial(){
    const found = backwaren.find(b => String(b.artikelnummer) === String(special.artikelnummer))
    const amount = Number(special.menge || 0)
    if(!found){ appFeedback('error'); return alert('Bitte Backware auswählen.') }
    if(amount < 1){ appFeedback('error'); return alert('Bitte Menge eingeben.') }
    const grund = special.grund === 'Bruch' ? 'Backwaren Bruch' : 'Backwaren MHD'
    setSending(true)
    await writeOff({ artikelnummer:found.artikelnummer, name:found.name, kategorie:'🥐 Backwaren', mhd:todayISO(), menge:amount, grund })
    setSpecial({ artikelnummer:'', menge:'', grund:'MHD' })
    setSpecialOpen(false)
    setSending(false)
  }

  function addBackware(){
    if(!newItem.artikelnummer || !newItem.name){ appFeedback('error'); return }
    if(backwaren.some(b => String(b.artikelnummer) === String(newItem.artikelnummer))){ appFeedback('error'); return alert('Diese Artikelnummer ist schon in der Backwarenliste.') }
    saveBackwarenList([...backwaren, { artikelnummer:newItem.artikelnummer, name:newItem.name }])
    setNewItem({ artikelnummer:'', name:'' })
  }

  function deleteBackware(num){
    if(!window.confirm('Backwaren-Eintrag wirklich löschen? Bestehende Abschriften bleiben erhalten.')) return
    saveBackwarenList(backwaren.filter(b => b.artikelnummer !== num))
  }

  function editBackware(item){
    const oldNum = String(item.artikelnummer || '')
    const nextNum = prompt('Artikelnummer bearbeiten', oldNum)
    if(nextNum === null) return
    const cleanNum = String(nextNum || '').trim()
    const nextName = prompt('Name bearbeiten', item.name || '')
    if(nextName === null) return
    const cleanName = String(nextName || '').trim()
    if(!cleanNum || !cleanName){ appFeedback('error'); return alert('Artikelnummer und Name dürfen nicht leer sein.') }
    if(cleanNum !== oldNum && backwaren.some(b => String(b.artikelnummer) === cleanNum)){ appFeedback('error'); return alert('Diese Artikelnummer ist schon in der Backwarenliste.') }
    saveBackwarenList(backwaren.map(b => String(b.artikelnummer) === oldNum ? { ...b, artikelnummer:cleanNum, name:cleanName } : b))
    setQty(q => {
      if(cleanNum === oldNum) return q
      const next = {...q}
      if(next[oldNum] !== undefined){ next[cleanNum] = next[oldNum]; delete next[oldNum] }
      return next
    })
  }

  return <section className="list backwarenPage">
    <div className="stickySubmit">
      <div><h2>Backwaren Tagesende</h2><p>{entries.length} Positionen · {total} Stück</p></div>
      <button disabled={!entries.length || sending} onClick={submit}>{sending ? 'Speichern...' : 'Alles absenden'}</button>
    </div>
    <div className="submitHint">Tagesende ist die normale Backwaren-Abschrift. MHD und Bruch findest du unter „Sonderabschrift“.</div>

    <button className="ghostSmall" onClick={() => setSpecialOpen(!specialOpen)}>{specialOpen ? 'Sonderabschrift schließen' : '➕ Sonderabschrift MHD / Bruch'}</button>

    {specialOpen && <div className="adminBox specialBox">
      <h3>Backwaren Sonderabschrift</h3>
      <label>Grund</label>
      <select className="realInput" value={special.grund} onChange={e => setSpecial({...special, grund:e.target.value})}>
        <option value="MHD">MHD</option>
        <option value="Bruch">Bruch</option>
      </select>
      <label>Backware</label>
      <select className="realInput" value={special.artikelnummer} onChange={e => setSpecial({...special, artikelnummer:e.target.value})}>
        <option value="">Backware auswählen...</option>
        {backwaren.map(b => <option key={b.artikelnummer} value={b.artikelnummer}>{b.name} · {b.artikelnummer}</option>)}
      </select>
      <label>Menge</label>
      <input className="realInput" inputMode="numeric" type="number" min="0" value={special.menge} onChange={e => setSpecial({...special, menge:e.target.value.replace(/\D/g,'')})} placeholder="0"/>
      <button className="primary" disabled={sending} onClick={submitSpecial}>{sending ? 'Speichern...' : 'Sonderabschrift speichern'}</button>
    </div>}

    {isAdmin(user) && <div className="adminBox">
      <h3>Backwarenliste erweitern</h3>
      <input placeholder="Artikelnummer" value={newItem.artikelnummer} onChange={e => setNewItem({...newItem, artikelnummer:e.target.value})}/>
      <input placeholder="Name" value={newItem.name} onChange={e => setNewItem({...newItem, name:e.target.value})}/>
      <button onClick={addBackware}>Backware hinzufügen</button>
    </div>}

    {backwaren.map(b => <div className={'item bakery ' + (Number(qty[b.artikelnummer] || 0) > 0 ? 'selectedBakery' : '')} key={b.artikelnummer}>
      <div className="artikelnummer">{b.artikelnummer}</div>
      <div className="grow"><b>{b.name}</b><p>Artikelnummer {b.artikelnummer}</p>{isAdmin(user) && <button className="ghostSmall" onClick={() => editBackware(b)}>Bearbeiten</button>} {isAdmin(user) && <button className="ghostSmall" onClick={() => deleteBackware(b.artikelnummer)}>Löschen</button>}</div>
      <div className="stepper">
        <button onClick={() => step(b.artikelnummer, -1)}>−</button>
        <input className="qty" inputMode="numeric" value={qty[b.artikelnummer] || ''} onChange={e => setQty({...qty, [b.artikelnummer]:e.target.value.replace(/\D/g,'')})} placeholder="0"/>
        <button onClick={() => step(b.artikelnummer, 1)}>+</button>
      </div>
    </div>)}

    <button className="fixedSubmit" disabled={!entries.length || sending} onClick={submit}>{sending ? 'Speichern...' : `Backwaren Tagesende absenden (${total})`}</button>
  </section>
}

function Abschriften({writeoffs,user,setEditWriteoff,deleteWriteoff,undoWriteoff}){
  const groups = groupByDay(writeoffs)
  const [openDay, setOpenDay] = useState(groups[0]?.[0] || '')

  return <section className="list">
    <div className="sectionHeader">
      <h2>Abschriften</h2>
    </div>
    {groups.length === 0 && <div className="empty">Keine Abschriften vorhanden.</div>}

    {groups.map(([day, entries]) => <div className="dayGroup" key={day}>
      <button className="dayHeader" onClick={() => setOpenDay(openDay === day ? '' : day)}>
        <span>📅 {formatDateDE(day)}</span>
        <b>❌ {entries.length} Abschriften</b>
      </button>

      {openDay === day && <div className="dayContent">
        <button className="pdfButton" onClick={() => exportAbschriftenPDF(entries, 'Abschriften', day)}>PDF-Liste speichern</button>
        {entries.map(w => <div className="item" key={w.id}>
          <div className="artikelnummer small">{w.artikelnummer || 'MHD'}</div>
          <div className="grow"><b>❌ Abschrift – {w.name || w.artikel}</b><p>{w.grund} · {w.menge} Stk. · {w.mitarbeiter} · {new Date(w.datum || w.created_at).toLocaleDateString('de-DE')}</p></div>
          {isAdmin(user) && <div className="actions">
            <button onClick={() => setEditWriteoff(w)}>Bearbeiten</button>
            <button onClick={() => undoWriteoff(w)}>Rückgängig</button>
            <button onClick={() => deleteWriteoff(w)}>Löschen</button>
          </div>}
        </div>)}
      </div>}
    </div>)}
  </section>
}

function Kontrollen({controls,user,deleteWriteoff}){
  const groups = groupByDay(controls)
  const [openDay, setOpenDay] = useState(groups[0]?.[0] || '')

  return <section className="list">
    <div className="sectionHeader">
      <h2>Kontrollen</h2>
    </div>
    {groups.length === 0 && <div className="empty">Keine Kontrollen vorhanden.</div>}

    {groups.map(([day, entries]) => <div className="dayGroup" key={day}>
      <button className="dayHeader control" onClick={() => setOpenDay(openDay === day ? '' : day)}>
        <span>📅 {formatDateDE(day)}</span>
        <b>✅ {entries.length} Kontrollen</b>
      </button>

      {openDay === day && <div className="dayContent">
        <button className="pdfButton" onClick={() => exportAbschriftenPDF(entries, 'Kontrollen', day)}>PDF-Liste speichern</button>
        {entries.map(w => <div className="item kontrolleItem" key={w.id}>
          <div className="artikelnummer small">OK</div>
          <div className="grow"><b>✅ Kontrolliert – {w.name || w.artikel}</b><p>Bestand war 0 · keine Abschrift · {w.mitarbeiter} · {new Date(w.datum || w.created_at).toLocaleDateString('de-DE')}</p></div>
          {isAdmin(user) && <div className="actions">
            <button onClick={() => deleteWriteoff(w)}>Löschen</button>
          </div>}
        </div>)}
      </div>}
    </div>)}
  </section>
}


function MissingArticles({missingArticles,markMissingDone}){
  const open = missingArticles.filter(x => x.status !== 'erledigt')
  return <section className="formCard">
    <h2>Fehlende Artikel</h2>
    <p className="hint">Hier landen EANs, die Mitarbeiter gescannt haben, aber nicht in der Artikelliste vorhanden sind. Chef/Stationsleitung kann sie danach in der Artikelliste einpflegen oder den Vorschlag löschen.</p>
    {open.length === 0 && <div className="empty">Keine fehlenden Artikel vorhanden.</div>}
    {open.map(row => <div className="item" key={row.id || row.barcode}>
      <div className="artikelnummer small">EAN</div>
      <div className="grow">
        <b>{row.barcode}</b>
        <p>{row.hinweis || 'Nicht in Artikelliste gefunden'} · {row.gemeldet_von || '-'} · {row.created_at ? new Date(row.created_at).toLocaleDateString('de-DE') : ''}</p>
      </div>
      <div className="actions">
        <button onClick={() => navigator.clipboard?.writeText(row.barcode)}>EAN kopieren</button>
        <button onClick={() => markMissingDone(row)}>Vorschlag löschen</button>
      </div>
    </div>)}
  </section>
}

function MasterArticles({masterArticles,saveMasterArticle,deleteMasterArticle,setMasterScannerOpen,quickMhdFromMaster}){
  const empty = { barcode:'', artikelnummer:'', name:'', kategorie:'Sonstiges', bild_url:'' }
  const [data,setData] = useState(empty)
  const [msg,setMsg] = useState(null)
  const [articleSearch, setArticleSearch] = useState('')
  const filteredMasterArticles = useMemo(() => {
    const term = articleSearch.trim().toLowerCase()
    if(!term) return masterArticles
    return masterArticles.filter(a => `${a.name || ''} ${a.artikelnummer || ''} ${a.barcode || ''}`.toLowerCase().includes(term) || String(a.name || '').toLowerCase().startsWith(term))
  }, [masterArticles, articleSearch])

  function findExistingMaster(ean = data.barcode, artNr = data.artikelnummer){
    const cleanEan = String(ean || '').replace(/\D/g,'')
    const cleanArtNr = String(artNr || '').trim()
    return masterArticles.find(a => {
      if(data.id && a.id === data.id) return false
      const sameEan = cleanEan && String(a.barcode || '') === cleanEan
      const sameArtNr = cleanArtNr && String(a.artikelnummer || '').trim() === cleanArtNr
      return sameEan || sameArtNr
    })
  }

  useEffect(() => {
    function handler(e){
      const code = String(e.detail || localStorage.getItem('mhd_master_scanned_ean') || '').replace(/\D/g,'')
      if(!code) return
      const existing = findExistingMaster(code, '')
      if(existing){
        setData({
          id:existing.id,
          barcode:existing.barcode || code,
          artikelnummer:existing.artikelnummer || '',
          name:existing.name || '',
          bild_url:existing.bild_url || ''
        })
        setMsg({type:'warning', text:'⚠ Artikel existiert bereits: ' + (existing.name || existing.barcode)})
        return
      }
      setData(prev => ({...prev, barcode:code}))
      setMsg({type:'success', text:'✓ EAN gescannt: ' + code + ' – Suche läuft...'})
      lookupMasterArticle(code)
    }
    window.addEventListener('mhd-master-scan', handler)
    return () => window.removeEventListener('mhd-master-scan', handler)
  }, [])

  async function upload(e){
    const file = await compressImageFile(e.target.files?.[0])
    if(!file) return
    setData({...data, bild_url:await fileToDataUrl(file)})
    setMsg({type:'success', text:'✓ Bild übernommen. Speichern nicht vergessen.'})
  }

  async function removeBg(){
    if(!data.bild_url){
      setMsg({type:'warning', text:'Bitte erst ein Bild hochladen oder automatisch übernehmen.'})
      return
    }
    try{
      setMsg({type:'warning', text:'Bild wird freigestellt...'})
      const cleaned = await removeImageBackground(data.bild_url)
      setData({...data, bild_url:cleaned})
      setMsg({type:'success', text:'✓ Hintergrund entfernt. Speichern nicht vergessen.'})
    }catch(e){
      setMsg({type:'error', text:'Freistellen nicht möglich. Bitte Foto vor hellem Hintergrund versuchen.'})
    }
  }

  async function lookupMasterArticle(code = data.barcode){
    const ean = String(code || '').replace(/\D/g,'')
    if(!ean){
      setMsg({type:'error', text:'Bitte erst EAN scannen oder eingeben.'})
      return
    }

    const existing = findExistingMaster(ean, data.artikelnummer)
    if(existing){
      setData({
        id:existing.id,
        barcode:existing.barcode || ean,
        artikelnummer:existing.artikelnummer || '',
        name:existing.name || '',
        bild_url:existing.bild_url || ''
      })
      setMsg({type:'warning', text:'⚠ Artikel existiert bereits: ' + (existing.name || existing.barcode)})
      return
    }

    setMsg({type:'warning', text:'Suche Artikelname und Bild im Internet...'})
    const result = await openFoodFacts(ean)

    if(!result){
      setData(prev => ({...prev, barcode:ean}))
      setMsg({type:'warning', text:'Kein Produkt gefunden. Bitte Name und Bild manuell eintragen.'})
      return
    }

    setData(prev => ({
      ...prev,
      barcode:ean,
      artikelnummer: prev.artikelnummer || '',
      name: result.name || prev.name,
      bild_url: result.bild_url || prev.bild_url
    }))

    setMsg({type:'success', text: result.bild_url ? '✓ Artikelname und Bild gefunden.' : '✓ Artikelname gefunden, kein Bild vorhanden.'})
  }

  function edit(a){
    setData({
      id:a.id,
      barcode:a.barcode || '',
      artikelnummer:a.artikelnummer || '',
      name:a.name || '',
      kategorie:a.kategorie || 'Sonstiges',
      bild_url:a.bild_url || ''
    })
    window.scrollTo({top:0, behavior:'smooth'})
  }

  async function save(){
    const existing = findExistingMaster(data.barcode, data.artikelnummer)
    if(existing){
      setMsg({type:'warning', text:'⚠ Artikel existiert bereits: ' + (existing.name || existing.barcode) + '. Zum Ändern wurde er geöffnet.'})
      setData({
        id:existing.id,
        barcode:existing.barcode || '',
        artikelnummer:existing.artikelnummer || '',
        name:existing.name || '',
        bild_url:existing.bild_url || ''
      })
      return
    }
    await saveMasterArticle(data)
    setData(empty)
    setMsg({type:'success', text:'✓ Artikel gespeichert.'})
  }

  return <section className="formCard">
    <h2>Artikelliste</h2><div className="hint"><b>MHD direkt aus der Artikelliste:</b> Artikel scannen oder auswählen, dann bei Chef/Stationsleitung über „MHD erfassen“ MHD eintragen. Über „Weiteres MHD hinzufügen“ können mehrere MHD-Datensätze für denselben Artikel erstellt werden. Ohne MHD wird kein Eintrag erstellt.</div>
    <p className="hint">Chef/Stationsleitung pflegt hier die festen Artikeldaten. Mitarbeiter müssen beim Erfassen danach nur MHD eingeben.</p>

    <button className="scannerButton" type="button" onClick={() => setMasterScannerOpen(true)}>📷 EAN scannen</button>

    <label>EAN / Barcode</label>
    <input placeholder="EAN / Barcode" value={data.barcode} onChange={e => setData({...data, barcode:e.target.value.replace(/\D/g,'')})}/>
    <button type="button" onClick={() => lookupMasterArticle()}>🔎 Name/Bild suchen</button>

    <label>Artikelnummer</label>
    <input placeholder="Interne Artikelnummer" value={data.artikelnummer} onChange={e => setData({...data, artikelnummer:e.target.value})}/>

    <label>Artikelname</label>
    <input placeholder="Artikelname" value={data.name} onChange={e => setData({...data, name:e.target.value})}/>

    
    

    <label>Bild</label>
    <input placeholder="Bild URL oder Upload nutzen" value={data.bild_url} onChange={e => setData({...data, bild_url:e.target.value})}/>
    <label className="upload">Bild hochladen<input type="file" accept="image/*" onChange={upload}/></label>
    {data.bild_url && <button type="button" onClick={removeArticleBg}>✂️ Bild freistellen</button>}
    {data.bild_url && <img className="preview transparentPreview" src={data.bild_url}/>}    
    <InlineFeedback msg={msg}/>
    <button className="primary" onClick={save}>{data.id ? 'Änderung speichern' : 'Artikel anlegen'}</button>
    {data.id && <button onClick={() => setData(empty)}>Neu anlegen</button>}

    <h3>Gespeicherte Artikel</h3>
    {masterArticles.length === 0 && <div className="empty">Noch keine Artikel in der Artikelliste.</div>}
    <input className="realInput" placeholder="Artikel suchen: Name, Artikelnummer oder EAN" value={articleSearch} onChange={e => setArticleSearch(e.target.value)} />
    {filteredMasterArticles.map(a => <div className="item" key={a.id || a.barcode}>
      <div className="thumb">{a.bild_url ? <img src={a.bild_url}/> : '📦'}</div>
      <div className="grow"><b>{a.name}</b><p>Art.-Nr. {a.artikelnummer || '-'} · EAN {a.barcode}</p></div>
      <div className="actions">
        <button onClick={() => edit(a)}>Bearbeiten</button><button type="button" onClick={() => quickMhdFromMaster?.(a)}>MHD erfassen</button>
        <button onClick={() => deleteMasterArticle(a)}>Löschen</button>
      </div>
    </div>)}
  </section>
}

function Bilder({items,reload}){
  async function upload(item,e){
    const file = await compressImageFile(e.target.files?.[0])
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
    const file = await compressImageFile(e.target.files?.[0])
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
  const [localMsg,setLocalMsg] = useState(null)

  async function upload(e){
    const file = await compressImageFile(e.target.files?.[0])
    if(!file) return
    setData({...data, bild_url:await fileToDataUrl(file)})
    setLocalMsg({type:'success', text:'✓ Bild übernommen. Bitte Speichern drücken.'})
  }

  async function removeArticleBg(){
    if(!data.bild_url){
      setLocalMsg({type:'warning', text:'Bitte erst ein Bild hochladen.'})
      return
    }
    try{
      setLocalMsg({type:'warning', text:'Bild wird freigestellt...'})
      const cleaned = await removeImageBackground(data.bild_url)
      setData({...data, bild_url:cleaned})
      setLocalMsg({type:'success', text:'✓ Hintergrund entfernt. Bitte Speichern drücken.'})
    }catch(e){
      setLocalMsg({type:'error', text:'Freistellen nicht möglich. Bitte Foto vor hellem Hintergrund versuchen.'})
    }
  }

  function saveNow(){
    if(!data.name && !data.artikel){
      setLocalMsg({type:'error', text:'Artikelname fehlt.'})
      return
    }
    if(!data.mhd){
      setLocalMsg({type:'error', text:'MHD fehlt.'})
      return
    }
    save(data)
  }

  return <div className="modalOverlay"><div className="modalCard">
    <h2>Artikel bearbeiten</h2>

    <label>Artikelnummer</label>
    <input placeholder="z. B. interne Artikelnummer" value={data.artikelnummer || ''} onChange={e => setData({...data, artikelnummer:e.target.value})}/>

    <label>Artikelname</label>
    <input placeholder="Artikelname" value={data.name || data.artikel || ''} onChange={e => setData({...data, name:e.target.value})}/>

    
    

    <label>MHD</label>
    <input type="date" value={data.mhd || todayISO()} onChange={e => setData({...data, mhd:e.target.value})}/>

    <label>EAN / Barcode</label>
    <input placeholder="EAN / Barcode" value={data.barcode || ''} onChange={e => setData({...data, barcode:e.target.value.replace(/\D/g,'')})}/>

    <label className="upload">Bild hochladen<input type="file" accept="image/*" onChange={upload}/></label>
    {data.bild_url && <button type="button" onClick={removeArticleBg}>✂️ Bild freistellen</button>}
    {data.bild_url && <img className="preview transparentPreview" src={data.bild_url}/>}
    <InlineFeedback msg={localMsg}/>

    <div className="modalActions"><button onClick={close}>Abbrechen</button><button onClick={saveNow}>Speichern</button></div>
  </div></div>
}

function WriteoffModal({item,close,save}){
  const [data,setData] = useState({...item})
  return <div className="modalOverlay"><div className="modalCard">
    <h2>Abschrift bearbeiten</h2>
    <input value={data.artikelnummer || ''} onChange={e => setData({...data, artikelnummer:e.target.value})}/>
    <input value={data.name || data.artikel || ''} onChange={e => setData({...data, name:e.target.value})}/>
    <label>Grund</label>
    <select value={data.grund || 'MHD'} onChange={e => setData({...data, grund:e.target.value})}>
      <option value="MHD">MHD</option>
      <option value="Bruch">Bruch</option>
      <option value="Eigenbedarf">Eigenbedarf</option>
    </select>
    <label>Menge</label>
    <input type="number" min="1" value={data.menge || 1} onChange={e => setData({...data, menge:e.target.value})}/>
    <input type="date" value={(data.datum || todayISO()).slice(0,10)} onChange={e => setData({...data, datum:e.target.value})}/>
    <div className="modalActions"><button onClick={close}>Abbrechen</button><button onClick={() => save(data)}>Speichern</button></div>
  </div></div>
}

function Scanner({onClose,onDetected}){
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [manual, setManual] = useState('')
  const [message, setMessage] = useState('Kamera wird gestartet...')
  const [scanMsg, setScanMsg] = useState(null)

  function stopCamera(){
    try{ cancelAnimationFrame(rafRef.current) }catch{}
    try{ streamRef.current?.getTracks()?.forEach(t => t.stop()) }catch{}
  }

  useEffect(() => {
    let stopped = false

    async function startNative(){
      try{
        if(!navigator.mediaDevices?.getUserMedia){
          throw new Error('Keine Kamerafunktion im Browser.')
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        })

        streamRef.current = stream
        if(videoRef.current){
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setMessage('Barcode ruhig und hell vor die Kamera halten.')
        setScanMsg({type:'success', text:'✓ Kamera bereit.'})

        if('BarcodeDetector' in window){
          const detector = new window.BarcodeDetector({
            formats: ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','itf']
          })

          const scan = async () => {
            if(stopped) return
            try{
              if(videoRef.current && videoRef.current.readyState >= 2){
                const codes = await detector.detect(videoRef.current)
                if(codes && codes.length){
                  const code = codes[0].rawValue || codes[0].rawValueText
                  if(code){
                    setScanMsg({type:'success', text:'✓ Barcode erkannt: ' + code})
                    stopCamera()
                    setTimeout(() => onDetected(String(code).replace(/\D/g,'')), 350)
                    return
                  }
                }
              }
            }catch{}
            rafRef.current = requestAnimationFrame(scan)
          }
          scan()
          return
        }

        await startZXing()
      }catch(e){
        console.warn(e)
        setMessage('Kamera konnte nicht scannen. Bitte Berechtigung erlauben oder Code manuell eingeben.')
        setScanMsg({type:'error', text:'Scanner nicht bereit. Manuelle Eingabe ist möglich.'})
      }
    }

    async function startZXing(){
      try{
        if(!window.ZXing){
          await new Promise((resolve,reject) => {
            const script = document.createElement('script')
            script.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js'
            script.onload = resolve
            script.onerror = reject
            document.head.appendChild(script)
          })
        }

        const reader = new window.ZXing.BrowserMultiFormatReader()
        const devices = await window.ZXing.BrowserCodeReader.listVideoInputDevices()
        const backCam = devices.find(d => /back|rear|environment|rück/i.test(d.label))
        const deviceId = backCam?.deviceId || devices[devices.length - 1]?.deviceId

        setMessage('Scanner bereit. Barcode ruhig vor die Kamera halten.')
        await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
          if(result){
            const code = result.getText()
            setScanMsg({type:'success', text:'✓ Barcode erkannt: ' + code})
            try{ reader.reset() }catch{}
            stopCamera()
            setTimeout(() => onDetected(String(code).replace(/\D/g,'')), 350)
          }
        })
      }catch(e){
        console.warn(e)
        setMessage('Scanner konnte nicht automatisch lesen. Bitte Barcode manuell eingeben.')
        setScanMsg({type:'warning', text:'Manuelle Eingabe ist möglich.'})
      }
    }

    startNative()
    return () => { stopped = true; stopCamera() }
  }, [])

  return <div className="modalOverlay"><div className="modalCard scannerCard">
    <h2>Barcode scannen</h2>
    <p>{message}</p>
    <InlineFeedback msg={scanMsg}/>
    <video ref={videoRef} className="scannerVideo" autoPlay muted playsInline></video>
    <label>Barcode manuell eingeben</label>
    <input inputMode="numeric" placeholder="EAN / Barcode" value={manual} onChange={e => setManual(e.target.value.replace(/\D/g,''))} onKeyDown={e => { if(e.key === 'Enter' && manual){ e.preventDefault(); onDetected(manual) } }}/>
    <button disabled={!manual} onClick={() => onDetected(manual)}>Übernehmen</button>
    <button onClick={() => { stopCamera(); onClose() }}>Schließen</button>
  </div></div>
}
