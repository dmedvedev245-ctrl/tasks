// Центр задач v5 — адаптация существующих задач к проектам и этапам (сценарий для пробного прогона и выпуска).
// plan() только вычисляет: маршрут для каждой задачи по отдельности (без каскада), проекты и этапы, отчёт до/после.
// Применение на сервере — tm_migrate_v5: ставит маршрут только задачам без маршрута, не изменённым после снимка;
// статусы, сроки, заметки, подзадачи, id и updated_at не меняются. Новые задачи не создаются.
window.MIGRATE_V5 = (() => {
  const ID = n => 'e7700000-0000-4000-8000-' + String(n).padStart(12, '0');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
  const MAIN = {
    id: ID(1), area: 'EV77 / Мини-апп', title: 'Переход на работу через мини-приложение',
    goal: 'Перевести работу EV77 на мини-приложение',
    result: 'Брони, выдачи, возвраты, договоры и расчёты ведутся через мини-приложение; выбран основной источник учёта, проверены роли и уведомления, отправка старой очереди исключена',
    stages: [
      { id: ID(11), title: 'Финансовый модуль', status: 'done', done_criteria: 'Финансовый модуль установлен и проверен',
        tasks: ['afa673ca-32fd-4de8-a4e3-05203183bf12'] },
      { id: ID(12), title: 'Связка amoCRM и мини-приложения', status: 'current',
        done_criteria: 'Согласованная аренда связана с правильной сделкой; даты и события передаются корректно; нет дублей и непредусмотренных действий. Финальное закрытие сделки остаётся ручным.',
        notes: 'Технический пакет CRM установлен, точный вариант Model 3 добавлен. Рабочий обмен выключен и на реальной сделке ещё не проверен — тесты кода не считаются завершением. Следующий шаг: контролируемая проверка на реальной сделке и пилот.',
        tasks: ['b3a57e17-9aa8-4ef9-b72a-32bcb0868526', '335e15cd-82e2-4a59-8393-caa4f35cc3d8'], next: 'b3a57e17-9aa8-4ef9-b72a-32bcb0868526' },
      { id: ID(13), title: 'Приёмочные проверки', status: 'todo',
        done_criteria: 'Проверены бронь (в том числе с телефона), выдача, возврат, договор, расчёты, права и отсутствие дублей',
        notes: 'Проверка брони с телефона отложена до приёмки перед запуском и не блокирует техническую подготовку CRM.',
        tasks: ['8de8ac09-6243-457a-add1-15bcfc1f7703'] },
      { id: ID(14), title: 'Реальный пилот с водителем', status: 'todo', done_criteria: 'Пилот с водителем проведён, найденные проблемы устранены',
        tasks: ['77850981-3231-4b82-85c9-0caa592df04a'] },
      { id: ID(15), title: 'Полный переход', status: 'todo', done_criteria: 'Выбран основной источник учёта, проверены роли и уведомления, исключена отправка старой очереди',
        tasks: ['142abf09-aaa9-42a1-b882-20a9e367af89'] }
    ]
  };
  // Обязательства перед клиентами — вместе со всеми подзадачами (разбор штрафов прошлых арендаторов, сверка Данилы Котова)
  const COMMIT = ['54fae7c3-8940-4489-b6cd-d4137c7050ab'];
  // Начатая правка сайта — существующая задача, новая не создаётся
  const SITE = { stage: ID(201), stageTitle: 'Оформление мобильного первого экрана', task: '618ae72f-a738-4109-9554-2b9a5fa3281b' };
  const ORDER = { 'Сайт': 10, 'Авито': 20, 'Телефония': 30, 'Отчётность': 40 };
  const NOTES = { '00102219-9641-4ea9-8477-376937234bb3': 'возможно, относится к этапу «Связка amoCRM и мини-приложения» — оставлено в очереди CRM' };
  const KEEP = ['title', 'notes', 'status', 'priority', 'due', 'plan_date', 'plan_order', 'parent_id', 'area_id', 'done_at', 'created_at', 'updated_at',
    'next_step', 'done_criteria', 'wait_for', 'unblock_action', 'check_date', 'rental_id', 'template_step'];

  function plan(data, applyOp){
    const T0 = JSON.parse(JSON.stringify(data.tasks || []));
    const byId = new Map(T0.map(t => [t.id, t]));
    const kids = new Map(); T0.forEach(t => { if (t.parent_id && byId.has(t.parent_id)){ if (!kids.has(t.parent_id)) kids.set(t.parent_id, []); kids.get(t.parent_id).push(t); } });
    const tree = id => { const out = [id]; (kids.get(id) || []).forEach(k => out.push(...tree(k.id))); return out; };
    const isTop = t => !t.parent_id || !byId.has(t.parent_id);
    const pathOf = id => { const a = (data.areas || []).find(x => x.id === id); return a ? (a.path || a.name) : ''; };
    const legacy = t => !t.project_id && !t.stage_id && !t.track;
    const missing = [];
    const route = new Map();   // id -> {project_id, stage_id, track, stage_ord}
    const assign = (rootId, r, ord) => {
      if (!byId.has(rootId)){ missing.push(rootId); return; }
      tree(rootId).forEach((id, i) => route.set(id, { project_id: r.project_id || null, stage_id: r.stage_id || null, track: r.track, stage_ord: i === 0 && ord ? ord : null }));
    };
    const projects = [], stages = [], next = [];
    // 1. направления EV77 — в очереди; открытое — очередь проекта, выполненное — история
    const ev = (data.areas || []).find(a => (a.path || a.name) === 'EV77');
    (data.areas || []).filter(a => ev && a.parent_id === ev.id).forEach((a, i) => {
      const tops = T0.filter(t => isTop(t) && t.area_id === a.id);
      if (!tops.length) return;
      const main = (a.path || a.name) === MAIN.area, pid = main ? MAIN.id : ID(100 + i);
      if (!main) projects.push({ id: pid, title: a.name, goal: null, result: null, area_id: a.id, status: 'queue', sort: ORDER[a.name] || 100, owner: null, notes: '', needs_review: true });
      tops.forEach(t => assign(t.id, { project_id: pid, track: t.status === 'done' ? 'project' : 'queue' }));
      if (a.name === 'Сайт'){
        stages.push({ id: SITE.stage, project_id: pid, ord: 1, title: SITE.stageTitle, done_criteria: null, status: 'current', depends_on: [], notes: 'Начатая работа — можно завершить. Новые улучшения сайта — в очередь.' });
        assign(SITE.task, { project_id: pid, stage_id: SITE.stage, track: 'project' }, 1);
        next.push({ stage_id: SITE.stage, task_id: SITE.task });
      }
    });
    // 2. главный проект и его этапы
    const ma = (data.areas || []).find(a => (a.path || a.name) === MAIN.area);
    projects.unshift({ id: MAIN.id, title: MAIN.title, goal: MAIN.goal, result: MAIN.result, area_id: ma ? ma.id : null, status: 'active', sort: 1, owner: null, notes: '', needs_review: false });
    let prev = null;
    MAIN.stages.forEach((s, i) => {
      stages.push({ id: s.id, project_id: MAIN.id, ord: i + 1, title: s.title, done_criteria: s.done_criteria, status: s.status, depends_on: prev ? [prev] : [], notes: s.notes || '' });
      s.tasks.forEach((id, k) => assign(id, { project_id: MAIN.id, stage_id: s.id, track: 'project' }, k + 1));
      if (s.next) next.push({ stage_id: s.id, task_id: s.next });
      prev = s.id;
    });
    // 3. обязательства — последними, чтобы подзадачи сохранили принадлежность
    COMMIT.forEach(id => assign(id, { track: 'commitment' }));

    const routes = [], already = [];
    for (const [id, r] of route){ const t = byId.get(id); if (legacy(t)) routes.push({ id, ...r }); else already.push(t.title); }
    const snapshot = T0.reduce((m, t) => (t.updated_at && t.updated_at > m ? t.updated_at : m), '');
    const sqlPlan = { projects, stages, routes, next, main: MAIN.id };

    // операции для показа в приложении (та же логика, что tm_migrate_v5)
    const ops = [];
    projects.forEach(p => { const { id, ...patch } = p; ops.push({ type: 'saveProject', id, patch }); });
    ops.push({ type: 'setMainProject', id: MAIN.id });
    stages.forEach(s => { const { id, project_id, status, ...patch } = s; ops.push({ type: 'saveStage', id, project_id, patch }); if (status !== 'todo') ops.push({ type: 'setStageStatus', id, status }); });
    routes.forEach(r => { const { id, ...patch } = r; ops.push({ type: 'routeTask', id, patch, with_subtasks: false, keep_updated: true }); });
    next.forEach(n => ops.push({ type: 'saveStage', id: n.stage_id, project_id: (stages.find(s => s.id === n.stage_id) || {}).project_id, patch: { next_task_id: n.task_id } }));

    // пробное применение на копии и отчёт до/после
    const st = JSON.parse(JSON.stringify({ areas: data.areas || [], tasks: T0, projects: data.projects || [], stages: data.stages || [], rentals: [] }));
    for (const op of ops) applyOp(st, JSON.parse(JSON.stringify(op)));
    const T1 = st.tasks, m1 = new Map(T1.map(t => [t.id, t]));
    const keepBroken = T0.filter(t => { const x = m1.get(t.id); return !x || KEEP.some(k => JSON.stringify(t[k] ?? null) !== JSON.stringify(x[k] ?? null)); });
    const idsSame = T0.length === T1.length && T0.every(t => m1.has(t.id));
    const cnt = (arr, f) => arr.reduce((o, t) => { const k = f(t); o[k] = (o[k] || 0) + 1; return o; }, {});
    const subsKept = T0.filter(t => t.parent_id).every(t => (m1.get(t.id) || {}).parent_id === t.parent_id);
    const top1 = T1.filter(t => !t.parent_id || !m1.has(t.parent_id));
    const unlinked = top1.filter(t => !t.track && !t.project_id);
    const commitments = T1.filter(t => t.track === 'commitment' && t.status !== 'done');
    const projView = st.projects.slice().sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || (a.sort ?? 100) - (b.sort ?? 100)).map(p => {
      const pt = T1.filter(t => t.project_id === p.id), ptop = pt.filter(t => !t.parent_id || !pt.some(x => x.id === t.parent_id));
      return { title: p.title, main: p.is_main, status: p.status, review: p.needs_review,
        stages: st.stages.filter(s => s.project_id === p.id).sort((a, b) => a.ord - b.ord).map(s => ({ title: s.title, status: s.status, crit: s.done_criteria, notes: s.notes,
          tasks: ptop.filter(t => t.stage_id === s.id).map(t => ({ title: t.title, status: t.status, next: s.next_task_id === t.id })) })),
        queue: ptop.filter(t => t.track === 'queue' && t.status !== 'done').length, history: ptop.filter(t => t.status === 'done').length, all: pt.length };
    });
    const report = {
      snapshot, before: { tasks: T0.length, status: cnt(T0, t => t.status), projects: (data.projects || []).length, stages: (data.stages || []).length },
      after: { tasks: T1.length, status: cnt(T1, t => t.status), projects: st.projects.length, stages: st.stages.length },
      routes: routes.length, idsSame, subsKept, keepBroken: keepBroken.map(t => t.title), already, missing,
      byTrack: cnt(T1, t => t.track || 'без маршрута'), projects: projView,
      commitments: commitments.map(t => [t.title, t.parent_id && m1.get(t.parent_id) ? m1.get(t.parent_id).title : '', t.status]),
      unlinked: unlinked.map(t => [t.title, pathOf(t.area_id), t.status]),
      dups: dupPairs(T1.filter(t => t.status !== 'done')).map(([a, b, j]) => [a.title, b.title, Math.round(j * 100)]),
      notes: Object.entries(NOTES).filter(([id]) => byId.has(id)).map(([id, n]) => [byId.get(id).title, n])
    };
    report.html = reportHtml(report);
    return { ops, plan: sqlPlan, snapshot, report };
  }
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
    const ST = { done: '✓ завершён', current: '▶ текущий', todo: '◻ впереди' }, PS = { active: 'главный фокус', queue: 'в очереди', paused: 'на паузе', done: 'завершён' };
    const TS = { todo: 'не начата', doing: 'в работе', waiting: 'ждёт', done: 'готово' };
    const stat = o => Object.entries(o).map(([k, n]) => `${TS[k] || k} ${n}`).join(', ');
    const ok = (c, y, n) => c ? `<span style="color:var(--green)">✓ ${y}</span>` : `<b style="color:var(--red)">✕ ${n}</b>`;
    return `<div class="rep">
      <div class="status-box">Снимок данных: ${esc(r.snapshot ? new Date(r.snapshot).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) : '—')} (МСК, последнее изменение в снимке).<br>
        Записей задач: ${r.before.tasks} → ${r.after.tasks}. Статусы до: ${stat(r.before.status)}; после: ${stat(r.after.status)}.<br>
        Проектов: ${r.before.projects} → ${r.after.projects}, этапов: ${r.before.stages} → ${r.after.stages}. Маршрут получат: ${r.routes} задач (каждая отдельно).<br>
        ${ok(r.idsSame, 'id те же, новых задач нет', 'набор id изменился')} · ${ok(r.subsKept, 'подзадачи на месте', 'подзадачи изменились')} ·
        ${ok(!r.keepBroken.length, 'сроки, статусы, заметки, планы и история не меняются', 'изменятся поля: ' + r.keepBroken.length)}</div>
      <details open><summary>Главный фокус и направления</summary>${r.projects.map(p => `<div style="margin:8px 0"><b>${p.main ? '★ ' : ''}${esc(p.title)}</b> <span class="chip ${p.main ? 'accent' : ''}">${PS[p.status] || p.status}</span>${p.review ? ' <span class="chip amber">требует разбора</span>' : ''}
        ${p.stages.length ? `<ol>${p.stages.map(s => `<li>${esc(s.title)} — ${ST[s.status]}<br><small>${s.crit ? 'Готово, когда: ' + esc(s.crit) : '<span class="warn">критерий не задан</span>'}</small>${s.notes ? `<br><small>${esc(s.notes)}</small>` : ''}${s.tasks.length ? `<br><small>${s.tasks.map(t => (t.next ? '➜ ' : '') + esc(t.title) + ' (' + TS[t.status] + ')').join('; ')}</small>` : ''}</li>`).join('')}</ol>` : ''}
        <div class="hint" style="margin:2px 0">${p.stages.length ? '' : 'маршрут не составлен · '}очередь: ${p.queue} · выполнено: ${p.history} · всего с подзадачами: ${p.all}</div></div>`).join('')}</details>
      <details open><summary>Обязательства перед клиентами (${r.commitments.length})</summary>${li(r.commitments.map(([t, p, s]) => `${esc(t)} <small>· ${TS[s]}${p ? ' · ↳ ' + esc(p) : ''}</small>`))}</details>
      <details><summary>По типу маршрута</summary>${li(Object.entries(r.byTrack).map(([k, n]) => `${esc(k)}: ${n}`))}</details>
      <details><summary>Остаются без маршрута — требуют разбора (${r.unlinked.length})</summary>${li(r.unlinked.map(([t, a, s]) => `${esc(t)} <small>· ${esc(a || 'без полки')} · ${TS[s]}</small>`))}</details>
      <details><summary>Возможные дубли — только кандидаты (${r.dups.length})</summary>${li(r.dups.map(([a, b, j]) => `${esc(a)} ⇄ ${esc(b)} <small>· ${j}%</small>`))}</details>
      <details><summary>Требуют решения</summary>${li(r.notes.map(([t, n]) => `${esc(t)} — ${esc(n)}`).concat(r.missing.map(m => 'Не найдена задача: ' + esc(m)), r.already.length ? ['Уже имеют маршрут (не трогаются): ' + r.already.length] : []))}</details>
      <div class="hint">При выпуске маршрут ставится только задачам без маршрута, не изменённым после снимка; остальные вернутся списком «пропущено». Удалений и объединений нет.</div></div>`;
  }
  return { plan };
})();
