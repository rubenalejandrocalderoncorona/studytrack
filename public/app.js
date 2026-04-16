'use strict';
/* ─── State ──────────────────────────────────────────────────────────── */
let appData = null, activeObjectiveId = null, activeTab = 'plan';
let pistonRuntimes = []; // loaded once on boot
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const TYPES = ['Coursera', 'Udemy', 'Lab', 'Review', 'Exam'];

/* ─── Boot ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const r = await fetch('/api/progress');
    appData = await r.json();
    if (!appData.notes) appData.notes = {};
    if (!appData.customTypes) appData.customTypes = [];
    renderSidebar();
    if (appData.objectives.length > 0) selectObj(appData.objectives[0].id);
    else showEmpty();
  } catch (e) { console.error(e); }

  setupModals();
  document.getElementById('mobileMenuBtn').addEventListener('click', () =>
    document.getElementById('sidebar').classList.toggle('mobile-open'));

  // Load version badge
  try {
    const vr = await fetch('/api/version');
    const vd = await vr.json();
    const vb = document.getElementById('versionBadge');
    if (vb) { vb.textContent = vd.version || 'beta'; vb.title = `Build: ${vd.build || ''}`; }
  } catch (e) {}

  // Load Piston runtimes for language selector (best-effort)
  try {
    const rr = await fetch('/api/sandbox/runtimes');
    if (rr.ok) pistonRuntimes = await rr.json();
  } catch (e) {}
});

/* ─── Tab Navigation ─────────────────────────────────────────────────── */
function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.obj-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ['plan', 'exam', 'code', 'heatmap'].forEach(t => {
    document.getElementById('tab' + capitalize(t)).style.display = t === tab ? '' : 'none';
  });
  if (tab === 'exam') renderExamTab();
  if (tab === 'code') renderCodeTab();
  if (tab === 'heatmap') renderHeatmapTab();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ─── Sidebar ────────────────────────────────────────────────────────── */
function renderSidebar() {
  const nav = document.getElementById('objectivesNav');
  nav.innerHTML = '';
  appData.objectives.forEach(obj => {
    const s = objStats(obj);
    const el = document.createElement('div');
    el.className = 'nav-item' + (obj.id === activeObjectiveId ? ' active' : '');
    el.style.setProperty('--item-accent', obj.accentColor);
    const typeIcon = obj.type === 'coding' ? '⌨' : obj.type === 'practical' ? '⚗' : '📖';
    el.innerHTML = `<div class="nav-dot"></div>
      <div class="nav-item-info">
        <div class="nav-item-title">${x(obj.title)}</div>
        <div class="nav-item-meta"><span class="nav-type-icon">${typeIcon}</span><span class="nav-item-date">${fmt(obj.examDate)}</span></div>
      </div>
      <div class="nav-item-progress">${s.done}/${s.total}</div>
      <button class="nav-delete-btn" title="Delete">&times;</button>`;
    el.addEventListener('click', e => { if (!e.target.classList.contains('nav-delete-btn')) selectObj(obj.id); });
    el.querySelector('.nav-delete-btn').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`Delete "${obj.title}"?`)) return;
      await fetch(`/api/objectives/${obj.id}`, { method: 'DELETE' });
      appData.objectives = appData.objectives.filter(o => o.id !== obj.id);
      if (activeObjectiveId === obj.id) { activeObjectiveId = null; showEmpty(); }
      renderSidebar();
    });
    nav.appendChild(el);
  });
}

function selectObj(id) {
  activeObjectiveId = id;
  activeTab = 'plan';
  renderSidebar();
  const obj = appData.objectives.find(o => o.id === id);
  if (!obj) return showEmpty();
  // Show tabs
  document.getElementById('objTabs').style.display = '';
  ['plan', 'exam', 'code', 'heatmap'].forEach(t =>
    document.getElementById('tab' + capitalize(t)).style.display = t === 'plan' ? '' : 'none');
  document.querySelectorAll('.obj-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'plan'));
  document.getElementById('objTabs').querySelectorAll('.obj-tab').forEach(btn => {
    btn.onclick = () => showTab(btn.dataset.tab);
  });
  renderObj(obj);
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function showEmpty() {
  document.getElementById('objTabs').style.display = 'none';
  document.getElementById('mainContent').innerHTML =
    '<div class="empty-state"><p class="empty-title">No objective selected</p><p class="empty-sub">Choose a study objective from the sidebar.</p></div>';
}

/* ─── Render Objective (Plan tab) ────────────────────────────────────── */
function renderObj(obj) {
  const s = objStats(obj);
  const pct = s.total > 0 ? Math.round(s.done / s.total * 100) : 0;
  const d = daysLeft(obj.examDate);
  const wrap = document.getElementById('mainContent');
  wrap.style.setProperty('--obj-accent', obj.accentColor);

  const typeBadge = obj.type ? `<span class="type-badge type-badge-${obj.type}">${obj.type}${obj.type === 'coding' && obj.codingLanguage ? ' · ' + obj.codingLanguage : ''}</span>` : '';

  let h = `<div class="obj-header">
    <div class="obj-header-top">
      <div class="obj-title-group">
        <h1 class="obj-title">${x(obj.title)}</h1>
        <span class="obj-exam-badge">EXAM ${fmt(obj.examDate)}</span>
        ${typeBadge}
      </div>
      <div class="obj-header-actions">
        <button class="btn-download-json" id="downloadJsonBtn">↓ Export JSON</button>
        <button class="btn-edit-json" id="editJsonBtn">{ } Edit JSON</button>
      </div>
    </div>
    ${obj.description ? `<p class="obj-description">${x(obj.description)}</p>` : ''}
    <div class="stats-row">
      <div class="stat-cell"><div class="stat-label">Total Tasks</div><div class="stat-value">${s.total}</div></div>
      <div class="stat-cell"><div class="stat-label">Done</div><div class="stat-value highlight">${s.done}</div></div>
      <div class="stat-cell"><div class="stat-label">Remaining</div><div class="stat-value">${s.total - s.done}</div></div>
      <div class="stat-cell"><div class="stat-label">Days Until Exam</div><div class="stat-value ${d <= 7 ? 'highlight' : ''}">${d >= 0 ? d : '—'}</div></div>
    </div>
    <div class="progress-wrap">
      <div class="progress-header"><span class="progress-label">Overall Progress</span><span class="progress-pct">${pct}%</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    </div>
  </div>`;
  obj.phases.forEach(ph => { h += renderPhase(ph); });
  wrap.innerHTML = h;

  document.getElementById('editJsonBtn').addEventListener('click', () => openJsonEditor(obj));
  document.getElementById('downloadJsonBtn').addEventListener('click', () => downloadObjJson(obj));
  wrap.querySelectorAll('.phase-header').forEach(hdr => hdr.addEventListener('click', () => hdr.closest('.phase').classList.toggle('collapsed')));
  wrap.querySelectorAll('.task-checkbox').forEach(cb => cb.addEventListener('change', onCheck));
  wrap.querySelectorAll('.task-tag').forEach(t => t.addEventListener('click', onTagClick));
  wrap.querySelectorAll('.task-text').forEach(el => {
    el.addEventListener('blur', onTextBlur);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  });
  wrap.querySelectorAll('.task-note-btn').forEach(b => b.addEventListener('click', onNoteToggle));
  wrap.querySelectorAll('.task-notes-input').forEach(ta => {
    ta.addEventListener('blur', onNoteSave);
    ta.addEventListener('input', () => ta.closest('.task-row').classList.toggle('task-has-note', ta.value.trim().length > 0));
  });
  wrap.querySelectorAll('.delete-task').forEach(b => b.addEventListener('click', onDeleteTask));
  wrap.querySelectorAll('.add-task-btn').forEach(b => b.addEventListener('click', onAddTask));
}

function renderPhase(ph) {
  const ps = phaseStats(ph);
  const pct = ps.total > 0 ? Math.round(ps.done / ps.total * 100) : 0;
  let h = `<div class="phase" data-phase-id="${ph.id}">
    <div class="phase-header">
      <div class="phase-title-group"><span class="phase-title">${x(ph.title)}</span><span class="phase-daterange">${x(ph.dateRange)}</span></div>
      <div class="phase-right">
        <div class="phase-mini-bar"><div class="phase-mini-bar-fill" style="width:${pct}%"></div></div>
        <span class="phase-pct">${pct}%</span><span class="phase-chevron">▾</span>
      </div>
    </div><div class="phase-body">`;
  ph.weeks.forEach(w => { h += renderWeek(w); });
  return h + '</div></div>';
}

function renderWeek(w) {
  let h = `<div class="week"><div class="week-header"><span class="week-title">${x(w.title)}</span><span class="week-daterange">${x(w.dateRange)}</span></div>`;
  w.days.forEach(d => { h += renderDay(d); });
  return h + '</div>';
}

function renderDay(day) {
  const done = day.tasks.filter(t => appData.checked[t.id]).length;
  const tot = day.tasks.length;
  const allDone = tot > 0 && done === tot;
  const over = new Date(day.date + 'T00:00:00') < TODAY && !allDone && !day.isExamDay;
  let cls = 'day-card' + (allDone ? ' complete' : '') + (over ? ' overdue' : '') + (day.isExamDay ? ' exam-day' : '');
  const chk = `<div class="day-check-icon"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg></div>`;
  let h = `<div class="${cls}" data-day-id="${day.id}">
    <div class="day-card-header">
      <span class="day-num">Day ${day.isExamDay ? 'EXAM' : day.dayNum}</span>
      <span class="day-label">${x(day.label)}</span>
      ${day.isExamDay ? '<span class="exam-day-label">EXAM DAY</span>' : `<span class="day-hours">${day.hours}h</span>`}
      <span class="day-progress-text">${done}/${tot}</span>${chk}
    </div><div class="day-tasks">`;
  day.tasks.forEach(t => { h += renderTask(t, day.id); });
  return h + `<div class="add-task-row"><button class="add-task-btn" data-day-id="${day.id}">+ Add Task</button></div></div></div>`;
}

function renderTask(task, dayId) {
  const chk = !!appData.checked[task.id];
  const note = appData.notes[task.id] || '';
  return `<div class="task-row${chk ? ' done' : ''}${note ? ' task-has-note' : ''}" data-task-id="${task.id}" data-day-id="${dayId}">
    <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" ${chk ? 'checked' : ''}/>
    <div class="task-body"><div class="task-main-line">
      <span class="task-tag ${typeClass(task.type)}" data-task-id="${task.id}" data-type="${x(task.type)}">${x(task.type)}</span>
      <span class="task-text" contenteditable="true" data-task-id="${task.id}" data-day-id="${dayId}" data-placeholder="Task description...">${x(task.text)}</span>
      <div class="task-actions">
        <button class="task-action-btn task-note-btn" data-task-id="${task.id}" title="Notes">📝</button>
        <button class="task-action-btn delete-task" data-task-id="${task.id}" data-day-id="${dayId}" title="Delete">✕</button>
      </div>
    </div>
    <div class="task-notes-area${note ? ' open' : ''}" id="notes-${task.id}">
      <textarea class="task-notes-input" data-task-id="${task.id}" placeholder="Add notes...">${x(note)}</textarea>
    </div></div></div>`;
}

/* ─── Checkbox ───────────────────────────────────────────────────────── */
async function onCheck(e) {
  const id = e.target.dataset.taskId, val = e.target.checked;
  appData.checked[id] = val; updateRowUI(e.target, val); renderSidebar(); updateBars();
  try { await fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: id, checked: val }) }); }
  catch (err) { appData.checked[id] = !val; e.target.checked = !val; updateRowUI(e.target, !val); }
}

function updateRowUI(cb, chk) {
  cb.closest('.task-row').classList.toggle('done', chk);
  const card = cb.closest('.day-card'); if (!card) return;
  const cbs = card.querySelectorAll('.task-checkbox');
  const d = [...cbs].filter(c => c.checked).length, t = cbs.length;
  const pt = card.querySelector('.day-progress-text'); if (pt) pt.textContent = `${d}/${t}`;
  card.classList.toggle('complete', d === t && t > 0);
}

function updateBars() {
  const obj = appData.objectives.find(o => o.id === activeObjectiveId); if (!obj) return;
  const s = objStats(obj), pct = s.total > 0 ? Math.round(s.done / s.total * 100) : 0;
  const fill = document.querySelector('.obj-header .progress-bar-fill');
  const pctEl = document.querySelector('.obj-header .progress-pct');
  if (fill) fill.style.width = pct + '%'; if (pctEl) pctEl.textContent = pct + '%';
  const cells = document.querySelectorAll('.stat-cell');
  if (cells[1]) cells[1].querySelector('.stat-value').textContent = s.done;
  if (cells[2]) cells[2].querySelector('.stat-value').textContent = s.total - s.done;
  obj.phases.forEach(ph => {
    const el = document.querySelector(`.phase[data-phase-id="${ph.id}"]`); if (!el) return;
    const ps = phaseStats(ph), pp = ps.total > 0 ? Math.round(ps.done / ps.total * 100) : 0;
    const f = el.querySelector('.phase-mini-bar-fill'); if (f) f.style.width = pp + '%';
    const p = el.querySelector('.phase-pct'); if (p) p.textContent = pp + '%';
  });
}

/* ─── Inline Edit ────────────────────────────────────────────────────── */
async function onTextBlur(e) {
  const el = e.target, id = el.dataset.taskId, txt = el.textContent.trim();
  const task = getTask(id); if (!task) return;
  if (!txt) { el.textContent = task.text; return; }
  if (task.text === txt) return;
  task.text = txt; await saveObj();
}

/* ─── Tag Selector ───────────────────────────────────────────────────── */
function allTypes() { return [...TYPES, ...(appData.customTypes || [])]; }
function typeClass(type) {
  const lower = type.toLowerCase();
  if (TYPES.map(t => t.toLowerCase()).includes(lower)) return lower;
  return 'custom';
}

function onTagClick(e) {
  e.stopPropagation();
  document.querySelectorAll('.type-selector-popup').forEach(p => p.remove());
  const tag = e.currentTarget, id = tag.dataset.taskId, cur = tag.dataset.type;
  const popup = document.createElement('div');
  popup.className = 'type-selector-popup';
  const rect = tag.getBoundingClientRect();
  popup.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:200`;
  allTypes().forEach(type => {
    const opt = document.createElement('div');
    opt.className = `type-option ${typeClass(type)}${type === cur ? ' selected' : ''}`;
    opt.textContent = type;
    opt.addEventListener('click', async ev => {
      ev.stopPropagation(); popup.remove(); if (type === cur) return;
      const task = getTask(id); if (!task) return;
      task.type = type;
      tag.className = `task-tag ${typeClass(type)}`; tag.textContent = type; tag.dataset.type = type;
      await saveObj();
    });
    popup.appendChild(opt);
  });
  const addOpt = document.createElement('div');
  addOpt.className = 'type-option add-new';
  addOpt.textContent = '+ Add type';
  addOpt.addEventListener('click', async ev => {
    ev.stopPropagation(); popup.remove();
    const newType = prompt('New task type name:', '');
    if (!newType || !newType.trim()) return;
    const trimmed = newType.trim();
    if (allTypes().map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) return;
    appData.customTypes.push(trimmed);
    try { await fetch('/api/custom-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customTypes: appData.customTypes }) }); }
    catch (err) { console.error(err); }
    const task = getTask(id); if (!task) return;
    task.type = trimmed;
    tag.className = 'task-tag custom'; tag.textContent = trimmed; tag.dataset.type = trimmed;
    await saveObj();
  });
  popup.appendChild(addOpt);
  document.body.appendChild(popup);
  setTimeout(() => document.addEventListener('click', () => popup.remove(), { once: true }), 0);
}

/* ─── Notes ──────────────────────────────────────────────────────────── */
function onNoteToggle(e) {
  const id = e.currentTarget.dataset.taskId;
  const area = document.getElementById(`notes-${id}`); if (!area) return;
  area.classList.toggle('open');
  if (area.classList.contains('open')) area.querySelector('textarea').focus();
}
async function onNoteSave(e) {
  const ta = e.target, id = ta.dataset.taskId, note = ta.value.trim();
  appData.notes[id] = note;
  try { await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: id, note }) }); }
  catch (err) { console.error(err); }
}

/* ─── Delete / Add Task ──────────────────────────────────────────────── */
async function onDeleteTask(e) {
  const taskId = e.currentTarget.dataset.taskId, dayId = e.currentTarget.dataset.dayId;
  if (!confirm('Delete this task?')) return;
  const obj = appData.objectives.find(o => o.id === activeObjectiveId); if (!obj) return;
  for (const ph of obj.phases) for (const w of ph.weeks) for (const d of w.days)
    if (d.id === dayId) { d.tasks = d.tasks.filter(t => t.id !== taskId); break; }
  delete appData.checked[taskId]; delete appData.notes[taskId];
  await saveObj(); selectObj(activeObjectiveId);
}
async function onAddTask(e) {
  const dayId = e.currentTarget.dataset.dayId;
  const obj = appData.objectives.find(o => o.id === activeObjectiveId); if (!obj) return;
  for (const ph of obj.phases) for (const w of ph.weeks) for (const d of w.days) {
    if (d.id === dayId) {
      const nt = { id: `t-${Date.now()}`, type: 'Review', text: 'New task' };
      d.tasks.push(nt); await saveObj(); selectObj(activeObjectiveId);
      setTimeout(() => {
        const el = document.querySelector(`[data-task-id="${nt.id}"] .task-text`);
        if (el) { el.focus(); document.execCommand('selectAll', false, null); }
      }, 50);
      return;
    }
  }
}

/* ─── AI Exam Tab ────────────────────────────────────────────────────── */
function renderExamTab() {
  const obj = appData.objectives.find(o => o.id === activeObjectiveId);
  if (!obj) return;
  const panel = document.getElementById('tabExam');
  panel.style.setProperty('--obj-accent', obj.accentColor);

  panel.innerHTML = `
    <div class="exam-panel">
      <div class="exam-generate-card">
        <div class="section-title">Generate Theoretical Exam</div>
        <div class="exam-form">
          <div class="form-row">
            <div class="form-group flex1">
              <label class="form-label">Topic</label>
              <input class="form-input" id="examTopic" placeholder="e.g. Binary Search Trees, Vertex AI, …" />
            </div>
            <div class="form-group" style="min-width:110px">
              <label class="form-label">Questions</label>
              <input class="form-input" id="examCount" type="number" min="1" max="20" value="5" />
            </div>
          </div>
          <button class="btn btn-primary" id="examGenerateBtn">Generate Exam ↗</button>
          <div class="exam-error" id="examError"></div>
        </div>
      </div>
      <div id="examArea"></div>
      <div class="exam-history-section">
        <div class="section-title" style="margin-top:32px">Previous Sessions</div>
        <div id="examHistory" class="exam-history-list"></div>
      </div>
    </div>`;

  document.getElementById('examGenerateBtn').addEventListener('click', () => runGenerateExam(obj));
  loadExamHistory(obj);
}

async function runGenerateExam(obj) {
  const topic = document.getElementById('examTopic').value.trim();
  const count = parseInt(document.getElementById('examCount').value) || 5;
  const errEl = document.getElementById('examError');
  const btn = document.getElementById('examGenerateBtn');
  if (!topic) { errEl.textContent = 'Topic is required.'; return; }
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Generating…';

  try {
    const res = await fetch('/api/exams/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectiveId: obj.id, topic, type: 'theoretical', count })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Generation failed.'; return; }
    renderExamQuestions(data);
    loadExamHistory(obj);
  } catch (e) {
    errEl.textContent = 'Network error: ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Generate Exam ↗';
  }
}

function renderExamQuestions(record) {
  const area = document.getElementById('examArea');
  const questions = record.exam.questions || [];
  let h = `<div class="exam-card" data-exam-id="${record.id}" data-obj-id="${record.objectiveId}">
    <div class="exam-card-header">
      <span class="exam-topic">${x(record.topic)}</span>
      <span class="exam-meta">${questions.length} questions · ${new Date(record.createdAt).toLocaleString()}</span>
    </div>
    <div class="exam-questions">`;
  questions.forEach((q, i) => {
    h += `<div class="exam-q" data-q-index="${i}">
      <div class="exam-q-text"><span class="exam-q-num">${i + 1}.</span> ${x(q.question)}</div>
      <div class="exam-options">`;
    q.options.forEach((opt, oi) => {
      const letter = String.fromCharCode(65 + oi);
      h += `<label class="exam-option">
        <input type="radio" name="q${i}" value="${letter}" class="exam-radio" />
        <span class="exam-option-letter">${letter}</span>
        <span class="exam-option-text">${x(opt)}</span>
      </label>`;
    });
    h += `</div></div>`;
  });
  h += `</div>
    <div class="exam-actions">
      <button class="btn btn-primary" id="submitExamBtn">Submit Answers</button>
      <div class="exam-submit-error" id="submitErr"></div>
    </div>
    <div id="examResults"></div>
  </div>`;
  area.innerHTML = h;

  document.getElementById('submitExamBtn').addEventListener('click', () => submitExam(record));
}

async function submitExam(record) {
  const questions = record.exam.questions || [];
  const answers = [];
  let missing = false;
  questions.forEach((q, i) => {
    const sel = document.querySelector(`input[name="q${i}"]:checked`);
    if (!sel) missing = true;
    else answers.push(sel.value);
  });
  if (missing) { document.getElementById('submitErr').textContent = 'Answer all questions before submitting.'; return; }
  document.getElementById('submitErr').textContent = '';

  const btn = document.getElementById('submitExamBtn');
  btn.disabled = true; btn.textContent = 'Grading…';

  try {
    const res = await fetch('/api/exams/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId: record.id, objectiveId: record.objectiveId, answers })
    });
    const result = await res.json();
    renderExamResults(record.exam.questions, answers, result);
    loadExamHistory(appData.objectives.find(o => o.id === activeObjectiveId));
  } catch (e) {
    document.getElementById('submitErr').textContent = 'Submit failed: ' + e.message;
    btn.disabled = false; btn.textContent = 'Submit Answers';
  }
}

function renderExamResults(questions, answers, result) {
  const resultsEl = document.getElementById('examResults');
  const pct = Math.round(result.score / result.total * 100);
  const grade = pct >= 80 ? 'pass' : pct >= 60 ? 'partial' : 'fail';
  let h = `<div class="exam-results">
    <div class="exam-score exam-score-${grade}">
      <span class="score-pct">${pct}%</span>
      <span class="score-label">${result.score}/${result.total} correct</span>
    </div>`;
  questions.forEach((q, i) => {
    const r = result.results[i];
    h += `<div class="result-row ${r.correct ? 'correct' : 'wrong'}">
      <div class="result-q"><span class="result-icon">${r.correct ? '✓' : '✗'}</span> ${x(q.question)}</div>
      <div class="result-detail">
        ${!r.correct ? `<span class="result-your">Your answer: <strong>${answers[i]}</strong></span> · ` : ''}
        <span class="result-correct">Correct: <strong>${r.correctAnswer}</strong></span>
        <div class="result-explanation">${x(r.explanation)}</div>
      </div>
    </div>`;
  });
  h += '</div>';
  resultsEl.innerHTML = h;
  document.getElementById('submitExamBtn').textContent = '✓ Submitted';
}

async function loadExamHistory(obj) {
  const histEl = document.getElementById('examHistory');
  if (!histEl) return;
  try {
    const res = await fetch(`/api/exams/${obj.id}`);
    const summaries = await res.json();
    if (!summaries.length) { histEl.innerHTML = '<div class="history-empty">No sessions yet.</div>'; return; }
    histEl.innerHTML = summaries.slice().reverse().map(s =>
      `<div class="history-item">
        <span class="history-topic">${x(s.topic)}</span>
        <span class="history-type tag-${s.type}">${s.type}</span>
        <span class="history-date">${new Date(s.createdAt).toLocaleDateString()}</span>
        ${s.completedAt ? '<span class="history-done">✓ completed</span>' : ''}
      </div>`
    ).join('');
  } catch (e) {}
}

/* ─── Code Lab Tab ───────────────────────────────────────────────────── */
function renderCodeTab() {
  const obj = appData.objectives.find(o => o.id === activeObjectiveId);
  if (!obj) return;
  const panel = document.getElementById('tabCode');
  panel.style.setProperty('--obj-accent', obj.accentColor);

  const lang = obj.codingLanguage || 'python';

  // Build language options — merge Piston runtimes with known list
  const knownLangs = ['python', 'javascript', 'typescript', 'go', 'java', 'rust', 'cpp', 'bash', 'c', 'ruby', 'php'];
  const runtimeLangs = pistonRuntimes.map(r => r.language);
  const allLangs = [...new Set([...knownLangs, ...runtimeLangs])].sort();
  const langOpts = allLangs.map(l => `<option value="${l}" ${l === lang ? 'selected' : ''}>${l}</option>`).join('');

  panel.innerHTML = `
    <div class="code-panel">
      <div class="code-generate-card">
        <div class="section-title">Generate Coding Challenge</div>
        <div class="exam-form">
          <div class="form-row">
            <div class="form-group flex1">
              <label class="form-label">Topic / Problem Type</label>
              <input class="form-input" id="codeTopic" placeholder="e.g. Two pointers, Graph BFS, Kubernetes deploy, …" />
            </div>
            <div class="form-group" style="min-width:150px">
              <label class="form-label">Language / Environment</label>
              <select class="form-input form-select" id="codeLang">${langOpts}</select>
            </div>
          </div>
          <button class="btn btn-primary" id="codeGenerateBtn">Generate Challenge ↗</button>
          <div class="exam-error" id="codeError"></div>
        </div>
      </div>
      <div id="challengeArea"></div>
    </div>`;

  document.getElementById('codeGenerateBtn').addEventListener('click', () => runGenerateChallenge(obj));
}

async function runGenerateChallenge(obj) {
  const topic = document.getElementById('codeTopic').value.trim();
  const language = document.getElementById('codeLang').value;
  const errEl = document.getElementById('codeError');
  const btn = document.getElementById('codeGenerateBtn');
  if (!topic) { errEl.textContent = 'Topic is required.'; return; }
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Generating…';

  try {
    const res = await fetch('/api/exams/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectiveId: obj.id, topic, type: 'coding', language })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Generation failed.'; return; }
    renderCodingChallenge(data, language);
  } catch (e) {
    errEl.textContent = 'Network error: ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Generate Challenge ↗';
  }
}

function renderCodingChallenge(record, selectedLang) {
  const area = document.getElementById('challengeArea');
  const ch = record.exam;
  const lang = selectedLang || ch.language || 'python';
  const starter = (ch.starterCode && ch.starterCode[lang]) || ch.starterCode?.python || '# write your solution here\n';

  const examples = (ch.examples || []).map(e =>
    `<div class="ex-row"><span class="ex-label">Input:</span> <code>${x(e.input)}</code> → <span class="ex-label">Output:</span> <code>${x(e.output)}</code>${e.explanation ? ` <span class="ex-note">${x(e.explanation)}</span>` : ''}</div>`
  ).join('');

  const constraints = (ch.constraints || []).map(c => `<li>${x(c)}</li>`).join('');
  const visibleTests = (ch.testCases || []).filter(t => !t.hidden);

  area.innerHTML = `
    <div class="challenge-card" data-exam-id="${record.id}" data-obj-id="${record.objectiveId}">
      <div class="challenge-header">
        <div class="challenge-title">${x(ch.title || record.topic)}</div>
        <span class="lang-badge">${lang}</span>
      </div>
      <div class="challenge-description">${x(ch.description)}</div>
      ${examples ? `<div class="challenge-section"><div class="section-label">Examples</div>${examples}</div>` : ''}
      ${constraints ? `<div class="challenge-section"><div class="section-label">Constraints</div><ul class="constraint-list">${constraints}</ul></div>` : ''}

      <div class="editor-section">
        <div class="editor-header">
          <span class="section-label">Your Solution (${lang})</span>
          <div class="editor-actions">
            <button class="btn btn-sm btn-ghost" id="resetCodeBtn">Reset</button>
            <button class="btn btn-sm btn-primary" id="runCodeBtn">▶ Run</button>
          </div>
        </div>
        <textarea class="code-editor" id="codeEditor" spellcheck="false">${x(starter)}</textarea>
        <div class="stdin-row">
          <label class="form-label" style="margin:0;flex-shrink:0">stdin</label>
          <input class="form-input stdin-input" id="stdinInput" placeholder="optional stdin…" />
        </div>
      </div>

      <div class="run-output" id="runOutput" style="display:none">
        <div class="output-header">
          <span class="section-label">Output</span>
          <span class="exit-badge" id="exitBadge"></span>
        </div>
        <pre class="output-pre" id="outputPre"></pre>
      </div>

      ${visibleTests.length ? `<div class="challenge-section">
        <div class="section-label">Sample Test Cases</div>
        ${visibleTests.map(t => `<div class="test-row"><span class="ex-label">in:</span> <code>${x(t.input)}</code> <span class="ex-label">expected:</span> <code>${x(t.expectedOutput)}</code></div>`).join('')}
      </div>` : ''}
    </div>`;

  document.getElementById('runCodeBtn').addEventListener('click', () => runCode(lang));
  document.getElementById('resetCodeBtn').addEventListener('click', () => {
    document.getElementById('codeEditor').value = starter;
  });
}

async function runCode(lang) {
  const code = document.getElementById('codeEditor').value;
  const stdin = document.getElementById('stdinInput')?.value || '';
  const btn = document.getElementById('runCodeBtn');
  const outputEl = document.getElementById('runOutput');
  const pre = document.getElementById('outputPre');
  const badge = document.getElementById('exitBadge');

  btn.disabled = true; btn.textContent = '⏳ Running…';
  outputEl.style.display = '';
  pre.textContent = 'Running…';
  badge.textContent = '';
  badge.className = 'exit-badge';

  try {
    const res = await fetch('/api/sandbox/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang, code, stdin })
    });
    const data = await res.json();
    if (!res.ok) { pre.textContent = data.error || 'Execution failed.'; return; }
    pre.textContent = data.output || data.stdout || '(no output)';
    if (data.stderr) pre.textContent += '\n--- stderr ---\n' + data.stderr;
    badge.textContent = `exit ${data.exitCode}`;
    badge.className = 'exit-badge ' + (data.exitCode === 0 ? 'exit-ok' : 'exit-err');
  } catch (e) {
    pre.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = '▶ Run';
  }
}

/* ─── Activity Heatmap Tab ───────────────────────────────────────────── */
async function renderHeatmapTab() {
  const panel = document.getElementById('tabHeatmap');
  panel.innerHTML = '<div class="heatmap-loading">Loading activity…</div>';

  try {
    const res = await fetch('/api/exams/calendar/heatmap');
    const counts = await res.json(); // { "2026-04-15": 3, … }
    panel.innerHTML = buildHeatmap(counts);
  } catch (e) {
    panel.innerHTML = `<div class="empty-state"><p class="empty-title">Could not load activity data</p></div>`;
  }
}

function buildHeatmap(counts) {
  // Show last 52 weeks (364 days) like GitHub
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cells = [];
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, count: counts[key] || 0, dow: d.getDay() });
  }

  // Group into weeks (columns)
  const weeks = [];
  let week = [];
  // Pad the first week to start on Sunday
  const firstDow = cells[0].dow;
  for (let i = 0; i < firstDow; i++) week.push(null);
  for (const cell of cells) {
    week.push(cell);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }

  const maxCount = Math.max(...cells.map(c => c.count), 1);

  function levelClass(count) {
    if (count === 0) return 'l0';
    const pct = count / maxCount;
    if (pct <= 0.25) return 'l1';
    if (pct <= 0.5) return 'l2';
    if (pct <= 0.75) return 'l3';
    return 'l4';
  }

  const totalSessions = cells.reduce((a, c) => a + c.count, 0);
  const activeDays = cells.filter(c => c.count > 0).length;
  const streak = calcStreak(counts);

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowLabels = DOW_LABELS.map((l, i) =>
    `<div class="hm-dow-label" style="grid-row:${i + 1}">${i % 2 === 1 ? l : ''}</div>`
  ).join('');

  const cellsHtml = weeks.map(w =>
    `<div class="hm-week">${w.map(c => c
      ? `<div class="hm-cell ${levelClass(c.count)}" title="${c.date}: ${c.count} session${c.count !== 1 ? 's' : ''}"></div>`
      : '<div class="hm-cell l0 hm-empty"></div>'
    ).join('')}</div>`
  ).join('');

  return `<div class="heatmap-panel">
    <div class="section-title">Study Activity</div>
    <div class="heatmap-stats">
      <div class="hm-stat"><span class="hm-stat-value">${totalSessions}</span><span class="hm-stat-label">total sessions</span></div>
      <div class="hm-stat"><span class="hm-stat-value">${activeDays}</span><span class="hm-stat-label">active days</span></div>
      <div class="hm-stat"><span class="hm-stat-value">${streak}</span><span class="hm-stat-label">day streak 🔥</span></div>
    </div>
    <div class="heatmap-wrap">
      <div class="hm-dow-col">${dowLabels}</div>
      <div class="hm-grid">${cellsHtml}</div>
    </div>
    <div class="hm-legend">
      <span class="hm-legend-label">Less</span>
      <div class="hm-cell l0"></div>
      <div class="hm-cell l1"></div>
      <div class="hm-cell l2"></div>
      <div class="hm-cell l3"></div>
      <div class="hm-cell l4"></div>
      <span class="hm-legend-label">More</span>
    </div>
  </div>`;
}

function calcStreak(counts) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (counts[key]) streak++;
    else if (i > 0) break;
  }
  return streak;
}

/* ─── JSON Editor ────────────────────────────────────────────────────── */
function openJsonEditor(obj) {
  document.getElementById('jsonEditorTextarea').value = JSON.stringify(obj, null, 2);
  document.getElementById('jsonEditorError').textContent = '';
  document.getElementById('jsonEditorOverlay').classList.add('open');
}

/* ─── Modals Setup ───────────────────────────────────────────────────── */
function setupModals() {
  const jOverlay = document.getElementById('jsonEditorOverlay');
  document.getElementById('jsonEditorClose').addEventListener('click', () => jOverlay.classList.remove('open'));
  document.getElementById('jsonEditorCancel').addEventListener('click', () => jOverlay.classList.remove('open'));
  jOverlay.addEventListener('click', e => { if (e.target === e.currentTarget) jOverlay.classList.remove('open'); });
  document.getElementById('jsonEditorSave').addEventListener('click', async () => {
    const ta = document.getElementById('jsonEditorTextarea');
    const err = document.getElementById('jsonEditorError');
    let parsed;
    try { parsed = JSON.parse(ta.value); } catch (e) { err.textContent = 'Invalid JSON: ' + e.message; return; }
    if (!parsed.title || !parsed.examDate) { err.textContent = 'Missing required fields: title, examDate'; return; }
    err.textContent = '';
    const id = activeObjectiveId; parsed.id = id;
    try {
      const res = await fetch(`/api/objectives/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) });
      if (!res.ok) throw new Error(await res.text());
      const idx = appData.objectives.findIndex(o => o.id === id);
      if (idx !== -1) appData.objectives[idx] = parsed;
      jOverlay.classList.remove('open'); selectObj(id);
    } catch (e) { err.textContent = 'Save failed: ' + e.message; }
  });

  const mOverlay = document.getElementById('modalOverlay');
  document.getElementById('newObjectiveBtn').addEventListener('click', () => {
    mOverlay.classList.add('open');
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'manual'));
    document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-manual'));
  });
  document.getElementById('modalClose').addEventListener('click', closeNewModal);
  document.getElementById('modalCancel').addEventListener('click', closeNewModal);
  mOverlay.addEventListener('click', e => { if (e.target === e.currentTarget) closeNewModal(); });

  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Show/hide language selector based on type selection
  document.getElementById('objType').addEventListener('change', e => {
    document.getElementById('langGroup').style.display = e.target.value === 'coding' ? '' : 'none';
  });

  document.getElementById('colorPicker').addEventListener('input', e => {
    document.getElementById('colorSwatch').style.background = e.target.value;
    document.getElementById('colorHex').textContent = e.target.value.toUpperCase();
  });

  document.getElementById('newObjectiveForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      title: fd.get('title'), examDate: fd.get('examDate'),
      accentColor: fd.get('accentColor'), description: fd.get('description'),
      type: fd.get('type'), codingLanguage: fd.get('codingLanguage') || 'python'
    };
    try {
      const res = await fetch('/api/objectives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      appData.objectives.push({ id: data.id, ...body, phases: [] });
      renderSidebar(); selectObj(data.id); closeNewModal();
    } catch (err) { alert('Failed to create objective'); }
  });

  document.getElementById('importJsonCancel').addEventListener('click', closeNewModal);
  document.getElementById('importJsonBtn').addEventListener('click', async () => {
    const ta = document.getElementById('importJsonTextarea');
    const err = document.getElementById('importJsonError');
    let parsed;
    try { parsed = JSON.parse(ta.value); } catch (e) { err.textContent = 'Invalid JSON: ' + e.message; return; }
    if (!parsed.title || !parsed.examDate) { err.textContent = 'Missing required fields: title, examDate'; return; }
    err.textContent = '';
    try {
      const res = await fetch('/api/objectives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) });
      const data = await res.json();
      parsed.id = data.id;
      appData.objectives.push(parsed);
      renderSidebar(); selectObj(data.id); closeNewModal();
    } catch (e) { err.textContent = 'Import failed: ' + e.message; }
  });
}

function closeNewModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('newObjectiveForm').reset();
  document.getElementById('colorSwatch').style.background = '#378ADD';
  document.getElementById('colorHex').textContent = '#378ADD';
  document.getElementById('langGroup').style.display = 'none';
  document.getElementById('importJsonError').textContent = '';
  document.getElementById('importJsonTextarea').value = '';
}

/* ─── Download JSON ──────────────────────────────────────────────────── */
function downloadObjJson(obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `studytrack-${obj.id || 'objective'}.json`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function x(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmt(ds) { if (!ds) return ''; const d = new Date(ds + 'T00:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function daysLeft(ds) { if (!ds) return -1; return Math.ceil((new Date(ds + 'T00:00:00') - TODAY) / 86400000); }
function objStats(obj) { let t = 0, d = 0; for (const ph of obj.phases) for (const w of ph.weeks) for (const dy of w.days) { t += dy.tasks.length; d += dy.tasks.filter(tk => appData.checked[tk.id]).length; } return { total: t, done: d }; }
function phaseStats(ph) { let t = 0, d = 0; for (const w of ph.weeks) for (const dy of w.days) { t += dy.tasks.length; d += dy.tasks.filter(tk => appData.checked[tk.id]).length; } return { total: t, done: d }; }
function getTask(id) { for (const obj of appData.objectives) for (const ph of obj.phases) for (const w of ph.weeks) for (const d of w.days) for (const t of d.tasks) if (t.id === id) return t; return null; }
async function saveObj() {
  const obj = appData.objectives.find(o => o.id === activeObjectiveId); if (!obj) return;
  try { await fetch('/api/objectives/' + obj.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }); }
  catch (err) { console.error('Save failed:', err); }
}
