"use strict";

/* ================= Константы ================= */

const STORE_KEY = "hrum-v1";
const MEALS = [["breakfast", "Завтрак"], ["lunch", "Обед"], ["dinner", "Ужин"], ["snack", "Перекусы"]];
// Бытовая активность БЕЗ тренировок — тренировки добавляются отдельно
const ACTIVITY = [
  [1.2, "Сидячая работа", "Мало хожу, в основном за столом"],
  [1.3, "Сидячая, но много хожу", "8–10 тысяч шагов в день"],
  [1.45, "Работа на ногах", "Физический труд, весь день в движении"],
];
const GOALS = {
  cut: [-0.15, "Похудение", "Дефицит 15% — около 0,5 кг в неделю"],
  keep: [0, "Поддержание", "Держать текущий вес"],
  bulk: [0.10, "Набор", "Профицит 10% — рост мышц"],
};
// Метаболический эквивалент (MET)
const WORKOUTS = [
  ["Ходьба", 3.5], ["Быстрая ходьба", 4.5], ["Бег", 9.8], ["Велосипед", 7.5], ["Силовая", 5],
  ["Плавание", 6], ["Йога", 2.5], ["Футбол", 7], ["Лыжи", 9], ["Танцы", 5], ["Единоборства", 10], ["HIIT", 8],
];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

/* ================= Утилиты ================= */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r0 = n => Math.round(n);
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace(".", ",");
function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}
const num = v => { const x = parseFloat(String(v ?? "").replace(",", ".").trim()); return Number.isFinite(x) ? x : null; };

function dayKey(d = new Date()) {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function parseDay(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
function shiftDay(k, n) { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); }
function dayTitle(k) {
  const t = dayKey();
  if (k === t) return "Сегодня";
  if (k === shiftDay(t, -1)) return "Вчера";
  const d = parseDay(k);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function daySub(k) { const d = parseDay(k); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; }
function mealByTime() {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 18 ? "snack" : "dinner";
}
const mealName = k => (MEALS.find(m => m[0] === k) || MEALS[3])[1];

let toastTimer;
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ================= Платформа ================= */

const IS_STANDALONE = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const HIDE_INSTALL_KEY = "hrum-install-hidden";

function installHidden() {
  if (IS_STANDALONE) return true;
  try { return Date.now() - Number(localStorage.getItem(HIDE_INSTALL_KEY) || 0) < 3 * 864e5; }
  catch (e) { return false; }
}

// Карточка «Поселите Хрум на главный экран» — пока приложение открыто в браузере
function installCard(force = false) {
  if (IS_STANDALONE || (!force && installHidden())) return "";
  const iosWarn = IS_IOS && !S.profile
    ? `<p class="install-warn">На iPhone сначала добавь Хрум на экран «Домой» и открой с иконки, а потом заполняй профиль — у иконки своя память, отдельная от Safari.</p>`
    : "";
  return `<section class="card install">
    <img src="icons/icon-192.png" alt="">
    <div><b>Поселите Хрум на главный экран</b><span>Будет открываться с иконки-печеньки, на весь экран и без интернета</span></div>
    ${force ? "" : `<button class="close" data-a="hideInstall" aria-label="Скрыть подсказку">×</button>`}
    ${iosWarn}
    <button class="btn" data-a="install">${ui.installPrompt ? "Установить" : "Как это сделать"}</button>
  </section>`;
}

// Подпись автора внизу каждого экрана
function footer() {
  return `<footer class="credit">
    <button class="author" data-a="author" aria-label="Об авторе" aria-expanded="false"><img src="icons/author.png" alt="Логотип автора"></button>
    <div><b id="authorName" hidden>Чукин Владимир</b><span>© 2026</span></div>
  </footer>`;
}

/* ================= Хранилище ================= */

function blank() { return { profile: null, products: [], entries: {}, workouts: {}, weights: {}, recent: [], seq: 1 }; }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && typeof s === "object") return Object.assign(blank(), s);
  } catch (e) { /* пусто или недоступно */ }
  return blank();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast("Не удалось сохранить — память браузера недоступна"); }
}
const uid = () => (S.seq++).toString(36) + Date.now().toString(36).slice(-5);

let S = load();
const ui = { view: "diary", day: dayKey(), addMeal: null, onPick: null, gctx: null, codeBusy: false, installPrompt: null };

/* ================= Расчёты ================= */

function targets(pr = S.profile) {
  const lbm = pr.weight * (1 - pr.bodyFat / 100);          // сухая масса
  const bmr = 370 + 21.6 * lbm;                              // Кетч-МакАрдл
  const tdee = bmr * pr.activity;
  const kcal = tdee * (1 + GOALS[pr.goal][0]);
  const p = (pr.goal === "cut" ? 2.2 : 2.0) * lbm;
  const f = 0.9 * pr.weight;
  const c = Math.max(0, (kcal - p * 4 - f * 9) / 4);
  return { lbm, bmr, tdee, kcal, p, f, c };
}

function navyBodyFat(sex, height, neck, waist, hip) {
  const lg = Math.log10;
  const bf = sex === "m"
    ? 495 / (1.0324 - 0.19077 * lg(waist - neck) + 0.15456 * lg(height)) - 450
    : 495 / (1.29579 - 0.35004 * lg(waist + hip - neck) + 0.22100 * lg(height)) - 450;
  return Math.round(Math.min(60, Math.max(3, bf)) * 10) / 10;
}

// сверх базового обмена (MET − 1), покой уже учтён в норме
const workoutKcal = (met, weight, minutes) => (met - 1) * weight * minutes / 60;

function dayData(k) {
  const es = S.entries[k] || [];
  const ws = S.workouts[k] || [];
  const eaten = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const e of es) for (const x in eaten) eaten[x] += e[x];
  const burned = ws.reduce((s, w) => s + w.kcal, 0);
  const t = targets();
  return { es, ws, eaten, burned, t, limit: t.kcal + burned };
}

/* ================= Продукты ================= */

const norm = s => String(s).toLowerCase().replace(/ё/g, "е").trim();
const stem = w => (w.length > 4 ? w.slice(0, Math.max(3, w.length - 2)) : w);
const allProducts = () => [...S.products, ...BASE_PRODUCTS];
const findProduct = id => allProducts().find(p => p.id === id);
const kbju = p => `${r0(p.kcal)} ккал · Б ${fmt(p.p)} · Ж ${fmt(p.f)} · У ${fmt(p.c)}`;

function searchProducts(q) {
  const all = allProducts();
  const nq = norm(q);
  if (!nq) {
    const rec = S.recent.map(findProduct).filter(Boolean);
    return [...rec, ...all.filter(p => !S.recent.includes(p.id))];
  }
  const words = (nq.match(/[\p{L}\p{N}]+/gu) || []).map(stem);
  const hits = all.filter(p => { const n = norm(p.name); return words.every(w => n.includes(w)); });
  const rank = p => (norm(p.name).startsWith(words[0]) ? 0 : 1) * 2 + (S.recent.includes(p.id) ? 0 : 1);
  return hits.sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length);
}

function touchRecent(id) {
  S.recent = [id, ...S.recent.filter(x => x !== id)].slice(0, 30);
}

async function fetchOFF(code) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_ru,brands,nutriments`,
      { signal: ctrl.signal }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const pr = d.product;
    if (!pr) return null;
    const n = pr.nutriments || {};
    let kcal = n["energy-kcal_100g"];
    if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
    if (kcal == null) return null;
    let name = pr.product_name_ru || pr.product_name || `Товар ${code}`;
    const brand = (pr.brands || "").split(",")[0].trim();
    if (brand && !norm(name).includes(norm(brand))) name += ` (${brand})`;
    const v = x => Math.round((+x || 0) * 10) / 10;
    return { name, kcal: v(kcal), p: v(n.proteins_100g), f: v(n.fat_100g), c: v(n.carbohydrates_100g) };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ================= Иконки ================= */

const ICONS = {
  diary: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8v8M11 8v8M14 8v8M17 8v8"/>',
  chart: '<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  run: '<circle cx="14" cy="4" r="2"/><path d="M8 21l3-6 3 3v3M6 12l3-3 4 1 3 3h3M11 15l-1-4"/>',
};
const icon = (k, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

function renderTabs() {
  const tab = (v, ic, label) => `<button data-a="tab" data-v="${v}" class="${ui.view === v ? "on" : ""}">${icon(ic)}${label}</button>`;
  $("#tabs").innerHTML = `<div class="inner">
    ${tab("diary", "diary", "Дневник")}
    ${tab("products", "search", "Продукты")}
    <button class="scan" data-a="scan" aria-label="Сканировать штрихкод"><span class="circle">${icon("scan")}</span></button>
    ${tab("progress", "chart", "Прогресс")}
    ${tab("profile", "user", "Профиль")}
  </div>`;
}

/* ================= Экран: дневник ================= */

function viewDiary() {
  const d = dayData(ui.day);
  const { t, eaten, burned, limit } = d;
  const left = limit - eaten.kcal;
  const over = left < 0;
  const C = 2 * Math.PI * 52;
  const frac = Math.min(1, eaten.kcal / limit);
  const isToday = ui.day === dayKey();

  const macro = (name, v, target, color) => {
    const pct = target ? v / target * 100 : 0;
    return `<div class="macro"><span class="name">${name}</span>
      <span class="val">${r0(v)} <small>/ ${r0(target)} г</small></span>
      <div class="bar ${pct > 110 ? "over" : ""}"><i style="width:${Math.min(100, pct)}%;background:var(${color})"></i></div></div>`;
  };

  const meals = MEALS.map(([key, title]) => {
    const items = d.es.filter(e => e.meal === key);
    const kc = items.reduce((s, e) => s + e.kcal, 0);
    const body = items.length
      ? items.map(e => `<button class="item" data-a="editEntry" data-id="${e.id}">
          <span class="n">${esc(e.name)}</span><span class="k">${r0(e.kcal)}</span>
          <span class="g">${fmt(e.grams, 0)} г</span><span class="m">Б ${r0(e.p)} · Ж ${r0(e.f)} · У ${r0(e.c)}</span></button>`).join("")
      : `<div class="empty">Пусто</div>`;
    return `<article class="meal">
      <div class="meal-head"><h3>${title}</h3><span class="kc">${kc ? r0(kc) + " ккал" : ""}</span>
        <button class="add" data-a="addFood" data-meal="${key}" aria-label="Добавить: ${title}">+</button></div>${body}</article>`;
  }).join("");

  const workouts = d.ws.map(w => `<button class="row-card" data-a="editWorkout" data-id="${w.id}">
      <span class="badge">${icon("run", 20)}</span>
      <span class="t"><b>${esc(w.name)}</b><span>${fmt(w.minutes, 0)} мин</span></span>
      <span class="p">+${r0(w.kcal)}</span></button>`).join("");

  return `
  <header class="top">
    <div class="day">
      <button class="icon-btn" data-a="prevDay" aria-label="Предыдущий день">‹</button>
      <div><h1>${dayTitle(ui.day)}</h1><small>${daySub(ui.day)}</small></div>
      <button class="icon-btn" data-a="nextDay" aria-label="Следующий день" ${isToday ? "disabled" : ""}>›</button>
    </div>
    <div class="brand"><img src="icons/icon-192.png" alt="">хрум</div>
  </header>
  ${installCard()}

  <section class="card hero" aria-label="Итог дня">
    <div class="ring-row">
      <div class="ring ${over ? "over" : ""}">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--track)" stroke-width="11"/>
          <circle class="arc" cx="60" cy="60" r="52" fill="none" stroke="var(${over ? "--danger" : "--accent"})" stroke-width="11"
            stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/>
        </svg>
        <div class="center"><div class="big">${r0(Math.abs(left))}</div><div class="cap">${over ? "ккал сверх лимита" : "ккал осталось"}</div></div>
      </div>
      <div class="balance">
        <div class="kv"><span>Норма</span><b>${r0(t.kcal)}</b></div>
        <div class="kv"><span>Тренировки</span><b class="plus">+${r0(burned)}</b></div>
        <div class="kv"><span>Съедено</span><b>${r0(eaten.kcal)}</b></div>
        <hr>
        <div class="kv"><span>Лимит дня</span><b>${r0(limit)}</b></div>
      </div>
    </div>
    <div class="macros">
      ${macro("Белки", eaten.p, t.p, "--protein")}
      ${macro("Жиры", eaten.f, t.f, "--fat")}
      ${macro("Углеводы", eaten.c, t.c + burned / 4, "--carbs")}
    </div>
    <div class="basis">
      <span>Сухая масса <b>${fmt(t.lbm)} кг</b></span>
      <span>Жир <b>${fmt(S.profile.bodyFat)}%</b></span>
      <span>Цель <b>${GOALS[S.profile.goal][1].toLowerCase()}</b></span>
    </div>
  </section>

  <div class="section-title"><h2>Приёмы пищи</h2><span>${d.es.length ? d.es.length + " " + plural(d.es.length, ["запись", "записи", "записей"]) : "нажми +, чтобы добавить"}</span></div>
  ${meals}

  <div class="section-title"><h2>Активность</h2><span>${burned ? "+" + r0(burned) + " ккал" : ""}</span></div>
  ${workouts}
  <button class="row-card dashed" data-a="addWorkout">+ Добавить тренировку</button>

  <div class="section-title"><h2>Вес</h2><span>последние записи</span></div>
  ${weightCard()}`;
}

function weightSeries(limit) {
  return Object.entries(S.weights).sort(([a], [b]) => a.localeCompare(b)).slice(-limit).map(([k, v]) => ({ k, w: v.w }));
}

function weightCard() {
  const pts = weightSeries(14);
  const cur = S.profile.weight;
  let delta = "";
  if (pts.length > 1) {
    const d = pts[pts.length - 1].w - pts[0].w;
    delta = `${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d))} кг с ${parseDay(pts[0].k).getDate()} ${MONTHS[parseDay(pts[0].k).getMonth()]}`;
  }
  let spark = `<span class="muted small">Записывай вес раз в несколько дней — здесь появится график</span>`;
  if (pts.length > 1) {
    const ws = pts.map(p => p.w), mn = Math.min(...ws), mx = Math.max(...ws), span = mx - mn || 1;
    const xy = pts.map((p, i) => [4 + i * 192 / (pts.length - 1), 6 + (mx - p.w) / span * 40]);
    const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${fmt(x)} ${fmt(y)}`.replace(/,/g, ".")).join(" ");
    const [lx, ly] = xy[xy.length - 1];
    spark = `<svg viewBox="0 0 200 56" preserveAspectRatio="none" aria-hidden="true">
      <path d="${line} L${lx} 56 L4 56 Z" fill="var(--accent-soft)"/>
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      <circle cx="${lx}" cy="${ly}" r="3.5" fill="var(--accent)"/></svg>`;
  }
  return `<button class="card weight" data-a="addWeight">
    <div><div class="w">${fmt(cur)} <small>кг</small></div><div class="d">${delta || "Записать вес"}</div></div>${spark}</button>`;
}

/* ================= Экран: продукты ================= */

function viewProducts() {
  return `<header class="top"><h1>Продукты</h1><span class="muted small">${allProducts().length} в базе</span></header>
    <input id="psearch" class="input" type="search" placeholder="Поиск по названию" autocomplete="off">
    <div class="btn-row">
      <button class="btn ghost" data-a="scan">Штрихкод</button>
      <button class="btn ghost" data-a="newProduct">+ Новый продукт</button>
    </div>
    <div id="plist" class="list"></div>`;
}
function mountProducts() {
  const inp = $("#psearch");
  const draw = () => { $("#plist").innerHTML = productRows(searchProducts(inp.value).slice(0, 80), "openProduct", inp.value); };
  inp.addEventListener("input", draw);
  draw();
}
function productRows(list, action, q) {
  if (!list.length) {
    return `<p class="muted">Не нашёл «${esc(q)}».</p>
      <button class="btn ghost" data-a="newProduct" data-name="${esc(q)}">Создать продукт «${esc(q)}»</button>`;
  }
  return list.map(p => `<button class="prod" data-a="${action}" data-id="${p.id}">
      <span class="n">${esc(p.name)}${p.id[0] !== "b" ? `<span class="tag">${p.barcode ? "штрихкод" : "мой"}</span>` : ""}</span>
      <span class="k">${r0(p.kcal)} ккал</span>
      <span class="m">на 100 г · Б ${fmt(p.p)} · Ж ${fmt(p.f)} · У ${fmt(p.c)}</span></button>`).join("");
}

/* ================= Экран: прогресс ================= */

function viewProgress() {
  const t = targets();
  const days = Array.from({ length: 14 }, (_, i) => shiftDay(dayKey(), i - 13));
  const data = days.map(k => { const d = dayData(k); return { k, eaten: d.eaten.kcal, limit: d.limit, has: d.es.length > 0 }; });

  // сегодняшний день ещё не закончен — в среднее не берём
  const last7 = data.slice(-8, -1).filter(x => x.has);
  let stats = `<p class="muted small">Записывай еду несколько дней — со следующего дня здесь появится средний дефицит и прогноз.</p>`;
  if (last7.length) {
    const avg = last7.reduce((s, x) => s + x.eaten, 0) / last7.length;
    const bal = last7.reduce((s, x) => s + (x.limit - x.eaten), 0) / last7.length;
    const kgWeek = bal * 7 / 7700;
    stats = `<div class="stats">
      <div class="stat"><b>${r0(avg)}</b><span>ккал в день, в среднем</span></div>
      <div class="stat"><b>${bal >= 0 ? "−" : "+"}${r0(Math.abs(bal))}</b><span>${bal >= 0 ? "дефицит" : "профицит"} в день</span></div>
      <div class="stat"><b>${kgWeek >= 0 ? "−" : "+"}${fmt(Math.abs(kgWeek))}</b><span>кг в неделю при таком темпе</span></div>
    </div><p class="muted small">По ${last7.length} ${plural(last7.length, ["полному дню", "полным дням", "полным дням"])} с записями за неделю, без сегодняшнего. 1 кг жира ≈ 7700 ккал.</p>`;
  }

  // Столбики калорий
  const W = 340, H = 170, L = 34, B = 22, T = 8;
  const max = Math.max(t.kcal * 1.3, ...data.map(x => Math.max(x.eaten, x.limit))) || 1;
  const y = v => T + (H - T - B) * (1 - v / max);
  const step = (W - L) / data.length;
  let bars = "";
  data.forEach((x, i) => {
    const bx = L + i * step + step * 0.2, bw = step * 0.6;
    if (x.eaten > 0) {
      bars += `<rect x="${bx}" y="${y(x.eaten)}" width="${bw}" height="${y(0) - y(x.eaten)}" rx="3" fill="var(${x.eaten > x.limit ? "--danger" : "--accent"})"/>`;
    }
    bars += `<line x1="${bx - 2}" x2="${bx + bw + 2}" y1="${y(x.limit)}" y2="${y(x.limit)}" stroke="var(--ink)" stroke-width="1.5" opacity=".5"/>`;
    if (i % 2 === 1) bars += `<text x="${bx + bw / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="var(--muted)">${parseDay(x.k).getDate()}</text>`;
  });
  const kcalChart = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Калории за 14 дней">
    <line x1="${L}" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>
    <line x1="${L}" x2="${W}" y1="${y(t.kcal)}" y2="${y(t.kcal)}" stroke="var(--line)" stroke-dasharray="4 4"/>
    <text x="${L - 4}" y="${y(t.kcal) + 4}" font-size="10" text-anchor="end" fill="var(--muted)">${r0(t.kcal)}</text>
    <text x="${L - 4}" y="${y(0) + 4}" font-size="10" text-anchor="end" fill="var(--muted)">0</text>
    ${bars}</svg>`;

  // Вес
  const pts = weightSeries(30);
  let weightChart = `<p class="muted small">Нужно минимум две записи веса. Нажми «Записать вес» на экране дневника или в профиле.</p>`;
  if (pts.length > 1) {
    const ws = pts.map(p => p.w), mn = Math.min(...ws) - 0.5, mx = Math.max(...ws) + 0.5;
    const t0 = parseDay(pts[0].k).getTime(), t1 = parseDay(pts[pts.length - 1].k).getTime() || t0 + 1;
    const X = k => L + (W - L - 10) * ((parseDay(k).getTime() - t0) / ((t1 - t0) || 1));
    const Y = w => T + (H - T - B) * (mx - w) / (mx - mn);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.k).toFixed(1)} ${Y(p.w).toFixed(1)}`).join(" ");
    const first = pts[0], lastP = pts[pts.length - 1];
    weightChart = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Вес: с ${fmt(first.w)} до ${fmt(lastP.w)} кг">
      <line x1="${L}" x2="${W}" y1="${Y(mx)}" y2="${Y(mx)}" stroke="var(--line)"/>
      <line x1="${L}" x2="${W}" y1="${Y(mn)}" y2="${Y(mn)}" stroke="var(--line)"/>
      <text x="${L - 4}" y="${Y(mx) + 4}" font-size="10" text-anchor="end" fill="var(--muted)">${fmt(mx)}</text>
      <text x="${L - 4}" y="${Y(mn) + 4}" font-size="10" text-anchor="end" fill="var(--muted)">${fmt(mn)}</text>
      <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(p => `<circle cx="${X(p.k).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="3" fill="var(--accent)"/>`).join("")}
      <text x="${L}" y="${H - 6}" font-size="10" fill="var(--muted)">${parseDay(first.k).getDate()} ${MONTHS[parseDay(first.k).getMonth()]}</text>
      <text x="${W}" y="${H - 6}" font-size="10" text-anchor="end" fill="var(--muted)">${parseDay(lastP.k).getDate()} ${MONTHS[parseDay(lastP.k).getMonth()]}</text>
    </svg>`;
  }

  return `<header class="top"><h1>Прогресс</h1></header>
    <section class="card">${stats}</section>
    <div class="section-title"><h2>Калории за 14 дней</h2><span>черта — лимит дня</span></div>
    <section class="card chart">${kcalChart}</section>
    <div class="section-title"><h2>Вес</h2><span>${pts.length ? pts.length + " " + plural(pts.length, ["запись", "записи", "записей"]) : ""}</span></div>
    <section class="card chart">${weightChart}</section>
    <button class="btn ghost" data-a="addWeight">Записать вес</button>`;
}

/* ================= Экран: профиль ================= */

function viewProfile() {
  const p = S.profile, t = targets();
  const act = ACTIVITY.find(a => a[0] === p.activity) || ACTIVITY[0];
  return `<header class="top"><h1>Профиль</h1><div class="brand"><img src="icons/icon-192.png" alt="">хрум</div></header>
    <section class="card form">
      <div class="kv"><span>${p.sex === "m" ? "Мужчина" : "Женщина"}, ${p.age} лет, ${fmt(p.height, 0)} см</span><b>${fmt(p.weight)} кг</b></div>
      <div class="kv"><span>Процент жира</span><b>${fmt(p.bodyFat)}%</b></div>
      <div class="kv"><span>Сухая масса</span><b>${fmt(t.lbm)} кг</b></div>
      <hr class="rule">
      <div class="kv"><span>Базовый обмен</span><b>${r0(t.bmr)} ккал</b></div>
      <div class="kv"><span>${esc(act[1])} (×${act[0]})</span><b>${r0(t.tdee)} ккал</b></div>
      <div class="kv"><span>Цель: ${GOALS[p.goal][1].toLowerCase()}</span><b>${r0(t.kcal)} ккал</b></div>
      <div class="kv"><span>Белки · Жиры · Углеводы</span><b>${r0(t.p)} · ${r0(t.f)} · ${r0(t.c)} г</b></div>
    </section>
    <details class="card">
      <summary><b>Как считается норма</b></summary>
      <p class="small">Сухая масса = вес × (1 − % жира). Базовый обмен по формуле Кетча-МакАрдла: 370 + 21,6 × сухая масса.
      Он точнее обычных формул, потому что жир почти не тратит энергию, а мышцы тратят.</p>
      <p class="small">Базовый обмен умножается на бытовую активность без тренировок, затем корректируется под цель.
      Тренировки добавляются к лимиту конкретного дня.</p>
      <p class="small">Белок: ${p.goal === "cut" ? "2,2" : "2,0"} г на кг сухой массы. Жиры: 0,9 г на кг веса. Углеводы — остаток калорий.</p>
    </details>
    <button class="btn" data-a="addWeight">Записать вес</button>
    <button class="btn ghost" data-a="editProfile">Изменить профиль</button>
    <div class="section-title"><h2>Данные</h2></div>
    <p class="note">Всё хранится только на этом телефоне. Раз в пару недель сохраняй копию — пригодится при смене телефона.</p>
    <div class="btn-row">
      <button class="btn ghost" data-a="exportData">Сохранить копию</button>
      <label class="btn ghost">Загрузить копию<input type="file" id="importFile" accept="application/json,.json" hidden></label>
    </div>
    <button class="btn ghost" data-a="install">Установить на главный экран</button>`;
}
function mountProfile() {
  $("#importFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || !("entries" in data)) throw new Error("bad");
      openSheet(`<h2>Загрузить копию?</h2>
        <p>Текущие данные на этом телефоне заменятся данными из файла «${esc(file.name)}».</p>
        <button class="btn" data-a="confirmImport">Заменить</button>
        <button class="btn ghost" data-a="closeSheet">Отмена</button>`);
      ui.pendingImport = data;
    } catch (err) {
      toast("Это не файл копии Хрума");
    }
    e.target.value = "";
  });
}

/* ================= Экран: заполнение профиля ================= */

function viewSetup() {
  const p = S.profile || {};
  const seg = (group, val, label) => `<button type="button" data-a="pick" data-val="${val}" aria-pressed="${p[group] === val}">${label}</button>`;
  const opt = (val, title, sub, cur) => `<button type="button" class="option" data-a="pick" data-val="${val}" aria-pressed="${cur === val}"><b>${title}</b><span>${sub}</span></button>`;
  return `<header class="top"><div class="brand" style="font-size:22px"><img src="icons/icon-192.png" alt="" style="width:34px;height:34px">хрум</div></header>
  ${S.profile ? "" : installCard(IS_IOS)}
  ${S.profile ? "<h1>Профиль</h1>" : `<div class="card"><h2>Привет!</h2><p class="muted">Хрум считает калории от сухой массы тела — это точнее обычных калькуляторов. Заполни профиль, и я посчитаю твою норму.</p></div>`}
  <form id="setupForm" class="form" novalidate>
    <div class="field"><span>Пол</span><div class="seg" id="fSex">${seg("sex", "m", "Мужской")}${seg("sex", "f", "Женский")}</div></div>
    <div class="grid2">
      <label class="field"><span>Возраст</span><input id="fAge" class="input" inputmode="numeric" value="${p.age ?? ""}" placeholder="лет"></label>
      <label class="field"><span>Рост, см</span><input id="fHeight" class="input" inputmode="decimal" value="${p.height ?? ""}" placeholder="175"></label>
    </div>
    <div class="grid2">
      <label class="field"><span>Вес, кг</span><input id="fWeight" class="input" inputmode="decimal" value="${p.weight ?? ""}" placeholder="80"></label>
      <label class="field"><span>Жир, %</span><input id="fBf" class="input" inputmode="decimal" value="${p.bodyFat ?? ""}" placeholder="с умных весов"></label>
    </div>
    <button type="button" class="chip" data-a="toggleNavy" id="navyBtn" aria-pressed="false">Не знаю % жира — посчитать по замерам</button>
    <div id="navy" class="form" hidden>
      <p class="note">Сантиметровой лентой, утром. Шея — под кадыком. Талия — ${"на уровне пупка у мужчин, в самом узком месте у женщин"}, на выдохе. Бёдра (для женщин) — по самой широкой части.</p>
      <div class="grid2">
        <label class="field"><span>Шея, см</span><input id="fNeck" class="input" inputmode="decimal"></label>
        <label class="field"><span>Талия, см</span><input id="fWaist" class="input" inputmode="decimal"></label>
      </div>
      <label class="field" id="hipField"><span>Бёдра, см</span><input id="fHip" class="input" inputmode="decimal"></label>
    </div>
    <div class="field"><span>Активность без учёта тренировок</span>
      <div class="options" id="fAct">${ACTIVITY.map(([v, t, s]) => opt(v, t, s, p.activity)).join("")}</div></div>
    <div class="field"><span>Цель</span>
      <div class="options" id="fGoal">${Object.entries(GOALS).map(([k, [, t, s]]) => opt(k, t, s, p.goal)).join("")}</div></div>
    <p id="setupErr" class="note" style="color:var(--danger)" hidden></p>
    <button class="btn" type="submit">${S.profile ? "Сохранить" : "Посчитать норму"}</button>
    ${S.profile ? `<button type="button" class="btn ghost" data-a="tab" data-v="profile">Отмена</button>` : ""}
  </form>`;
}
function mountSetup() {
  $("#setupForm").addEventListener("submit", e => {
    e.preventDefault();
    const picked = id => { const b = $(`#${id} [aria-pressed="true"]`); return b ? b.dataset.val : null; };
    const err = m => { const el = $("#setupErr"); el.textContent = m; el.hidden = false; el.scrollIntoView({ block: "center", behavior: "smooth" }); };
    const sex = picked("fSex");
    const age = num($("#fAge").value), height = num($("#fHeight").value), weight = num($("#fWeight").value);
    let bodyFat = num($("#fBf").value);
    const act = num(picked("fAct")), goal = picked("fGoal");
    if (!sex) return err("Выбери пол.");
    if (!age || age < 10 || age > 100) return err("Возраст — от 10 до 100 лет.");
    if (!height || height < 120 || height > 230) return err("Рост — от 120 до 230 см.");
    if (!weight || weight < 30 || weight > 300) return err("Вес — от 30 до 300 кг.");
    if (!$("#navy").hidden) {
      const neck = num($("#fNeck").value), waist = num($("#fWaist").value), hip = num($("#fHip").value);
      if (!neck || !waist || (sex === "f" && !hip)) return err("Заполни замеры сантиметром.");
      if (waist <= neck) return err("Талия должна быть больше шеи — проверь замер.");
      bodyFat = navyBodyFat(sex, height, neck, waist, hip);
    }
    if (!bodyFat || bodyFat < 3 || bodyFat > 60) return err("Укажи % жира (3–60) или посчитай по замерам.");
    if (!act) return err("Выбери активность.");
    if (!goal) return err("Выбери цель.");
    const first = !S.profile;
    S.profile = { sex, age: r0(age), height, weight, bodyFat, activity: act, goal };
    S.weights[dayKey()] = { w: weight, bf: bodyFat };
    save();
    ui.view = first ? "diary" : "profile";
    render();
    toast(`Норма: ${r0(targets().kcal)} ккал в день`);
  });
  const syncHip = () => {
    const b = $('#fSex [aria-pressed="true"]');
    $("#hipField").hidden = !b || b.dataset.val !== "f";
  };
  ui.onPick = syncHip;
  syncHip();
}

/* ================= Листы ================= */

function openSheet(html) {
  if (ui.view !== "setup") ui.onPick = null;
  $("#sheetBody").innerHTML = html;
  $("#sheet").hidden = false;
  document.body.style.overflow = "hidden";
}
async function closeSheet() {
  await stopScanner();
  $("#sheet").hidden = true;
  $("#sheetBody").innerHTML = "";
  document.body.style.overflow = "";
  if (ui.view !== "setup") ui.onPick = null;
}

function addFoodSheet(meal) {
  ui.addMeal = meal;
  openSheet(`<h2>${mealName(meal)}</h2>
    <input id="fsearch" class="input" type="search" placeholder="Что съел? Например, гречка" autocomplete="off">
    <div class="btn-row">
      <button class="btn ghost" data-a="scan">Штрихкод</button>
      <button class="btn ghost" data-a="newProduct">+ Новый продукт</button>
    </div>
    <div id="flabel" class="muted small"></div>
    <div id="flist" class="list"></div>`);
  const inp = $("#fsearch");
  const draw = () => {
    $("#flabel").textContent = !inp.value && S.recent.length ? "Недавние и все продукты" : "";
    $("#flist").innerHTML = productRows(searchProducts(inp.value).slice(0, 60), "pickProduct", inp.value);
  };
  inp.addEventListener("input", draw);
  draw();
}

function gramsSheet(p, meal, entry) {
  // для записи дневника пересчитываем «на 100 г» из самой записи — продукт мог быть удалён
  const per100 = entry
    ? { id: entry.pid, name: entry.name, kcal: entry.kcal / entry.grams * 100, p: entry.p / entry.grams * 100, f: entry.f / entry.grams * 100, c: entry.c / entry.grams * 100 }
    : p;
  const g0 = entry ? entry.grams : 100;
  ui.gctx = { p: per100, entry };
  openSheet(`<div><h2>${esc(per100.name)}</h2><p class="muted small">На 100 г: ${kbju(per100)}</p></div>
    <label class="field"><span>Сколько грамм</span><input id="grams" class="input" inputmode="decimal" value="${fmt(g0, 0)}"></label>
    <div class="chips">${[30, 50, 100, 150, 200, 250, 300].map(g => `<button class="chip" data-a="setGrams" data-g="${g}">${g}</button>`).join("")}</div>
    <div class="seg" id="mealSeg">${MEALS.map(([k, t]) => `<button data-a="pick" data-val="${k}" aria-pressed="${k === meal}">${t}</button>`).join("")}</div>
    <div class="card preview" id="gprev"></div>
    <button class="btn" data-a="saveGrams">${entry ? "Сохранить" : "Добавить"}</button>
    ${entry ? `<button class="btn danger" data-a="deleteEntry">Удалить из дневника</button>` : ""}`);
  const upd = () => {
    const k = (num($("#grams").value) || 0) / 100;
    $("#gprev").innerHTML = `<span><b>${r0(per100.kcal * k)}</b> ккал</span><span>Б ${fmt(per100.p * k)}</span><span>Ж ${fmt(per100.f * k)}</span><span>У ${fmt(per100.c * k)}</span>`;
  };
  $("#grams").addEventListener("input", upd);
  upd();
}

function productFormSheet({ barcode = null, name = "", edit = null, note = "" } = {}) {
  const p = edit || { name, kcal: "", p: "", f: "", c: "" };
  ui.formCtx = { barcode: edit ? edit.barcode : barcode, edit };
  openSheet(`<h2>${edit ? "Изменить продукт" : "Новый продукт"}</h2>
    ${note ? `<p class="note">${note}</p>` : ""}
    <form id="prodForm" class="form" novalidate>
      <label class="field"><span>Название</span><input id="pName" class="input" value="${esc(p.name)}" placeholder="Творог Простоквашино 5%"></label>
      <p class="muted small">С этикетки, на 100 г:</p>
      <div class="grid4">
        <label class="field"><span>Ккал</span><input id="pK" class="input" inputmode="decimal" value="${p.kcal}"></label>
        <label class="field"><span>Белки</span><input id="pP" class="input" inputmode="decimal" value="${p.p}"></label>
        <label class="field"><span>Жиры</span><input id="pF" class="input" inputmode="decimal" value="${p.f}"></label>
        <label class="field"><span>Углев.</span><input id="pC" class="input" inputmode="decimal" value="${p.c}"></label>
      </div>
      ${ui.formCtx.barcode ? `<p class="muted small">Штрихкод ${esc(ui.formCtx.barcode)} — в следующий раз найду сразу.</p>` : ""}
      <p id="pErr" class="note" style="color:var(--danger)" hidden></p>
      <button class="btn" type="submit">Сохранить</button>
    </form>`);
  $("#prodForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#pName").value.trim();
    const [kcal, pp, ff, cc] = ["#pK", "#pP", "#pF", "#pC"].map(s => num($(s).value));
    const bad = m => { const el = $("#pErr"); el.textContent = m; el.hidden = false; };
    if (!name) return bad("Введи название.");
    if (kcal == null || kcal < 0 || kcal > 950) return bad("Калории на 100 г — от 0 до 950.");
    if ([pp, ff, cc].some(v => v == null || v < 0 || v > 100)) return bad("Белки, жиры и углеводы — от 0 до 100 г.");
    let prod;
    if (edit) {
      prod = Object.assign(edit, { name, kcal, p: pp, f: ff, c: cc });
    } else {
      prod = { id: "u" + uid(), name, kcal, p: pp, f: ff, c: cc, barcode: ui.formCtx.barcode };
      S.products.unshift(prod);
    }
    save();
    if (ui.addMeal && !edit) {
      gramsSheet(prod, ui.addMeal);
    } else {
      closeSheet();
      render();
      toast("Продукт сохранён");
    }
  });
}

function productSheet(p) {
  const mine = p.id[0] !== "b";
  openSheet(`<div><h2>${esc(p.name)}</h2><p class="muted small">На 100 г: ${kbju(p)}${p.barcode ? `<br>Штрихкод ${esc(p.barcode)}` : ""}</p></div>
    <button class="btn" data-a="productToDiary" data-id="${p.id}">Добавить в дневник</button>
    ${mine ? `<div class="btn-row"><button class="btn ghost" data-a="editProduct" data-id="${p.id}">Изменить</button>
      <button class="btn danger" data-a="deleteProduct" data-id="${p.id}">Удалить</button></div>` : `<p class="muted small">Продукт из стартовой базы.</p>`}`);
}

function workoutSheet() {
  openSheet(`<h2>Тренировка</h2>
    <div class="chips" id="wType">${WORKOUTS.map(([n], i) => `<button class="chip" data-a="pick" data-val="${i}" aria-pressed="${i === 0}">${n}</button>`).join("")}</div>
    <label class="field"><span>Сколько минут</span><input id="wMin" class="input" inputmode="numeric" value="30"></label>
    <div class="card preview" id="wPrev"></div>
    <button class="btn" data-a="saveWorkout">Добавить</button>`);
  const upd = () => {
    const [, met] = WORKOUTS[+$('#wType [aria-pressed="true"]').dataset.val];
    const kc = workoutKcal(met, S.profile.weight, num($("#wMin").value) || 0);
    $("#wPrev").innerHTML = `<span><b>+${r0(kc)}</b> ккал к лимиту дня</span><span class="muted small">по весу ${fmt(S.profile.weight)} кг и нагрузке ${fmt(met)} MET</span>`;
  };
  ui.onPick = upd;
  $("#wMin").addEventListener("input", upd);
  upd();
}

function weightSheet() {
  const p = S.profile;
  openSheet(`<h2>Вес сегодня</h2>
    <div class="grid2">
      <label class="field"><span>Вес, кг</span><input id="wW" class="input" inputmode="decimal" value="${fmt(p.weight)}"></label>
      <label class="field"><span>Жир, % (если знаешь)</span><input id="wBf" class="input" inputmode="decimal" value="${fmt(p.bodyFat)}"></label>
    </div>
    <p class="muted small">Взвешивайся утром натощак — так цифры сравнимы между собой. Норма пересчитается автоматически.</p>
    <button class="btn" data-a="saveWeight">Сохранить</button>`);
}

/* ================= Сканер штрихкода ================= */

let scanner = null;
function scannerConfig() {
  const F = window.Html5QrcodeSupportedFormats;
  return {
    formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128],
    verbose: false,
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  };
}
async function stopScanner() {
  if (!scanner) return;
  const s = scanner;
  scanner = null;
  try { if (s.isScanning) await s.stop(); } catch (e) { /* уже остановлен */ }
  try { s.clear(); } catch (e) { /* ignore */ }
}
function scanMsg(text) { const el = $("#scanMsg"); if (el) el.textContent = text; }

async function scanSheet() {
  if (!ui.addMeal) ui.addMeal = mealByTime();
  openSheet(`<h2>Штрихкод</h2>
    <div id="reader"></div>
    <p id="scanMsg" class="muted small">Наведи камеру на штрихкод товара</p>
    <div class="btn-row">
      <label class="btn ghost">Из фото<input type="file" id="scanFile" accept="image/*" hidden></label>
      <button class="btn ghost" data-a="manualCode">Ввести цифры</button>
    </div>
    <form id="codeForm" class="grid2" hidden>
      <input id="codeInput" class="input" inputmode="numeric" placeholder="4600000000000">
      <button class="btn" type="submit">Найти</button>
    </form>`);
  $("#scanFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file || !window.Html5Qrcode) return;
    await stopScanner();
    const s = new Html5Qrcode("reader", scannerConfig());
    try { onCode(await s.scanFile(file, false)); }
    catch (err) { scanMsg("На фото не нашёл штрихкод. Сфотографируй его крупнее и ровнее."); }
    try { s.clear(); } catch (err) { /* ignore */ }
  });
  $("#codeForm").addEventListener("submit", e => {
    e.preventDefault();
    const code = $("#codeInput").value.replace(/\D/g, "");
    if (code.length >= 8) onCode(code); else scanMsg("В штрихкоде 8 или 13 цифр.");
  });
  if (!window.Html5Qrcode) { scanMsg("Сканер не загрузился. Проверь интернет или введи цифры вручную."); return; }
  scanner = new Html5Qrcode("reader", scannerConfig());
  try {
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: (w, h) => ({ width: Math.floor(Math.min(w * 0.9, 320)), height: Math.floor(Math.min(h * 0.55, 150)) }) },
      code => onCode(code),
      () => {}
    );
  } catch (e) {
    scanMsg("Камера недоступна. Разреши доступ к камере в настройках браузера или выбери фото штрихкода.");
  }
}

async function onCode(code) {
  if (ui.codeBusy) return;
  ui.codeBusy = true;
  try {
    await stopScanner();
    if (navigator.vibrate) navigator.vibrate(40);
    let p = allProducts().find(x => x.barcode === code);
    if (!p) {
      scanMsg(`Штрихкод ${code}. Ищу в базе Open Food Facts…`);
      const off = await fetchOFF(code);
      if (off) {
        p = { id: "u" + uid(), ...off, barcode: code };
        S.products.unshift(p);
        save();
      }
    }
    if (p) gramsSheet(p, ui.addMeal || mealByTime());
    else productFormSheet({
      barcode: code,
      note: `Товара ${esc(code)} нет в открытой базе. Перепиши КБЖУ с этикетки один раз — дальше Хрум узнает его по штрихкоду.`,
    });
  } finally {
    ui.codeBusy = false;
  }
}

/* ================= Действия ================= */

const actions = {
  tab(el) { ui.view = el.dataset.v; if (ui.view === "diary") ui.day = ui.day || dayKey(); render(); window.scrollTo(0, 0); },
  prevDay() { ui.day = shiftDay(ui.day, -1); render(); },
  nextDay() { if (ui.day < dayKey()) { ui.day = shiftDay(ui.day, 1); render(); } },
  closeSheet() { closeSheet(); },
  pick(el) {
    el.parentElement.querySelectorAll("[data-a=pick]").forEach(b => b.setAttribute("aria-pressed", b === el));
    ui.onPick?.();
  },
  toggleNavy(el) {
    const on = el.getAttribute("aria-pressed") !== "true";
    el.setAttribute("aria-pressed", on);
    $("#navy").hidden = !on;
    $("#fBf").disabled = on;
  },
  addFood(el) { addFoodSheet(el.dataset.meal); },
  scan() {
    if ($("#sheet").hidden) ui.addMeal = ui.view === "diary" ? mealByTime() : null;
    if (!ui.addMeal) ui.addMeal = mealByTime();
    if (ui.view !== "diary") { ui.view = "diary"; render(); }
    scanSheet();
  },
  manualCode() { $("#codeForm").hidden = false; $("#codeInput").focus(); },
  newProduct(el) {
    if ($("#sheet").hidden) ui.addMeal = null;
    productFormSheet({ name: el.dataset.name || "" });
  },
  pickProduct(el) { gramsSheet(findProduct(el.dataset.id), ui.addMeal || mealByTime()); },
  openProduct(el) { productSheet(findProduct(el.dataset.id)); },
  productToDiary(el) {
    ui.addMeal = mealByTime();
    ui.view = "diary";
    ui.day = dayKey();
    render();
    gramsSheet(findProduct(el.dataset.id), ui.addMeal);
  },
  editProduct(el) { ui.addMeal = null; productFormSheet({ edit: findProduct(el.dataset.id) }); },
  deleteProduct(el) {
    S.products = S.products.filter(p => p.id !== el.dataset.id);
    S.recent = S.recent.filter(id => id !== el.dataset.id);
    save(); closeSheet(); render(); toast("Продукт удалён. Записи в дневнике остались.");
  },
  setGrams(el) { $("#grams").value = el.dataset.g; $("#grams").dispatchEvent(new Event("input")); },
  saveGrams() {
    const g = num($("#grams").value);
    if (!g || g <= 0 || g > 5000) { toast("Укажи вес в граммах"); return; }
    const meal = $('#mealSeg [aria-pressed="true"]').dataset.val;
    const { p, entry } = ui.gctx;
    const k = g / 100;
    const vals = { grams: g, meal, kcal: p.kcal * k, p: p.p * k, f: p.f * k, c: p.c * k };
    if (entry) Object.assign(entry, vals);
    else {
      (S.entries[ui.day] ||= []).push({ id: uid(), pid: p.id, name: p.name, ...vals });
      touchRecent(p.id);
    }
    save(); closeSheet(); render();
    toast(entry ? "Сохранено" : `Хрум! +${r0(vals.kcal)} ккал`);
  },
  editEntry(el) {
    const e = (S.entries[ui.day] || []).find(x => x.id === el.dataset.id);
    if (e) gramsSheet(null, e.meal, e);
  },
  deleteEntry() {
    const { entry } = ui.gctx;
    S.entries[ui.day] = (S.entries[ui.day] || []).filter(x => x !== entry);
    save(); closeSheet(); render(); toast("Удалено");
  },
  addWorkout() { workoutSheet(); },
  saveWorkout() {
    const min = num($("#wMin").value);
    if (!min || min <= 0 || min > 600) { toast("Укажи минуты"); return; }
    const [name, met] = WORKOUTS[+$('#wType [aria-pressed="true"]').dataset.val];
    (S.workouts[ui.day] ||= []).push({ id: uid(), name, minutes: min, kcal: workoutKcal(met, S.profile.weight, min) });
    save(); closeSheet(); render(); toast("Тренировка добавлена");
  },
  editWorkout(el) {
    const w = (S.workouts[ui.day] || []).find(x => x.id === el.dataset.id);
    if (!w) return;
    ui.wEdit = w;
    openSheet(`<h2>${esc(w.name)}</h2><p class="muted">${fmt(w.minutes, 0)} мин · +${r0(w.kcal)} ккал к лимиту дня</p>
      <button class="btn danger" data-a="deleteWorkout">Удалить тренировку</button>`);
  },
  deleteWorkout() {
    S.workouts[ui.day] = (S.workouts[ui.day] || []).filter(x => x !== ui.wEdit);
    save(); closeSheet(); render(); toast("Удалено");
  },
  addWeight() { weightSheet(); },
  saveWeight() {
    const w = num($("#wW").value), bf = num($("#wBf").value);
    if (!w || w < 30 || w > 300) { toast("Вес — от 30 до 300 кг"); return; }
    if (bf != null && (bf < 3 || bf > 60)) { toast("Жир — от 3 до 60%"); return; }
    S.profile.weight = w;
    if (bf != null) S.profile.bodyFat = bf;
    S.weights[dayKey()] = { w, bf: S.profile.bodyFat };
    save(); closeSheet(); render();
    toast(`Записал. Норма: ${r0(targets().kcal)} ккал`);
  },
  editProfile() { ui.view = "setup"; render(); window.scrollTo(0, 0); },
  exportData() {
    const blob = new Blob([JSON.stringify(S)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hrum-${dayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Файл копии сохранён");
  },
  confirmImport() {
    S = Object.assign(blank(), ui.pendingImport);
    ui.pendingImport = null;
    save(); closeSheet(); ui.view = S.profile ? "diary" : "setup"; render(); toast("Данные загружены");
  },
  async install() {
    if (ui.installPrompt) {
      ui.installPrompt.prompt();
      const { outcome } = await ui.installPrompt.userChoice.catch(() => ({}));
      ui.installPrompt = null;
      if (outcome === "accepted") toast("Хрум! Ищи печеньку на главном экране");
      return;
    }
    const ios = `<h3>iPhone</h3>
      <ol class="steps">
        <li>Открой эту страницу в <b>Safari</b>.</li>
        <li>Нажми «Поделиться» — квадрат со стрелкой вверх внизу экрана.</li>
        <li>Пролистай вниз и выбери <b>«На экран „Домой“»</b>, затем «Добавить».</li>
        <li>Открой Хрум с новой иконки-печеньки и заполни профиль там.</li>
      </ol>`;
    const android = `<h3>Android</h3>
      <ol class="steps">
        <li>В Chrome нажми меню <b>⋮</b> справа сверху.</li>
        <li>Выбери <b>«Установить приложение»</b> или «Добавить на главный экран» → «Установить».</li>
        <li>Если есть только <b>«Добавить ярлык»</b> — тоже подойдёт, просто сверху останется строка браузера.</li>
      </ol>`;
    openSheet(`<h2>Хрум на главный экран</h2>
      ${IS_ANDROID ? android + ios : ios + android}
      <p class="muted small">Данные и так хранятся на телефоне — установка просто делает Хрум похожим на обычное приложение.</p>
      <button class="btn ghost" data-a="closeSheet">Понятно</button>`);
  },
  hideInstall() {
    try { localStorage.setItem(HIDE_INSTALL_KEY, String(Date.now())); } catch (e) { /* ignore */ }
    render();
  },
  author(el) {
    const name = $("#authorName");
    name.hidden = !name.hidden;
    el.setAttribute("aria-expanded", !name.hidden);
  },
};

document.addEventListener("click", e => {
  const el = e.target.closest("[data-a]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

/* ================= Отрисовка ================= */

const VIEWS = {
  diary: [viewDiary],
  products: [viewProducts, mountProducts],
  progress: [viewProgress],
  profile: [viewProfile, mountProfile],
  setup: [viewSetup, mountSetup],
};

function render() {
  ui.today = dayKey();
  if (!S.profile) ui.view = "setup";
  if (ui.view !== "setup") ui.onPick = null;
  const [view, mount] = VIEWS[ui.view];
  const root = $("#view");
  root.className = "app" + (ui.view === "setup" ? " plain" : "");
  root.innerHTML = view() + footer();
  $("#tabs").hidden = ui.view === "setup";
  renderTabs();
  mount?.();
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  ui.installPrompt = e;
  if ($("#sheet").hidden && (ui.view === "diary" || ui.view === "setup")) render();
});
window.addEventListener("appinstalled", () => { ui.installPrompt = null; toast("Хрум установлен!"); });
// Смена даты, пока приложение открыто в фоне
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  // если был открыт «сегодня», а наступил новый день — переключаемся на новый
  if (ui.day === ui.today && dayKey() !== ui.today) ui.day = dayKey();
  if (ui.view === "diary" && $("#sheet").hidden) render();
});
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
