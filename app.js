import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const tabs = {
  week: { btn: document.getElementById('tab-week'), view: document.getElementById('view-week') },
  history: { btn: document.getElementById('tab-history'), view: document.getElementById('view-history') },
  settings: { btn: document.getElementById('tab-settings'), view: document.getElementById('view-settings') },
};
Object.entries(tabs).forEach(([name, {btn, view}]) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('main.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active'); view.classList.add('active');
    if (name === 'history') loadHistory();
    if (name === 'settings') loadSettings();
  });
});

function startOfWeek(d) { const x = new Date(d); const day = x.getDay(); x.setHours(0,0,0,0); x.setDate(x.getDate() - day); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function isoDate(d) { return d.toISOString().slice(0,10); }
function labelDate(d) { return d.toLocaleDateString(undefined, { month:'short', day:'numeric' }); }
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CONFIG_DOC = doc(db, 'config', 'global');

async function ensureDefaultConfig() {
  const snap = await getDoc(CONFIG_DOC);
  if (!snap.exists()) {
    await setDoc(CONFIG_DOC, {
      checkItems: [
        { id: 'followedMenu', label: 'Followed menu' },
        { id: 'workedOut', label: 'Worked out' }
      ],
      reminderTime: '18:00'
    });
  }
}
async function getConfig() {
  await ensureDefaultConfig();
  const snap = await getDoc(CONFIG_DOC);
  return snap.data();
}

let currentWeekStart = startOfWeek(new Date());
const weekRangeEl = document.getElementById('week-range');
const gridEl = document.getElementById('week-grid');
document.getElementById('prev-week').onclick = ()=>{ currentWeekStart = addDays(currentWeekStart,-7); renderWeek(); };
document.getElementById('next-week').onclick = ()=>{ currentWeekStart = addDays(currentWeekStart, 7); renderWeek(); };

async function renderWeek() {
  const cfg = await getConfig();
  const start = currentWeekStart, end = addDays(start, 6);
  weekRangeEl.textContent = labelDate(start) + ' – ' + labelDate(end);
  gridEl.innerHTML = '';
  for (let i=0;i<7;i++) {
    const d = addDays(start, i);
    const card = createDayCard(d, cfg.checkItems);
    gridEl.appendChild(card);
    loadEntryIntoCard(d, card, cfg.checkItems);
  }
}

function createDayCard(date, checkItems) {
  const tpl = document.getElementById('day-card-template');
  const node = tpl.content.cloneNode(true);
  node.querySelector('.day-name').textContent = dayNames[date.getDay()];
  node.querySelector('.date-str').textContent = labelDate(date);
  const checksEl = node.querySelector('.checks');
  checkItems.forEach(item => {
    const row = document.createElement('label'); row.className = 'check-row';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.id = item.id;
    const span = document.createElement('span'); span.textContent = item.label;
    row.appendChild(cb); row.appendChild(span); checksEl.appendChild(row);
  });
  const saveBtn = node.querySelector('.save');
  saveBtn.addEventListener('click', async () => {
    const entry = collectEntryFromCard(date, node);
    await setDoc(doc(db, 'entries', entry.date), entry);
    saveBtn.textContent = 'Saved ✓'; setTimeout(()=> saveBtn.textContent='Save', 1200);
  });
  return node;
}

function collectEntryFromCard(date, fragment) {
  const root = fragment instanceof DocumentFragment ? fragment : fragment.parentNode;
  const dinner = root.querySelector('.dinner').value.trim();
  const rating = root.querySelector('.rating').value ? Number(root.querySelector('.rating').value) : null;
  const notes = root.querySelector('.notes').value.trim();
  const checkMap = {};
  root.querySelectorAll('.checks input[type="checkbox"]').forEach(cb => { checkMap[cb.dataset.id] = cb.checked; });
  return {
    date: isoDate(date),
    dinner, rating, notes,
    checks: checkMap
  };
}

async function loadEntryIntoCard(date, fragment, checkItems) {
  const id = isoDate(date);
  const snap = await getDoc(doc(db, 'entries', id));
  const root = gridEl.lastElementChild;
  if (snap.exists()) {
    const e = snap.data();
    root.querySelector('.dinner').value = e.dinner || '';
    root.querySelector('.rating').value = e.rating || '';
    root.querySelector('.notes').value = e.notes || '';
    root.querySelectorAll('.checks input[type="checkbox"]').forEach(cb => {
      cb.checked = !!(e.checks && e.checks[cb.dataset.id]);
    });
  }
}

async function loadHistory() {
  const nw = Number(document.getElementById('history-weeks').value || 12);
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  const today = new Date();
  const start = addDays(today, -7*nw);
  const qq = query(collection(db, 'entries'), orderBy('date', 'desc'), limit(7*nw+14));
  const snap = await getDocs(qq);
  const byWeek = new Map();
  snap.forEach(docu => {
    const e = docu.data();
    const d = new Date(e.date+'T00:00:00');
    if (d < start) return;
    const ws = startOfWeek(d).toISOString().slice(0,10);
    if (!byWeek.has(ws)) byWeek.set(ws, []);
    byWeek.get(ws).push(e);
  });
  const weeks = Array.from(byWeek.entries()).sort((a,b)=> a[0]<b[0]?1:-1);
  weeks.forEach(([ws, arr]) => {
    const avg = averageRating(arr);
    const pctFollow = percentageTrue(arr, 'followedMenu');
    const card = document.createElement('div');
    card.className='history-card';
    const startD = new Date(ws+'T00:00:00');
    const endD = addDays(startD,6);
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline">
      <div><strong>${startD.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${endD.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</strong></div>
      <div class="note">${arr.length} days</div>
    </div>
    <div>Avg rating: <strong>${isNaN(avg)?'—':avg.toFixed(2)}</strong></div>
    <div>% followed menu: <strong>${isNaN(pctFollow)?'—':(pctFollow*100).toFixed(0)}%</strong></div>`;
    list.appendChild(card);
  });
}
function averageRating(arr){ const r = arr.map(e=>Number(e.rating||0)).filter(Boolean); return r.length? r.reduce((a,b)=>a+b)/r.length : NaN; }
function percentageTrue(arr, id){
  let total=0, yes=0;
  arr.forEach(e=>{ if (e.checks && id in e.checks){ total++; if (e.checks[id]) yes++; } });
  return total? yes/total : NaN;
}

async function loadSettings(){
  const cfg = await getConfig();
  const list = document.getElementById('checkitems-list');
  list.innerHTML = '';
  cfg.checkItems.forEach((it, idx)=>{
    const row = document.createElement('div'); row.className='item';
    const input = document.createElement('input'); input.value = it.label; input.dataset.id = it.id;
    const del = document.createElement('button'); del.textContent='Remove';
    del.onclick = async ()=>{
      const next = cfg.checkItems.filter(c=>c.id!==it.id);
      await setDoc(CONFIG_DOC, { ...cfg, checkItems: next });
      loadSettings();
    };
    input.addEventListener('change', async ()=>{
      cfg.checkItems[idx].label = input.value.trim() || cfg.checkItems[idx].label;
      await setDoc(CONFIG_DOC, cfg);
    });
    row.appendChild(input); row.appendChild(del); list.appendChild(row);
  });
  const addBtn = document.getElementById('add-checkitem');
  const input = document.getElementById('new-checkitem');
  addBtn.onclick = async ()=>{
    const label = (input.value||'').trim();
    if(!label) return;
    const id = label.replace(/\W+/g,'').replace(/^\d+/,'').slice(0,24) || ('item'+Math.random().toString(36).slice(2,8));
    const next = [...cfg.checkItems, { id, label }];
    await setDoc(CONFIG_DOC, { ...cfg, checkItems: next });
    input.value=''; loadSettings();
  };
  const timeEl = document.getElementById('reminder-time');
  timeEl.value = cfg.reminderTime || '18:00';
  document.getElementById('save-reminder').onclick = async ()=>{
    await setDoc(CONFIG_DOC, { ...cfg, reminderTime: timeEl.value || '18:00' });
    alert('Reminder time saved.');
  };
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}

renderWeek();
document.getElementById('history-weeks').addEventListener('change', loadHistory);