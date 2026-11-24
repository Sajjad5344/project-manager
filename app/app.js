'use strict';

const STORAGE_KEY = 'project-manager:v1';
const THEME_KEY = 'project-manager:theme';

const TAB_LABELS = {
  overview: 'مشخصات پروژه',
  checklist: 'برنامه‌ریزی',
  rich: 'یادداشت‌ها',
  costs: 'هزینه‌ها',
  division: 'تقسیم کار',
  members: 'اعضای گروه',
};
// Types a user can pick when adding a custom tab
const CUSTOM_TYPES = {
  rich: 'یادداشت (ویرایشگر متن)',
  checklist: 'لیست کارها (تیک‌دار)',
  costs: 'لیست هزینه',
  division: 'تقسیم کار',
  members: 'لیست اعضا',
};
const DEFAULT_TYPES = ['overview', 'checklist', 'rich', 'costs', 'division', 'members'];
const FONT_FAMILIES = [
  ['Vazirmatn, Tahoma, sans-serif', 'وزیرمتن'],
  ['Tahoma, Arial, sans-serif', 'Tahoma'],
  ['Georgia, serif', 'Georgia'],
  ['"Times New Roman", serif', 'Times New Roman'],
  ['"Courier New", monospace', 'Courier New'],
];
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];

/* ---------- helpers ---------- */

const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmtNum = (n) => Number(n).toLocaleString('fa-IR', { maximumFractionDigits: 2 });

// Small DOM builder: h('div', {class:'x', onclick: fn}, child, [children])
function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = !!v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

const delBtn = (onclick) => h('button', { class: 'icon danger', title: 'حذف', onclick }, '✕');
const emptyMsg = (list, msg) => (list.length ? null : h('p', { class: 'empty' }, msg));
function removeFrom(arr, id) {
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
}

/* ---------- state ---------- */

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && Array.isArray(s.projects)) return s;
  } catch (e) { /* ignore corrupt data */ }
  return { projects: [] };
}
let state = loadState();
const ui = { projectId: state.projects[0] ? state.projects[0].id : null, tabId: null };

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function changed() { save(); render(); }
function currentProject() { return state.projects.find((p) => p.id === ui.projectId) || null; }
function currentTab(p) { return p.tabs.find((t) => t.id === ui.tabId) || p.tabs[0]; }

function defaultData(type) {
  switch (type) {
    case 'overview': return { description: '' };
    case 'rich': return { html: '' };
    case 'costs': return { currency: '€', items: [] };
    default: return { items: [] };
  }
}
function makeTab(type, title) {
  return { id: uid(), type, title: title || TAB_LABELS[type] || 'تب', data: defaultData(type) };
}
function createProject(title) {
  const p = { id: uid(), title, createdAt: Date.now(), tabs: DEFAULT_TYPES.map((t) => makeTab(t)) };
  state.projects.push(p);
  ui.projectId = p.id;
  ui.tabId = null;
  changed();
}

/* ---------- top-level rendering ---------- */

function render() {
  renderSidebar();
  renderMain();
}

function renderSidebar() {
  const side = $('#sidebar');
  side.replaceChildren();
  const input = h('input', { type: 'text', placeholder: 'عنوان پروژه (مثلاً ساخت بازوی رباتیک)' });
  const add = () => {
    const t = input.value.trim();
    if (t) createProject(t);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  const isDark = document.documentElement.dataset.theme === 'dark';

  side.append(
    h('div', { class: 'side-head' },
      h('h2', {}, 'پروژه‌ها'),
      h('button', { class: 'icon theme-toggle', title: isDark ? 'حالت روشن' : 'حالت تاریک', onclick: toggleTheme },
        isDark ? '☀' : '☾')),
    h('div', { class: 'stack' }, input, h('button', { class: 'btn primary', onclick: add }, '+ افزودن پروژه')),
    h('ul', { class: 'project-list' },
      state.projects.map((p) => h('li', {
        class: 'project-item' + (p.id === ui.projectId ? ' active' : ''),
        onclick: () => { ui.projectId = p.id; ui.tabId = null; render(); },
      },
        h('span', { class: 'grow' }, p.title),
        h('button', {
          class: 'icon danger', title: 'حذف پروژه',
          onclick: async (e) => {
            e.stopPropagation();
            const ok = await askConfirm(`پروژه «${p.title}» و همه اطلاعات آن حذف شود؟`, { danger: true, okText: 'حذف' });
            if (!ok) return;
            removeFrom(state.projects, p.id);
            if (ui.projectId === p.id) { ui.projectId = state.projects[0] ? state.projects[0].id : null; ui.tabId = null; }
            changed();
          },
        }, '✕'),
      ))),
    ...(state.projects.length === 0 ? [h('p', { class: 'muted' }, 'هنوز پروژه‌ای ندارید.')] : []),
  );
}

function renderMain() {
  const main = $('#main');
  main.replaceChildren();
  const p = currentProject();
  if (!p) {
    main.append(h('div', { class: 'welcome' },
      h('h1', {}, 'به برنامه مدیریت پروژه خوش آمدید'),
      h('p', {}, 'از سمت راست یک پروژه جدید اضافه کنید، مثلاً «ساخت بازوی رباتیک».')));
    return;
  }
  const tab = currentTab(p);
  ui.tabId = tab.id;
  main.append(
    h('h1', {}, p.title),
    renderTabBar(p, tab),
    renderTabContent(p, tab),
  );
}

function renderTabBar(p, active) {
  const bar = h('nav', { class: 'tabs' });
  for (const t of p.tabs) {
    bar.append(h('div', { class: 'tab' + (t.id === active.id ? ' active' : '') },
      h('button', { class: 'tab-btn', onclick: () => { ui.tabId = t.id; render(); } }, t.title),
      h('button', {
        class: 'icon', title: 'تغییر نام تب',
        onclick: async () => {
          const n = await askText('نام جدید تب', t.title);
          if (n && n.trim()) { t.title = n.trim(); changed(); }
        },
      }, '✎'),
      h('button', {
        class: 'icon danger', title: 'حذف تب',
        onclick: async () => {
          if (p.tabs.length <= 1) { await askInfo('حداقل یک تب باید باقی بماند.'); return; }
          const ok = await askConfirm(`تب «${t.title}» و محتوای آن حذف شود؟`, { danger: true, okText: 'حذف' });
          if (!ok) return;
          removeFrom(p.tabs, t.id);
          ui.tabId = null;
          changed();
        },
      }, '✕'),
    ));
  }

  // Form to add a new custom tab
  const titleIn = h('input', { type: 'text', placeholder: 'عنوان تب جدید' });
  const typeSel = h('select', {},
    Object.entries(CUSTOM_TYPES).map(([k, v]) => h('option', { value: k }, v)));
  const add = () => {
    const t = titleIn.value.trim();
    if (!t) return;
    const nt = makeTab(typeSel.value, t);
    p.tabs.push(nt);
    ui.tabId = nt.id;
    changed();
  };
  titleIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  bar.append(h('div', { class: 'tab-add' }, titleIn, typeSel, h('button', { class: 'btn', onclick: add }, '+ افزودن تب')));
  return bar;
}

const RENDERERS = {
  overview: renderOverview,
  checklist: renderChecklist,
  rich: renderRich,
  costs: renderCosts,
  division: renderDivision,
  members: renderMembers,
};
function renderTabContent(p, tab) {
  const r = RENDERERS[tab.type];
  return r ? r(p, tab) : h('p', {}, 'نوع این تب ناشناخته است.');
}

/* ---------- tab: overview (title & description) ---------- */

function renderOverview(p, tab) {
  const d = tab.data;
  const title = h('input', {
    type: 'text', value: p.title,
    onchange: (e) => { const v = e.target.value.trim(); if (v) p.title = v; changed(); },
  });
  const desc = h('textarea', {
    rows: 12,
    placeholder: 'تعریف پروژه، هدف، محدوده کار، نتایج مورد انتظار…',
    oninput: (e) => { d.description = e.target.value; save(); },
  });
  desc.value = d.description;
  return h('section', { class: 'panel' },
    h('label', {}, 'عنوان پروژه', title),
    h('label', {}, 'تعریف و توضیحات پروژه', desc),
    h('p', { class: 'muted' },
      `تاریخ ایجاد: ${new Date(p.createdAt).toLocaleDateString('fa-IR')} · تعداد تب‌ها: ${fmtNum(p.tabs.length)}`),
  );
}

/* ---------- tab: checklist (planning / custom task list) ---------- */

function renderChecklist(p, tab) {
  const items = tab.data.items;
  const done = items.filter((i) => i.done).length;
  const input = h('input', { type: 'text', placeholder: 'کار جدید…', class: 'grow' });
  const add = () => {
    const v = input.value.trim();
    if (!v) return;
    items.push({ id: uid(), text: v, done: false });
    changed();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  return h('section', { class: 'panel' },
    h('div', { class: 'row' }, input, h('button', { class: 'btn primary', onclick: add }, 'افزودن')),
    h('p', { class: 'muted' }, `${fmtNum(done)} از ${fmtNum(items.length)} کار انجام شده`),
    h('ul', { class: 'checklist' }, items.map((it) => h('li', { class: it.done ? 'done' : '' },
      h('input', {
        type: 'checkbox', checked: it.done,
        onchange: (e) => { it.done = e.target.checked; changed(); },
      }),
      h('input', {
        type: 'text', class: 'grow', value: it.text,
        onchange: (e) => { it.text = e.target.value.trim() || it.text; changed(); },
      }),
      delBtn(() => { removeFrom(items, it.id); changed(); }),
    ))),
    emptyMsg(items, 'هنوز کاری ثبت نشده است.'),
  );
}

/* ---------- tab: rich text notes ---------- */

let lastRange = null; // last selection inside an editor, so toolbar actions can restore it
document.addEventListener('selectionchange', () => {
  const s = getSelection();
  if (!s.rangeCount) return;
  const r = s.getRangeAt(0);
  const n = r.commonAncestorContainer;
  const el = n.nodeType === 1 ? n : n.parentElement;
  if (el && el.closest('.editor-body')) lastRange = r.cloneRange();
});

// Replace legacy <font> tags with <span style="..."> so the style is stored as CSS.
function replaceFontTags(body, selector, styleFn) {
  body.querySelectorAll(selector).forEach((f) => {
    const s = document.createElement('span');
    s.style.cssText = styleFn(f);
    if (f.hasAttribute('color')) s.style.color = f.getAttribute('color');
    s.innerHTML = f.innerHTML;
    f.replaceWith(s);
  });
}

function renderRich(p, tab) {
  lastRange = null;
  const body = h('div', { class: 'editor-body', contenteditable: 'true', dir: 'auto', spellcheck: 'true' });
  body.innerHTML = tab.data.html;
  const sync = () => { tab.data.html = body.innerHTML; save(); };
  body.addEventListener('input', sync);
  return h('section', { class: 'panel' }, toolbar(body, sync), body);
}

function toolbar(body, sync) {
  const restore = () => {
    body.focus();
    if (lastRange) {
      try {
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(lastRange);
      } catch (e) { /* range no longer valid */ }
    }
  };
  const run = (cmd, val = null) => { restore(); document.execCommand(cmd, false, val); sync(); };
  const btn = (content, title, cmd, val) => h('button', {
    type: 'button', class: 'tb', title,
    onmousedown: (e) => e.preventDefault(), // keep the text selection
    onclick: () => run(cmd, val),
  }, content);
  const select = (title, placeholder, options, onpick) => h('select', {
    class: 'tb-select', title,
    onchange: (e) => { const v = e.target.value; e.target.value = ''; if (v) onpick(v); },
  }, h('option', { value: '' }, placeholder), options.map(([v, l]) => h('option', { value: v }, l)));
  const colorBtn = (title, label, initial, cmd) => h('label', { class: 'tb tb-color', title },
    h('span', {}, label),
    h('input', { type: 'color', value: initial, onchange: (e) => {
      if (cmd === 'hilite') {
        restore();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('hiliteColor', false, e.target.value);
        document.execCommand('styleWithCSS', false, false);
        sync();
      } else {
        run('foreColor', e.target.value);
      }
    } }));

  return h('div', { class: 'toolbar' },
    select('تیتربندی', 'تیتربندی', [['<p>', 'متن عادی'], ['<h1>', 'تیتر ۱'], ['<h2>', 'تیتر ۲'], ['<h3>', 'تیتر ۳']],
      (v) => run('formatBlock', v)),
    select('قلم', 'قلم', FONT_FAMILIES, (v) => {
      restore();
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('fontName', false, v);
      document.execCommand('styleWithCSS', false, false);
      replaceFontTags(body, 'font[face]', (f) => `font-family:${f.getAttribute('face')}`);
      sync();
    }),
    select('اندازه', 'اندازه', FONT_SIZES.map((s) => [String(s), s + 'px']), (v) => {
      restore();
      document.execCommand('fontSize', false, '7');
      replaceFontTags(body, 'font[size="7"]', () => `font-size:${v}px`);
      sync();
    }),
    btn(h('b', {}, 'B'), 'بولد', 'bold'),
    btn(h('i', {}, 'I'), 'کج', 'italic'),
    btn(h('u', {}, 'U'), 'زیرخط', 'underline'),
    btn(h('s', {}, 'S'), 'خط‌خوردگی', 'strikeThrough'),
    colorBtn('رنگ نوشته', 'A', '#000000', 'fore'),
    colorBtn('رنگ هایلایت', '▮', '#fff59d', 'hilite'),
    btn('• لیست', 'لیست نقطه‌ای', 'insertUnorderedList'),
    btn('1. لیست', 'لیست شماره‌دار', 'insertOrderedList'),
    btn('⇤', 'افزایش تورفتگی', 'indent'),
    btn('⇥', 'کاهش تورفتگی', 'outdent'),
    btn('⬅', 'چپ‌چین', 'justifyLeft'),
    btn('↔', 'وسط‌چین', 'justifyCenter'),
    btn('➡', 'راست‌چین', 'justifyRight'),
    btn('≡', 'خط‌چین (دوطرفه)', 'justifyFull'),
    btn('—', 'خط افقی', 'insertHorizontalRule'),
    btn('⌫ قالب', 'پاک‌کردن قالب‌بندی', 'removeFormat'),
    btn('↶', 'برگشت', 'undo'),
    btn('↷', 'انجام دوباره', 'redo'),
  );
}

/* ---------- tab: costs ---------- */

function renderCosts(p, tab) {
  const d = tab.data;
  const name = h('input', { type: 'text', placeholder: 'نام هزینه (مثلاً موتور سروو)', class: 'grow' });
  const amount = h('input', { type: 'number', min: '0', step: 'any', placeholder: 'مبلغ' });
  const add = () => {
    const n = name.value.trim();
    const a = parseFloat(amount.value);
    if (!n || isNaN(a)) return;
    d.items.push({ id: uid(), name: n, amount: a });
    changed();
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') amount.focus(); });
  amount.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  const total = d.items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return h('section', { class: 'panel' },
    h('div', { class: 'row' }, name, amount, h('button', { class: 'btn primary', onclick: add }, 'افزودن')),
    h('div', { class: 'row muted' }, 'واحد پول: ',
      h('input', { type: 'text', class: 'small', value: d.currency,
        onchange: (e) => { d.currency = e.target.value.trim(); changed(); } })),
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'هزینه'), h('th', {}, 'مبلغ'), h('th', {}, ''))),
      h('tbody', {}, d.items.map((it) => h('tr', {},
        h('td', {}, h('input', { type: 'text', value: it.name,
          onchange: (e) => { it.name = e.target.value.trim() || it.name; changed(); } })),
        h('td', {}, h('input', { type: 'number', min: '0', step: 'any', value: it.amount,
          onchange: (e) => { it.amount = parseFloat(e.target.value) || 0; changed(); } })),
        h('td', {}, delBtn(() => { removeFrom(d.items, it.id); changed(); })),
      ))),
    ),
    h('p', { class: 'total' }, `جمع کل: ${fmtNum(total)} ${d.currency}`),
    emptyMsg(d.items, 'هنوز هزینه‌ای ثبت نشده است.'),
  );
}

/* ---------- tab: division of work ---------- */

function renderDivision(p, tab) {
  const d = tab.data;
  const mt = p.tabs.find((t) => t.type === 'members');
  const names = mt ? mt.data.items.map((m) => m.name).filter(Boolean) : [];
  const listId = 'member-names';
  const task = h('input', { type: 'text', placeholder: 'کار / بخش', class: 'grow' });
  const who = h('input', { type: 'text', placeholder: 'مسئول', list: listId });
  const add = () => {
    const t = task.value.trim();
    if (!t) return;
    d.items.push({ id: uid(), task: t, member: who.value.trim(), done: false });
    changed();
  };
  task.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  who.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  const done = d.items.filter((i) => i.done).length;

  return h('section', { class: 'panel' },
    h('datalist', { id: listId }, names.map((n) => h('option', { value: n }))),
    h('div', { class: 'row' }, task, who, h('button', { class: 'btn primary', onclick: add }, 'افزودن')),
    h('p', { class: 'muted' },
      `${fmtNum(done)} از ${fmtNum(d.items.length)} بخش انجام شده` +
      (names.length ? '' : ' · برای انتخاب سریع مسئول، ابتدا اعضا را در تب «اعضای گروه» اضافه کنید.')),
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'انجام شد'), h('th', {}, 'کار'), h('th', {}, 'مسئول'), h('th', {}, ''))),
      h('tbody', {}, d.items.map((it) => h('tr', { class: it.done ? 'done' : '' },
        h('td', {}, h('input', { type: 'checkbox', checked: it.done,
          onchange: (e) => { it.done = e.target.checked; changed(); } })),
        h('td', {}, h('input', { type: 'text', value: it.task,
          onchange: (e) => { it.task = e.target.value.trim() || it.task; changed(); } })),
        h('td', {}, h('input', { type: 'text', value: it.member, list: listId,
          onchange: (e) => { it.member = e.target.value.trim(); changed(); } })),
        h('td', {}, delBtn(() => { removeFrom(d.items, it.id); changed(); })),
      ))),
    ),
    emptyMsg(d.items, 'هنوز کاری برای تقسیم ثبت نشده است.'),
  );
}

/* ---------- tab: group members ---------- */

function renderMembers(p, tab) {
  const d = tab.data;
  const name = h('input', { type: 'text', placeholder: 'نام عضو', class: 'grow' });
  const role = h('input', { type: 'text', placeholder: 'نقش / تخصص (مثلاً مکانیک، برنامه‌نویس)', class: 'grow' });
  const add = () => {
    const n = name.value.trim();
    if (!n) return;
    d.items.push({ id: uid(), name: n, role: role.value.trim() });
    changed();
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') role.focus(); });
  role.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  return h('section', { class: 'panel' },
    h('div', { class: 'row' }, name, role, h('button', { class: 'btn primary', onclick: add }, 'افزودن عضو')),
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'نام'), h('th', {}, 'نقش / تخصص'), h('th', {}, ''))),
      h('tbody', {}, d.items.map((it) => h('tr', {},
        h('td', {}, h('input', { type: 'text', value: it.name,
          onchange: (e) => { it.name = e.target.value.trim() || it.name; changed(); } })),
        h('td', {}, h('input', { type: 'text', value: it.role,
          onchange: (e) => { it.role = e.target.value.trim(); changed(); } })),
        h('td', {}, delBtn(() => { removeFrom(d.items, it.id); changed(); })),
      ))),
    ),
    emptyMsg(d.items, 'هنوز عضوی اضافه نشده است.'),
  );
}

/* ---------- in-app dialogs (native confirm/prompt misbehave in Electron) ---------- */

function modal({ title = '', message = '', input = null, okText = 'تأیید', cancelText = 'انصراف', danger = false, info = false }) {
  return new Promise((resolve) => {
    const field = input !== null ? h('input', { type: 'text', value: input }) : null;
    let overlay = null;
    const done = (v) => {
      document.removeEventListener('keydown', onKey, true);
      if (overlay) overlay.remove();
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done(null); }
      else if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        done(field ? field.value : true);
      }
    };
    const ok = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(field ? field.value : true) }, okText);
    const cancel = info ? null : h('button', { class: 'btn', onclick: () => done(null) }, cancelText);
    overlay = h('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) done(null); } },
      h('div', { class: 'modal', role: 'dialog' },
        title ? h('h3', {}, title) : null,
        message ? h('p', {}, message) : null,
        field,
        h('div', { class: 'modal-actions' }, cancel, ok)));
    document.body.append(overlay);
    document.addEventListener('keydown', onKey, true);
    if (field) { field.focus(); field.select(); } else ok.focus();
  });
}
const askConfirm = (message, opts = {}) => modal({ message, ...opts }).then((v) => v === true);
const askText = (title, value) => modal({ title, input: value, okText: 'ذخیره' }).then((v) => (typeof v === 'string' ? v : null));
const askInfo = (message) => modal({ message, okText: 'باشه', info: true });

/* ---------- theme (light / dark) ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}
function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  renderSidebar();
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

initTheme();
render();
