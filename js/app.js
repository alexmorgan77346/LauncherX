/* =====================================================================
   FIREBASE INIT
   firebaseConfig itself lives in js/firebase-config.js (loaded before
   this file) so you only ever have to edit one small, obvious file.
   ===================================================================== */
const firebaseReady = typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY";

let auth = null, db = null, currentUser = null, saveTimer = null;

if(firebaseReady){
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  document.getElementById('auth-config-warning').style.display = 'none';
} else {
  // No Firebase project configured yet — skip straight into the app in local demo mode.
  document.getElementById('auth-screen').classList.add('hidden');
}

let authMode = 'login';
function setAuthMode(mode){
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode==='login');
  document.getElementById('tab-signup').classList.toggle('active', mode==='signup');
  document.getElementById('auth-title').textContent = mode==='login' ? 'Welcome back' : 'Create your account';
  document.getElementById('auth-submit').textContent = mode==='login' ? 'Log In' : 'Sign Up';
  document.getElementById('auth-error').textContent = '';
}
async function submitAuth(){
  if(!firebaseReady) return;
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('auth-submit');
  errEl.textContent = '';
  if(!email || !password){ errEl.textContent = 'Enter your email and password.'; return; }
  if(password.length < 6){ errEl.textContent = 'Password must be at least 6 characters.'; return; }
  btn.disabled = true;
  try{
    if(authMode==='login'){
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      await auth.createUserWithEmailAndPassword(email, password);
    }
  }catch(err){
    errEl.textContent = (err.message || 'Something went wrong.').replace('Firebase: ','');
  }
  btn.disabled = false;
}
function logout(){
  if(!firebaseReady) return;
  if(!confirm('Log out of Alex Launcher?')) return;
  auth.signOut();
}

function buildSyncPayload(){
  return {
    habits: state.habits,
    notes: state.notes,
    studyGoals: state.studyGoals,
    dashHidden: dashItems.filter(d=>d.hidden).map(d=>d.id),
    pomoPresets: state.pomo.presets,
    pomoActivePreset: state.pomo.activePreset,
    pomoSessions: state.pomo.sessions,
    xp: state.xp, xpMax: state.xpMax, level: state.level,
    dark: state.dark,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}
function scheduleSave(){
  if(!firebaseReady || !currentUser) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    try{ await db.collection('users').doc(currentUser.uid).set(buildSyncPayload(), {merge:true}); }
    catch(err){ console.error('Cloud save failed:', err); }
  }, 700);
}
async function loadStateFromCloud(){
  if(!firebaseReady || !currentUser) return;
  try{
    const snap = await db.collection('users').doc(currentUser.uid).get();
    if(snap.exists){
      const data = snap.data();
      if(Array.isArray(data.habits)) state.habits = data.habits;
      if(Array.isArray(data.notes)) state.notes = data.notes;
      if(Array.isArray(data.studyGoals)) state.studyGoals = data.studyGoals;
      if(Array.isArray(data.pomoPresets)) state.pomo.presets = data.pomoPresets;
      if(data.pomoActivePreset) state.pomo.activePreset = data.pomoActivePreset;
      if(typeof data.pomoSessions === 'number') state.pomo.sessions = data.pomoSessions;
      if(typeof data.xp === 'number') state.xp = data.xp;
      if(typeof data.xpMax === 'number') state.xpMax = data.xpMax;
      if(typeof data.level === 'number') state.level = data.level;
      if(Array.isArray(data.dashHidden)) dashItems.forEach(d=> d.hidden = data.dashHidden.includes(d.id));
      if(typeof data.dark === 'boolean') state.dark = data.dark;
      const activePreset = state.pomo.presets.find(p=>p.id===state.pomo.activePreset) || state.pomo.presets[0];
      if(activePreset){ state.pomo.mode = activePreset.min; state.pomo.totalSeconds = activePreset.min*60; state.pomo.secondsLeft = activePreset.min*60; }
    } else {
      await db.collection('users').doc(currentUser.uid).set(buildSyncPayload());
    }
  }catch(err){ console.error('Cloud load failed:', err); }
  document.body.classList.toggle('dark', state.dark);
  document.getElementById('theme-toggle').textContent = state.dark ? '☀️ Light' : '🌙 Dark';
  renderDashboard(); renderHabitsMini(); renderHabitsFull(); renderNotes();
  renderStudyGoals(); renderPomoModes(); renderPomo(); renderXP();
  document.getElementById('pomo-sessions').textContent = state.pomo.sessions;
}

if(firebaseReady){
  auth.onAuthStateChanged(async (user)=>{
    currentUser = user;
    if(user){
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('qs-account-email').textContent = user.email || '';
      await loadStateFromCloud();
    } else {
      document.getElementById('auth-screen').classList.remove('hidden');
    }
  });
}

/* ============ STATE (falls back to in-memory demo data until cloud data loads) ============ */
const state = {
  dark:false,
  xp:180, xpMax:300, level:4,
  habits:[
    {emoji:'📖',name:'Read 20 pages',streak:12,done:true},
    {emoji:'💧',name:'Drink 8 glasses water',streak:9,done:true},
    {emoji:'🏋️',name:'Workout 30 min',streak:4,done:true},
    {emoji:'🧘',name:'Meditate 10 min',streak:2,done:false},
    {emoji:'💻',name:'Code 1 hour',streak:20,done:false},
  ],
  pomo:{running:false, mode:25, secondsLeft:25*60, totalSeconds:25*60, sessions:6},
  notes:[
    {title:'Project ideas', body:'Launcher onboarding flow, mascot outfits shop...', pinned:true},
    {title:'Grocery list', body:'Milk, eggs, coffee, oats', pinned:false},
    {title:'Journal — Jul 30', body:'Felt productive, finished 3 pomodoros...', pinned:false},
  ],
  drawerApps:['Chrome','Spotify','VS Code','Gmail','Camera','Gallery','Maps','WhatsApp','YouTube','Notion','Calculator','Clock',
              'Files','Calendar','Instagram','Twitter/X','Reddit','Slack'],
};

/* ============ CLOCK / GREETING ============ */
function pad(n){ return n.toString().padStart(2,'0'); }
function renderClock(){
  const now = new Date();
  let h = now.getHours(), m = now.getMinutes();
  const ampm = h>=12?'PM':'AM';
  let h12 = h%12; if(h12===0) h12=12;
  const parts = [pad(h12), pad(m)];
  const clockEl = document.getElementById('flip-clock');
  clockEl.innerHTML = `<div class="flip-digit">${parts[0]}</div><div class="flip-colon">:</div><div class="flip-digit">${parts[1]}</div><div class="flip-colon" style="font-size:16px; align-self:flex-end; margin-bottom:8px;">${ampm}</div>`;
  document.getElementById('date-line').textContent = now.toLocaleDateString(undefined,{weekday:'long', day:'numeric', month:'long'});
  const greetEl = document.getElementById('greeting');
  if(h<12) greetEl.textContent = 'Good Morning ☀️';
  else if(h<17) greetEl.textContent = 'Good Afternoon 🌤️';
  else greetEl.textContent = 'Good Evening 🌙';
}
renderClock();
setInterval(renderClock, 15000);

/* ============ MASCOT ============ */
const mascotStates = [
  {face:'😊', msg:'Great job! Keep going.'},
  {face:'🍅', msg:'Ready to focus?'},
  {face:'💧', msg:'Drink some water!'},
  {face:'🎉', msg:'Amazing streak!'},
  {face:'😴', msg:'Time to sleep soon.'},
];
function cycleMascot(){
  const s = mascotStates[Math.floor(Math.random()*mascotStates.length)];
  document.getElementById('mascot-face').textContent = s.face;
  document.getElementById('mascot-msg').textContent = s.msg;
}
setInterval(cycleMascot, 6000);

/* ============ XP ============ */
function renderXP(){
  const pct = Math.min(100, (state.xp/state.xpMax)*100);
  document.getElementById('xp-fill').style.width = pct+'%';
  document.getElementById('xp-level').textContent = 'Level '+state.level;
  document.getElementById('xp-count').textContent = state.xp+' / '+state.xpMax+' XP';
  const ringEl = document.getElementById('xp-ring');
  if(ringEl) ringEl.innerHTML = ringSVG(pct, 90, 'var(--sun-yellow)', state.level, 'LVL');
}
function addXP(n){
  state.xp += n;
  if(state.xp >= state.xpMax){ state.xp -= state.xpMax; state.level++; state.xpMax += 50; launchConfetti(); }
  renderXP();
}
function ringSVG(pct, size, color, centerNum, centerLabel){
  const r = size/2 - 8;
  const c = 2*Math.PI*r;
  const off = c - (pct/100)*c;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-opacity="0.18" stroke-width="9" fill="none"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="9" fill="none" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size/2} ${size/2})"/>
    <text x="50%" y="47%" text-anchor="middle" font-size="${size*0.22}" font-weight="800" fill="currentColor" font-family="Baloo 2, sans-serif">${centerNum}</text>
    <text x="50%" y="66%" text-anchor="middle" font-size="${size*0.11}" font-weight="700" fill="currentColor" opacity="0.6">${centerLabel}</text>
  </svg>`;
}

/* ============ DASHBOARD ============ */
const dashItems = [
  {id:'study',   icon:'📚', label:'Study Hrs', value:'3.5h', pct:70, color:'var(--warm-blue)',  type:'study',    hidden:false},
  {id:'pomo',    icon:'🍅', label:'Pomodoros', value:'6',    pct:60, color:'#E8664E',            type:'pomodoro', hidden:false},
  {id:'workout', icon:'🏋️', label:'Workout',   value:'Done', pct:100,color:'var(--soft-green)',  type:'workout',  hidden:false},
  {id:'water',   icon:'💧', label:'Water',     value:'5/8',  pct:62, color:'#3AB0E0',            type:'water',    hidden:false},
  {id:'sleep',   icon:'😴', label:'Sleep',     value:'7.2h', pct:90, color:'#8B7CF6',            type:'sleep',    hidden:false},
  {id:'notes',   icon:'📝', label:'Notes',     value:'3',    pct:60, color:'#8B7CF6',            type:'notes',    hidden:false},
  {id:'xp',      icon:'⭐', label:'Daily XP',  value:'+60',  pct:60, color:'var(--sun-yellow)',  type:'xp',       hidden:false},
  {id:'habits',  icon:'✅', label:'Habits',    value:'3/5',  pct:60, color:'var(--soft-green)',  type:'habits',   hidden:false},
];
const dashSettingsLabel = { pomodoro:'⏱️ Session Settings', habits:'✏️ Edit Habits', study:'🎯 Study Goals', notes:'📝 Open Notes' };
const dashOpenMap = { pomodoro:'pomodoro', habits:'habits', study:'study', notes:'notes' };

function renderDashboard(){
  const grid = document.getElementById('dash-grid');
  const visible = dashItems.filter(d=>!d.hidden);
  const hidden = dashItems.filter(d=>d.hidden);

  grid.innerHTML = visible.map(d=>{
    const settingsLabel = dashSettingsLabel[d.type];
    const openable = dashOpenMap[d.type];
    return `
    <div class="dash-item" data-id="${d.id}" onclick="${openable ? `openDashTile('${d.id}')` : ''}">
      <button class="dash-menu-btn" onclick="event.stopPropagation(); toggleDashMenu('${d.id}')">⋮</button>
      <div class="dash-icon">${d.icon}</div>
      <div class="dash-label">${d.label}</div>
      <div class="dash-value">${d.value}</div>
      <div class="dash-ring">${ringSVG(d.pct, 26, d.color, '', '')}</div>
      <div class="dash-menu" id="dash-menu-${d.id}" onclick="event.stopPropagation();">
        ${settingsLabel ? `<div class="dash-menu-item" onclick="openDashSettings('${d.type}')">${settingsLabel}</div>` : ''}
        <div class="dash-menu-item danger" onclick="removeDashItem('${d.id}')">🗑️ Remove from dashboard</div>
      </div>
    </div>`;
  }).join('');

  if(hidden.length){
    grid.innerHTML += `
    <div class="add-widget-wrap">
      <div class="add-widget-tile" onclick="event.stopPropagation(); toggleAddWidgetMenu()">
        <span style="font-size:18px;">+</span><span>Add widget</span>
      </div>
      <div class="add-widget-menu" id="add-widget-menu" onclick="event.stopPropagation();">
        ${hidden.map(d=>`<div class="dash-menu-item" onclick="restoreDashItem('${d.id}')">${d.icon} ${d.label}</div>`).join('')}
      </div>
    </div>`;
  }
}
renderDashboard();

function openDashTile(id){
  const d = dashItems.find(x=>x.id===id);
  if(!d) return;
  const target = dashOpenMap[d.type];
  if(target) openPanel(target);
}

function closeAllDashMenus(){
  document.querySelectorAll('.dash-menu.open').forEach(m=>m.classList.remove('open'));
  const awm = document.getElementById('add-widget-menu');
  if(awm) awm.classList.remove('open');
}
function toggleDashMenu(id){
  const menu = document.getElementById('dash-menu-'+id);
  const wasOpen = menu.classList.contains('open');
  closeAllDashMenus();
  if(!wasOpen) menu.classList.add('open');
}
function toggleAddWidgetMenu(){
  const menu = document.getElementById('add-widget-menu');
  const wasOpen = menu.classList.contains('open');
  closeAllDashMenus();
  if(!wasOpen) menu.classList.add('open');
}
document.addEventListener('click', closeAllDashMenus);

function removeDashItem(id){
  const d = dashItems.find(x=>x.id===id);
  if(d) d.hidden = true;
  closeAllDashMenus();
  renderDashboard();
  scheduleSave();
}
function restoreDashItem(id){
  const d = dashItems.find(x=>x.id===id);
  if(d) d.hidden = false;
  closeAllDashMenus();
  renderDashboard();
  scheduleSave();
}
function openDashSettings(type){
  closeAllDashMenus();
  const target = dashOpenMap[type];
  if(target) openPanel(target);
}

/* ============ HABITS ============ */
function syncHabitsSummary(){
  const total = state.habits.length;
  const done = state.habits.filter(h=>h.done).length;
  const chip = document.getElementById('habits-count-chip');
  if(chip) chip.textContent = `${done}/${total}`;
  const tile = dashItems.find(d=>d.id==='habits');
  if(tile){
    tile.value = `${done}/${total}`;
    tile.pct = total ? Math.round((done/total)*100) : 0;
    renderDashboard();
  }
}
function renderHabitsMini(){
  const el = document.getElementById('habit-mini-list');
  el.innerHTML = state.habits.slice(0,4).map((h,i)=>`
    <div class="habit-mini">
      <div class="habit-check ${h.done?'done':''}" onclick="event.stopPropagation(); toggleHabit(${i})">${h.done?'✓':''}</div>
      <span>${h.emoji} ${h.name}</span>
    </div>`).join('');
  syncHabitsSummary();
}
function renderHabitsFull(){
  const el = document.getElementById('habit-full-list');
  el.innerHTML = state.habits.map((h,i)=>`
    <div class="habit-row">
      <div class="habit-emoji">${h.emoji}</div>
      <div class="habit-info">
        <div class="habit-name">${h.name}</div>
        <div class="habit-streak">🔥 ${h.streak} day streak</div>
      </div>
      <div class="row-actions">
        <button class="icon-btn" onclick="editHabit(${i})" title="Edit">✏️</button>
        <button class="icon-btn danger" onclick="deleteHabit(${i})" title="Delete">🗑️</button>
        <div class="habit-check-lg ${h.done?'done':''}" onclick="toggleHabit(${i}, true)">${h.done?'✓':''}</div>
      </div>
    </div>`).join('');
  syncHabitsSummary();
}
function toggleHabit(i, full){
  const h = state.habits[i];
  h.done = !h.done;
  h.streak = h.done ? h.streak+1 : Math.max(0,h.streak-1);
  if(h.done) addXP(15);
  renderHabitsMini();
  renderHabitsFull();
  scheduleSave();
}
function addHabit(){
  const name = prompt('New habit name:', 'Drink green tea');
  if(!name || !name.trim()) return;
  const emoji = prompt('Pick an emoji for it (optional):', '⭐') || '⭐';
  state.habits.push({emoji, name:name.trim(), streak:0, done:false});
  renderHabitsMini();
  renderHabitsFull();
  scheduleSave();
}
function editHabit(i){
  const h = state.habits[i];
  const name = prompt('Edit habit name:', h.name);
  if(!name || !name.trim()) return;
  h.name = name.trim();
  renderHabitsMini();
  renderHabitsFull();
  scheduleSave();
}
function deleteHabit(i){
  if(!confirm('Remove this habit?')) return;
  state.habits.splice(i,1);
  renderHabitsMini();
  renderHabitsFull();
  scheduleSave();
}
renderHabitsMini();
renderHabitsFull();
renderXP();

/* ============ STUDY GOALS ============ */
state.studyGoals = [
  {text:'Finish React module', target:10, done:4},
  {text:'Read 2 DSA chapters / week', target:5, done:5},
];
function renderStudyGoals(){
  const el = document.getElementById('goal-full-list');
  el.innerHTML = state.studyGoals.map((g,i)=>{
    const pct = Math.min(100, Math.round((g.done/g.target)*100));
    return `
    <div class="goal-row">
      <div class="goal-row-top">
        <div class="goal-row-title">${g.text}</div>
        <div class="row-actions">
          <button class="icon-btn" onclick="logStudyProgress(${i})" title="Log hours">➕</button>
          <button class="icon-btn danger" onclick="deleteStudyGoal(${i})" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="goal-row-track"><div class="goal-row-fill" style="width:${pct}%"></div></div>
      <div class="goal-row-sub">${g.done}h / ${g.target}h · ${pct}% complete</div>
    </div>`;
  }).join('');
}
function addStudyGoal(){
  const text = prompt('New study goal:', 'Complete JavaScript course');
  if(!text || !text.trim()) return;
  const target = parseFloat(prompt('Target hours:', '10')) || 10;
  state.studyGoals.push({text:text.trim(), target, done:0});
  renderStudyGoals();
  scheduleSave();
}
function logStudyProgress(i){
  const g = state.studyGoals[i];
  const hrs = parseFloat(prompt('Add how many hours studied?', '1')) || 0;
  g.done = Math.min(g.target, g.done + hrs);
  if(hrs>0) addXP(10);
  renderStudyGoals();
  scheduleSave();
}
function deleteStudyGoal(i){
  if(!confirm('Delete this goal?')) return;
  state.studyGoals.splice(i,1);
  renderStudyGoals();
  scheduleSave();
}
renderStudyGoals();

/* ============ POMODORO ============ */
let pomoInterval = null;
state.pomo.presets = [
  {id:'p25', name:'25 / 5', min:25, removable:false},
  {id:'p50', name:'50 / 10', min:50, removable:false},
];
state.pomo.activePreset = 'p25';
function fmtTime(s){ const m=Math.floor(s/60), sec=s%60; return pad(m)+':'+pad(sec); }
function renderPomoModes(){
  const el = document.getElementById('pomo-modes');
  el.innerHTML = state.pomo.presets.map(p=>`
    <div class="mode-chip ${state.pomo.activePreset===p.id?'active':''}" onclick="setPomoModeById('${p.id}')">
      <span>${p.name}</span>
      ${p.removable ? `<span class="chip-remove" onclick="event.stopPropagation(); removePomoPreset('${p.id}')">✕</span>` : ''}
    </div>`).join('') + `<div class="mode-chip add-chip" onclick="addPomoPreset()">+ Add session</div>`;
}
function renderPomo(){
  document.getElementById('pomo-time').textContent = fmtTime(state.pomo.secondsLeft);
  const ring = document.getElementById('pomo-ring');
  const c = 603;
  const pct = state.pomo.secondsLeft/state.pomo.totalSeconds;
  ring.setAttribute('stroke-dashoffset', c*pct);
  document.getElementById('pomo-toggle').textContent = state.pomo.running ? '⏸ Pause' : '▶ Start';
}
function togglePomo(){
  state.pomo.running = !state.pomo.running;
  if(state.pomo.running){
    pomoInterval = setInterval(()=>{
      state.pomo.secondsLeft--;
      if(state.pomo.secondsLeft<=0){
        clearInterval(pomoInterval);
        state.pomo.running=false;
        state.pomo.sessions++;
        document.getElementById('pomo-sessions').textContent = state.pomo.sessions;
        addXP(40);
        launchConfetti();
        cycleMascot();
        scheduleSave();
      }
      renderPomo();
    },1000);
  } else {
    clearInterval(pomoInterval);
  }
  renderPomo();
}
function resetPomo(){
  clearInterval(pomoInterval);
  state.pomo.running=false;
  state.pomo.secondsLeft = state.pomo.totalSeconds;
  renderPomo();
}
function setPomoModeById(id){
  const preset = state.pomo.presets.find(p=>p.id===id);
  if(!preset) return;
  state.pomo.activePreset = id;
  state.pomo.mode = preset.min;
  state.pomo.totalSeconds = preset.min*60;
  renderPomoModes();
  resetPomo();
}
function addPomoPreset(){
  const name = prompt('Session name (e.g. 90 / 15):', 'Custom');
  if(!name || !name.trim()) return;
  const min = parseInt(prompt('Focus minutes:', '30'), 10);
  if(!min || min<=0) return;
  const id = 'p'+Date.now();
  state.pomo.presets.push({id, name:name.trim(), min, removable:true});
  renderPomoModes();
  setPomoModeById(id);
  scheduleSave();
}
function removePomoPreset(id){
  const preset = state.pomo.presets.find(p=>p.id===id);
  if(!preset || !preset.removable) return;
  if(!confirm('Remove "'+preset.name+'" session?')) return;
  state.pomo.presets = state.pomo.presets.filter(p=>p.id!==id);
  if(state.pomo.activePreset===id){
    setPomoModeById(state.pomo.presets[0].id);
  } else {
    renderPomoModes();
  }
  scheduleSave();
}
renderPomoModes();
renderPomo();

/* ============ NOTES ============ */
function renderNotes(){
  const el = document.getElementById('notes-grid');
  el.innerHTML = state.notes.map((n,i)=>`
    <div class="note-card ${n.pinned?'pinned':''}">
      <div class="row-actions" style="justify-content:flex-end; margin-bottom:-4px;">
        <button class="icon-btn danger" onclick="deleteNote(${i})" title="Delete">🗑️</button>
      </div>
      <div class="note-title">${n.pinned?'📌 ':''}${n.title}</div>
      <div class="note-body">${n.body}</div>
    </div>`).join('') + `<div class="note-add" onclick="addNote()">+</div>`;

  const notesTile = dashItems.find(d=>d.id==='notes');
  if(notesTile){
    notesTile.value = String(state.notes.length);
    notesTile.pct = Math.min(100, state.notes.length*20);
    renderDashboard();
  }
}
function addNote(){
  const title = prompt('Note title:', 'New note');
  if(!title || !title.trim()) return;
  const body = prompt('Note text:', '') || '';
  state.notes.push({title:title.trim(), body, pinned:false});
  renderNotes();
  scheduleSave();
}
function deleteNote(i){
  if(!confirm('Delete this note?')) return;
  state.notes.splice(i,1);
  renderNotes();
  scheduleSave();
}
renderNotes();

/* ============ APP DRAWER ============ */
function renderDrawer(){
  const el = document.getElementById('drawer-grid');
  const colors = ['#4C6FFF','#3FC38A','#FFC94A','#E8664E','#8B7CF6','#3AB0E0'];
  el.innerHTML = state.drawerApps.map((a,i)=>`
    <div class="app-cell">
      <div class="app-icon" style="background:${colors[i%colors.length]}22; color:${colors[i%colors.length]};">${a[0]}</div>
      <span>${a}</span>
    </div>`).join('');
}
renderDrawer();

/* ============ QUICK SETTINGS ============ */
const qsToggles = [
  {icon:'✈️', label:'Wi-Fi', on:true},
  {icon:'🔷', label:'Bluetooth', on:false},
  {icon:'🔦', label:'Flashlight', on:false},
];
function renderQS(){
  const el = document.getElementById('qs-grid');
  el.innerHTML = qsToggles.map((t,i)=>`
    <div class="qs-card">
      <div class="qs-top"><span class="qs-icon">${t.icon}</span>
        <div class="toggle ${t.on?'on':''}" onclick="toggleQS(${i})"><div class="toggle-dot"></div></div>
      </div>
      <div style="font-weight:800; font-size:13px;">${t.label}</div>
    </div>`).join('') + `
    <div class="qs-card">
      <div class="qs-top"><span class="qs-icon">🔆</span></div>
      <div style="font-weight:800; font-size:13px;">Brightness</div>
      <input type="range" class="qs-slider" value="70">
    </div>
    <div class="qs-card">
      <div class="qs-top"><span class="qs-icon">🔊</span></div>
      <div style="font-weight:800; font-size:13px;">Volume</div>
      <input type="range" class="qs-slider" value="55">
    </div>
    <div class="qs-card">
      <div class="qs-top"><span class="qs-icon">🔋</span></div>
      <div style="font-weight:800; font-size:13px;">Battery</div>
      <div class="stat-sub">87% · 6h left</div>
    </div>
    <div class="qs-card">
      <div class="qs-top"><span class="qs-icon">👤</span></div>
      <div style="font-weight:800; font-size:13px;">Account</div>
      <div class="stat-sub" id="qs-account-email">—</div>
      <button class="pomo-btn secondary" style="padding:6px 10px; font-size:10.5px; margin-top:2px;" onclick="logout()">Log Out</button>
    </div>`;
}
function toggleQS(i){ qsToggles[i].on = !qsToggles[i].on; renderQS(); }
renderQS();

/* ============ CALENDAR / TASKS ============ */
const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
function renderCalStrip(){
  const el = document.getElementById('cal-strip');
  const today = new Date();
  let html='';
  for(let i=-2;i<=3;i++){
    const d = new Date(today); d.setDate(today.getDate()+i);
    html += `<div class="cal-day ${i===0?'active':''}"><div class="cal-dow">${dayNames[d.getDay()]}</div><div class="cal-num">${d.getDate()}</div></div>`;
  }
  el.innerHTML = html;
}
renderCalStrip();

const tasks = [
  {time:'9:00', name:'Standup meeting', color:'var(--warm-blue)', done:true},
  {time:'10:30', name:'React module — Ch.4', color:'var(--soft-green)', done:false},
  {time:'13:00', name:'Lunch + walk', color:'var(--sun-yellow)', done:false},
  {time:'15:00', name:'Deep work block', color:'var(--warm-blue)', done:false},
  {time:'19:00', name:'Gym session', color:'var(--soft-green)', done:false},
];
const events = [
  {time:'Tomorrow', name:'DSA Assignment due', color:'#E8664E'},
  {time:'Aug 3', name:'Portfolio review', color:'var(--warm-blue)'},
  {time:'Aug 5', name:'Mock interview', color:'var(--soft-green)'},
  {time:'Aug 8', name:'Project deadline', color:'#E8664E'},
];
function renderTasks(){
  document.getElementById('task-list').innerHTML = tasks.map((t,i)=>`
    <div class="task-item ${t.done?'done':''}" onclick="toggleTask(${i})">
      <div class="task-dot" style="background:${t.color}"></div>${t.name}<div class="task-time">${t.time}</div>
    </div>`).join('');
  document.getElementById('event-list').innerHTML = events.map(e=>`
    <div class="task-item"><div class="task-dot" style="background:${e.color}"></div>${e.name}<div class="task-time">${e.time}</div></div>`).join('');
}
function toggleTask(i){ tasks[i].done = !tasks[i].done; renderTasks(); }
renderTasks();

/* ============ STATS SCREEN ============ */
function renderBars(id, values, color){
  const el = document.getElementById(id);
  const max = Math.max(...values);
  el.innerHTML = values.map(v=>`<div class="bar" style="height:${(v/max)*100}%; background:${color||'linear-gradient(180deg, var(--warm-blue), var(--warm-blue-deep))'};"></div>`).join('');
}
renderBars('study-bars', [2,4,3.5,5,4.2,1,3]);
renderBars('pomo-bars', [3,5,4,6,5,2,4]);
renderBars('workout-bars', [1,0,1,1,0,1,1], 'linear-gradient(180deg, var(--soft-green), #2a9c6e)');

function renderHeatmap(){
  const el = document.getElementById('heatmap');
  let html='';
  for(let i=0;i<28;i++){
    const intensity = Math.random();
    const bg = intensity>0.7?'var(--soft-green)':intensity>0.4?'rgba(63,195,138,0.5)':intensity>0.15?'rgba(63,195,138,0.25)':'rgba(63,195,138,0.08)';
    html += `<div class="heat-cell" style="background:${bg}"></div>`;
  }
  el.innerHTML = html;
}
renderHeatmap();

/* ============ NAVIGATION: horizontal track (calendar/home/stats) ============ */
const track = document.getElementById('track');
let trackIndex = 1; // 0=left(calendar) 1=home 2=right(stats)
function updateTrack(){
  track.style.transform = `translateX(-${trackIndex*100}vw)`;
}
function goHome(){ trackIndex = 1; updateTrack(); }
function goLeft(){ trackIndex = Math.max(0, trackIndex-1); updateTrack(); }
function goRight(){ trackIndex = Math.min(2, trackIndex+1); updateTrack(); }
updateTrack();

/* ============ PANELS (pomodoro/habits/notes/drawer/settings) ============ */
function openPanel(name){
  const el = document.getElementById('panel-'+name);
  el.classList.remove('up');
  el.classList.add('open');
}
function closePanel(name){
  document.getElementById('panel-'+name).classList.remove('open');
}

/* ============ SWIPE / DRAG GESTURES ============ */
function isInsideScrollable(target){
  return !!(target.closest && (target.closest('.panel.open') || target.closest('.scroll-col')));
}

let touchStartX=0, touchStartY=0, touchActive=false, touchInsideScrollable=false;
document.getElementById('app').addEventListener('touchstart', (e)=>{
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchActive = true;
  touchInsideScrollable = isInsideScrollable(e.target);
}, {passive:true});
document.getElementById('app').addEventListener('touchend', (e)=>{
  if(!touchActive) return;
  touchActive=false;
  if(touchInsideScrollable) return; // let panel/list scrolling behave normally
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  handleSwipe(dx,dy);
}, {passive:true});

// mouse drag support for desktop testing
let mouseDown=false, mStartX=0, mStartY=0, mouseInsideScrollable=false;
document.getElementById('app').addEventListener('mousedown', e=>{
  mouseDown=true; mStartX=e.clientX; mStartY=e.clientY;
  mouseInsideScrollable = isInsideScrollable(e.target);
});
window.addEventListener('mouseup', e=>{
  if(!mouseDown) return;
  mouseDown=false;
  if(mouseInsideScrollable) return;
  handleSwipe(e.clientX-mStartX, e.clientY-mStartY);
});

function handleSwipe(dx,dy){
  const absX=Math.abs(dx), absY=Math.abs(dy);
  const threshold=60;
  if(absX>absY && absX>threshold){
    if(dx<0) goRight(); else goLeft();
  } else if(absY>absX && absY>threshold){
    if(dy<0) openPanel('drawer'); // swipe up
    else openPanel('settings');   // swipe down
  }
}

/* Keyboard nav for desktop preview convenience */
window.addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft') goLeft();
  if(e.key==='ArrowRight') goRight();
  if(e.key==='ArrowUp') openPanel('drawer');
  if(e.key==='ArrowDown') openPanel('settings');
  if(e.key==='Escape') ['pomodoro','habits','study','notes','drawer','settings'].forEach(closePanel);
});

/* ============ THEME TOGGLE ============ */
document.getElementById('theme-toggle').addEventListener('click', ()=>{
  state.dark = !state.dark;
  document.body.classList.toggle('dark', state.dark);
  document.getElementById('theme-toggle').textContent = state.dark ? '☀️ Light' : '🌙 Dark';
  scheduleSave();
});

/* ============ CONFETTI CELEBRATION ============ */
function launchConfetti(){
  const colors = ['#4C6FFF','#3FC38A','#FFC94A','#E8664E'];
  for(let i=0;i<40;i++){
    const c = document.createElement('div');
    c.className='confetti';
    c.style.left = Math.random()*100+'vw';
    c.style.background = colors[Math.floor(Math.random()*colors.length)];
    c.style.borderRadius = Math.random()>0.5 ? '50%' : '2px';
    document.body.appendChild(c);
    const duration = 1800+Math.random()*1200;
    c.animate([
      {transform:'translateY(0) rotate(0deg)', opacity:1},
      {transform:`translateY(${window.innerHeight+40}px) rotate(${360+Math.random()*360}deg)`, opacity:0.9}
    ], {duration, easing:'cubic-bezier(.2,.6,.4,1)'});
    setTimeout(()=>c.remove(), duration);
  }
}

/* ============ PWA: SERVICE WORKER REGISTRATION ============ */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service worker registered:', reg.scope))
      .catch(err => console.warn('Service worker registration failed:', err));
  });
}

/* ============ PWA: INSTALL PROMPT ============ */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('install-btn');
  if(btn) btn.style.display = 'flex';
});
function installApp(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(()=>{
    deferredInstallPrompt = null;
    const btn = document.getElementById('install-btn');
    if(btn) btn.style.display = 'none';
  });
}
window.addEventListener('appinstalled', ()=>{
  const btn = document.getElementById('install-btn');
  if(btn) btn.style.display = 'none';
});

/* ============ PWA: launch shortcut handling (?open=panelName) ============ */
(function handleLaunchShortcut(){
  const params = new URLSearchParams(window.location.search);
  const target = params.get('open');
  if(target){
    window.addEventListener('load', ()=> setTimeout(()=> openPanel(target), 300));
  }
})();
