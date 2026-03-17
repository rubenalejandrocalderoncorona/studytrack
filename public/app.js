'use strict';
/* ─── State ──────────────────────────────────────────────────────────── */
let appData=null, activeObjectiveId=null;
const TODAY=new Date(); TODAY.setHours(0,0,0,0);
const TYPES=['Coursera','Udemy','Lab','Review','Exam'];

/* ─── Boot ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',async()=>{
  try{
    const r=await fetch('/api/progress');
    appData=await r.json();
    if(!appData.notes)appData.notes={};
    if(!appData.customTypes)appData.customTypes=[];
    renderSidebar();
    if(appData.objectives.length>0)selectObj(appData.objectives[0].id);
    else showEmpty();
  }catch(e){console.error(e);}
  setupModals();
  document.getElementById('mobileMenuBtn').addEventListener('click',()=>
    document.getElementById('sidebar').classList.toggle('mobile-open'));
  // Load version
  try{
    const vr=await fetch('/api/version');
    const vd=await vr.json();
    const vb=document.getElementById('versionBadge');
    if(vb)vb.textContent=vd.version||'beta';
    if(vb)vb.title=`Build: ${vd.build||''} | Updated: ${vd.updated||''}`;
  }catch(e){}
});

/* ─── Sidebar ────────────────────────────────────────────────────────── */
function renderSidebar(){
  const nav=document.getElementById('objectivesNav');
  nav.innerHTML='';
  appData.objectives.forEach(obj=>{
    const s=objStats(obj);
    const el=document.createElement('div');
    el.className='nav-item'+(obj.id===activeObjectiveId?' active':'');
    el.style.setProperty('--item-accent',obj.accentColor);
    el.innerHTML=`<div class="nav-dot"></div>
      <div class="nav-item-info">
        <div class="nav-item-title">${x(obj.title)}</div>
        <div class="nav-item-date">${fmt(obj.examDate)}</div>
      </div>
      <div class="nav-item-progress">${s.done}/${s.total}</div>
      <button class="nav-delete-btn" title="Delete">&times;</button>`;
    el.addEventListener('click',e=>{if(!e.target.classList.contains('nav-delete-btn'))selectObj(obj.id);});
    el.querySelector('.nav-delete-btn').addEventListener('click',async e=>{
      e.stopPropagation();
      if(!confirm(`Delete "${obj.title}"?`))return;
      await fetch(`/api/objectives/${obj.id}`,{method:'DELETE'});
      appData.objectives=appData.objectives.filter(o=>o.id!==obj.id);
      if(activeObjectiveId===obj.id){activeObjectiveId=null;showEmpty();}
      renderSidebar();
    });
    nav.appendChild(el);
  });
}

function selectObj(id){
  activeObjectiveId=id; renderSidebar();
  const obj=appData.objectives.find(o=>o.id===id);
  if(!obj)return showEmpty();
  renderObj(obj);
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function showEmpty(){
  document.getElementById('mainContent').innerHTML=
    '<div class="empty-state"><p class="empty-title">No objective selected</p><p class="empty-sub">Choose a study objective from the sidebar.</p></div>';
}

/* ─── Render Objective ───────────────────────────────────────────────── */
function renderObj(obj){
  const s=objStats(obj);
  const pct=s.total>0?Math.round(s.done/s.total*100):0;
  const d=daysLeft(obj.examDate);
  const wrap=document.getElementById('mainContent');
  wrap.style.setProperty('--obj-accent',obj.accentColor);
  let h=`<div class="obj-header">
    <div class="obj-header-top">
      <div class="obj-title-group">
        <h1 class="obj-title">${x(obj.title)}</h1>
        <span class="obj-exam-badge">EXAM ${fmt(obj.examDate)}</span>
      </div>
      <div class="obj-header-actions">
        <button class="btn-download-json" id="downloadJsonBtn">↓ Export JSON</button>
        <button class="btn-edit-json" id="editJsonBtn">{ } Edit JSON</button>
      </div>
    </div>
    ${obj.description?`<p class="obj-description">${x(obj.description)}</p>`:''}
    <div class="stats-row">
      <div class="stat-cell"><div class="stat-label">Total Tasks</div><div class="stat-value">${s.total}</div></div>
      <div class="stat-cell"><div class="stat-label">Done</div><div class="stat-value highlight">${s.done}</div></div>
      <div class="stat-cell"><div class="stat-label">Remaining</div><div class="stat-value">${s.total-s.done}</div></div>
      <div class="stat-cell"><div class="stat-label">Days Until Exam</div><div class="stat-value ${d<=7?'highlight':''}">${d>=0?d:'—'}</div></div>
    </div>
    <div class="progress-wrap">
      <div class="progress-header"><span class="progress-label">Overall Progress</span><span class="progress-pct">${pct}%</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    </div>
  </div>`;
  obj.phases.forEach(ph=>{h+=renderPhase(ph);});
  wrap.innerHTML=h;
  document.getElementById('editJsonBtn').addEventListener('click',()=>openJsonEditor(obj));
  document.getElementById('downloadJsonBtn').addEventListener('click',()=>downloadObjJson(obj));
  wrap.querySelectorAll('.phase-header').forEach(hdr=>hdr.addEventListener('click',()=>hdr.closest('.phase').classList.toggle('collapsed')));
  wrap.querySelectorAll('.task-checkbox').forEach(cb=>cb.addEventListener('change',onCheck));
  wrap.querySelectorAll('.task-tag').forEach(t=>t.addEventListener('click',onTagClick));
  wrap.querySelectorAll('.task-text').forEach(el=>{
    el.addEventListener('blur',onTextBlur);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.blur();}});
  });
  wrap.querySelectorAll('.task-note-btn').forEach(b=>b.addEventListener('click',onNoteToggle));
  wrap.querySelectorAll('.task-notes-input').forEach(ta=>{
    ta.addEventListener('blur',onNoteSave);
    ta.addEventListener('input',()=>ta.closest('.task-row').classList.toggle('task-has-note',ta.value.trim().length>0));
  });
  wrap.querySelectorAll('.delete-task').forEach(b=>b.addEventListener('click',onDeleteTask));
  wrap.querySelectorAll('.add-task-btn').forEach(b=>b.addEventListener('click',onAddTask));
}

function renderPhase(ph){
  const ps=phaseStats(ph);
  const pct=ps.total>0?Math.round(ps.done/ps.total*100):0;
  let h=`<div class="phase" data-phase-id="${ph.id}">
    <div class="phase-header">
      <div class="phase-title-group"><span class="phase-title">${x(ph.title)}</span><span class="phase-daterange">${x(ph.dateRange)}</span></div>
      <div class="phase-right">
        <div class="phase-mini-bar"><div class="phase-mini-bar-fill" style="width:${pct}%"></div></div>
        <span class="phase-pct">${pct}%</span><span class="phase-chevron">▾</span>
      </div>
    </div><div class="phase-body">`;
  ph.weeks.forEach(w=>{h+=renderWeek(w);});
  return h+'</div></div>';
}

function renderWeek(w){
  let h=`<div class="week"><div class="week-header"><span class="week-title">${x(w.title)}</span><span class="week-daterange">${x(w.dateRange)}</span></div>`;
  w.days.forEach(d=>{h+=renderDay(d);});
  return h+'</div>';
}

function renderDay(day){
  const done=day.tasks.filter(t=>appData.checked[t.id]).length;
  const tot=day.tasks.length;
  const allDone=tot>0&&done===tot;
  const over=new Date(day.date+'T00:00:00')<TODAY&&!allDone&&!day.isExamDay;
  let cls='day-card'+(allDone?' complete':'')+(over?' overdue':'')+(day.isExamDay?' exam-day':'');
  const chk=`<div class="day-check-icon"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg></div>`;
  let h=`<div class="${cls}" data-day-id="${day.id}">
    <div class="day-card-header">
      <span class="day-num">Day ${day.isExamDay?'EXAM':day.dayNum}</span>
      <span class="day-label">${x(day.label)}</span>
      ${day.isExamDay?'<span class="exam-day-label">EXAM DAY</span>':`<span class="day-hours">${day.hours}h</span>`}
      <span class="day-progress-text">${done}/${tot}</span>${chk}
    </div><div class="day-tasks">`;
  day.tasks.forEach(t=>{h+=renderTask(t,day.id);});
  return h+`<div class="add-task-row"><button class="add-task-btn" data-day-id="${day.id}">+ Add Task</button></div></div></div>`;
}

function renderTask(task,dayId){
  const chk=!!appData.checked[task.id];
  const note=appData.notes[task.id]||'';
  return `<div class="task-row${chk?' done':''}${note?' task-has-note':''}" data-task-id="${task.id}" data-day-id="${dayId}">
    <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" ${chk?'checked':''}/>
    <div class="task-body"><div class="task-main-line">
      <span class="task-tag ${typeClass(task.type)}" data-task-id="${task.id}" data-type="${x(task.type)}">${x(task.type)}</span>
      <span class="task-text" contenteditable="true" data-task-id="${task.id}" data-day-id="${dayId}" data-placeholder="Task description...">${x(task.text)}</span>
      <div class="task-actions">
        <button class="task-action-btn task-note-btn" data-task-id="${task.id}" title="Notes">📝</button>
        <button class="task-action-btn delete-task" data-task-id="${task.id}" data-day-id="${dayId}" title="Delete">✕</button>
      </div>
    </div>
    <div class="task-notes-area${note?' open':''}" id="notes-${task.id}">
      <textarea class="task-notes-input" data-task-id="${task.id}" placeholder="Add notes...">${x(note)}</textarea>
    </div></div></div>`;
}

/* ─── Checkbox ───────────────────────────────────────────────────────── */
async function onCheck(e){
  const id=e.target.dataset.taskId, val=e.target.checked;
  appData.checked[id]=val; updateRowUI(e.target,val); renderSidebar(); updateBars();
  try{await fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:id,checked:val})});}
  catch(err){appData.checked[id]=!val;e.target.checked=!val;updateRowUI(e.target,!val);}
}

function updateRowUI(cb,chk){
  cb.closest('.task-row').classList.toggle('done',chk);
  const card=cb.closest('.day-card'); if(!card)return;
  const cbs=card.querySelectorAll('.task-checkbox');
  const d=[...cbs].filter(c=>c.checked).length, t=cbs.length;
  const pt=card.querySelector('.day-progress-text'); if(pt)pt.textContent=`${d}/${t}`;
  card.classList.toggle('complete',d===t&&t>0);
}

function updateBars(){
  const obj=appData.objectives.find(o=>o.id===activeObjectiveId); if(!obj)return;
  const s=objStats(obj), pct=s.total>0?Math.round(s.done/s.total*100):0;
  const fill=document.querySelector('.obj-header .progress-bar-fill');
  const pctEl=document.querySelector('.obj-header .progress-pct');
  if(fill)fill.style.width=pct+'%'; if(pctEl)pctEl.textContent=pct+'%';
  const cells=document.querySelectorAll('.stat-cell');
  if(cells[1])cells[1].querySelector('.stat-value').textContent=s.done;
  if(cells[2])cells[2].querySelector('.stat-value').textContent=s.total-s.done;
  obj.phases.forEach(ph=>{
    const el=document.querySelector(`.phase[data-phase-id="${ph.id}"]`); if(!el)return;
    const ps=phaseStats(ph), pp=ps.total>0?Math.round(ps.done/ps.total*100):0;
    const f=el.querySelector('.phase-mini-bar-fill'); if(f)f.style.width=pp+'%';
    const p=el.querySelector('.phase-pct'); if(p)p.textContent=pp+'%';
  });
}

/* ─── Inline Edit ────────────────────────────────────────────────────── */
async function onTextBlur(e){
  const el=e.target, id=el.dataset.taskId, txt=el.textContent.trim();
  const task=getTask(id); if(!task)return;
  if(!txt){el.textContent=task.text;return;}
  if(task.text===txt)return;
  task.text=txt; await saveObj();
}

/* ─── Tag Selector ───────────────────────────────────────────────────── */
function allTypes(){return [...TYPES,...(appData.customTypes||[])];}

function typeClass(type){
  const lower=type.toLowerCase();
  if(TYPES.map(t=>t.toLowerCase()).includes(lower))return lower;
  return 'custom';
}

function onTagClick(e){
  e.stopPropagation();
  document.querySelectorAll('.type-selector-popup').forEach(p=>p.remove());
  const tag=e.currentTarget, id=tag.dataset.taskId, cur=tag.dataset.type;
  const popup=document.createElement('div');
  popup.className='type-selector-popup';
  const rect=tag.getBoundingClientRect();
  popup.style.cssText=`position:fixed;top:${rect.bottom+4}px;left:${rect.left}px;z-index:200`;

  allTypes().forEach(type=>{
    const opt=document.createElement('div');
    opt.className=`type-option ${typeClass(type)}${type===cur?' selected':''}`;
    opt.textContent=type;
    opt.addEventListener('click',async ev=>{
      ev.stopPropagation(); popup.remove(); if(type===cur)return;
      const task=getTask(id); if(!task)return;
      task.type=type;
      tag.className=`task-tag ${typeClass(type)}`;
      tag.textContent=type; tag.dataset.type=type;
      await saveObj();
    });
    popup.appendChild(opt);
  });

  // "Add new type" option
  const addOpt=document.createElement('div');
  addOpt.className='type-option add-new';
  addOpt.textContent='+ Add type';
  addOpt.addEventListener('click',async ev=>{
    ev.stopPropagation(); popup.remove();
    const newType=prompt('New task type name:','');
    if(!newType||!newType.trim())return;
    const trimmed=newType.trim();
    if(allTypes().map(t=>t.toLowerCase()).includes(trimmed.toLowerCase()))return;
    appData.customTypes.push(trimmed);
    try{await fetch('/api/custom-types',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customTypes:appData.customTypes})});}
    catch(err){console.error(err);}
    // Apply to current task
    const task=getTask(id); if(!task)return;
    task.type=trimmed;
    tag.className=`task-tag custom`;
    tag.textContent=trimmed; tag.dataset.type=trimmed;
    await saveObj();
  });
  popup.appendChild(addOpt);

  document.body.appendChild(popup);
  setTimeout(()=>document.addEventListener('click',()=>popup.remove(),{once:true}),0);
}

/* ─── Notes ──────────────────────────────────────────────────────────── */
function onNoteToggle(e){
  const id=e.currentTarget.dataset.taskId;
  const area=document.getElementById(`notes-${id}`); if(!area)return;
  area.classList.toggle('open');
  if(area.classList.contains('open'))area.querySelector('textarea').focus();
}

async function onNoteSave(e){
  const ta=e.target, id=ta.dataset.taskId, note=ta.value.trim();
  appData.notes[id]=note;
  try{await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:id,note})});}
  catch(err){console.error(err);}
}

/* ─── Delete / Add Task ──────────────────────────────────────────────── */
async function onDeleteTask(e){
  const taskId=e.currentTarget.dataset.taskId, dayId=e.currentTarget.dataset.dayId;
  if(!confirm('Delete this task?'))return;
  const obj=appData.objectives.find(o=>o.id===activeObjectiveId); if(!obj)return;
  for(const ph of obj.phases)for(const w of ph.weeks)for(const d of w.days)
    if(d.id===dayId){d.tasks=d.tasks.filter(t=>t.id!==taskId);break;}
  delete appData.checked[taskId]; delete appData.notes[taskId];
  await saveObj(); selectObj(activeObjectiveId);
}

async function onAddTask(e){
  const dayId=e.currentTarget.dataset.dayId;
  const obj=appData.objectives.find(o=>o.id===activeObjectiveId); if(!obj)return;
  for(const ph of obj.phases)for(const w of ph.weeks)for(const d of w.days){
    if(d.id===dayId){
      const nt={id:`t-${Date.now()}`,type:'Review',text:'New task'};
      d.tasks.push(nt); await saveObj(); selectObj(activeObjectiveId);
      setTimeout(()=>{
        const el=document.querySelector(`[data-task-id="${nt.id}"] .task-text`);
        if(el){el.focus();document.execCommand('selectAll',false,null);}
      },50);
      return;
    }
  }
}

/* ─── JSON Editor ────────────────────────────────────────────────────── */
function openJsonEditor(obj){
  document.getElementById('jsonEditorTextarea').value=JSON.stringify(obj,null,2);
  document.getElementById('jsonEditorError').textContent='';
  document.getElementById('jsonEditorOverlay').classList.add('open');
}

/* ─── Modals Setup ───────────────────────────────────────────────────── */
function setupModals(){
  const jOverlay=document.getElementById('jsonEditorOverlay');
  document.getElementById('jsonEditorClose').addEventListener('click',()=>jOverlay.classList.remove('open'));
  document.getElementById('jsonEditorCancel').addEventListener('click',()=>jOverlay.classList.remove('open'));
  jOverlay.addEventListener('click',e=>{if(e.target===e.currentTarget)jOverlay.classList.remove('open');});
  document.getElementById('jsonEditorSave').addEventListener('click',async()=>{
    const ta=document.getElementById('jsonEditorTextarea');
    const err=document.getElementById('jsonEditorError');
    let parsed;
    try{parsed=JSON.parse(ta.value);}catch(e){err.textContent='Invalid JSON: '+e.message;return;}
    if(!parsed.title||!parsed.examDate){err.textContent='Missing required fields: title, examDate';return;}
    err.textContent='';
    const id=activeObjectiveId; parsed.id=id;
    try{
      const res=await fetch(`/api/objectives/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed)});
      if(!res.ok)throw new Error(await res.text());
      const idx=appData.objectives.findIndex(o=>o.id===id);
      if(idx!==-1)appData.objectives[idx]=parsed;
      jOverlay.classList.remove('open'); selectObj(id);
    }catch(e){err.textContent='Save failed: '+e.message;}
  });

  const mOverlay=document.getElementById('modalOverlay');
  document.getElementById('newObjectiveBtn').addEventListener('click',()=>{
    mOverlay.classList.add('open');
    document.querySelectorAll('.modal-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='manual'));
    document.querySelectorAll('.modal-tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-manual'));
  });
  document.getElementById('modalClose').addEventListener('click',closeNewModal);
  document.getElementById('modalCancel').addEventListener('click',closeNewModal);
  mOverlay.addEventListener('click',e=>{if(e.target===e.currentTarget)closeNewModal();});

  document.querySelectorAll('.modal-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.modal-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.modal-tab-panel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('colorPicker').addEventListener('input',e=>{
    document.getElementById('colorSwatch').style.background=e.target.value;
    document.getElementById('colorHex').textContent=e.target.value.toUpperCase();
  });

  document.getElementById('newObjectiveForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const body={title:fd.get('title'),examDate:fd.get('examDate'),accentColor:fd.get('accentColor'),description:fd.get('description')};
    try{
      const res=await fetch('/api/objectives',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await res.json();
      appData.objectives.push({id:data.id,...body,phases:[]});
      renderSidebar(); selectObj(data.id); closeNewModal();
    }catch(err){alert('Failed to create objective');}
  });

  document.getElementById('importJsonCancel').addEventListener('click',closeNewModal);
  document.getElementById('importJsonBtn').addEventListener('click',async()=>{
    const ta=document.getElementById('importJsonTextarea');
    const err=document.getElementById('importJsonError');
    let parsed;
    try{parsed=JSON.parse(ta.value);}catch(e){err.textContent='Invalid JSON: '+e.message;return;}
    if(!parsed.title||!parsed.examDate){err.textContent='Missing required fields: title, examDate';return;}
    err.textContent='';
    try{
      const res=await fetch('/api/objectives',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed)});
      const data=await res.json();
      parsed.id=data.id;
      appData.objectives.push(parsed);
      renderSidebar(); selectObj(data.id); closeNewModal();
    }catch(e){err.textContent='Import failed: '+e.message;}
  });
}

function closeNewModal(){
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('newObjectiveForm').reset();
  document.getElementById('colorSwatch').style.background='#378ADD';
  document.getElementById('colorHex').textContent='#378ADD';
  document.getElementById('importJsonError').textContent='';
  document.getElementById('importJsonTextarea').value='';
}

/* ─── Download JSON ──────────────────────────────────────────────────── */
function downloadObjJson(obj){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`studytrack-${obj.id||'objective'}.json`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function x(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmt(ds){if(!ds)return'';const d=new Date(ds+'T00:00:00');return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
function daysLeft(ds){if(!ds)return-1;return Math.ceil((new Date(ds+'T00:00:00')-TODAY)/86400000);}
function objStats(obj){let t=0,d=0;for(const ph of obj.phases)for(const w of ph.weeks)for(const dy of w.days){t+=dy.tasks.length;d+=dy.tasks.filter(tk=>appData.checked[tk.id]).length;}return{total:t,done:d};}
function phaseStats(ph){let t=0,d=0;for(const w of ph.weeks)for(const dy of w.days){t+=dy.tasks.length;d+=dy.tasks.filter(tk=>appData.checked[tk.id]).length;}return{total:t,done:d};}
function getTask(id){for(const obj of appData.objectives)for(const ph of obj.phases)for(const w of ph.weeks)for(const d of w.days)for(const t of d.tasks)if(t.id===id)return t;return null;}
async function saveObj(){
  const obj=appData.objectives.find(o=>o.id===activeObjectiveId); if(!obj)return;
  try{await fetch('/api/objectives/'+obj.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});}
  catch(err){console.error('Save failed:',err);}
}
