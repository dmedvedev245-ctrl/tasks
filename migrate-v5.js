// Центр задач v5 — сценарий адаптации существующих задач к проектам и этапам.
// Ничего не удаляет и не меняет у задач, кроме полей маршрута (project_id, stage_id, track).
// Статусы, сроки, дни работы, подзадачи, заметки и id остаются прежними. Идентификаторы проектов и этапов постоянные —
// повторный запуск не создаёт дублей. plan() только вычисляет операции и отчёт; применяет их приложение.
window.MIGRATE_V5 = (() => {
  const ID = n => 'e7700000-0000-4000-8000-' + String(n).padStart(12, '0');
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAIN = {
    id: ID(1), area: 'EV77 / Мини-апп', title: 'Переход на работу через мини-приложение',
    goal: 'Перевести работу EV77 на мини-приложение',
    result: 'Брони, выдачи, возвраты, договоры и расчёты ведутся через мини-приложение; выбран основной источник учёта, проверены роли и уведомления, отправка старой очереди исключена',
    stages: [
      { id: ID(11), title: 'Финансовый модуль', status: 'done', done_criteria: 'Финансовый модуль установлен и проверен', tasks: ['Довести раздел «Финансы» до учёта всей компании EV77'] },
      { id: ID(12), title: 'Связка amoCRM и мини-приложения', status: 'current', done_criteria: null, notes: 'Рабочий обмен пока выключен.',
        tasks: ['Подключить поиск клиента из мини-приложения', 'Синхронизировать брони и этапы аренды'], next: 'Подключить поиск клиента из мини-приложения' },
      { id: ID(13), title: 'Приёмочные проверки', status: 'todo', done_criteria: 'Проверены бронь, выдача, возврат, договор, расчёты, права и отсутствие дублей', tasks: [] },
      { id: ID(14), title: 'Реальный пилот с водителем', status: 'todo', done_criteria: 'Пилот с водителем проведён, найденные проблемы устранены', tasks: ['Провести реальный цикл с водителем'] },
      { id: ID(15), title: 'Полный переход', status: 'todo', done_criteria: 'Выбран основной источник учёта, проверены роли и уведомления, исключена отправка старой очереди', tasks: ['Подключить уведомления сотрудникам и группе'] }
    ],
    queue: ['Довести поиск, фильтры и журнал', 'Продумать статусы и категории клиентов']
  };
  const COMMIT = ['Собрать договоры и фото для возврата залогов и разбора штрафов'];
  const ORDER = { 'Сайт': 10, 'Авито': 20, 'Телефония': 30, 'Отчётность': 40 };
  const SITE = { stage: ID(201), task: ID(301), stageTitle: 'Мобильный первый экран', taskTitle: 'Доработать мобильный первый экран сайта' };
  const NOTE_FIT = { 'Связаться с Екатериной по amoCRM': 'возможно, относится к этапу «Связка amoCRM и мини-приложения» — оставлено в очереди CRM, решите сами' };

  function plan(data, applyOp){
    const st = JSON.parse(JSON.stringify({ areas: data.areas || [], tasks: data.tasks || [], projects: data.projects || [], stages: data.stages || [], rentals: [] }));
    const T0 = JSON.parse(JSON.stringify(st.tasks));
    const ops = [], missing = [], used = new Set();
    const byId = new Map(st.tasks.map(t => [t.id, t]));
    const isTop = t => !t.parent_id || !byId.has(t.parent_id);
    const areaByPath = p => st.areas.find(a => (a.path || a.name) === p);
    const pathOf = id => { const a = st.areas.find(x => x.id === id); return a ? (a.path || a.name) : ''; };
    const find = (title, areaPath) => {
      const c = st.tasks.filter(t => isTop(t) && norm(t.title) === norm(title));
      const pick = c.find(t => !areaPath || pathOf(t.area_id) === areaPath) || c[0];
      if (!pick){ missing.push(title); return null; }
      if (c.length > 1) missing.push(title + ' (найдено ' + c.length + ', взята первая)');
      return pick;
    };
    const route = (t, patch) => { used.add(t.id); ops.push({ type: 'routeTask', id: t.id, patch }); };

    // 1. Главный проект и его этапы
    const ma = areaByPath(MAIN.area);
    ops.push({ type: 'saveProject', id: MAIN.id, patch: { title: MAIN.title, goal: MAIN.goal, result: MAIN.result, area_id: ma ? ma.id : null, status: 'active', sort: 1, needs_review: false, owner: null, notes: '' } });
    ops.push({ type: 'setMainProject', id: MAIN.id });
    let prev = null;
    MAIN.stages.forEach((s, i) => {
      ops.push({ type: 'saveStage', id: s.id, project_id: MAIN.id, patch: { title: s.title, ord: i + 1, done_criteria: s.done_criteria, depends_on: prev ? [prev] : [], notes: s.notes || '' } });
      if (s.status !== 'todo') ops.push({ type: 'setStageStatus', id: s.id, status: s.status });
      prev = s.id;
    });
    const nextOps = [];
    MAIN.stages.forEach(s => {
      s.tasks.forEach((title, k) => { const t = find(title); if (t) route(t, { project_id: MAIN.id, stage_id: s.id, track: 'project', stage_ord: k + 1 }); });
      if (s.next){ const t = find(s.next); if (t) nextOps.push({ type: 'saveStage', id: s.id, project_id: MAIN.id, patch: { next_task_id: t.id } }); }
    });
    MAIN.queue.forEach(title => { const t = find(title); if (t) route(t, { project_id: MAIN.id, track: 'queue' }); });
    // выполненные задачи мини-приложения — история главного проекта
    st.tasks.filter(t => isTop(t) && !used.has(t.id) && pathOf(t.area_id) === MAIN.area).forEach(t =>
      route(t, { project_id: MAIN.id, track: t.status === 'done' ? 'project' : 'queue' }));

    // 2. Обязательства перед клиентами
    COMMIT.forEach(title => { const t = find(title); if (t) route(t, { track: 'commitment' }); });

    // 3. Остальные направления EV77 — свои маршруты, требуют разбора; открытое — в очередь, выполненное — история
    const ev = areaByPath('EV77');
    const subAreas = st.areas.filter(a => ev && a.parent_id === ev.id && (a.path || a.name) !== MAIN.area);
    const dirs = [];
    subAreas.forEach((a, i) => {
      const ts = st.tasks.filter(t => isTop(t) && !used.has(t.id) && t.area_id === a.id);
      if (!ts.length) return;
      const pid = ID(100 + i), name = a.name;
      ops.push({ type: 'saveProject', id: pid, patch: { title: name, goal: null, result: null, area_id: a.id, status: 'active', sort: ORDER[name] || 100, needs_review: true, owner: null, notes: '' } });
      dirs.push({ pid, name });
      if (name === 'Сайт'){
        ops.push({ type: 'saveStage', id: SITE.stage, project_id: pid, patch: { title: SITE.stageTitle, ord: 1, done_criteria: null, depends_on: [], notes: '' } });
        ops.push({ type: 'setStageStatus', id: SITE.stage, status: 'current' });
        if (!byId.has(SITE.task)) ops.push({ type: 'addTask', task: { id: SITE.task, title: SITE.taskTitle, notes: '', area_id: a.id, priority: 2, status: 'doing', project_id: pid, stage_id: SITE.stage, track: 'project', stage_ord: 1 } });
      }
      ts.forEach(t => route(t, { project_id: pid, track: isOpenT(t) ? 'queue' : 'project' }));
    });
    ops.push(...nextOps);

    // 4. Пробное применение на копии и отчёт
    for (const op of ops) applyOp(st, JSON.parse(JSON.stringify(op)));
    const T1 = st.tasks, m1 = new Map(T1.map(t => [t.id, t]));
    const KEEP = ['title', 'notes', 'status', 'priority', 'due', 'plan_date', 'plan_order', 'parent_id', 'area_id', 'done_at', 'created_at', 'next_step', 'done_criteria', 'wait_for', 'unblock_action', 'check_date', 'rental_id'];
    const changedOther = T0.filter(t => { const x = m1.get(t.id); return !x || KEEP.some(k => JSON.stringify(t[k] ?? null) !== JSON.stringify(x[k] ?? null)); });
    const routed = T0.filter(t => { const x = m1.get(t.id); return x && ['project_id', 'stage_id', 'track'].some(k => (t[k] || null) !== (x[k] || null)); });
    const top1 = T1.filter(t => !t.parent_id || !m1.has(t.parent_id));
    const unlinked = top1.filter(t => !t.track && !t.project_id);
    const descOpen = id => { let n = 0; const walk = p => T1.forEach(t => { if (t.parent_id === p){ if (t.status !== 'done') n++; walk(t.id); } }); walk(id); return n; };
    const doneOpen = top1.filter(t => t.status === 'done' && descOpen(t.id));
    const dups = dupPairs(T1.filter(t => t.status !== 'done'));
    const byTrack = {}; T1.forEach(t => { const k = t.track || 'не разобрано'; byTrack[k] = (byTrack[k] || 0) + 1; });
    const stagesOf = pid => st.stages.filter(s => s.project_id === pid).sort((a, b) => a.ord - b.ord);
    const projList = st.projects.slice().sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || (a.sort ?? 100) - (b.sort ?? 100) || a.title.localeCompare(b.title)).map(p => {
      const pt = T1.filter(t => t.project_id === p.id), ptop = pt.filter(t => !t.parent_id || !pt.some(x => x.id === t.parent_id));
      return { title: p.title, main: p.is_main, review: p.needs_review,
        stages: stagesOf(p.id).map(s => ({ title: s.title, status: s.status, crit: s.done_criteria, tasks: ptop.filter(t => t.stage_id === s.id).map(t => t.title), next: s.next_task_id ? (m1.get(s.next_task_id) || {}).title : null })),
        queue: ptop.filter(t => t.track === 'queue').map(t => t.title), history: ptop.filter(t => !t.stage_id && t.track !== 'queue').length, all: pt.length };
    });
    const created = T1.length - T0.length;
    const report = {
      before: { tasks: T0.length, open: T0.filter(isOpenT).length, projects: (data.projects || []).length, stages: (data.stages || []).length },
      after: { tasks: T1.length, open: T1.filter(isOpenT).length, projects: st.projects.length, stages: st.stages.length },
      created, routed: routed.length, changedOther: changedOther.map(t => t.title), byTrack, projects: projList,
      unlinked: unlinked.map(t => [t.title, pathOf(t.area_id), t.status]), doneOpen: doneOpen.map(t => [t.title, descOpen(t.id)]),
      dups: dups.map(([a, b, j]) => [a.title, b.title, Math.round(j * 100)]), missing, notes: Object.entries(NOTE_FIT).filter(([t]) => T1.some(x => norm(x.title) === norm(t))), ops: ops.length
    };
    report.html = reportHtml(report);
    return { ops, report };
  }
  function isOpenT(t){ return t.status !== 'done'; }
  function dupPairs(open){
    const W = open.map(t => [t, new Set(norm(t.title).replace(/[^a-zа-я0-9 ]+/g, ' ').split(' ').filter(w => w.length > 2))]), out = [];
    for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++){
      const a = W[i][1], b = W[j][1]; if (a.size < 2 || b.size < 2) continue;
      let n = 0; for (const w of a) if (b.has(w)) n++;
      const jac = n / (a.size + b.size - n), x = W[i][0], y = W[j][0];
      if (jac >= 0.6 && x.parent_id !== y.id && y.parent_id !== x.id) out.push([x, y, jac]);
    }
    return out.sort((p, q) => q[2] - p[2]).slice(0, 40);
  }
  function reportHtml(r){
    const li = a => a.length ? `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>` : '<div class="hint">нет</div>';
    const ST = { done: '✓ завершён', current: '▶ текущий', todo: '◻ впереди' };
    const TR = { inbox: 'Входящие', project: 'Проект', queue: 'Очередь', commitment: 'Обязательство', ops: 'Операционка' };
    return `<div class="rep">
      <div class="status-box">Записей задач: было ${r.before.tasks}, станет ${r.after.tasks} (+${r.created} новая — «${esc(SITE.taskTitle)}»). Открытых: ${r.before.open} → ${r.after.open}.<br>
        Проектов: ${r.before.projects} → ${r.after.projects}, этапов: ${r.before.stages} → ${r.after.stages}. Задач с новым маршрутом: ${r.routed}.<br>
        Изменены поля, кроме маршрута: ${r.changedOther.length ? '<b style="color:var(--red)">' + r.changedOther.length + '</b>' : 'нет — статусы, сроки, дни работы, подзадачи, заметки и id прежние'}.</div>
      <details open><summary>Проекты и этапы</summary>${r.projects.map(p => `<div style="margin:8px 0"><b>${p.main ? '★ ' : ''}${esc(p.title)}</b>${p.review ? ' <span class="chip amber">требует разбора</span>' : ''} <span class="hint">· задач с подзадачами: ${p.all}</span>
        ${p.stages.length ? `<ol>${p.stages.map(s => `<li>${esc(s.title)} — ${ST[s.status]}${s.crit ? '' : ' · <span class="warn">критерий не задан</span>'}${s.tasks.length ? `<br><small>${s.tasks.map(t => (t === s.next ? '➜ ' : '') + esc(t)).join('; ')}</small>` : ''}</li>`).join('')}</ol>` : '<div class="hint">этапы не составлены</div>'}
        ${p.queue.length ? `<div class="hint" style="margin:2px 0">Очередь (${p.queue.length}): ${p.queue.slice(0, 8).map(esc).join('; ')}${p.queue.length > 8 ? '…' : ''}</div>` : ''}${p.history ? `<div class="hint" style="margin:2px 0">История (выполнено): ${p.history}</div>` : ''}</div>`).join('')}</details>
      <details><summary>По типу маршрута (все записи)</summary>${li(Object.entries(r.byTrack).map(([k, n]) => `${esc(TR[k] || k)}: ${n}`))}</details>
      <details><summary>Остаются без маршрута — требуют разбора (${r.unlinked.length})</summary>${li(r.unlinked.map(([t, a, s]) => `${esc(t)} <small>· ${esc(a || 'без полки')}${s === 'done' ? ' · выполнена' : ''}</small>`))}</details>
      <details><summary>Закрыты, но есть открытые подзадачи (${r.doneOpen.length})</summary>${li(r.doneOpen.map(([t, n]) => `${esc(t)} <small>· открыто ${n}</small>`))}</details>
      <details><summary>Возможные дубли — только кандидаты (${r.dups.length})</summary>${li(r.dups.map(([a, b, j]) => `${esc(a)} ⇄ ${esc(b)} <small>· ${j}%</small>`))}</details>
      <details><summary>Требуют решения</summary>${li(r.notes.map(([t, n]) => `${esc(t)} — ${esc(n)}`).concat(r.missing.map(m => 'Не найдена задача по правилу: ' + esc(m))))}</details>
      <div class="hint">Операций: ${r.ops}. Удалений нет. Объединений нет.</div></div>`;
  }
  return { plan };
})();
