
import React, { useEffect, useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './main.jsx'


function firstImageUrl(...values){
  return values.map(v => String(v || '').trim()).find(Boolean) || ''
}

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

  const buildIso = (dayRaw, monthRaw, yearRaw) => {
    const day = String(dayRaw || '').padStart(2,'0')
    const month = String(monthRaw || '').padStart(2,'0')
    const year = String(yearRaw || '').length === 2 ? '20' + String(yearRaw || '') : String(yearRaw || '')
    const iso = `${year}-${month}-${day}`
    const d = new Date(iso + 'T00:00:00')
    if(Number.isNaN(d.getTime())) return ''
    if(d.getFullYear() !== Number(year) || d.getMonth()+1 !== Number(month) || d.getDate() !== Number(day)) return ''
    return iso
  }

  const buildMonthYearIso = (monthRaw, yearRaw) => {
    const monthNum = Number(monthRaw)
    const yearNum = Number(String(yearRaw || '').length === 2 ? '20' + String(yearRaw || '') : yearRaw)
    if(monthNum >= 1 && monthNum <= 12 && yearNum >= 2000){
      const lastDay = new Date(yearNum, monthNum, 0).getDate()
      return `${yearNum}-${String(monthNum).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    }
    return ''
  }

  const validFull = (...parts) => {
    for(const p of parts){
      const iso = buildIso(p[0], p[1], p[2])
      if(iso) return iso
    }
    return ''
  }

  // iPhone-/Android-freundlich: Punkt, Komma, Slash, Minus oder nur Zahlen erlauben.
  // Beispiele: 23626, 23,6,26, 2362026, 23062026, 23/06/2026.
  const separated = raw.match(/^(\d{1,2})[.,\-/\s]+(\d{1,2})[.,\-/\s]+(\d{2}|\d{4})$/)
  if(separated) return buildIso(separated[1], separated[2], separated[3])

  const monthYear = raw.match(/^(\d{1,2})[.,\-/\s]+(\d{2}|\d{4})$/)
  if(monthYear) return buildMonthYearIso(monthYear[1], monthYear[2])

  const digits = raw.replace(/\D/g,'')
  if(digits.length === 8) return buildIso(digits.slice(0,2), digits.slice(2,4), digits.slice(4))
  if(digits.length === 7){
    // 2362026 -> 23.06.2026 oder 3062026 -> 03.06.2026
    return validFull(
      [digits.slice(0,2), digits.slice(2,3), digits.slice(3)],
      [digits.slice(0,1), digits.slice(1,3), digits.slice(3)]
    )
  }
  if(digits.length === 6){
    // 230626 -> 23.06.2026; 062026 im Monat/Jahr-Feld bleibt 06.2026.
    const full = buildIso(digits.slice(0,2), digits.slice(2,4), digits.slice(4))
    if(full) return full
    const monthYearIso = buildMonthYearIso(digits.slice(0,2), digits.slice(2))
    if(monthYearIso) return monthYearIso
  }
  if(digits.length === 5){
    // 23626 -> 23.06.2026; 3626 -> 03.06.2026 wäre vierstellig, daher hier nur 5 Stellen.
    return validFull(
      [digits.slice(0,2), digits.slice(2,3), digits.slice(3)],
      [digits.slice(0,1), digits.slice(1,3), digits.slice(3)]
    )
  }
  if(digits.length === 4){
    return buildMonthYearIso(digits.slice(0,2), digits.slice(2))
  }

  return ''
}


function normalizeMhdInputMode(value, mode = 'full'){
  const raw = String(value || '').trim()
  if(!raw) return ''
  if(mode === 'month'){
    const buildMonthYearIso = (monthRaw, yearRaw) => {
      const monthNum = Number(monthRaw)
      const yearStr = String(yearRaw || '')
      const yearNum = Number(yearStr.length === 2 ? '20' + yearStr : yearStr)
      if(monthNum >= 1 && monthNum <= 12 && yearNum >= 2000){
        const lastDay = new Date(yearNum, monthNum, 0).getDate()
        return `${yearNum}-${String(monthNum).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
      }
      return ''
    }
    const separated = raw.match(/^\s*(\d{1,2})[.,\-/\s]+(\d{2}|\d{4})\s*$/)
    if(separated) return buildMonthYearIso(separated[1], separated[2])
    const digits = raw.replace(/\D/g,'')
    if(digits.length === 6) return buildMonthYearIso(digits.slice(0,2), digits.slice(2))
    if(digits.length === 5) return buildMonthYearIso(digits.slice(0,1), digits.slice(1))
    if(digits.length === 4) return buildMonthYearIso(digits.slice(0,2), digits.slice(2)) || buildMonthYearIso(digits.slice(0,1), digits.slice(1))
    if(digits.length === 3) return buildMonthYearIso(digits.slice(0,1), digits.slice(1))
    return ''
  }
  return normalizeMhdInput(raw)
}

function mhdEntryValue(value, mode = 'full'){
  const raw = String(value || '')
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
    if(mode === 'month'){
      const [y,m] = raw.split('-')
      return `${m}.${y}`
    }
    return toGermanDate(raw)
  }
  return raw
}

function toGermanDate(value){
  const iso = normalizeMhdInput(value)
  if(!iso) return String(value || '')
  const [y,m,d] = iso.split('-')
  return `${d}.${m}.${y}`
}
function mhdInputValue(value){
  const raw = String(value || '')
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return toGermanDate(raw)
  return raw
}
function mhdMonthYearInputValue(value){
  const raw = String(value || '')
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
    const [y,m] = raw.split('-')
    return `${m}.${y}`
  }
  return raw
}
const isAdmin = u => ['chef','chef_temp','stationsleitung'].includes(u?.rolle)

const PERMISSION_GROUPS = [
  ['MHD', [
    ['mhd_erfassen','MHD erfassen'],
    ['mhd_alle_ansehen','Alle MHD ansehen'],
    ['mhd_bearbeiten','MHD bearbeiten'],
    ['mhd_loeschen','MHD löschen']
  ]],
  ['Artikel', [
    ['artikel_ansehen','Artikelliste ansehen'],
    ['artikel_anlegen','Artikel anlegen'],
    ['artikel_bearbeiten','Artikel bearbeiten'],
    ['artikel_loeschen','Artikel löschen']
  ]],
  ['Bilder', [
    ['bilder_ansehen','Bilder ansehen'],
    ['bilder_hochladen','Bilder aufnehmen/hochladen']
  ]],
  ['Fehlende Artikel', [
    ['fehlende_melden','Fehlende Artikel melden'],
    ['fehlende_bearbeiten','Fehlende Artikel bearbeiten']
  ]],
  ['Backwaren', [
    ['backwaren','Backwaren nutzen'],
    ['backwaren_bearbeiten','Backwarenliste bearbeiten']
  ]],
  ['Abschriften', [
    ['abschriften_ansehen','Abschriften ansehen'],
    ['abschriften_download','Abschriften-PDF herunterladen'],
    ['abschriften_bearbeiten','Abschriften bearbeiten'],
    ['abschriften_loeschen','Abschriften löschen']
  ]],
  ['Dienstplan', [
    ['dienstplan_ansehen','Dienstplan ansehen'],
    ['dienstplan_bearbeiten','Dienstplan hochladen/löschen']
  ]],
  ['Verwaltung', [
    ['online_ansehen','Online-Status ansehen'],
    ['mitarbeiter_verwalten','Mitarbeiter/Rechte verwalten'],
    ['einstellungen','Einstellungen ändern'],
    ['push_senden','Push aktivieren/testen']
  ]]
]
const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(([,items]) => items.map(([key]) => key))
const allRights = () => Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, true]))
function defaultRightsForRole(role){
  if(['chef','chef_temp','stationsleitung'].includes(role)) return allRights()
  return {
    mhd_erfassen:true,
    bilder_ansehen:true,
    fehlende_melden:true,
    backwaren:true,
    dienstplan_ansehen:true
  }
}
function parseRightsMap(settings = {}){
  try{ return JSON.parse(settings.mitarbeiter_rechte_v1 || '{}') || {} }catch{ return {} }
}
function userRights(user, settings = {}){
  if(!user) return {}
  if(['chef','chef_temp'].includes(user.rolle)) return allRights()
  const base = defaultRightsForRole(user.rolle)
  const custom = parseRightsMap(settings)[String(user.nummer)]
  return custom ? {...base, ...custom} : base
}
function can(user, settings, key){
  return !!userRights(user, settings)[key]
}
const cleanCode = v => String(v || '').replace(/\D/g,'')
function ean13CheckDigit(body12){
  const digits = String(body12 || '').replace(/\D/g,'')
  if(digits.length !== 12) return ''
  const sum = digits.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0)
  return String((10 - (sum % 10)) % 10)
}
function isValidEan13(code){
  const clean = cleanCode(code)
  return clean.length === 13 && ean13CheckDigit(clean.slice(0,12)) === clean.slice(12)
}
function isValidEan8(code){
  const clean = cleanCode(code)
  if(clean.length !== 8) return false
  const sum = clean.slice(0,7).split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 1 : 3), 0)
  return String((10 - (sum % 10)) % 10) === clean.slice(7)
}
function isLikelyProductBarcode(code){
  const clean = cleanCode(code)
  if(clean.length === 13) return isValidEan13(clean) || true
  if(clean.length === 8) return isValidEan8(clean) || true
  return clean.length >= 4
}
const stripLeadingZeros = v => cleanCode(v).replace(/^0+/, '')
const codesEqual = (a,b) => { const x=cleanCode(a), y=cleanCode(b); return !!x && !!y && (x===y || stripLeadingZeros(x)===stripLeadingZeros(y)) }
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



function InfoButton({title='Hinweis', children}){
  const [open,setOpen] = useState(false)
  return <>
    <button type="button" className="infoButton" onClick={() => setOpen(true)} title={title}>ℹ️</button>
    {open && <div className="modalOverlay"><div className="modalCard infoModal">
      <h2>{title}</h2>
      <div className="infoText">{children}</div>
      <button type="button" onClick={() => setOpen(false)}>Schließen</button>
    </div></div>}
  </>
}

function PageTitle({title, info}){
  return <div className="pageTitleRow"><h2>{title}</h2>{info && <InfoButton title={title}>{info}</InfoButton>}</div>
}



const UI_THEMES = [
  ['classic','Klassisch'],
  ['modern','Modern'],
  ['light','Hell'],
  ['blue','Blau'],
  ['green','Grün'],
  ['petrol','Petrol'],
  ['slate','Schiefer'],
  ['berry','Beere'],
  ['lila','Lila'],
  ['dark','Dunkel'],
  ['contrast','Kontrast'],
  ['ocean','Ozean'],
  ['forest','Wald'],
  ['sand','Sand'],
  ['coffee','Kaffee'],
  ['graphite','Graphit']
]
const UI_THEME_KEYS = UI_THEMES.map(t => t[0])
function DesignButton({uiTheme, setUiTheme}){
  const [open,setOpen] = useState(false)
  const label = UI_THEMES.find(t => t[0] === uiTheme)?.[1] || 'Design'
  return <>
    <button type="button" className="designMiniBtn" onClick={() => setOpen(true)} title="Design auswählen">⚙️ Design</button>
    {open && <div className="modalOverlay"><div className="modalCard designModal">
      <h2>Design wählen</h2>
      <p>Aktuell: <b>{label}</b>. Die Auswahl gilt nur für dieses Gerät.</p>
      <div className="themeGrid">
        {UI_THEMES.map(([key,name]) => <button key={key} type="button" className={`themeChoice themePreview-${key} ${uiTheme === key ? 'active' : ''}`} onClick={() => { setUiTheme?.(key); setOpen(false) }}>
          <span>{name}</span>
        </button>)}
      </div>
      <button type="button" className="ghostSmall" onClick={() => setOpen(false)}>Schließen</button>
    </div></div>}
  </>
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

function robustVibrate(pattern = [120], repeats = 2){
  try{
    if(!('vibrate' in navigator)) return
    const seq = Array.isArray(pattern) ? pattern : [Number(pattern) || 120]
    navigator.vibrate(seq)
    for(let i=1;i<repeats;i++){
      setTimeout(() => { try{ navigator.vibrate(seq) }catch{} }, i * 180)
    }
  }catch{}
}

function playFeedbackTone(type = 'success'){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if(!AudioCtx) return
    const ctx = new AudioCtx()
    const presets = {
      success: { wave:'sine', volume:0.11, notes:[[880,0.00,0.08],[1320,0.10,0.10]], close:380 },
      error: { wave:'square', volume:0.13, notes:[[240,0.00,0.11],[170,0.13,0.13],[120,0.29,0.17]], close:620 },
      warning: { wave:'triangle', volume:0.10, notes:[[520,0.00,0.10],[520,0.18,0.12]], close:520 },
      click: { wave:'sine', volume:0.045, notes:[[760,0.00,0.035]], close:180 }
    }
    const cfg = presets[type] || presets.success
    cfg.notes.forEach(([freq, delay, duration]) => {
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(cfg.volume, ctx.currentTime + delay + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration)
      gain.connect(ctx.destination)
      const osc = ctx.createOscillator()
      osc.type = cfg.wave
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
      osc.connect(gain)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + duration + 0.02)
    })
    setTimeout(() => ctx.close?.(), cfg.close)
  }catch{}
}

function appFeedback(type = 'success'){
  try{
    const patterns = {
      success:[80],
      warning:[160,90,160],
      error:[280,120,280,120,420],
      click:[45],
      alarm:[500,300,500,300,500]
    }
    robustVibrate(patterns[type] || patterns.success, 1)
  }catch{}
  if(['success','error','warning','click'].includes(type)) playFeedbackTone(type)
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
    const vibrateStrong = () => robustVibrate([500,300,500], 1)
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

function exportAbschriftenPDF(abschriften = [], title = 'Abschriftenliste', dateKey = '', pdfPassword = ''){
  try{
    const cleanPassword = String(pdfPassword || '').trim()
    const doc = cleanPassword ? new jsPDF({ encryption: { userPassword: cleanPassword, ownerPassword: cleanPassword, userPermissions: ['print'] } }) : new jsPDF()
    const now = new Date().toLocaleDateString('de-DE')
    const listDate = dateKey ? formatDateDE(dateKey) : now

    doc.setFontSize(18)
    doc.text(title || 'Abschriftenliste', 14, 18)
    doc.setFontSize(10)
    doc.text('Erstellt am: ' + now, 14, 26)
    doc.text('Liste vom: ' + listDate, 14, 32)

    const lowerReason = item => String(item.grund || item.typ || '').toLowerCase()
    const isBackwarenTagesende = item => lowerReason(item).includes('backwaren tagesende') || lowerReason(item).includes('backwaren_tagesende')
    const isBackwarenBruch = item => lowerReason(item).includes('backwaren bruch') || lowerReason(item).includes('backwaren_bruch')
    const isMhd = item => !isBackwarenTagesende(item) && !isBackwarenBruch(item)

    const sections = [
      ['Backwaren Tagesende', abschriften.filter(isBackwarenTagesende)],
      ['Backwaren Bruch', abschriften.filter(isBackwarenBruch)],
      ['MHD-Abschriften', abschriften.filter(isMhd)]
    ]

    let y = 42
    let totalAll = 0
    sections.forEach(([label, list]) => {
      if(!list.length) return
      const sectionTotal = list.reduce((sum, item) => sum + Number(item.menge || 0), 0)
      totalAll += sectionTotal
      doc.setFontSize(13)
      doc.text(`${label} · Summe: ${sectionTotal}`, 14, y)
      const rows = [...list].sort((a,b) => String(a.name || a.artikel || '').localeCompare(String(b.name || b.artikel || ''), 'de')).map((item) => [
        item.artikelnummer || '',
        item.name || item.artikel || '',
        String(item.menge || 0),
        item.mhd ? new Date(item.mhd).toLocaleDateString('de-DE') : '',
        item.mitarbeiter || '',
        item.datum ? new Date(item.datum).toLocaleDateString('de-DE') : (item.created_at ? new Date(item.created_at).toLocaleDateString('de-DE') : '')
      ])
      autoTable(doc, {
        startY: y + 4,
        head: [['Artikelnummer', 'Name', 'Menge', 'MHD', 'Mitarbeiter', 'Datum']],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [215, 25, 32], textColor: [255, 217, 0] },
        alternateRowStyles: { fillColor: [255, 248, 210] },
        margin: { left: 14, right: 14 }
      })
      y = (doc.lastAutoTable?.finalY || y + 20) + 12
      if(y > 260){ doc.addPage(); y = 18 }
    })

    if(totalAll === 0){
      doc.setFontSize(12)
      doc.text('Keine Abschriften vorhanden.', 14, y)
    }else{
      doc.setFontSize(13)
      doc.text('Gesamtabschriften: ' + totalAll, 14, y)
    }

    const suffix = dateKey ? '-' + dateKey : ''
    doc.save('abschriftenliste' + suffix + '.pdf')
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
  const [prefillMasterArticle, setPrefillMasterArticle] = useState(null)
  const [globalImage, setGlobalImage] = useState(null)
  const [pushPanelOpen, setPushPanelOpen] = useState(false)
  const [duePopupQueue, setDuePopupQueue] = useState([])
  const [duePopupIndex, setDuePopupIndex] = useState(0)
  const [duePopupOpen, setDuePopupOpen] = useState(false)
  const [duePopupAmount, setDuePopupAmount] = useState('')
  const [writeoffConfirm, setWriteoffConfirm] = useState(null)
  const writeoffConfirmResolver = useRef(null)

  useEffect(() => {
    function showImage(e){ setGlobalImage(e.detail || null) }
    window.addEventListener('mhd-show-image', showImage)
    return () => window.removeEventListener('mhd-show-image', showImage)
  }, [])

  const missingStorageKey = 'mhd_fehlende_artikel_lokal'
  function readMissingLocal(){
    try{ return JSON.parse(localStorage.getItem(missingStorageKey) || '[]') }catch{ return [] }
  }
  function writeMissingLocal(list){
    try{ localStorage.setItem(missingStorageKey, JSON.stringify(list || [])) }catch{}
  }
  function upsertMissingLocal(row){
    const list = readMissingLocal()
    const exists = list.some(x => String(x.barcode) === String(row.barcode) && x.status !== 'erledigt')
    const next = exists ? list.map(x => String(x.barcode) === String(row.barcode) && x.status !== 'erledigt' ? {...x, ...row, id:x.id || row.id} : x) : [row, ...list]
    writeMissingLocal(next)
    setMissingArticles(prev => {
      const merged = next.concat(prev || [])
      const seen = new Set()
      return merged.filter(x => { const k = String(x.id || x.barcode); if(seen.has(k)) return false; seen.add(k); return true })
    })
  }

  async function syncMissingLocalToSupabase(){
    if(!db) return readMissingLocal()
    const local = readMissingLocal().filter(x => x && x.status !== 'erledigt' && String(x.barcode || '').trim())
    if(!local.length) return []
    const stillLocal = []
    for(const row of local){
      const clean = String(row.barcode || '').replace(/\D/g,'')
      if(!clean) continue
      try{
        const { data: existing, error: findError } = await supabase
          .from('fehlende_artikel')
          .select('*')
          .eq('barcode', clean)
          .eq('status', 'offen')
          .maybeSingle()
        if(findError){ stillLocal.push(row); continue }
        if(existing) continue
        const { error: insertError } = await supabase.from('fehlende_artikel').insert({
          barcode: clean,
          hinweis: row.hinweis || 'Artikel nicht in Artikelliste gefunden',
          gemeldet_von: row.gemeldet_von || user?.name || '',
          gemeldet_von_nummer: Number(row.gemeldet_von_nummer || user?.nummer || 0),
          status: 'offen'
        })
        if(insertError) stillLocal.push(row)
      }catch{
        stillLocal.push(row)
      }
    }
    writeMissingLocal(stillLocal)
    return stillLocal
  }


  const missingSettingsKey = 'fehlende_artikel_liste'
  function cleanMissingRow(row){
    const barcode = String(row?.barcode || '').replace(/\D/g,'')
    if(!barcode) return null
    return {
      id: row?.id || ('app-' + barcode + '-' + Date.now()),
      created_at: row?.created_at || nowISO(),
      barcode,
      hinweis: row?.hinweis || 'Artikel nicht in Artikelliste gefunden',
      gemeldet_von: row?.gemeldet_von || user?.name || '',
      gemeldet_von_nummer: Number(row?.gemeldet_von_nummer || user?.nummer || 0),
      status: row?.status || 'offen',
      bild_url: row?.bild_url || '',
      erledigt_am: row?.erledigt_am || null,
      erledigt_von: row?.erledigt_von || ''
    }
  }
  function mergeMissingLists(...lists){
    const out = []
    const seen = new Set()
    for(const list of lists){
      for(const raw of (list || [])){
        const row = cleanMissingRow(raw)
        if(!row || row.status === 'erledigt') continue
        const key = String(row.barcode || row.id)
        if(seen.has(key)) continue
        seen.add(key)
        out.push(row)
      }
    }
    return out.sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  }
  async function readMissingFromSettings(){
    if(!db) return []
    try{
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', missingSettingsKey).maybeSingle()
      if(error) return []
      return JSON.parse(data?.value || '[]')
    }catch{
      return []
    }
  }
  async function writeMissingToSettings(list){
    if(!db) return false
    try{
      const value = JSON.stringify(mergeMissingLists(list))
      const { error } = await supabase.from('app_settings').upsert({ key:missingSettingsKey, value, updated_by:user?.name || '' }, { onConflict:'key' })
      return !error
    }catch{
      return false
    }
  }
  async function addMissingToSettings(row){
    const current = await readMissingFromSettings()
    const next = mergeMissingLists([row], current)
    const ok = await writeMissingToSettings(next)
    if(ok) setMissingArticles(next)
    return ok
  }
  async function removeMissingFromSettings(barcode){
    const clean = String(barcode || '').replace(/\D/g,'')
    const current = await readMissingFromSettings()
    const next = (current || []).filter(x => String(x?.barcode || '').replace(/\D/g,'') !== clean)
    await writeMissingToSettings(next)
  }

  const [writeoffs, setWriteoffs] = useState([])
  const [settings, setSettings] = useState({})
  const [uiTheme, setUiThemeState] = useState(() => localStorage.getItem('mhd_design_theme') || 'modern')
  function setUiTheme(value){
    const clean = UI_THEME_KEYS.includes(value) ? value : 'modern'
    setUiThemeState(clean)
    localStorage.setItem('mhd_design_theme', clean)
  }
  const [online, setOnline] = useState([])
  const [backwaren, setBackwaren] = useState(DEFAULT_BACKWAREN)
  const [tab, setTab] = useState(() => localStorage.getItem('mhd_aktiver_reiter') || 'dashboard')
  useEffect(() => { try{ localStorage.setItem('mhd_aktiver_reiter', tab) }catch{} }, [tab])
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
    const el = e.target?.closest?.('button, .upload, .miniUpload, .scannerButton, .pdfButton')
    if(!el || el.disabled) return
    if(el.closest?.('.tabs') || el.closest?.('.stats')) return
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
          new Notification('MHD Kontrolle', { body:text, icon:'/icon-192.png', vibrate:[1000,250,1000,250,1000], requireInteraction:true })
        }else if(Notification.permission !== 'denied'){
          Notification.requestPermission().then(p => {
            if(p === 'granted') new Notification('MHD Kontrolle', { body:text, icon:'/icon-192.png', vibrate:[1000,250,1000,250,1000], requireInteraction:true })
          })
        }
      }
    }catch(e){
      console.warn('Benachrichtigung konnte nicht geprüft werden', e)
    }
  }


  const duePopupSnoozeKey = 'mhd_due_popup_snooze_until'

  function getDuePopupItems(){
    const today = todayISO()
    return (items || [])
      .filter(x => String(x?.mhd || '').slice(0,10) <= today)
      .sort((a,b) => String(a?.mhd || '').localeCompare(String(b?.mhd || '')))
  }

  function notifyDuePopupAgain(count){
    const text = count === 1
      ? '1 MHD-Artikel ist fällig und muss noch kontrolliert werden.'
      : count + ' MHD-Artikel sind fällig und müssen noch kontrolliert werden.'
    try{
      if('Notification' in window && Notification.permission === 'granted'){
        new Notification('MHD Kontrolle', { body:text, icon:'/icon-192.png', vibrate:[1000,250,1000,250,1000], requireInteraction:true })
      }
    }catch{}
    setSuccess(text)
  }

  function openDuePopupIfNeeded(force = false){
    if(!user) return false
    const due = getDuePopupItems()
    if(!due.length) return false
    const snoozeUntil = Number(localStorage.getItem(duePopupSnoozeKey) || 0)
    if(!force && snoozeUntil && Date.now() < snoozeUntil) return false
    setDuePopupQueue(due)
    setDuePopupIndex(0)
    setDuePopupAmount('')
    setDuePopupOpen(true)
    notifyDuePopupAgain(due.length)
    mhdOpenAlarm()
    return true
  }

  function snoozeDuePopup(minutes = 60){
    stopMhdOpenAlarm()
    setDuePopupOpen(false)
    setDuePopupAmount('')
    try{ localStorage.setItem(duePopupSnoozeKey, String(Date.now() + minutes * 60000)) }catch{}
    setSuccess('MHD-Erinnerung kommt später erneut. Der Artikel bleibt in der MHD-Liste.')
  }

  async function saveDuePopupAmount(){
    const item = duePopupQueue[duePopupIndex]
    if(!item) return
    const cleanAmount = String(duePopupAmount || '').replace(/[^0-9]/g,'')
    if(cleanAmount === ''){
      appFeedback('error')
      return setError('Bitte Menge oder 0 eingeben. Ohne Eingabe bleibt der Artikel offen.')
    }
    stopMhdOpenAlarm()
    await writeOffArticle(item, Number(cleanAmount), 'MHD')
    setDuePopupAmount('')
    const nextIndex = duePopupIndex + 1
    if(nextIndex < duePopupQueue.length){
      setDuePopupIndex(nextIndex)
      mhdOpenAlarm()
    }else{
      setDuePopupOpen(false)
      setDuePopupQueue([])
      try{ localStorage.removeItem(duePopupSnoozeKey) }catch{}
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


  async function enrichMhdItemsWithKnownImages(rows){
    const list = Array.isArray(rows) ? rows : []
    if(!db || !list.length) return list
    try{
      const imageByBarcode = new Map()
      const imageByNumber = new Map()
      const barcodes = [...new Set(list.map(r => String(r?.barcode || '').replace(/\D/g,'')).filter(Boolean))]
      const numbers = [...new Set(list.map(r => String(r?.artikelnummer || '').trim()).filter(Boolean))]

      if(barcodes.length){
        const { data } = await supabase
          .from('artikel_stammdaten')
          .select('barcode,bild_url')
          .in('barcode', barcodes)
        ;(data || []).forEach(r => {
          const key = String(r?.barcode || '').replace(/\D/g,'')
          const img = firstImageUrl(r?.bild_url)
          if(key && img) imageByBarcode.set(key, img)
        })
      }
      if(numbers.length){
        const { data } = await supabase
          .from('artikel_stammdaten')
          .select('artikelnummer,bild_url')
          .in('artikelnummer', numbers)
        ;(data || []).forEach(r => {
          const key = String(r?.artikelnummer || '').trim()
          const img = firstImageUrl(r?.bild_url)
          if(key && img) imageByNumber.set(key, img)
        })
      }

      return list.map(r => {
        const direct = firstImageUrl(r?.bild_url)
        const byBarcode = imageByBarcode.get(String(r?.barcode || '').replace(/\D/g,'')) || ''
        const byNumber = imageByNumber.get(String(r?.artikelnummer || '').trim()) || ''
        const img = firstImageUrl(direct, byBarcode, byNumber)
        return img ? {...r, bild_url: img, bild_status: 'vorhanden'} : {...r, bild_status: 'fehlt'}
      })
    }catch(e){
      console.warn('Bildstatus konnte nicht vorab geprüft werden:', e)
      return list.map(r => ({...r, bild_status: firstImageUrl(r?.bild_url) ? 'vorhanden' : 'unbekannt'}))
    }
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

    // FINAL SPEED/STABIL: Übersicht ohne große Bilddaten laden.
    // Bei Datenbank-Timeout wird automatisch ohne ORDER BY neu versucht und im Browser sortiert.
    const columns = 'id,barcode,artikelnummer,name,artikel,kategorie,mhd,created_at,mitarbeiter,bild_url'
    async function runItemsQuery({ ordered = true } = {}){
      let query = supabase.from('mhd_artikel').select(columns)
      if(!all) query = query.lte('mhd', next30ISO())
      if(ordered) query = query.order('mhd', { ascending:true })
      if(all) query = query.range(0, 999)
      return await query
    }

    let { data, error } = await runItemsQuery({ ordered:true })
    if(error && String(error.message || '').toLowerCase().includes('timeout')){
      console.warn('MHD-Abfrage mit Sortierung Timeout, versuche schnelle Ersatzabfrage:', error)
      const retry = await runItemsQuery({ ordered:false })
      data = retry.data
      error = retry.error
    }
    if(error && String(error.message || '').toLowerCase().includes('timeout')){
      console.warn('MHD-Abfrage Timeout, versuche minimale Ersatzabfrage ohne große Felder:', error)
      let retryQuery = supabase.from('mhd_artikel').select('id,barcode,artikelnummer,name,artikel,mhd')
      if(!all) retryQuery = retryQuery.lte('mhd', next30ISO())
      if(all) retryQuery = retryQuery.range(0, 999)
      const retry = await retryQuery
      data = (retry.data || []).map(r => ({...r, kategorie:'', created_at:'', mitarbeiter:'', bild_url:''}))
      error = retry.error
    }
    if(error){
      console.warn(error)
      const timeout = String(error.message || '').toLowerCase().includes('timeout')
      setError(timeout ? 'MHD-Liste lädt gerade zu langsam. Bitte noch einmal auf Alle MHD klicken oder die Seite neu öffnen.' : 'MHD-Übersicht konnte nicht geladen werden: ' + error.message)
      return
    }
    if(Array.isArray(data)){
      data = [...data].sort((a,b) => String(a.mhd || '').localeCompare(String(b.mhd || '')))
    }
    const enrichedItems = await enrichMhdItemsWithKnownImages(data || [])
    setItems(enrichedItems)
    setItemsLimited(!all)
    setAllMhdLoaded(!!all)
    setError('')
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
      .select('id,barcode,artikelnummer,name,kategorie,bild_url,updated_at')
      .order('name')
    if(error){
      console.warn('Artikelliste konnte nicht geladen werden:', error)
      const fallbackMap = new Map()
      ;(items || []).forEach(item => {
        const key = cleanCode(item?.barcode) || String(item?.artikelnummer || item?.name || item?.artikel || '').trim().toLowerCase()
        if(key && !fallbackMap.has(key)) fallbackMap.set(key, {
          id:item?.id,
          barcode:item?.barcode || '',
          artikelnummer:item?.artikelnummer || '',
          name:item?.name || item?.artikel || '',
          kategorie:item?.kategorie || 'Sonstiges',
          bild_url:item?.bild_url || ''
        })
      })
      const fallback = Array.from(fallbackMap.values()).filter(x => x.name || x.barcode || x.artikelnummer)
      if(fallback.length){
        setMasterArticles(fallback.sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''))))
        setLoadedTabs(prev => ({...prev, master:true}))
        setError('Artikelliste konnte nicht direkt geladen werden. Ersatzliste aus vorhandenen MHD-Artikeln wurde genutzt.')
        return
      }
      setLoadedTabs(prev => ({...prev, master:true}))
      return setError('Artikelliste konnte nicht geladen werden: ' + error.message)
    }
    setMasterArticles((data || []).sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''))))
    setLoadedTabs(prev => ({...prev, master:true}))
  }

  async function loadMissingArticles(){
    const localRows = readMissingLocal()
    if(!db){
      setMissingArticles(localRows)
      setLoadedTabs(prev => ({...prev, missing:true}))
      return
    }

    const localLeft = await syncMissingLocalToSupabase()
    const settingsRows = await readMissingFromSettings()
    let tableRows = []

    const { data, error } = await supabase.from('fehlende_artikel').select('*').order('created_at', { ascending:false })
    if(error){
      console.warn('Fehlende Artikel konnten aus Tabelle nicht geladen werden, nutze zentrale Ersatzliste:', error)
      if(isMissingArticlesTableError(error)) { /* Ersatzspeicher läuft still im Hintergrund. */ }
      else setError(error.message)
    }else{
      tableRows = data || []
    }

    const merged = mergeMissingLists(tableRows, settingsRows, localLeft)
    setMissingArticles(merged)
    setLoadedTabs(prev => ({...prev, missing:true}))

    // Falls aus altem lokalen Speicher noch Einträge vorhanden sind, zentral nachziehen.
    if(localLeft?.length) await writeMissingToSettings(merged)
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
    if(tab === 'fehlende' && can(user, settings, 'fehlende_bearbeiten')) loadMissingArticles()
    if((tab === 'abschriften' || tab === 'kontrollen') && can(user, settings, 'abschriften_ansehen') && !loadedTabs.writeoffs) loadWriteoffs()
  }, [tab, user, db, loadedTabs.master, loadedTabs.writeoffs])


  useEffect(() => {
    if(!user || !items.length) return
    checkDueNotifications()
    openDuePopupIfNeeded(false)
  }, [user, items])

  useEffect(() => {
    if(!user) return
    const timer = setInterval(() => openDuePopupIfNeeded(false), 5 * 60 * 1000)
    const onVisible = () => { if(!document.hidden) openDuePopupIfNeeded(false) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
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
    if(!can(user, settings, 'backwaren_bearbeiten')) return setError('Keine Rechte.')
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

  async function reportMissingArticle(barcode, hinweis='Artikel nicht in Artikelliste gefunden', artikelname='', bildUrl=''){
    const clean = String(barcode || '').replace(/\D/g,'')
    if(!clean) return false

    const cleanName = String(artikelname || '').trim()
    const finalHinweis = cleanName ? ('Artikelname: ' + cleanName + ' · ' + hinweis) : hinweis

    const row = {
      id: 'app-' + clean + '-' + Date.now(),
      created_at: nowISO(),
      barcode: clean,
      hinweis: finalHinweis,
      gemeldet_von: user?.name || '',
      gemeldet_von_nummer: Number(user?.nummer || 0),
      status: 'offen',
      bild_url: bildUrl || ''
    }

    if(!db){
      upsertMissingLocal(row)
      return true
    }

    let savedCentral = false

    // 1) Immer zuerst in der zentralen Ersatzliste speichern.
    // Diese liegt in app_settings und ist auf allen Geräten sichtbar.
    savedCentral = await addMissingToSettings(row)

    // 2) Zusätzlich versuchen wir die eigene Tabelle fehlende_artikel zu pflegen.
    // Wenn die Tabelle fehlt, RLS blockiert oder Supabase-Cache hängt, bleibt die zentrale Ersatzliste trotzdem aktiv.
    try{
      const { data: existing, error: findError } = await supabase
        .from('fehlende_artikel')
        .select('*')
        .eq('barcode', clean)
        .eq('status','offen')
        .maybeSingle()

      if(findError){
        console.warn('Fehlende-Artikel-Tabelle nicht erreichbar, Ersatzliste wurde genutzt:', findError)
      }else if(existing){
        if((cleanName && !String(existing.hinweis || '').includes(cleanName)) || (bildUrl && !existing.bild_url)){
          await supabase.from('fehlende_artikel').update({ hinweis: finalHinweis, bild_url: bildUrl || existing.bild_url || '' }).eq('id', existing.id)
        }
      }else{
        await supabase.from('fehlende_artikel').insert({
          barcode: clean,
          hinweis: finalHinweis,
          gemeldet_von: user?.name || '',
          gemeldet_von_nummer: Number(user?.nummer || 0),
          status: 'offen',
          bild_url: bildUrl || ''
        })
      }
    }catch(e){
      console.warn('Fehlende-Artikel-Tabelle konnte nicht geschrieben werden, Ersatzliste wurde genutzt:', e)
    }

    if(savedCentral){
      if(tab === 'fehlende') await loadMissingArticles()
      return true
    }

    // 3) Letzter Notfall: lokal speichern, damit nichts verloren geht.
    upsertMissingLocal(row)
    setSuccess('Fehlender Artikel wurde gespeichert.')
    return true
  }

  function extractMissingArticleName(row){
    const direct = String(row?.artikelname || row?.name || '').trim()
    if(direct) return direct
    const hint = String(row?.hinweis || '')
    const m = hint.match(/Artikelname:\s*(.*?)\s*(?:·|$)/i)
    return (m?.[1] || '').trim()
  }

  function useExistingForMissing(row, article){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    if(!article) return setError('Kein vorhandener Artikel ausgewählt.')
    markMissingDone(row)
    setSuccess('Vorhandener Artikel übernommen: ' + (article.name || article.artikelnummer || article.barcode || 'Artikel') + '. Der Vorschlag wurde entfernt.')
  }

  function takeOverMissingArticle(row){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    const barcode = String(row?.barcode || '').replace(/\D/g,'')
    const name = extractMissingArticleName(row)
    setPrefillMasterArticle({
      sourceRow: row,
      barcode,
      artikelnummer: '',
      name,
      bild_url: row?.bild_url || '',
      kategorie: 'Sonstiges'
    })
    setError('')
    setSuccess('Fehlender Artikel wurde in die Artikelliste-Maske übernommen. Bitte prüfen und speichern.')
    setTab('stammdaten')
    window.setTimeout(() => window.scrollTo({top:0, behavior:'smooth'}), 80)
  }


  async function markMissingDone(row){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    const clean = cleanCode(row?.barcode)
    if(db){
      await removeMissingFromSettings(clean)
      const { error } = await supabase.from('fehlende_artikel').delete().eq('id', row.id)
      if(error && !isMissingArticlesTableError(error)){
        return setError(error.message)
      }
    }
    setMissingArticles(prev => prev.filter(x => x.id !== row.id && !codesEqual(x.barcode, clean)))
    writeMissingLocal(readMissingLocal().filter(x => x.id !== row.id && !codesEqual(x.barcode, clean)))
    if(db) await loadMissingArticles()
    setSuccess('Vorschlag gelöscht.')
  }

  async function recheckMissingArticle(row){
    if(!isAdmin(user)) return setError('Keine Rechte.')
    let list = masterArticles || []
    if(db){
      const { data, error } = await supabase
        .from('artikel_stammdaten')
        .select('id,barcode,artikelnummer,name,kategorie,bild_url')
        .order('name')
      if(error){ appFeedback('error'); return setError('Abgleich nicht möglich: ' + error.message) }
      list = data || []
      setMasterArticles(list)
    }
    const matches = findMissingMatches(row, list)
    if(matches.length){
      appFeedback('success')
      setSuccess(matches.length === 1 ? '1 möglicher Treffer gefunden. Bitte vergleichen und übernehmen oder neu anlegen.' : matches.length + ' mögliche Treffer gefunden. Bitte vergleichen und übernehmen oder neu anlegen.')
      return
    }
    appFeedback('error')
    setError('Kein passender Artikel über EAN, interne Artikelnummer oder Namen gefunden.')
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
    try{
      const file = await compressImageFile(e.target.files?.[0])
      if(!file) return
      const url = await fileToDataUrl(file)
      setForm(f => ({ ...f, bild_url:url }))

      // Wenn Chef/Stationsleitung ein Bild bei einem bereits bekannten Artikel ergänzt,
      // sofort dauerhaft speichern. Sonst sah es so aus, als wäre es gespeichert,
      // war nach dem Neuladen aber wieder weg.
      if(db && isAdmin(user)){
        const clean = String(form.barcode || '').replace(/\D/g,'')
        if(clean){
          await supabase.from('artikel_stammdaten').update({ bild_url:url, updated_at:nowISO() }).eq('barcode', clean)
          setMasterArticles(prev => prev.map(a => codesEqual(a.barcode, clean) ? {...a, bild_url:url} : a))
        }
        if(form.id){
          await supabase.from('mhd_artikel').update({ bild_url:url }).eq('id', form.id)
          setItems(prev => prev.map(x => x.id === form.id ? {...x, bild_url:url} : x))
        }
      }
      msgAt('erfassen','success','✓ Bild übernommen und gespeichert.')
      appFeedback('success')
    }catch(err){
      console.warn('Bild konnte nicht sofort gespeichert werden:', err)
      msgAt('erfassen','warning','Bild konnte nicht gespeichert werden. Bitte erneut versuchen.')
      appFeedback('error')
    }finally{
      try{ if(e?.target) e.target.value = '' }catch{}
    }
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
    if(!can(user, settings, 'mhd_erfassen')) return setError('Keine Rechte.')
    const normalizedMhd = normalizeMhdInputMode(form.mhd, form.mhd_mode || 'full')
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

  function requestWriteoffConfirm(payload){
    return new Promise(resolve => {
      writeoffConfirmResolver.current = resolve
      setWriteoffConfirm(payload)
    })
  }

  function resolveWriteoffConfirm(ok){
    const resolver = writeoffConfirmResolver.current
    writeoffConfirmResolver.current = null
    setWriteoffConfirm(null)
    resolver?.(!!ok)
  }

  async function writeOffWithConfirm(payload){
    const ok = await requestWriteoffConfirm(payload)
    if(!ok){ appFeedback('error'); return false }
    return writeOff(payload)
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
    const cleanReason = 'MHD'

    const confirmPayload = { ...item, artikel_id:item.id, menge:qty, grund:cleanReason }
    const confirmed = await requestWriteoffConfirm(confirmPayload)
    if(!confirmed){ appFeedback('error'); return false }

    let ok = true
    if(qty > 0){
      ok = await writeOff(confirmPayload)
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
    return writeOffArticle(item, 0, 'MHD')
  }


  async function quickMhdFromMaster(masterArticle){
    if(!can(user, settings, 'mhd_erfassen')) return setError('Keine Rechte.')
    if(!masterArticle) return setError('Kein Artikel ausgewählt.')

    const articleName = masterArticle.name || masterArticle.artikel || masterArticle.artikelname || masterArticle.bezeichnung || masterArticle.barcode || 'Artikel'

    const rows = []
    let round = 1

    while(true){
      const mhd = prompt('MHD ' + round + ' für "' + articleName + '" eingeben (Format: JJJJ-MM-TT)')
      const normalizedMhd = normalizeMhdInput(mhd)
      if(!normalizedMhd){
        if(rows.length === 0) return setError('Kein gültiges MHD eingetragen. Es wurde kein Eintrag erstellt.')
        break
      }
      if(isPastMhd(normalizedMhd)){ appFeedback('error'); return setError('MHD darf nicht in der Vergangenheit liegen.') }

      rows.push({ mhd:normalizedMhd, menge:0 })

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


  async function getArticleImage(item){
    // Bilder sparsam laden: Listen bleiben ohne Base64-Bilder schnell.
    // Erst beim Klick auf „Bild anzeigen“ wird das kleine gespeicherte Bild aus der DB geholt.
    if(item?.bild_url) return item.bild_url
    if(!db) return ''
    try{
      const barcode = String(item?.barcode || '').replace(/\D/g,'')
      const artikelnummer = String(item?.artikelnummer || '').trim()
      if(barcode){
        const { data } = await supabase.from('artikel_stammdaten').select('bild_url').eq('barcode', barcode).maybeSingle()
        if(data?.bild_url) return data.bild_url
      }
      if(artikelnummer){
        const { data } = await supabase.from('artikel_stammdaten').select('bild_url').eq('artikelnummer', artikelnummer).maybeSingle()
        if(data?.bild_url) return data.bild_url
      }
      if(item?.id){
        const { data } = await supabase.from('mhd_artikel').select('bild_url').eq('id', item.id).maybeSingle()
        if(data?.bild_url) return data.bild_url
      }
    }catch(e){
      console.warn('Artikelbild konnte nicht nachgeladen werden:', e)
    }
    return ''
  }


  async function uploadArticleImageFromMhd(item, e){
    const file = await compressImageFile(e.target.files?.[0])
    e.target.value = ''
    if(!file) return ''
    if(!(can(user, settings, 'artikel_bearbeiten') || can(user, settings, 'artikel_anlegen'))){
      setError('Keine Rechte zum Bild hochladen.')
      appFeedback('error')
      return ''
    }
    const url = await fileToDataUrl(file)
    const barcode = String(item?.barcode || '').replace(/\D/g,'')
    const artikelnummer = String(item?.artikelnummer || '').trim()
    try{
      if(db){
        if(item?.id){
          const { error:mhdError } = await supabase.from('mhd_artikel').update({ bild_url:url }).eq('id', item.id)
          if(mhdError) throw mhdError
        }
        if(barcode){
          const masterPayload = {
            barcode,
            artikelnummer,
            name:item?.name || item?.artikel || 'Artikel',
            kategorie:item?.kategorie || 'Sonstiges',
            bild_url:url,
            updated_at:nowISO()
          }
          const { error:masterError } = await supabase.from('artikel_stammdaten').upsert(masterPayload, { onConflict:'barcode' })
          if(masterError) console.warn('Bild konnte im Stammdatensatz nicht gespeichert werden:', masterError)
        }else if(artikelnummer){
          const { error:masterByNumberError } = await supabase.from('artikel_stammdaten').update({ bild_url:url, updated_at:nowISO() }).eq('artikelnummer', artikelnummer)
          if(masterByNumberError) console.warn('Bild konnte über Artikelnummer nicht gespeichert werden:', masterByNumberError)
        }
      }
      if(item?.id) setItems(prev => prev.map(x => x.id === item.id ? {...x, bild_url:url, bild_status:'vorhanden'} : x))
      if(barcode) setMasterArticles(prev => prev.map(x => String(x.barcode || '') === barcode ? {...x, bild_url:url} : x))
      setSuccess('✓ Bild gespeichert.')
      appFeedback('success')
      return url
    }catch(err){
      setError('Bild konnte nicht gespeichert werden: ' + (err?.message || err))
      appFeedback('error')
      return ''
    }
  }

  async function saveMasterArticle(data){
    if(!can(user, settings, data?.id ? 'artikel_bearbeiten' : 'artikel_anlegen')){ setError('Keine Rechte.'); return false }
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
    if(!payload.barcode){ setError('EAN / Barcode fehlt.'); return false }
    if(!payload.name){ setError('Artikelname fehlt.'); return false }

    const duplicate = masterArticles.find(a => {
      if(data.id && a.id === data.id) return false
      const sameEan = payload.barcode && String(a.barcode || '') === payload.barcode
      const sameArtNr = payload.artikelnummer && String(a.artikelnummer || '').trim() === String(payload.artikelnummer).trim()
      return sameEan || sameArtNr
    })
    if(duplicate){ setError('Artikel existiert bereits: ' + (duplicate.name || duplicate.barcode)); return false }

    if(db){
      const { data:saved, error } = await supabase.from('artikel_stammdaten').upsert(payload, { onConflict:'barcode' }).select().single()
      if(error){ setError(error.message); return false }
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
    return true
  }

  async function deleteMasterArticle(article){
    if(!can(user, settings, 'artikel_loeschen')) return setError('Keine Rechte.')
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
    if(!can(user, settings, 'mhd_loeschen')) return setError('Keine Rechte.')
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
    if(!can(user, settings, 'mhd_bearbeiten')) return setError('Keine Rechte.')
    if(isPastMhd(data.mhd)){ appFeedback('error'); return setError('MHD darf nicht in der Vergangenheit liegen.') }
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
    if(payload.bild_url && payload.barcode){
      try{
        await supabase.from('artikel_stammdaten').update({ bild_url: payload.bild_url, updated_at: nowISO() }).eq('barcode', payload.barcode)
        setMasterArticles(prev => prev.map(a => codesEqual(a.barcode, payload.barcode) ? {...a, bild_url:payload.bild_url} : a))
      }catch(e){ console.warn('Artikelbild konnte nicht in Stammdaten gespiegelt werden:', e) }
    }
    setEditArticle(null)
    setItems(prev => prev.map(x => x.id === data.id ? {...x, ...payload, id:data.id} : x).filter(x => !itemsLimited || isVisibleInFastOverview(x)))
    setSuccess('Artikel gespeichert.')
    appFeedback('success')
  }

  async function saveWriteoff(data){
    if(!can(user, settings, 'abschriften_bearbeiten')) return setError('Keine Rechte.')
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
    if(!can(user, settings, 'abschriften_loeschen')) return setError('Keine Rechte.')
    if(!confirm('Abschrift löschen?')) return
    const { error } = await supabase.from('abschriften').delete().eq('id', item.id)
    if(error) return setError(error.message)
    setWriteoffs(prev => prev.filter(x => x.id !== item.id))
    setSuccess('Abschrift gelöscht.')
    appFeedback('success')
  }

  async function deleteWriteoffsForDay(day, entries = []){
    if(!can(user, settings, 'abschriften_loeschen')) return setError('Keine Rechte.')
    const count = entries.length
    if(count < 1) return setError('Für diesen Tag sind keine Abschriften vorhanden.')
    if(!confirm(`Wirklich alle ${count} Abschriften vom ${formatDateDE(day)} löschen?`)) return

    const ids = entries.map(x => x.id).filter(Boolean)
    if(ids.length){
      const { error } = await supabase.from('abschriften').delete().in('id', ids)
      if(error) return setError(error.message)
    }

    setWriteoffs(prev => prev.filter(x => entryDateKey(x) !== day || x.typ === 'kontrolle'))
    setSuccess(`Abschriftenliste vom ${formatDateDE(day)} gelöscht.`)
    appFeedback('success')
  }

  async function undoWriteoff(item){
    if(!can(user, settings, 'abschriften_bearbeiten')) return setError('Keine Rechte.')
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
    if(!can(user, settings, 'mitarbeiter_verwalten')) return setError('Keine Rechte.')
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
    if(!can(user, settings, 'mitarbeiter_verwalten')) return setError('Keine Rechte.')
    if(!confirm(`${emp.name} löschen?`)) return
    const { error } = await supabase.from('mitarbeiter').delete().eq('nummer', emp.nummer)
    if(error) return setError(error.message)
    setEmployees(prev => prev.filter(x => Number(x.nummer) !== Number(emp.nummer)))
    setSuccess('Mitarbeiter gelöscht.')
    appFeedback('success')
  }

  async function resetPassword(emp){
    if(!can(user, settings, 'mitarbeiter_verwalten')) return setError('Keine Rechte.')
    const { error } = await supabase.from('mitarbeiter').update({ passwort:'0000', muss_passwort_aendern:true }).eq('nummer', emp.nummer)
    if(error) return setError(error.message)
    setEmployees(prev => prev.map(x => Number(x.nummer) === Number(emp.nummer) ? {...x, passwort:'0000', muss_passwort_aendern:true} : x))
    setSuccess(`Passwort für ${emp.name} auf 0000 zurückgesetzt.`)
    appFeedback('success')
  }

  async function saveEmployeeRights(nummer, rights){
    if(!can(user, settings, 'mitarbeiter_verwalten')) return setError('Keine Rechte.')
    const map = parseRightsMap(settings)
    map[String(nummer)] = rights || {}
    const value = JSON.stringify(map)
    if(db){
      const { error } = await supabase.from('app_settings').upsert({ key:'mitarbeiter_rechte_v1', value, updated_by:user.name }, { onConflict:'key' })
      if(error) return setError(error.message)
    }
    setSettings(prev => ({...prev, mitarbeiter_rechte_v1:value}))
    setSuccess('Rechte gespeichert.')
    appFeedback('success')
  }

  async function enablePush(){
    if(user && !can(user, settings, 'push_senden')) return setError('Keine Rechte.')
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
    const redItems = items.filter(i => daysUntil(i.mhd) === 1)
    const orangeItems = items.filter(i => daysUntil(i.mhd) >= 2 && daysUntil(i.mhd) <= 5)
    const yellowItems = items.filter(i => daysUntil(i.mhd) >= 6 && daysUntil(i.mhd) <= 7)
    const urgentItems = items.filter(i => daysUntil(i.mhd) >= 1 && daysUntil(i.mhd) <= 3)
    const weekItems = items.filter(i => daysUntil(i.mhd) >= 1 && daysUntil(i.mhd) <= 7)
    const nextDue = [...weekItems].sort((a,b) => daysUntil(a.mhd) - daysUntil(b.mhd))[0]
    return {
      total:items.length,
      expired:expiredItems.length,
      red:redItems.length,
      orange:orangeItems.length,
      yellow:yellowItems.length,
      urgent:urgentItems.length,
      week:weekItems.length,
      totalText: items.length === 1 ? '1 Artikel gesamt' : `${items.length} Artikel gesamt`,
      expiredText: expiredItems.length === 1 ? '1 Artikel abgelaufen' : `${expiredItems.length} Artikel abgelaufen`,
      urgentText: urgentItems.length === 1 ? '1 Artikel in 1-3 Tagen' : `${urgentItems.length} Artikel in 1-3 Tagen`,
      weekText: nextDue ? `${weekItems.length} Artikel · nächster in ${daysUntil(nextDue.mhd)} Tagen` : '0 Artikel',
      todayWriteoffs: writeoffs.filter(w => entryDateKey(w) === todayISO() && w.typ !== 'kontrolle').length,
      todayControls: writeoffs.filter(w => entryDateKey(w) === todayISO() && w.typ === 'kontrolle').length,
      missingOpen: missingArticles.filter(x => x.status !== 'erledigt').length
    }
  }, [items, writeoffs, missingArticles])

  function openArticleFilter(filter){
    setArticleFilter(filter)
    setTab(can(user, settings, 'mhd_alle_ansehen') ? 'artikel' : 'dashboard')
    setTimeout(() => {
      const target = document.querySelector('.list') || document.querySelector('.tabs')
      if(target) target.scrollIntoView({behavior:'smooth', block:'start'})
      else window.scrollTo({top:0, behavior:'smooth'})
    }, 80)
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
    ['dashboard','Übersicht','📊'],
    ...(can(user, settings, 'mhd_erfassen') ? [['erfassen','Erfassen','➕']] : []),
    ...(can(user, settings, 'backwaren') ? [['backwaren','Backwaren','🥐']] : []),
    ...(can(user, settings, 'abschriften_ansehen') ? [['abschriften','Abschriften','🗑️']] : []),
    ...(can(user, settings, 'mhd_alle_ansehen') ? [['artikel','Alle MHD','📅']] : []),
    ...(can(user, settings, 'artikel_ansehen') ? [['stammdaten','Artikelliste','📦']] : []),
    ...(can(user, settings, 'fehlende_bearbeiten') ? [['fehlende','Fehlende Artikel','⚠️', stats.missingOpen]] : []),
    ...(can(user, settings, 'dienstplan_ansehen') ? [['dienstplan','Dienstplan','👥']] : []),
    ...(can(user, settings, 'online_ansehen') ? [['online','Online','🌐']] : []),
    ...(can(user, settings, 'mitarbeiter_verwalten') ? [['verwaltung','Verwaltung','⚙️']] : []),
    ...(can(user, settings, 'einstellungen') ? [['settings','Einstellungen','🔧']] : [])
  ]

  const hasWriteoffsToday = stats.todayWriteoffs > 0

  function handleTabClick(key){
    setError('')
    // Stabilitäts-Fix: Beim direkten Menüwechsel dürfen alte Filter
    // (z. B. nach Klick auf "Abgelaufen") nicht in "Alle MHD"
    // oder "Übersicht" hängen bleiben.
    if(key === 'artikel'){
      setArticleFilter('all')
      if(itemsLimited) loadItems({all:true}).catch(err => {
        console.warn('Alle MHD konnten nicht sofort geladen werden:', err)
        setError('MHD-Liste konnte nicht vollständig geladen werden. Vorhandene Daten bleiben erhalten.')
      })
    }
    if(key === 'dashboard') setArticleFilter('all')
    setTab(key)
  }

  return <main className={`app theme-${uiTheme}`} onClickCapture={handleGlobalActionFeedback}>
    <header className="topbar topbarFinal">
      <div className="topbarInner">
        <p className="topbarRole">MHD Kontrolle · {roleLabel(user.rolle)}</p>
        <h1 className="topbarHello">Hallo {user.name}</h1>
        <div className="topbarButtonRow">
          <DesignButton uiTheme={uiTheme} setUiTheme={setUiTheme}/>
          <button className="pushBtn" onClick={() => setPushPanelOpen(true)} title="Push, Ton und Vibration testen">🔔 Push</button>
          <button className="logout" onClick={logout}>🚪 Logout</button>
        </div>
      </div>
    </header>

    <section className={`stats ${isAdmin(user) ? 'statsAdminClean' : ''}`}>
      <Stat label="Abgelaufen" value={stats.expiredText} tone="expired" onClick={() => openArticleFilter('expired')}/>
      <Stat label="7 Tage" value={stats.weekText} tone="week" onClick={() => openArticleFilter('week')}/>
      {isAdmin(user) && can(user, settings, 'abschriften_ansehen') && <Stat label="Abschriften" value={hasWriteoffsToday ? '🟢 Vorhanden' : '❌ Keine'} tone={hasWriteoffsToday ? 'writeoffsOk' : 'writeoffsNone'} onClick={() => setTab('abschriften')}/>}
    </section>

    {can(user, settings, 'abschriften_download') && <section className="todayStats single">
      <button className="pdfButton" onClick={() => exportAbschriftenPDF(writeoffs.filter(w => w.typ !== 'kontrolle' && entryDateKey(w) === todayISO()), 'Abschriftenliste', todayISO(), settings?.abschriften_pdf_passwort || '')}>📄 Abschriftenliste herunterladen</button>
    </section>}

    <nav className="tabs menuTiles">
      {tabs.map(([key,label,icon,badge]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => handleTabClick(key)}>
        <span className="tabIcon" aria-hidden="true">{icon}</span>
        <span className="tabLabel">{label}</span>
        {Number(badge) > 0 && <span className="tabBadge" aria-label={`${badge} offen`}>{badge}</span>}
      </button>)}
    </nav>

    {error && <div className="error">{error}</div>}
    {success && <div className="success" onClick={stopMhdOpenAlarm} title="Alarm stoppen">{success}</div>}

    {tab === 'artikel' && can(user, settings, 'mhd_alle_ansehen') && <ArticleList items={filteredItems} allCount={items.length} articleFilter={articleFilter} setArticleFilter={setArticleFilter} itemsLimited={itemsLimited} allMhdLoaded={allMhdLoaded} loadAllItems={() => loadItems({all:true})} user={user} writeOffArticle={writeOffArticle} markArticleCheckedZero={markArticleCheckedZero} setEditArticle={setEditArticle} deleteMhdEntry={deleteMhdEntry} inlineMsg={inlineMsg} safeEditOverviewItem={safeEditOverviewItem} getArticleImage={getArticleImage} settings={settings} uploadArticleImageFromMhd={uploadArticleImageFromMhd}/>}
    {tab === 'dashboard' && <Dashboard safeEditOverviewItem={safeEditOverviewItem} items={articleFilter === 'all' ? items : filteredItems} articleFilter={articleFilter} setTab={setTab} user={user} writeOffArticle={writeOffArticle} markArticleCheckedZero={markArticleCheckedZero} setEditArticle={setEditArticle} deleteMhdEntry={deleteMhdEntry} inlineMsg={inlineMsg} getArticleImage={getArticleImage} settings={settings} uploadArticleImageFromMhd={uploadArticleImageFromMhd}/>}
    {tab === 'erfassen' && <Erfassen form={form} setForm={setForm} setScannerOpen={setScannerOpen} lookupBarcode={lookupBarcode} uploadFormImg={uploadFormImg} addItem={addItem} user={user} inlineMsg={inlineMsg} masterArticles={masterArticles} reportMissingArticle={reportMissingArticle} saveMasterArticle={saveMasterArticle}/>}
    {tab === 'backwaren' && <Backwaren backwaren={backwaren} saveBackwarenList={saveBackwarenList} writeOff={writeOffWithConfirm} user={user}/>}
    {tab === 'abschriften' && can(user, settings, 'abschriften_ansehen') && <Abschriften writeoffs={writeoffs.filter(w => w.typ !== 'kontrolle')} user={user} setEditWriteoff={setEditWriteoff} deleteWriteoff={deleteWriteoff} deleteWriteoffsForDay={deleteWriteoffsForDay} undoWriteoff={undoWriteoff} pdfPassword={settings?.abschriften_pdf_passwort || ''}/>}
    {tab === 'fehlende' && can(user, settings, 'fehlende_bearbeiten') && <MissingArticles missingArticles={missingArticles} masterArticles={masterArticles} markMissingDone={markMissingDone} takeOverMissingArticle={takeOverMissingArticle} useExistingForMissing={useExistingForMissing} recheckMissingArticle={recheckMissingArticle}/>}    {tab === 'stammdaten' && can(user, settings, 'artikel_ansehen') && <MasterArticles prefillArticle={prefillMasterArticle} onPrefillUsed={() => setPrefillMasterArticle(null)} onMissingSaved={markMissingDone} quickMhdFromMaster={quickMhdFromMaster} masterArticles={masterArticles} mhdItems={items} saveMasterArticle={saveMasterArticle} deleteMasterArticle={deleteMasterArticle} setMasterScannerOpen={setMasterScannerOpen}/>}
    {tab === 'dienstplan' && <Dienstplan settings={settings} saveSetting={saveSetting} user={user}/>}
    {tab === 'online' && can(user, settings, 'online_ansehen') && <Online online={online}/>}
    {tab === 'verwaltung' && can(user, settings, 'mitarbeiter_verwalten') && <Verwaltung employees={employees} settings={settings} saveEmployee={saveEmployee} deleteEmployee={deleteEmployee} resetPassword={resetPassword} saveEmployeeRights={saveEmployeeRights}/>}
    {tab === 'settings' && can(user, settings, 'einstellungen') && <Settings enablePush={enablePush} settings={settings} saveSetting={saveSetting} uiTheme={uiTheme} setUiTheme={setUiTheme}/>}

    {globalImage && <div className="modalOverlay"><div className="modalCard imageOnlyModal"><h2>{globalImage.title || 'Bild anzeigen'}</h2><img className="smallProductImage" src={globalImage.src}/><button onClick={() => setGlobalImage(null)}>Schließen</button></div></div>}
    {pushPanelOpen && <PushPanel enablePush={enablePush} close={() => setPushPanelOpen(false)} />}
    {duePopupOpen && duePopupQueue[duePopupIndex] && <DueMhdPopup
      item={duePopupQueue[duePopupIndex]}
      index={duePopupIndex}
      total={duePopupQueue.length}
      amount={duePopupAmount}
      setAmount={setDuePopupAmount}
      save={saveDuePopupAmount}
      later={() => snoozeDuePopup(60)}
      stopAlarm={stopMhdOpenAlarm}
    />}

    {writeoffConfirm && <WriteoffConfirmPopup payload={writeoffConfirm} onCancel={() => resolveWriteoffConfirm(false)} onConfirm={() => resolveWriteoffConfirm(true)} />}

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




function WriteoffConfirmPopup({payload,onCancel,onConfirm}){
  const title = payload?.name || payload?.artikel || payload?.artikelnummer || payload?.barcode || 'Artikel'
  const qty = Number(payload?.menge || 0)
  return <div className="modalOverlay">
    <div className="modalCard writeoffConfirmModal">
      <h2>🗑️ Abschrift bestätigen</h2>
      <div className="confirmDetails">
        <p><b>Artikel:</b> {title}</p>
        <p><b>MHD:</b> {payload?.mhd ? new Date(payload.mhd).toLocaleDateString('de-DE') : '-'}</p>
        <p><b>Anzahl:</b> {qty}</p>
      </div>
      <p className="dueMhdHint">Soll die Abschrift wirklich gespeichert werden?</p>
      <div className="modalActions dueMhdActions">
        <button type="button" className="ghostSmall" onClick={onCancel}>🔴 Abbrechen</button>
        <button type="button" className="successBtn" onClick={onConfirm}>🟢 Ja, speichern</button>
      </div>
    </div>
  </div>
}

function DueMhdPopup({item, index, total, amount, setAmount, save, later, stopAlarm}){
  const days = daysUntil(item?.mhd)
  const title = item?.name || item?.artikel || item?.artikelnummer || item?.barcode || 'Artikel'
  const img = firstImageUrl(item?.bild_url)
  function cleanAmount(value){ setAmount(String(value || '').replace(/[^0-9]/g,'')) }
  return <div className="modalOverlay dueMhdOverlay">
    <div className="modalCard dueMhdModal">
      <button type="button" className="modalCloseX" onClick={() => { stopAlarm?.(); later?.(); }} aria-label="Später erinnern">×</button>
      <div className="dueMhdBadge">MHD fällig · {index + 1} von {total}</div>
      <h2>{title}</h2>
      {img && <img className="dueMhdImage" src={img} alt={title} loading="lazy" decoding="async"/>}
      <div className="dueMhdDetails">
        <p><b>MHD:</b> {item?.mhd ? new Date(item.mhd).toLocaleDateString('de-DE') : '-'}</p>
        <p><b>Status:</b> {days === 0 ? 'Heute fällig' : `${Math.abs(days)} Tage abgelaufen`}</p>
        <p><b>EAN:</b> {item?.barcode || '-'}</p>
        <p><b>Art.-Nr.:</b> {item?.artikelnummer || '-'}</p>
      </div>
      <label className="smallLabel">Menge für Abschrift eintragen oder 0 wenn nichts mehr da ist</label>
      <input className="realInput dueMhdQty" inputMode="numeric" type="number" min="0" value={amount} placeholder="Menge oder 0" onChange={e => cleanAmount(e.target.value)} />
      <p className="dueMhdHint">Ohne Eingabe bleibt der Artikel in der MHD-Liste und wird später erneut erinnert.</p>
      <div className="modalActions dueMhdActions">
        <button type="button" className="successBtn" onClick={save}>Speichern / nächster Artikel</button>
        <button type="button" className="ghostSmall" onClick={() => { stopAlarm?.(); later?.(); }}>Später erinnern</button>
      </div>
    </div>
  </div>
}

function PushPanel({enablePush, close}){
  return <div className="modalOverlay"><div className="modalCard pushTestModal">
    <h2>Push, Ton & Vibration</h2>
    <p>Hier kann jeder direkt auf seinem Handy testen, ob Push, Erfolgston, Fehlerton und Vibration funktionieren.</p>
    <button type="button" onClick={enablePush}>🔔 Push-Benachrichtigung aktivieren/testen</button>
    <div className="adminBox">
      <b>Ton & Vibration testen</b>
      <p>Erfolg und Fehler sind bewusst deutlich unterschiedlich.</p>
      <div className="feedbackTestGrid">
        <button type="button" className="feedbackSuccess" onClick={() => appFeedback('success')}>✅ Erfolg testen</button>
        <button type="button" className="feedbackError" onClick={() => appFeedback('error')}>❌ Fehler testen</button>
        <button type="button" className="feedbackAlarm" onClick={() => mhdOpenAlarm()}>🔔 MHD-Alarm testen</button>
      </div>
      <button type="button" className="ghostSmall" onClick={() => stopMhdOpenAlarm()}>Alarm stoppen</button>
    </div>
    <div className="modalActions"><button type="button" onClick={() => { stopMhdOpenAlarm(); close(); }}>Schließen</button></div>
  </div></div>
}

async function compressImageFile(file, maxSize = 360, quality = 0.68){
  if(!file || !file.type || !file.type.startsWith('image/')) return file
  let url = ''
  try{
    const img = new Image()
    url = URL.createObjectURL(file)
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = url
    })

    // FINAL BILD-FIX:
    // Alle aufgenommenen/hochgeladenen Artikelbilder werden automatisch
    // quadratisch zugeschnitten und klein gespeichert. Dadurch haben alle
    // Bilder die gleiche Ausrichtung/Größe und die App lädt schneller.
    const sourceSize = Math.min(img.width || maxSize, img.height || maxSize)
    const sourceX = Math.max(0, Math.round(((img.width || sourceSize) - sourceSize) / 2))
    const sourceY = Math.max(0, Math.round(((img.height || sourceSize) - sourceSize) / 2))
    const targetSize = maxSize
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetSize, targetSize)
    ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, targetSize, targetSize)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if(!blob) return file
    return new File([blob], (file.name || 'artikelbild').replace(/\.[^.]+$/, '') + '.jpg', { type:'image/jpeg' })
  }catch{
    return file
  }finally{
    if(url) URL.revokeObjectURL(url)
  }
}



async function compressPlanFile(file, maxSize = 1800, quality = 0.86){
  if(!file || !file.type || !file.type.startsWith('image/')) return file
  let url = ''
  try{
    const img = new Image()
    url = URL.createObjectURL(file)
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url })
    const scale = Math.min(1, maxSize / Math.max(img.width || maxSize, img.height || maxSize))
    const w = Math.max(1, Math.round((img.width || maxSize) * scale))
    const h = Math.max(1, Math.round((img.height || maxSize) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if(!blob) return file
    return new File([blob], (file.name || 'dienstplan').replace(/\.[^.]+$/, '') + '.jpg', { type:'image/jpeg' })
  }catch{
    return file
  }finally{
    if(url) URL.revokeObjectURL(url)
  }
}

const slugifyMonthLabel = (value) => String(value || '').trim().toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'plan'
const isPastMhd = (iso) => !!iso && iso < todayISO()

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

function Dashboard({items,articleFilter='all',setTab,user,settings,writeOffArticle,markArticleCheckedZero,setEditArticle,deleteMhdEntry,safeEditOverviewItem,getArticleImage,uploadArticleImageFromMhd}){
  const title = articleFilter === 'expired' ? 'Abgelaufene Artikel' : articleFilter === 'week' ? 'Nächste 7 Tage' : ''
  const shownItems = articleFilter === 'all' ? items.slice(0,8) : items
  return <section className="list">
    {!title && <div className="sectionTopInfo"><InfoButton title="Übersicht">Hier siehst du die wichtigsten MHD-Artikel. Rahmenfarben gelten in jedem Design: 7–6 Tage gelb, 5–2 Tage orange, 1–0 Tage rot. Abgelaufene Artikel sind rot hinterlegt.</InfoButton></div>}
    {title && <div className="sectionHeader"><div><div className="pageTitleInline"><h2>{title}</h2><InfoButton title={title}>Diese Liste zeigt nur die Artikel des ausgewählten Zeitraums. Rahmenfarben: 7–6 Tage gelb, 5–2 Tage orange, 1–0 Tage rot. Abgelaufene Artikel sind rot hinterlegt.</InfoButton></div><p className="filterInfo">{shownItems.length} Artikel angezeigt</p></div></div>}
    <button className="primary" onClick={() => { setTab('erfassen'); window.scrollTo({top:0, behavior:'smooth'}) }}>+ Schnell erfassen</button>
    {shownItems.length === 0 && articleFilter !== 'all' && <div className="empty">Keine passenden Artikel vorhanden.</div>}
    {shownItems.map(item => <Article key={item.id} item={item} user={user} writeOffArticle={writeOffArticle} markArticleCheckedZero={markArticleCheckedZero} setEditArticle={setEditArticle} deleteMhdEntry={deleteMhdEntry} getArticleImage={getArticleImage} settings={settings} uploadArticleImageFromMhd={uploadArticleImageFromMhd}/>)}
  </section>
}

function ArticleList({items,allCount,articleFilter,setArticleFilter,itemsLimited,allMhdLoaded,loadAllItems,user,settings,writeOffArticle,markArticleCheckedZero,setEditArticle,deleteMhdEntry,inlineMsg,safeEditOverviewItem,getArticleImage,uploadArticleImageFromMhd}){
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
        <div className="pageTitleInline"><h2>{title}</h2><InfoButton title={title}>Hier stehen die MHD-Einträge. Chef/Stationsleitung kann Einträge bearbeiten, löschen oder Abschriften speichern. Rahmenfarben gelten in jedem Design: 7–6 Tage gelb, 5–2 Tage orange, 1–0 Tage rot. Abgelaufene Artikel sind rot hinterlegt. Fällige MHD-Artikel ploppen beim Öffnen einzeln auf. Ohne Menge oder 0 bleibt der Artikel in der Liste und die Erinnerung kommt später erneut.</InfoButton></div>
        <p className="filterInfo">{shownItems.length} von {items.length} angezeigt · {allCount} Artikeln · Chef/Stationsleitung kann hier Einträge bearbeiten oder löschen.</p>
      </div>
      {itemsLimited && <button className="ghostSmall" onClick={loadAllItems}>Alle MHD laden</button>}
      {articleFilter !== 'all' && <button className="ghostSmall" onClick={() => setArticleFilter('all')}>Filter zurücksetzen</button>}
    </div>
    <input className="realInput" placeholder="Artikel suchen: Name, Art.-Nr. oder EAN" value={search} onChange={e => setSearch(e.target.value)} />
    {shownItems.length === 0 && <div className="empty">Keine passenden Artikel vorhanden.</div>}
    {shownItems.map(item => <Article key={item.id} item={item} user={user} writeOffArticle={writeOffArticle} markArticleCheckedZero={markArticleCheckedZero} setEditArticle={setEditArticle} deleteMhdEntry={deleteMhdEntry} inlineMsg={inlineMsg} getArticleImage={getArticleImage} settings={settings} uploadArticleImageFromMhd={uploadArticleImageFromMhd}/>)}
  </section>
}

function Article({item,user,settings,writeOffArticle,markArticleCheckedZero,setEditArticle,deleteMhdEntry,getArticleImage,uploadArticleImageFromMhd}){
  const [amount, setAmount] = useState('')
  const [showImage, setShowImage] = useState(false)
  const [imageSrc, setImageSrc] = useState(firstImageUrl(item.bild_url))
  const [imageLoading, setImageLoading] = useState(false)
  const [imageKnownMissing, setImageKnownMissing] = useState(item.bild_status === 'fehlt')
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

  async function openImage(){
    setShowImage(true)
    if(imageSrc || imageLoading) return
    setImageLoading(true)
    const src = await getArticleImage?.(item)
    const cleanSrc = firstImageUrl(src)
    setImageSrc(cleanSrc)
    setImageKnownMissing(!cleanSrc)
    setImageLoading(false)
  }

  async function uploadMissingImage(e){
    const src = await uploadArticleImageFromMhd?.(item, e)
    const cleanSrc = firstImageUrl(src)
    if(cleanSrc){
      setImageSrc(cleanSrc)
      setImageKnownMissing(false)
    }
  }

  const qty = Number(amount || 0)
  const stateClass = days <= 0 ? 'expiredArticle' : (days === 1 ? 'dueRedFrame' : (days <= 5 ? 'dueOrangeFrame' : (days <= 7 ? 'dueYellowFrame' : '')))
  const displayNo = item.name || item.artikel || item.artikelnummer || item.barcode || 'Artikel'
  const canAddImage = !imageSrc && (can(user, settings, 'artikel_bearbeiten') || can(user, settings, 'artikel_anlegen'))
  return <div className={'item articleItem ' + stateClass}>
    <div className="artikelnummer small articleTitleBar">{displayNo}</div>
    <div className="grow articleCardBody">
      <div className="articleMetaRow">
        <p><span>EAN:</span> {item.barcode || '-'}</p>
        <p><span>Art.-Nr.:</span> {item.artikelnummer || '-'}</p>
      </div>
      <p className={imageSrc ? 'imageStatus ok' : 'imageStatus missing'}>{imageSrc ? '📷 Bild hinterlegt' : '🚫 Kein Bild hinterlegt'}</p>
      <p className="articleMhdLine"><span>MHD:</span> {item.mhd ? new Date(item.mhd).toLocaleDateString('de-DE') : '-'} · {days <= 0 ? (days === 0 ? 'heute fällig' : `${Math.abs(days)} Tage drüber`) : `${days} Tage`}</p>
      {imageSrc && <button className="ghostSmall imageButton" type="button" onClick={openImage}>Bild anzeigen</button>}
      {canAddImage && <div className="captureRow inlineImageTools"><label className="miniUpload cardImageButton">📷 Bild aufnehmen<input type="file" accept="image/*" capture="environment" onChange={uploadMissingImage}/></label><label className="miniUpload cardImageButton">📁 Bild hochladen<input type="file" accept="image/*" onChange={uploadMissingImage}/></label></div>}
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
      <div className="actions">
        {isAdmin(user) && <button className="editBtn" onClick={() => setEditArticle(item)}>Bearbeiten</button>}
        {isAdmin(user) && <button className="danger" onClick={() => deleteMhdEntry(item)}>Löschen</button>}
        <button className="successBtn" onClick={() => writeOffArticle(item, qty, 'MHD')} title="Kontrolle speichern: Menge 0 entfernt nur den Eintrag, Menge größer 0 erstellt eine MHD-Abschrift">Kontrolle speichern</button>
      </div>
    </div>
    {showImage && <div className="modalOverlay" onClick={() => setShowImage(false)}>
      <div className="modalCard imageOnlyModal" onClick={e => e.stopPropagation()}>
        <h2>Bild anzeigen</h2>
        {imageLoading ? <div className="empty">Bild wird geladen...</div> : (imageSrc ? <img className="smallProductImage" src={imageSrc} alt={item.name || item.artikel || 'Artikelbild'} loading="lazy" decoding="async"/> : <div className="empty">Kein Bild hinterlegt.</div>)}
        <button type="button" onClick={() => setShowImage(false)}>Schließen</button>
      </div>
    </div>}
  </div>
}


function Erfassen({form,setForm,setScannerOpen,lookupBarcode,uploadFormImg,addItem,user,inlineMsg,masterArticles=[],reportMissingArticle,saveMasterArticle}){
  const [searchTerm, setSearchTerm] = useState('')
  const [articleNumberTerm, setArticleNumberTerm] = useState('')
  const [searchMsg, setSearchMsg] = useState(null)
  const [missingMode, setMissingMode] = useState(false)
  const [missingDialog, setMissingDialog] = useState({ open:false, ean:'', artikelnummer:'', name:'', bild_url:'' })
  const [mhdInputMode, setMhdInputMode] = useState('full')

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
    setSearchTerm(article.barcode || '')
    setArticleNumberTerm(article.artikelnummer || '')
    appFeedback('click')
    setSearchMsg({type:'success', text:'✓ Artikel gefunden: ' + (article.name || article.barcode)})
    return true
  }

  function suche(value, options = {}){
    const { openMissing = false, mode = 'any' } = options
    const term = String(value || '').trim()
    if(!term) return false

    const found = masterArticles.find(a => {
      const byArticle = String(a.artikelnummer || '').trim() === term
      const byEan = codesEqual(a.barcode, term)
      if(mode === 'artikelnummer') return byArticle
      if(mode === 'ean') return byEan
      return byArticle || byEan
    })

    if(found) return übernehmen(found)

    const clean = term.replace(/\D/g,'')
    if(clean && mode !== 'artikelnummer'){
      setForm(f => ({...f, barcode:clean, artikelnummer:f.artikelnummer || ''}))
    }
    if(clean && mode === 'artikelnummer'){
      setForm(f => ({...f, artikelnummer:clean}))
    }

    // Bei manueller Eingabe nur suchen und keine Meldemaske erzwingen.
    // Die Meldemaske öffnet nur beim echten Scanner oder bewusstem Enter im EAN-Feld.
    if(openMissing && clean && mode !== 'artikelnummer'){
      appFeedback('warning')
      setMissingMode(true)
      setMissingDialog({ open:true, ean:clean, artikelnummer:'', name:'', bild_url:'' })
      setSearchMsg({type:'warning', text:'Artikel nicht in Artikelliste gefunden. Bitte Namen eingeben und als fehlenden Artikel melden.'})
    }else{
      setSearchMsg({type:'warning', text:'Noch kein Treffer gefunden. EAN vollständig eingeben, Barcode scannen oder Artikelnummer prüfen.'})
    }
    return false
  }

  function handleSearch(value){
    const clean = String(value || '').replace(/\D/g,'')
    setSearchTerm(clean)
    setForm(f => ({...f, barcode:clean}))
    if(clean.length >= 3) suche(clean, { openMissing:false, mode:'ean' })
  }

  function handleArticleNumberSearch(value){
    const clean = String(value || '').replace(/\D/g,'')
    setArticleNumberTerm(clean)
    setForm(f => ({...f, artikelnummer:clean}))
    if(clean.length >= 1) suche(clean, { openMissing:false, mode:'artikelnummer' })
  }

  function handleBarcode(value){
    const clean = String(value || '').replace(/\D/g,'')
    setSearchTerm(clean)
    setForm(f => ({...f, barcode:clean}))
    if(clean.length >= 3) suche(clean, { openMissing:false, mode:'ean' })
  }

  useEffect(() => {
    function onScan(e){
      const code = String(e.detail || '').replace(/\D/g,'')
      if(code){
        setSearchTerm(code)
        setForm(f => ({...f, barcode:code}))
        setTimeout(() => suche(code, { openMissing:true, mode:'ean' }), 50)
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
    const ok = await reportMissingArticle?.(clean, 'EAN wurde beim Erfassen gescannt, aber nicht in der Artikelliste gefunden.', name, missingDialog.bild_url || '')
    if(!ok){ appFeedback('error'); setSearchMsg({type:'error', text:'Fehlender Artikel konnte nicht gespeichert werden.'}); return }
    setSearchMsg({type:'success', text:'✓ Fehlender Artikel wurde an Chef/Stationsleitung gemeldet.'})
    setForm(f => ({...f, barcode:'', artikelnummer:'', name:''}))
    setSearchTerm('')
    setArticleNumberTerm('')
    setMissingMode(false)
    setMissingDialog({ open:false, ean:'', artikelnummer:'', name:'', bild_url:'' })
    appFeedback('success')
  }

  async function uploadMissingDialogImage(e){
    const file = await compressImageFile(e.target.files?.[0])
    if(!file) return
    const url = await fileToDataUrl(file)
    setMissingDialog(d => ({...d, bild_url:url}))
    appFeedback('success')
  }

  async function createArticleFromMissingDialog(){
    const clean = String(missingDialog.ean || form.barcode || searchTerm || '').replace(/\D/g,'')
    const artikelnummer = String(missingDialog.artikelnummer || '').trim()
    const name = String(missingDialog.name || '').trim()
    if(!clean){ appFeedback('error'); setSearchMsg({type:'error', text:'Bitte erst EAN scannen oder eingeben.'}); return }
    if(!artikelnummer){ appFeedback('error'); setSearchMsg({type:'error', text:'Bitte interne Artikelnummer eingeben.'}); return }
    if(!name){ appFeedback('error'); setSearchMsg({type:'error', text:'Bitte Artikelnamen eingeben.'}); return }
    const ok = await saveMasterArticle?.({ barcode:clean, artikelnummer, name, bild_url:missingDialog.bild_url || '', kategorie:'Sonstiges' })
    if(ok === false){ appFeedback('error'); setSearchMsg({type:'error', text:'Artikel konnte nicht angelegt werden.'}); return }
    setForm(f => ({...f, barcode:clean, artikelnummer, name, bild_url:missingDialog.bild_url || f.bild_url || '', kategorie:f.kategorie || 'Sonstiges'}))
    setSearchTerm(clean)
    setArticleNumberTerm(artikelnummer)
    setMissingMode(false)
    setMissingDialog({ open:false, ean:'', artikelnummer:'', name:'', bild_url:'' })
    setSearchMsg({type:'success', text:'✓ Artikel wurde direkt in der Artikelliste angelegt. MHD kann jetzt eingetragen werden.'})
    appFeedback('success')
  }

  function closeMissingDialog(){
    setMissingDialog({ open:false, ean:'', artikelnummer:'', name:'', bild_url:'' })
  }

  const nameReadOnly = !isAdmin(user) && !missingMode

  return <section className="formCard">
    <PageTitle title="Artikel erfassen" info="Hier wird ein Artikel gescannt oder per EAN/Artikelnummer gesucht und anschließend mit MHD gespeichert." />

    {missingDialog.open && <div className="modalOverlay">
      <div className="modalCard missingArticleDialog">
        <h2>Artikel nicht gefunden</h2>
        <div className="submitHint">Diese EAN ist nicht in der Artikelliste. Bitte Artikelnamen eingeben und an Chef/Stationsleitung melden.</div>
        <label>EAN / Barcode</label>
        <input className="realInput" value={missingDialog.ean} readOnly />
        {isAdmin(user) && <>
          <label>Interne Artikelnummer</label>
          <input
            className="realInput"
            placeholder="Interne Artikelnummer eingeben"
            value={missingDialog.artikelnummer || ''}
            onChange={e => setMissingDialog(d => ({...d, artikelnummer:e.target.value}))}
          />
        </>}
        <label>Artikelname</label>
        <input
          className="realInput"
          autoFocus
          placeholder="Name des Artikels eingeben"
          value={missingDialog.name}
          onChange={e => setMissingDialog(d => ({...d, name:e.target.value}))}
          onKeyDown={e => { if(e.key === 'Enter'){ e.preventDefault(); isAdmin(user) ? createArticleFromMissingDialog() : meldenFehlendenArtikel(missingDialog.ean, missingDialog.name) } }}
        />
        {isAdmin(user) && <>
          <div className="captureRow">
            <label className="upload captureButton">📷 Bild aufnehmen<input type="file" accept="image/*" capture="environment" onChange={uploadMissingDialogImage}/></label>
            <label className="upload captureButton">📁 Bild hochladen<input type="file" accept="image/*" onChange={uploadMissingDialogImage}/></label>
          </div>
          {missingDialog.bild_url && <img className="preview" src={missingDialog.bild_url} loading="lazy" decoding="async"/>}
        </>}
        <div className="modalActions">
          <button className="ghostSmall" type="button" onClick={closeMissingDialog}>Abbrechen</button>
          {isAdmin(user)
            ? <>
                <button className="primary" type="button" onClick={createArticleFromMissingDialog}>Artikel direkt anlegen</button>
                <button className="ghostSmall" type="button" onClick={() => meldenFehlendenArtikel(missingDialog.ean, missingDialog.name)}>Als fehlenden Artikel speichern</button>
              </>
            : <button type="button" onClick={() => meldenFehlendenArtikel(missingDialog.ean, missingDialog.name)}>An fehlende Artikel senden</button>}
        </div>
      </div>
    </div>}

    <button className="scannerButton" type="button" onClick={() => setScannerOpen(true)}>📷 Barcode scannen</button>

    <label>EAN / Barcode suchen</label>
    <input
      className="realInput"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="EAN / Barcode scannen oder eingeben"
      value={searchTerm}
      onChange={e => handleSearch(e.target.value)}
      onKeyDown={e => { if(e.key === 'Enter'){ e.preventDefault(); suche(searchTerm, { openMissing:true, mode:'ean' }) } }}
    />

    <label>Interne Artikelnummer suchen</label>
    <input
      className="realInput"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="Interne Artikelnummer"
      value={articleNumberTerm}
      onChange={e => handleArticleNumberSearch(e.target.value)}
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

    <div className="labelInfoRow"><label>MHD</label><InfoButton title="MHD-Eingabe"><p>Mit der Schaltfläche wechselst du zwischen <b>Tag/Monat/Jahr</b> und <b>Monat/Jahr</b>.</p><p><b>Tag/Monat/Jahr:</b> normales MHD, z. B. 30.06.2026. <b>Monat/Jahr:</b> wenn nur Monat und Jahr aufgedruckt sind; die App nimmt automatisch den letzten Tag des Monats.</p><p>Punkt, Komma, Slash, Minus oder nur Zahlen sind möglich.</p></InfoButton></div>
    <div className={mhdInputMode === 'full' ? 'mhdInputRow mhdInputRowNoSelect' : 'mhdInputRow mhdInputRowMonthOnly'}>
      <input
        className="realInput"
        type="text"
        inputMode="numeric"
        placeholder={mhdInputMode === 'month' ? 'MM.JJJJ, z. B. 12.2026' : 'TT.MM.JJJJ'}
        value={mhdEntryValue(form.mhd || '', mhdInputMode)}
        onChange={e => setForm({...form, mhd:e.target.value, mhd_mode:mhdInputMode})}
        onBlur={e => {
          const iso = normalizeMhdInputMode(e.target.value, mhdInputMode)
          if(iso) setForm({...form, mhd:iso, mhd_mode:mhdInputMode})
        }}
      />
      {mhdInputMode === 'full' && <label className="calendarPickerButton">
        <span>📅 Kalender</span>
        <input
          type="date"
          min={todayISO()}
          aria-label="MHD per Kalender auswählen"
          value={normalizeMhdInputMode(form.mhd, 'full') || ''}
          onChange={e => setForm({...form, mhd:e.target.value, mhd_mode:mhdInputMode})}
        />
      </label>}
    </div>

    <div className="mhdModeSwitch mhdModeSwitchBelow" role="group" aria-label="MHD Eingabeart auswählen">
      <button
        type="button"
        className={mhdInputMode === 'full' ? 'active' : ''}
        onClick={() => { setMhdInputMode('full'); setForm({...form, mhd:'', mhd_mode:'full'}) }}
      >Tag / Monat / Jahr</button>
      <button
        type="button"
        className={mhdInputMode === 'month' ? 'active' : ''}
        onClick={() => { setMhdInputMode('month'); setForm({...form, mhd:'', mhd_mode:'month'}) }}
      >Monat / Jahr</button>
    </div>
    <p className="mhdModeHelp">{mhdInputMode === 'month' ? 'Monat/Jahr: z. B. 12.2026 eingeben, gespeichert wird automatisch der letzte Tag im Monat.' : 'Tag/Monat/Jahr: vollständiges MHD eingeben oder Kalender nutzen.'}</p>
    <InlineFeedback msg={inlineMsg?.erfassen}/>
    <button className="primary" onClick={addItem}>Speichern</button>

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



    {isAdmin(user) && <div className="captureRow"><label className="upload captureButton">📷 Bild aufnehmen<input type="file" accept="image/*" capture="environment" onChange={uploadFormImg}/></label><label className="upload captureButton">📁 Bild hochladen<input type="file" accept="image/*" onChange={uploadFormImg}/></label></div>}
    {form.bild_url && <img className="preview" src={form.bild_url} loading="lazy" decoding="async"/>}
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
    <div className="sectionTopInfo"><InfoButton title="Backwaren">Tagesende ist die normale Backwaren-Abschrift. MHD und Bruch findest du unter Sonderabschrift.</InfoButton></div>
    <div className="stickySubmit">
      <div><h2>Backwaren Tagesende</h2><p>{entries.length} Positionen · {total} Stück</p></div>
      <button disabled={!entries.length || sending} onClick={submit}>{sending ? 'Speichern...' : 'Alles absenden'}</button>
    </div>
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

function Abschriften({writeoffs,user,setEditWriteoff,deleteWriteoff,deleteWriteoffsForDay,undoWriteoff,pdfPassword=''}){
  const groups = groupByDay(writeoffs)
  const [openDay, setOpenDay] = useState(groups[0]?.[0] || '')

  return <section className="list">
    <div className="sectionHeader">
      <PageTitle title="Abschriften" info="Hier werden Tages-Abschriften angezeigt, als PDF gespeichert oder tagesweise gelöscht." />
    </div>
    {groups.length === 0 && <div className="empty">Keine Abschriften vorhanden.</div>}

    {groups.map(([day, entries]) => <div className="dayGroup" key={day}>
      <div className="dayHeader">
        <button className="dayHeaderToggle" onClick={() => setOpenDay(openDay === day ? '' : day)}>
          <span>📅 {formatDateDE(day)}</span>
          <b>❌ {entries.length} Abschriften</b>
        </button>
        <div className="dayHeaderActions">
          <button className="dayPdfBtn" onClick={() => exportAbschriftenPDF(entries, 'Abschriften', day, pdfPassword)}>📄 PDF</button>
          {isAdmin(user) && <button className="dayDeleteBtn" onClick={() => deleteWriteoffsForDay(day, entries)}>🗑️ Löschen</button>}
        </div>
      </div>

      {openDay === day && <div className="dayContent">
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
        <button className="pdfButton" onClick={() => exportAbschriftenPDF(entries, 'Kontrollen', day, pdfPassword)}>PDF-Liste speichern</button>
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


function normalizeCompareText(value){
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,' ')
    .trim()
}

function extractMissingName(row){
  const direct = String(row?.artikelname || row?.name || '').trim()
  if(direct) return direct
  const hint = String(row?.hinweis || '')
  const m = hint.match(/Artikelname:\s*(.*?)\s*(?:·|$)/i)
  return (m?.[1] || '').trim()
}

function extractMissingArtNr(row){
  return String(row?.artikelnummer || row?.interne_artikelnummer || row?.artnr || '').trim()
}

function findMissingMatches(row, masterArticles=[]){
  const ean = cleanCode(row?.barcode)
  const artNr = extractMissingArtNr(row)
  const name = extractMissingName(row)
  const nameNorm = normalizeCompareText(name)
  const nameWords = nameNorm.split(' ').filter(w => w.length >= 3)
  const scored = (masterArticles || []).map(article => {
    const reasons = []
    if(ean && codesEqual(article?.barcode, ean)) reasons.push('EAN')
    if(artNr && String(article?.artikelnummer || '').trim() === artNr) reasons.push('Art.-Nr.')
    const articleNameNorm = normalizeCompareText(article?.name || article?.artikel || '')
    if(nameNorm && articleNameNorm){
      if(articleNameNorm === nameNorm) reasons.push('Name exakt')
      else if(articleNameNorm.includes(nameNorm) || nameNorm.includes(articleNameNorm)) reasons.push('Name ähnlich')
      else if(nameWords.length && nameWords.filter(w => articleNameNorm.includes(w)).length >= Math.min(2, nameWords.length)) reasons.push('Name ähnlich')
    }
    return reasons.length ? {article, reasons} : null
  }).filter(Boolean)
  return scored.slice(0,5)
}

function MissingArticles({missingArticles,masterArticles=[],markMissingDone,takeOverMissingArticle,useExistingForMissing,recheckMissingArticle}){
  const open = missingArticles.filter(x => x.status !== 'erledigt')
  const getMissingName = (row) => extractMissingName(row) || 'Ohne Namen'
  return <section className="formCard">
    <PageTitle title="Fehlende Artikel" info="Hier landen EANs, die Mitarbeiter gescannt haben, aber nicht in der Artikelliste vorhanden sind. Chef/Stationsleitung kann über EAN, interne Artikelnummer und Name vergleichen, vorhandene Artikel übernehmen, neu anlegen oder Vorschläge löschen." />
    {open.length === 0 && <div className="empty">Keine fehlenden Artikel vorhanden.</div>}
    {open.map(row => {
      const name = getMissingName(row)
      const matches = findMissingMatches(row, masterArticles)
      return <div className="missingCard" key={row.id || row.barcode}>
        <div className="missingInfo">
          <div className="missingEanLabel">EAN</div>
          <div className="missingEan">{row.barcode || '-'}</div>
          <div className="missingNameLabel">Artikelname</div>
          <div className="missingName">{name}</div>
          {extractMissingArtNr(row) && <><div className="missingNameLabel">Art.-Nr.</div><div className="missingName">{extractMissingArtNr(row)}</div></>}
          <div className="missingMeta">{row.gemeldet_von || '-'} · {row.created_at ? new Date(row.created_at).toLocaleDateString('de-DE') : ''}</div>
        </div>
        {matches.length > 0 && <div className="missingMatches">
          <b>Mögliche Treffer aus der Artikelliste</b>
          {matches.map(({article,reasons}) => <div className="missingMatch" key={article.id || article.barcode || article.artikelnummer}>
            <div>
              <strong>{article.name || article.artikel || 'Artikel ohne Namen'}</strong>
              <p>EAN: {article.barcode || '-'} · Art.-Nr.: {article.artikelnummer || '-'}</p>
              <span>Treffer über: {reasons.join(', ')}</span>
            </div>
            <button type="button" className="successBtn" onClick={() => useExistingForMissing?.(row, article)}>Vorhandenen Artikel übernehmen</button>
          </div>)}
        </div>}
        <div className="missingActions">
          <button onClick={() => recheckMissingArticle?.(row)}>Abgleich starten</button>
          <button onClick={() => takeOverMissingArticle?.(row)}>Neuen Artikel anlegen</button>
          <button onClick={() => navigator.clipboard?.writeText(row.barcode || '')}>EAN kopieren</button>
          <button onClick={() => markMissingDone(row)}>Vorschlag löschen</button>
        </div>
      </div>
    })}
  </section>
}


function MasterArticles({masterArticles, mhdItems=[], saveMasterArticle,deleteMasterArticle,setMasterScannerOpen,quickMhdFromMaster,prefillArticle,onPrefillUsed,onMissingSaved}){
  const empty = { barcode:'', artikelnummer:'', name:'', kategorie:'Sonstiges', bild_url:'' }
  const [data,setData] = useState(empty)
  const [msg,setMsg] = useState(null)
  const [articleSearch, setArticleSearch] = useState('')
  useEffect(() => {
    if(!prefillArticle) return
    setData({
      id:prefillArticle.id || undefined,
      barcode:prefillArticle.barcode || '',
      artikelnummer:prefillArticle.artikelnummer || '',
      name:prefillArticle.name || '',
      kategorie:'Sonstiges',
      bild_url:prefillArticle.bild_url || ''
    })
    setMsg({type:'warning', text:'Fehlender Artikel übernommen. Bitte Artikelnummer, Name und Bild prüfen und speichern.'})
  }, [prefillArticle])

  const filteredMasterArticles = useMemo(() => {
    const term = articleSearch.trim().toLowerCase()
    if(!term) return masterArticles
    return masterArticles.filter(a => `${a.name || ''} ${a.artikelnummer || ''} ${a.barcode || ''}`.toLowerCase().includes(term) || String(a.name || '').toLowerCase().startsWith(term))
  }, [masterArticles, articleSearch])

  function articleCardImage(article){
    if(!article) return ''
    if(article.bild_url) return article.bild_url
    const match = (mhdItems || []).find(item => {
      const sameEan = article.barcode && item.barcode && codesEqual(item.barcode, article.barcode)
      const sameArtNr = article.artikelnummer && item.artikelnummer && String(item.artikelnummer || '').trim() === String(article.artikelnummer || '').trim()
      return (sameEan || sameArtNr) && item.bild_url
    })
    return match?.bild_url || ''
  }

  function findExistingMaster(ean = data.barcode, artNr = data.artikelnummer){
    const cleanEan = String(ean || '').replace(/\D/g,'')
    const cleanArtNr = String(artNr || '').trim()
    return masterArticles.find(a => {
      if(data.id && a.id === data.id) return false
      const sameEan = cleanEan && codesEqual(a.barcode, cleanEan)
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
    const url = await fileToDataUrl(file)
    const next = {...data, bild_url:url}
    setData(next)
    if(next.id && next.barcode && next.name){
      const ok = await saveMasterArticle(next)
      setMsg(ok === false ? {type:'error', text:'Bild konnte nicht gespeichert werden.'} : {type:'success', text:'✓ Bild übernommen und gespeichert.'})
    }else{
      setMsg({type:'success', text:'✓ Bild übernommen. Beim Artikel anlegen wird es mitgespeichert.'})
    }
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
    try{
      if(!a) return
      setData({
        id:a.id || null,
        barcode:a.barcode || '',
        artikelnummer:a.artikelnummer || '',
        name:a.name || a.artikel || '',
        kategorie:a.kategorie || 'Sonstiges',
        bild_url:a.bild_url || ''
      })
      setMsg({type:'success', text:'✓ Artikel zum Bearbeiten geladen.'})
      setTimeout(() => { try{ document.querySelector('.formCard')?.scrollIntoView({behavior:'smooth', block:'start'}) }catch{} }, 50)
    }catch(err){
      console.error(err)
      setMsg({type:'error', text:'Artikel konnte nicht zum Bearbeiten geöffnet werden. Bitte Liste neu laden und erneut versuchen.'})
    }
  }

  async function uploadArticleImageDirect(article, e){
    const file = await compressImageFile(e.target.files?.[0])
    e.target.value = ''
    if(!file) return
    const url = await fileToDataUrl(file)
    const ok = await saveMasterArticle({...article, bild_url:url})
    setMsg(ok === false ? {type:'error', text:'Bild konnte nicht gespeichert werden.'} : {type:'success', text:'✓ Bild bei Artikel gespeichert.'})
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
    const ok = await saveMasterArticle(data)
    if(ok === false) return
    if(prefillArticle?.sourceRow){
      await onMissingSaved?.(prefillArticle.sourceRow)
      onPrefillUsed?.()
    }
    setData(empty)
    setMsg({type:'success', text:'✓ Artikel gespeichert und in Artikelliste übernommen.'})
  }

  return <section className={prefillArticle ? "formCard takeoverForm" : "formCard"}>
    <PageTitle title={prefillArticle ? "Fehlenden Artikel übernehmen" : "Artikelliste"} info={prefillArticle ? "Hier kann Chef/Stationsleitung einen gemeldeten Artikel direkt in die Artikelliste übernehmen." : "Hier pflegt Chef/Stationsleitung die festen Artikeldaten. Bilder können direkt am Artikel aufgenommen oder hochgeladen werden. Mitarbeiter erfassen später nur das MHD."} />

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
    {data.bild_url ? <div className="captureRow">
      <button type="button" className="ghostSmall" onClick={() => window.dispatchEvent(new CustomEvent('mhd-show-image', {detail:{src:data.bild_url, title:data.name || 'Artikelbild'}}))}>Bild anzeigen</button>
      <label className="upload captureButton">🔄 Bild ändern<input type="file" accept="image/*" onChange={upload}/></label>
    </div> : <div className="captureRow"><label className="upload captureButton">📷 Bild aufnehmen<input type="file" accept="image/*" capture="environment" onChange={upload}/></label><label className="upload captureButton">📁 Bild hochladen<input type="file" accept="image/*" onChange={upload}/></label></div>}
    {data.bild_url && <button type="button" onClick={removeBg}>✂️ Bild freistellen</button>}
    {data.bild_url && <img className="preview transparentPreview" src={data.bild_url}/>}    
    <InlineFeedback msg={msg}/>
    <button className="primary" onClick={save}>{data.id ? 'Änderung speichern' : 'Artikel anlegen'}</button>
    {data.id && <button onClick={() => setData(empty)}>Neu anlegen</button>}

    <h3>Gespeicherte Artikel</h3>
    {masterArticles.length === 0 && <div className="empty">Noch keine Artikel in der Artikelliste.</div>}
    <input className="realInput" placeholder="Artikel suchen: Name, Artikelnummer oder EAN" value={articleSearch} onChange={e => setArticleSearch(e.target.value)} />
    {filteredMasterArticles.map(a => {
      const cardImg = articleCardImage(a)
      const hasImage = !!cardImg
      return <div className="item masterArticleCard masterArticleCardFinal" key={a.id || a.barcode}>
        <div className="masterArticleNameBar">{a.name || 'Unbenannter Artikel'}</div>
        <div className="grow masterArticleInfo">
          <div className="masterArticleMetaRow">
            <p><span>EAN:</span> {a.barcode || '-'}</p>
            <p><span>Art.-Nr.:</span> {a.artikelnummer || '-'}</p>
          </div>
          <p className={hasImage ? 'imageStatus ok' : 'imageStatus missing'}>{hasImage ? '✓ Bild hinterlegt' : '✕ Kein Bild hinterlegt'}</p>
        </div>
        <div className="actions masterArticleActions">
          <button className="editBtn" onClick={() => edit({...a, bild_url: cardImg || a.bild_url || ''})}>Bearbeiten</button>
          <button className="successBtn" type="button" onClick={() => quickMhdFromMaster?.({...a, bild_url: cardImg || a.bild_url || ''})}>MHD erfassen</button>
          {cardImg && <button className="ghostSmall" type="button" onClick={() => window.dispatchEvent(new CustomEvent('mhd-show-image', {detail:{src:cardImg, title:a.name || 'Artikelbild'}}))}>Bild anzeigen</button>}
          {cardImg ? <label className="miniUpload cardImageButton">🔄 Bild ändern<input type="file" accept="image/*" onChange={e => uploadArticleImageDirect(a,e)}/></label> : <>
            <label className="miniUpload cardImageButton">📷 Bild aufnehmen<input type="file" accept="image/*" capture="environment" onChange={e => uploadArticleImageDirect(a,e)}/></label>
            <label className="miniUpload cardImageButton">📁 Bild hochladen<input type="file" accept="image/*" onChange={e => uploadArticleImageDirect(a,e)}/></label>
          </>}
          <button className="danger" onClick={() => deleteMasterArticle(a)}>Löschen</button>
        </div>
      </div>
    })}
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
  const labelsFromSettings = (() => {
    try{
      const parsed = JSON.parse(settings.dienstplan_monate || '[]')
      return Array.isArray(parsed) && parsed.length ? parsed : ['Mai','Juni']
    }catch{ return ['Mai','Juni'] }
  })()
  const [month, setMonth] = useState(labelsFromSettings[0] || 'Juni')
  const [editName, setEditName] = useState(month)
  const [fullOpen, setFullOpen] = useState(false)
  useEffect(() => {
    if(!labelsFromSettings.includes(month)) setMonth(labelsFromSettings[0] || 'Juni')
  }, [settings.dienstplan_monate])
  useEffect(() => { setEditName(month) }, [month])
  const key = 'dienstplan_' + slugifyMonthLabel(month)
  const src = settings[key] || ''
  const isPdf = String(src || '').startsWith('data:application/pdf')

  async function saveMonthLabels(next){
    const cleaned = Array.from(new Set(next.map(x => String(x || '').trim()).filter(Boolean)))
    await saveSetting('dienstplan_monate', JSON.stringify(cleaned.length ? cleaned : ['Juni']))
  }

  async function upload(e){
    const original = e.target.files?.[0]
    const file = await compressPlanFile(original)
    if(file){
      await saveSetting(key, await fileToDataUrl(file))
    }
    try{ e.target.value = '' }catch{}
  }

  async function renameMonth(){
    const nextName = String(editName || '').trim()
    if(!nextName) return alert('Bitte Monatsnamen eingeben.')
    const oldKey = key
    const newKey = 'dienstplan_' + slugifyMonthLabel(nextName)
    const nextLabels = labelsFromSettings.map(x => x === month ? nextName : x)
    await saveMonthLabels(nextLabels)
    if(src && newKey !== oldKey){
      await saveSetting(newKey, src)
      await saveSetting(oldKey, '')
    }
    setMonth(nextName)
  }

  async function addMonth(){
    const name = prompt('Neuen Monat eingeben, z. B. Juli')
    if(!name) return
    const clean = String(name).trim()
    if(!clean) return
    await saveMonthLabels([...labelsFromSettings, clean])
    setMonth(clean)
  }

  async function deletePlan(){
    if(!src) return
    if(!confirm('Dienstplan für ' + month + ' wirklich löschen?')) return
    await saveSetting(key, '')
  }

  return <section className="formCard">
    <PageTitle title="Dienstplan" info="Hier kann der aktuelle Dienstplan angesehen, groß geöffnet und von Chef/Stationsleitung verwaltet werden." />
    <div className="planSwitch">
      {labelsFromSettings.map(label => <button key={label} className={month === label ? 'active' : ''} onClick={() => setMonth(label)}>{label}</button>)}
      {isAdmin(user) && <button type="button" onClick={addMonth}>+ Monat</button>}
    </div>

    {isAdmin(user) && <div className="adminBox dienstplanEditBox">
      <label>Monatsname</label>
      <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="z. B. Juli" />
      <button type="button" onClick={renameMonth}>Monatsname speichern</button>
    </div>}

    {src ? <div className="dienstplanBox">{isPdf ? <iframe title="Dienstplan" src={src}></iframe> : <img src={src}/>}</div> : <div className="empty">Noch kein Dienstplan hinterlegt.</div>}

    {src && <button type="button" className="downloadBtn" onClick={() => setFullOpen(true)}>Plan groß öffnen</button>}
    {isAdmin(user) && <label className="upload">Plan hochladen/ersetzen<input type="file" accept="image/*,application/pdf" onChange={upload}/></label>}
    {isAdmin(user) && src && <button type="button" className="danger" onClick={deletePlan}>Plan löschen</button>}

    {fullOpen && <div className="modalOverlay"><div className="modalCard planFullModal">
      <h2>Dienstplan {month}</h2>
      <div className="planFullView">{isPdf ? <iframe title="Dienstplan groß" src={src}></iframe> : <img src={src} alt={'Dienstplan ' + month}/>}</div>
      <div className="modalActions"><button onClick={() => setFullOpen(false)}>Schließen</button><a className="downloadBtn" href={src} target="_blank" rel="noreferrer">In neuem Fenster öffnen</a></div>
    </div></div>}
  </section>
}

function Online({online}){
  return <section className="formCard">
    <PageTitle title="Mitarbeiter online" info="Zeigt die zuletzt aktiven Mitarbeiter in der App." />
    {online.map(o => <div className="onlineItem" key={o.nummer}><span className="dot online"></span><div><b>{o.name}</b><p>{roleLabel(o.rolle)}</p></div></div>)}
  </section>
}

function Verwaltung({employees, settings = {}, saveEmployee, deleteEmployee, resetPassword, saveEmployeeRights}){
  const [emp, setEmp] = useState({ nummer:'', name:'', rolle:'mitarbeiter' })
  const [editingNr, setEditingNr] = useState(null)
  const rightsMap = parseRightsMap(settings)
  function rightsForEmployee(e){ return {...defaultRightsForRole(e.rolle), ...(rightsMap[String(e.nummer)] || {})} }
  function toggleRight(e, key){
    const current = rightsForEmployee(e)
    const next = {...current, [key]: !current[key]}
    saveEmployeeRights?.(e.nummer, next)
  }
  return <section className="formCard">
    <PageTitle title="Mitarbeiter verwalten" info="Hier verwaltet Chef/Stationsleitung Mitarbeiter, Rollen, Passwort-Reset und einzelne Rechte." />
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
    {employees.map(e => {
      const open = String(editingNr) === String(e.nummer)
      const rights = rightsForEmployee(e)
      return <div className="item employeeCard" key={e.nummer}>
        <div className="artikelnummer small">{e.nummer}</div>
        <div className="grow"><b>{e.name}</b><p>{roleLabel(e.rolle)}</p></div>
        <div className="actions"><button onClick={() => setEditingNr(open ? null : e.nummer)}>{open ? 'Rechte schließen' : 'Rechte'}</button><button onClick={() => resetPassword(e)}>PW 0000</button><button onClick={() => deleteEmployee(e)}>Löschen</button></div>
        {open && <div className="rightsPanel">
          {PERMISSION_GROUPS.map(([group, list]) => <div className="rightsGroup" key={group}>
            <h4>{group}</h4>
            {list.map(([key,label]) => <label className="rightCheck" key={key}>
              <input type="checkbox" checked={!!rights[key]} onChange={() => toggleRight(e, key)} />
              <span>{label}</span>
            </label>)}
          </div>)}
        </div>}
      </div>
    })}
  </section>
}

function Settings({enablePush, settings = {}, saveSetting, uiTheme, setUiTheme}){
  const [pdfPass, setPdfPass] = useState(settings.abschriften_pdf_passwort || '')
  useEffect(() => { setPdfPass(settings.abschriften_pdf_passwort || '') }, [settings.abschriften_pdf_passwort])
  return <section className="formCard">
    <PageTitle title="Einstellungen" info="Hier werden Push, Ton und Vibration verwaltet." />
    <button onClick={enablePush}>🔔 Push aktivieren/testen</button>
    <div className="adminBox">
      <b>Ton & Vibration testen</b>
      <p>Hier kann jeder prüfen, wie sich Erfolg, Fehler und MHD-Alarm auf diesem Gerät anhören und anfühlen.</p>
      <div className="feedbackTestGrid">
        <button type="button" className="feedbackSuccess" onClick={() => appFeedback('success')}>✅ Erfolg testen</button>
        <button type="button" className="feedbackError" onClick={() => appFeedback('error')}>❌ Fehler testen</button>
        <button type="button" className="feedbackAlarm" onClick={() => mhdOpenAlarm()}>🔔 MHD-Alarm testen</button>
      </div>
      <button type="button" className="ghostSmall" onClick={() => stopMhdOpenAlarm()}>Alarm stoppen</button>
    </div>
    <div className="adminBox">
      <b>Design</b>
      <p>Das Design wird oben neben deinem Namen über <b>⚙️ Design</b> gewählt. Jeder Mitarbeiter kann sein eigenes Design auf diesem Gerät speichern.</p>
    </div>
    <div className="adminBox">
      <b>PDF-Schutz Abschriften</b>
      <p>Optionales Passwort für die Abschriften-PDF. Leer lassen = PDF ohne Passwort.</p>
      <input type="text" placeholder="PDF Passwort" value={pdfPass} onChange={e => setPdfPass(e.target.value)} />
      <button type="button" onClick={() => saveSetting?.('abschriften_pdf_passwort', pdfPass.trim())}>PDF-Passwort speichern</button>
    </div>
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
    if(isPastMhd(data.mhd)){
      setLocalMsg({type:'error', text:'MHD darf nicht in der Vergangenheit liegen.'})
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
    <input type="date" min={todayISO()} value={data.mhd || todayISO()} onChange={e => setData({...data, mhd:e.target.value})}/>

    <label>EAN / Barcode</label>
    <input placeholder="EAN / Barcode" value={data.barcode || ''} onChange={e => setData({...data, barcode:e.target.value.replace(/\D/g,'')})}/>

    {data.bild_url ? <div className="captureRow">
      <button type="button" className="ghostSmall" onClick={() => window.dispatchEvent(new CustomEvent('mhd-show-image', {detail:{src:data.bild_url, title:data.name || data.artikel || 'Artikelbild'}}))}>Bild anzeigen</button>
      <label className="upload captureButton">🔄 Bild ändern<input type="file" accept="image/*" onChange={upload}/></label>
    </div> : <div className="captureRow"><label className="upload captureButton">📷 Bild aufnehmen<input type="file" accept="image/*" capture="environment" onChange={upload}/></label><label className="upload captureButton">📁 Bild hochladen<input type="file" accept="image/*" onChange={upload}/></label></div>}
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
  const zxingReaderRef = useRef(null)
  const detectedRef = useRef(false)
  const [manual, setManual] = useState('')
  const [message, setMessage] = useState('Kamera wird gestartet...')
  const [scanMsg, setScanMsg] = useState(null)

  function stopCamera(){
    try{ cancelAnimationFrame(rafRef.current) }catch{}
    try{ zxingReaderRef.current?.reset?.() }catch{}
    zxingReaderRef.current = null
    try{ streamRef.current?.getTracks()?.forEach(t => t.stop()) }catch{}
  }

  const scanHitsRef = useRef({ code:'', count:0 })

  function finishDetected(code, options = {}){
    const clean = String(code || '').replace(/\D/g,'')
    if(!clean || detectedRef.current) return
    const manualInput = !!options.manual

    if(!manualInput){
      if(clean.length === 12 && clean.startsWith('0')){
        setScanMsg({type:'warning', text:'Unsicher erkannt: ' + clean + '. Bitte EAN auf der Packung prüfen oder manuell eingeben.'})
        return
      }
      if(!isLikelyProductBarcode(clean)) return
      const prev = scanHitsRef.current
      const nextCount = prev.code === clean ? prev.count + 1 : 1
      scanHitsRef.current = { code:clean, count:nextCount }
      if(nextCount < 2){
        setScanMsg({type:'warning', text:'Barcode erkannt: ' + clean + ' – bitte kurz ruhig halten...'})
        return
      }
    }

    detectedRef.current = true
    setScanMsg({type:'success', text:'✓ Barcode erkannt: ' + clean})
    stopCamera()
    setTimeout(() => onDetected(clean), 250)
  }

  useEffect(() => {
    let stopped = false
    let zxingStarted = false

    async function startCamera(){
      try{
        if(!navigator.mediaDevices?.getUserMedia){
          throw new Error('Keine Kamerafunktion im Browser.')
        }

        const constraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
            advanced: [{ focusMode: 'continuous' }]
          }
        }

        let stream
        try{
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        }catch{
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false })
        }

        streamRef.current = stream
        if(videoRef.current){
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline','true')
          videoRef.current.setAttribute('webkit-playsinline','true')
          await videoRef.current.play()
        }

        try{
          const track = stream.getVideoTracks?.()[0]
          await track?.applyConstraints?.({ advanced:[{ focusMode:'continuous' }] })
        }catch{}

        setMessage('Barcode ruhig, hell und nah vor die Kamera halten.')
        setScanMsg({type:'success', text:'✓ Kamera bereit. iPhone: bei Bedarf etwas näher ran oder manuell eingeben.'})

        startNativeBarcodeDetector()
        setTimeout(() => { if(!stopped && !detectedRef.current) startZXing() }, 900)
        setTimeout(() => { if(!stopped && !detectedRef.current) setScanMsg({type:'warning', text:'Wenn der iPhone-Scan nicht erkennt: EAN unten manuell eingeben.'}) }, 8000)
      }catch(e){
        console.warn(e)
        setMessage('Kamera konnte nicht scannen. Bitte Berechtigung erlauben oder Code manuell eingeben.')
        setScanMsg({type:'error', text:'Scanner nicht bereit. Manuelle Eingabe ist möglich.'})
      }
    }

    function startNativeBarcodeDetector(){
      if(!('BarcodeDetector' in window)) return
      let detector
      try{
        detector = new window.BarcodeDetector({
          formats: ['ean_13','ean_8']
        })
      }catch{ return }

      const scan = async () => {
        if(stopped || detectedRef.current) return
        try{
          if(videoRef.current && videoRef.current.readyState >= 2){
            const codes = await detector.detect(videoRef.current)
            const code = codes?.[0]?.rawValue || codes?.[0]?.rawValueText
            if(code) return finishDetected(code)
          }
        }catch{}
        rafRef.current = requestAnimationFrame(scan)
      }
      scan()
    }

    async function startZXing(){
      if(zxingStarted || stopped || detectedRef.current) return
      zxingStarted = true
      try{
        if(!window.ZXing){
          await new Promise((resolve,reject) => {
            const existing = document.querySelector('script[data-zxing="true"]')
            if(existing){ existing.addEventListener('load', resolve, {once:true}); existing.addEventListener('error', reject, {once:true}); return }
            const script = document.createElement('script')
            script.dataset.zxing = 'true'
            script.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js'
            script.onload = resolve
            script.onerror = reject
            document.head.appendChild(script)
          })
        }

        const hints = new Map()
        try{
          const BarcodeFormat = window.ZXing.BarcodeFormat
          const DecodeHintType = window.ZXing.DecodeHintType
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13, BarcodeFormat.EAN_8
          ])
          hints.set(DecodeHintType.TRY_HARDER, true)
        }catch{}

        const reader = new window.ZXing.BrowserMultiFormatReader(hints, 450)
        zxingReaderRef.current = reader
        const devices = await window.ZXing.BrowserCodeReader.listVideoInputDevices()
        const backCam = devices.find(d => /back|rear|environment|rück|kamera 0/i.test(d.label))
        const deviceId = backCam?.deviceId || devices[devices.length - 1]?.deviceId || undefined

        setMessage('Scanner bereit. Barcode ruhig vor die Kamera halten.')
        await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
          if(result) finishDetected(result.getText())
        })
      }catch(e){
        console.warn(e)
        if(!detectedRef.current){
          setMessage('Scanner konnte nicht automatisch lesen. Bitte Barcode manuell eingeben.')
          setScanMsg({type:'warning', text:'Manuelle Eingabe ist möglich.'})
        }
      }
    }

    startCamera()
    return () => { stopped = true; stopCamera() }
  }, [])

  return <div className="modalOverlay"><div className="modalCard scannerCard">
    <h2>Barcode scannen</h2>
    <p>{message}</p>
    <InlineFeedback msg={scanMsg}/>
    <video ref={videoRef} className="scannerVideo" autoPlay muted playsInline></video>
    <label>Barcode manuell eingeben</label>
    <input inputMode="numeric" pattern="[0-9]*" placeholder="EAN / Barcode" value={manual} onChange={e => setManual(e.target.value.replace(/\D/g,''))} onKeyDown={e => { if(e.key === 'Enter' && manual){ e.preventDefault(); finishDetected(manual, {manual:true}) } }}/>
    <button disabled={!manual} onClick={() => finishDetected(manual, {manual:true})}>Übernehmen</button>
    <button onClick={() => { stopCamera(); onClose() }}>Schließen</button>
  </div></div>
}
