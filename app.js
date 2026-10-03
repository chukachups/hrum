"use strict";

/* ================= Константы ================= */

const STORE_KEY = "hrum-v1";
const PLAN_DAYS = 7; // на сколько дней вперёд можно планировать еду
const MEALS = [["breakfast", "Завтрак"], ["lunch", "Обед"], ["dinner", "Ужин"], ["snack", "Перекусы"]];
// Бытовая активность БЕЗ тренировок — тренировки добавляются отдельно
const ACTIVITY = [
  [1.2, "Сидячая работа", "Мало хожу, в основном за столом"],
  [1.3, "Сидячая, но много хожу", "8–10 тысяч шагов в день"],
  [1.45, "Работа на ногах", "Физический труд, весь день в движении"],
];
const GOALS = {
  cut: [-0.15, "Похудение", "Дефицит 15% — примерно 0,2–0,4 кг жира в неделю"],
  keep: [0, "Поддержание", "Держать текущий вес"],
  bulk: [0.10, "Набор", "Профицит 10% — рост мышц"],
};
// Метаболический эквивалент (MET)
const WORKOUTS = [
  ["Ходьба", 3.5], ["Быстрая ходьба", 4.5], ["Бег", 9.8], ["Велосипед", 7.5], ["Силовая", 5],
  ["Плавание", 6], ["Йога", 2.5], ["Футбол", 7], ["Лыжи", 9], ["Танцы", 5], ["Единоборства", 10], ["HIIT", 8],
];
// Доли дня по приёмам — тот же совет, что для семьи (25/35/30/10 %)
const MEAL_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
// Гарниры для подсказки (вес в готовом виде) и чем каждый хорош
const GARNISHES = {
  breakfast: [["b11", "к яйцам и сыру — медленные углеводы"], ["b68", "сытно и мягко для утра"], ["b1", "много клетчатки"], ["b49", "быстро и без готовки"]],
  main: [["b1", "много клетчатки, сытно"], ["b61", "медленные углеводы, почти без жира"], ["b62", "добавит белка"],
    ["b3", "мягкий, почти без жира"], ["b63", "цельнозерновой, сытнее белого"], ["b9", "сытно и мало калорий"],
    ["b7", "если нужно больше энергии"], ["b64", "белок и клетчатка"], ["b65", "растительный белок"], ["b66", "белок и клетчатка, сытно"]],
};
const LEGUMES = ["b62", "b65", "b66"]; // в подсказке не больше одного — иначе тройка из одной фасоли
const WHOLE = ["b1", "b61", "b63", "b64", "b62", "b65", "b66", "b11", "b68"]; // цельные: клетчатка — небольшой бонус
const VEGGIES = ["b47", "b67"];
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
  if (k === shiftDay(t, 1)) return "Завтра";
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
  const tdee = bmr * pr.activity * (pr.adjust || 1);        // adjust — поправка по реальной динамике веса
  const kcal = tdee * (1 + GOALS[pr.goal][0]);
  const p = (pr.goal === "cut" ? 2.2 : 2.0) * lbm;
  // жиры — 30 % калорий, но не меньше 0,8 г на кг сухой массы; раньше было 0,9 г на кг всего веса,
  // и при большом весе жиры съедали до половины нормы, а углеводов почти не оставалось
  const f = Math.max(0.3 * kcal / 9, 0.8 * lbm);
  const c = Math.max(0, (kcal - p * 4 - f * 9) / 4);
  return { lbm, bmr, tdee, kcal, p, f, c };
}

// Ожидаемый темп по плану: кг жира в неделю (минус — похудение)
const planKgWeek = t => (t.kcal - t.tdee) * 7 / 7700;

// Автоподстройка нормы: за последние 3 недели (без сегодня) сравниваем записанную еду
// с реальной динамикой веса. Еда − (расход + тренировки) = изменение веса × 7700 ккал
// ⇒ реальный бытовой расход = еда − тренировки − наклон веса × 7700.
// Заодно учитывается то, что записывается не всё или % жира с весов неточный.
function adjustCalc() {
  const pr = S.profile;
  const end = shiftDay(dayKey(), -1);
  const days = Array.from({ length: 21 }, (_, i) => shiftDay(end, i - 20));
  const formula = targets({ ...pr, adjust: 1 }).tdee;
  const full = days.map(dayData).filter(d => d.es.length && d.eaten.kcal >= d.limit * 0.5);
  const ws = days.filter(k => S.weights[k]).map(k => [(parseDay(k) - parseDay(days[0])) / 864e5, S.weights[k].w]);
  const span = ws.length ? ws[ws.length - 1][0] - ws[0][0] : 0;
  const need = [];
  if (full.length < 14) need.push(`ещё ${14 - full.length} ${plural(14 - full.length, ["день", "дня", "дней"])} с полностью записанной едой`);
  if (ws.length < 4 || span < 14) need.push(ws.length < 4
    ? `ещё ${4 - ws.length} ${plural(4 - ws.length, ["взвешивание", "взвешивания", "взвешиваний"])} (раз в 4–5 дней)`
    : "взвешивания на протяжении хотя бы двух недель");
  if (need.length) return { ready: false, need, days: full.length, weighs: ws.length };
  const mx = ws.reduce((a, [x]) => a + x, 0) / ws.length, my = ws.reduce((a, [, y]) => a + y, 0) / ws.length;
  const slope = ws.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) / ws.reduce((a, [x]) => a + (x - mx) ** 2, 0);
  const intake = full.reduce((a, d) => a + d.eaten.kcal, 0) / full.length;
  const burned = full.reduce((a, d) => a + d.burned, 0) / full.length;
  const real = intake - burned - slope * 7700;
  const factor = Math.min(1.2, Math.max(0.8, Math.round(real / formula * 100) / 100));
  const cur = pr.adjust || 1;
  const newKcal = targets({ ...pr, adjust: factor }).kcal;
  return { ready: true, intake, burned, slope, real, formula, factor, newKcal,
    suggest: Math.abs(factor - cur) >= 0.05, days: full.length, weighs: ws.length };
}
function adjustCard(a) {
  const t = targets();
  if (!a.ready) {
    return `<p class="small"><b>Хрум уточнит норму по твоему весу.</b> Формула — хорошая оценка, но % жира с весов бывает неточным,
      и не всё съеденное попадает в дневник. Для проверки нужно: ${a.need.join(" и ")}.</p>
      <p class="muted small">Сейчас: ${a.days} из 14 дней с едой, ${a.weighs} ${plural(a.weighs, ["взвешивание", "взвешивания", "взвешиваний"])} за 3 недели.</p>`;
  }
  const wk = a.slope * 7;
  const fact = `За 3 недели ты в среднем ел${S.profile.sex === "f" ? "а" : ""} <b>${r0(a.intake)} ккал</b>, а вес ${Math.abs(wk) < 0.05 ? "<b>почти не менялся</b>" : `${wk < 0 ? "уходил" : "прибавлялся"} на <b>${fmt(Math.abs(wk), 2)} кг в неделю</b>`}.
    Значит, реальный расход — около <b>${r0(a.real)} ккал</b>, формула считала ${r0(a.formula)}.`;
  if (!a.suggest) return `<p class="small">${fact}</p><p class="small">Норма совпадает с реальностью — менять ничего не нужно.</p>`;
  return `<p class="small">${fact}</p>
    <p class="small">Предлагаю поправить норму: <b>${r0(t.kcal)} → ${r0(a.newKcal)} ккал</b> в день.</p>
    <button class="btn" data-a="applyAdjust" data-f="${a.factor}">Поправить норму</button>
    <p class="muted small">Через пару недель Хрум проверит ещё раз. Поправку можно сбросить в Профиле.</p>`;
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
  // тренировки лимит не увеличивают — идут бонусом к дефициту
  return { es, ws, eaten, burned, t, limit: t.kcal };
}

const KEYS = ["kcal", "p", "f", "c"];
function mealSum(d, meal) {
  const m = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const e of d.es) if (e.meal === meal) for (const k of KEYS) m[k] += e[k];
  return m;
}
// Сколько уложить в приём: остаток дня за вычетом других приёмов,
// поделённый между этим и следующими пустыми приёмами по их долям
function mealTarget(d, meal) {
  const order = MEALS.map(m => m[0]);
  const i = order.indexOf(meal);
  const open = order.filter((k, j) => k === meal || (j > i && !d.es.some(e => e.meal === k)));
  const share = MEAL_SHARE[meal] / open.reduce((s, k) => s + MEAL_SHARE[k], 0);
  const goal = { kcal: d.limit, p: d.t.p, f: d.t.f, c: d.t.c };
  const other = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const e of d.es) if (e.meal !== meal) for (const k of KEYS) other[k] += e[k];
  const T = {};
  for (const k of KEYS) T[k] = Math.max(0, goal[k] - other[k]) * share;
  return T;
}
// Подсказка нужна, если основа приёма белковая, а гарнира нет. Гарнир — продукты от 10 г углеводов на 100 г
// (крупы, хлеб, картофель, макароны, фрукты); овощи и салат не считаются. Сравниваем ДОЛИ калорий, а не граммы:
// одинаковая еда разным объёмом (присланная и пересчитанная под другую норму) даёт одинаковый совет
function needsGarnish(d, meal) {
  if (meal === "snack") return false;
  const m = mealSum(d, meal), T = mealTarget(d, meal);
  if (m.kcal < 80 || T.c < 20) return false;
  const starch = d.es.filter(e => e.meal === meal && e.grams > 0 && e.c / e.grams * 100 >= 10).reduce((s, e) => s + e.c, 0);
  return m.p * 4 / m.kcal >= 0.2 && starch * 4 / m.kcal < 0.15;
}
// Вес гарнира — чтобы добрать углеводы приёма, не выходя за его калории;
// лучшие — те, после которых углеводы (главное) и белки приёма ближе всего к нужным
function garnishOptions(d, meal) {
  const T = mealTarget(d, meal), m = mealSum(d, meal);
  const opts = [];
  for (const [id, why] of GARNISHES[meal === "breakfast" ? "breakfast" : "main"]) {
    const p = findProduct(id);
    if (!p) continue;
    let g = Math.min((T.c - m.c) / p.c * 100, (T.kcal - m.kcal) / p.kcal * 100);
    g = Math.min(meal === "breakfast" ? 200 : 250, Math.round(g / 10) * 10);
    if (g < 40) continue;
    const v = {};
    for (const k of KEYS) v[k] = m[k] + p[k] * g / 100;
    const score = [["c", 1], ["p", 0.3]].reduce((s, [k, wt]) => s + (T[k] ? wt * ((v[k] - T[k]) / T[k]) ** 2 : 0), 0);
    opts.push({ p, g, why, v, score: score * (WHOLE.includes(id) ? 0.6 : 1) });
  }
  opts.sort((a, b) => a.score - b.score);
  const legume = opts.find(o => LEGUMES.includes(o.p.id));
  return { T, m, opts: opts.filter(o => !LEGUMES.includes(o.p.id) || o === legume).slice(0, 3) };
}

/* ================= Продукты ================= */

const norm = s => String(s).toLowerCase().replace(/ё/g, "е").trim();
const stem = w => (w.length > 4 ? w.slice(0, Math.max(3, w.length - 2)) : w);
// товары Перекрёстка (perekrestok.js) и меню Додо (dodo.js)
const STORE = [...(typeof STORE_PRODUCTS !== "undefined" ? STORE_PRODUCTS : []), ...(typeof DODO_PRODUCTS !== "undefined" ? DODO_PRODUCTS : []),
  ...(typeof ALCOHOL_PRODUCTS !== "undefined" ? ALCOHOL_PRODUCTS : [])]; // алкоголь — расчёт по крепости (alcohol.js)
const allProducts = () => [...S.products, ...BASE_PRODUCTS, ...STORE];
const findProduct = id => allProducts().find(p => p.id === id);
// Рецепт: сумма ингредиентов (сырой вес), делённая на вес готового блюда
function recipeCalc(r) {
  const total = { kcal: 0, p: 0, f: 0, c: 0 };
  let raw = 0;
  for (const it of r.items) {
    raw += it.grams;
    for (const k in total) total[k] += it[k] * it.grams / 100;
  }
  const weight = r.cooked || raw;
  const per100 = {};
  for (const k in total) per100[k] = weight ? Math.round(total[k] / weight * 1000) / 10 : 0;
  return { total, raw, weight, per100 };
}
const recipeWeight = r => recipeCalc(r).weight;

function recipeLink(p) {
  const data = { n: p.name, c: p.recipe.cooked || 0, s: p.recipe.portions || 0,
    i: p.recipe.items.map(x => [x.name, x.grams, x.kcal, x.p, x.f, x.c]) };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return location.origin + location.pathname + "#recipe=" + b64;
}
// Общие упаковщики данных для ссылок (#norm=…)
function packLink(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unpackLink(str) {
  let b = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return JSON.parse(decodeURIComponent(escape(atob(b))));
}
function normLink() {
  return location.origin + location.pathname + "#norm=" + packLink({ w: S.profile.weight, k: r0(targets().kcal), d: dayKey() });
}
function parseNormHash() {
  const m = location.hash.match(/^#norm=([\w-]+)$/);
  if (!m) return null;
  try {
    const d = unpackLink(m[1]);
    const w = +d.w, k = +d.k;
    if (!(k >= 800 && k <= 6000) || !(w >= 30 && w <= 300)) return null;
    return { weight: w, kcal: k, date: /^\d{4}-\d\d-\d\d$/.test(d.d) ? d.d : dayKey() };
  } catch (e) {
    return null;
  }
}
// «Поделиться едой»: приём или весь день; у получателя граммы пересчитываются под его норму
function foodLink(meal) {
  const r1 = x => Math.round(x * 10) / 10;
  const es = (S.entries[ui.day] || []).filter(e => !meal || e.meal === meal);
  return location.origin + location.pathname + "#food=" + packLink({
    k: r0(targets().kcal), m: meal || "",
    i: es.map(e => [e.meal, e.name, r0(e.grams), ...KEYS.map(k => r1(e[k] / e.grams * 100))]),
  });
}
function parseFoodHash() {
  const m = location.hash.match(/^#food=([\w-]+)$/);
  if (!m) return null;
  try {
    const d = unpackLink(m[1]);
    const meals = MEALS.map(x => x[0]);
    const items = d.i.map(([meal, name, grams, kcal, pp, f, c]) => ({
      meal: meals.includes(meal) ? meal : "snack", name: String(name).slice(0, 120), grams: +grams, kcal: +kcal, p: +pp, f: +f, c: +c }));
    if (!items.length || items.length > 80 || items.some(x => !(x.grams > 0) || ![x.kcal, x.p, x.f, x.c].every(Number.isFinite))) return null;
    const k = +d.k;
    return { kcal: k >= 800 && k <= 6000 ? k : null, meal: meals.includes(d.m) ? d.m : null, items };
  } catch (e) {
    return null;
  }
}
const shortDate = k => { const d = parseDay(k); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

function parseRecipeHash() {
  const m = location.hash.match(/^#recipe=([\w-]+)$/);
  if (!m) return null;
  try {
    let b = m[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const d = JSON.parse(decodeURIComponent(escape(atob(b))));
    const items = d.i.map(([name, grams, kcal, pp, f, c]) => ({ name: String(name).slice(0, 120), grams: +grams, kcal: +kcal, p: +pp, f: +f, c: +c }));
    if (!items.length || items.some(x => !(x.grams > 0) || ![x.kcal, x.p, x.f, x.c].every(Number.isFinite))) return null;
    return { name: String(d.n || "Рецепт").slice(0, 120), recipe: { items, cooked: +d.c || null, portions: +d.s || null } };
  } catch (e) {
    return null;
  }
}

// «2 шт · » — если вес записи ровно кратен весу штуки продукта
function pieces(e) {
  const p = e.pid && findProduct(e.pid);
  const opt = p && p.opts && p.opts.find(([, g]) => g === e.grams);
  if (opt) return `${opt[0]} · `;
  if (!p || !p.pc) return "";
  const k = e.grams / p.pc;
  return Number.isInteger(k) && k <= 20 ? `${k} ${p.pcName || "шт"} · ` : "";
}
const kbju = p => `${r0(p.kcal)} ккал · Б ${fmt(p.p)} · Ж ${fmt(p.f)} · У ${fmt(p.c)}`;

function searchProducts(q) {
  const all = allProducts();
  const nq = norm(q);
  if (!nq) {
    const rec = S.recent.map(findProduct).filter(Boolean);
    return [...rec, ...all.filter(p => !S.recent.includes(p.id))];
  }
  const full = nq.match(/[\p{L}\p{N}]+/gu) || [];
  const words = full.map(stem);
  const hits = all.filter(p => { const n = norm(p.name); return words.every(w => n.includes(w)); });
  // выше — где слова запроса целиком («сырок» раньше «сыра»), потом — начинается с запроса, потом недавние
  const rank = p => {
    const n = norm(p.name);
    // слово с начала («сухое», а не внутри «полусухое») — выше
    const atStart = full.every(w => new RegExp("(^|[^a-zа-я0-9])" + w).test(n));
    return (atStart ? 0 : full.every(w => n.includes(w)) ? 4 : 8) + (n.startsWith(words[0]) ? 0 : 2) + (S.recent.includes(p.id) ? 0 : 1);
  };
  return hits.sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length);
}

function touchRecent(id) {
  S.recent = [id, ...S.recent.filter(x => x !== id)].slice(0, 30);
}

// → { product } | { missing: true, name? } (нет товара или нет КБЖУ) | { error: true } (сеть)
async function fetchOFF(code) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_ru,brands,nutriments`,
      { signal: ctrl.signal }
    );
    if (r.status === 404) return { missing: true };
    if (!r.ok) return { error: true };
    const d = await r.json();
    const pr = d.product;
    if (!pr) return { missing: true };
    let name = pr.product_name_ru || pr.product_name || "";
    const brand = (pr.brands || "").split(",")[0].trim();
    if (name && brand && !norm(name).includes(norm(brand))) name += ` (${brand})`;
    const n = pr.nutriments || {};
    let kcal = n["energy-kcal_100g"];
    if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
    if (kcal == null) return { missing: true, name };
    const v = x => Math.round((+x || 0) * 10) / 10;
    return { product: { name: name || `Товар ${code}`, kcal: v(kcal), p: v(n.proteins_100g), f: v(n.fat_100g), c: v(n.carbohydrates_100g) } };
  } catch (e) {
    return { error: true };
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
  share: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
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
  const isLast = ui.day >= shiftDay(dayKey(), PLAN_DAYS);

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
          <span class="g">${pieces(e)}${fmt(e.grams, 0)} г</span><span class="m">Б ${r0(e.p)} · Ж ${r0(e.f)} · У ${r0(e.c)}</span></button>`).join("")
      : `<div class="empty">Пусто</div>`;
    const hint = items.length && needsGarnish(d, key)
      ? `<button class="garnish-hint" data-a="garnish" data-meal="${key}">${key === "breakfast" ? "Мало углеводов? Подобрать к завтраку" : "Нет гарнира? Подобрать под норму дня"}</button>` : "";
    return `<article class="meal">
      <div class="meal-head"><h3>${title}</h3><span class="kc">${kc ? r0(kc) + " ккал" : ""}</span>
        ${items.length ? `<button class="add share" data-a="shareMeal" data-meal="${key}" aria-label="Поделиться: ${title}">${icon("share", 16)}</button>` : ""}
        <button class="add" data-a="addFood" data-meal="${key}" aria-label="Добавить: ${title}">+</button></div>${body}${hint}</article>`;
  }).join("");

  const workouts = d.ws.map(w => `<button class="row-card" data-a="editWorkout" data-id="${w.id}">
      <span class="badge">${icon("run", 20)}</span>
      <span class="t"><b>${esc(w.name)}</b><span>${fmt(w.minutes, 0)} мин${w.manual ? " · по часам" : ""}</span></span>
      <span class="p">−${r0(w.kcal)}</span></button>`).join("");

  return `
  <header class="top">
    <div class="day">
      <button class="icon-btn" data-a="prevDay" aria-label="Предыдущий день">‹</button>
      <div data-a="toToday"><h1>${dayTitle(ui.day)}</h1><small>${isToday ? daySub(ui.day) : daySub(ui.day) + " · к сегодня ↩"}</small></div>
      <button class="icon-btn" data-a="nextDay" aria-label="Следующий день" ${isLast ? "disabled" : ""}>›</button>
    </div>
    <div class="brand"><img src="icons/icon-192.png" alt="">хрум</div>
  </header>
  ${installCard()}
  ${isToday ? adjustNote() : ""}

  <section class="card hero" aria-label="Итог дня">
    ${S.skin === "cookie" ? cookieBlock(d) : `
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
        <div class="kv"><span>Съедено</span><b>${r0(eaten.kcal)}</b></div>
        <hr>
        <div class="kv"><span>Спорт</span><b class="plus">${burned ? "−" + r0(burned) : "0"}</b></div>
      </div>
    </div>
    `}
    <div class="macros">
      ${macro("Белки", eaten.p, t.p, "--protein")}
      ${macro("Жиры", eaten.f, t.f, "--fat")}
      ${macro("Углеводы", eaten.c, t.c, "--carbs")}
    </div>
    ${burned ? `<p class="sport-bonus">Тренировки сегодня: <b>−${r0(burned)} ккал</b> ≈ ${r0(burned / 7.7)} г жира сверх плана</p>` : ""}
    <div class="basis">
      <span>Сухая масса <b>${fmt(t.lbm)} кг</b></span>
      <span>Жир <b>${fmt(S.profile.bodyFat)}%</b></span>
      <span>Цель <b>${GOALS[S.profile.goal][1].toLowerCase()}</b></span>
    </div>
  </section>

  <div class="section-title"><h2>Приёмы пищи</h2><span>${d.es.length ? d.es.length + " " + plural(d.es.length, ["запись", "записи", "записей"]) : "нажми +, чтобы добавить"}</span></div>
  ${meals}
  ${d.es.length ? `<button class="row-card dashed" data-a="shareDay">${icon("share", 18)} Отправить меню дня</button>` : ""}

  <div class="section-title"><h2>Активность</h2><span>${burned ? "−" + r0(burned) + " ккал, в лимит не входят" : "ускоряет похудение"}</span></div>
  ${workouts}
  <button class="row-card dashed" data-a="addWorkout">+ Добавить тренировку</button>

  <div class="section-title"><h2>Вес</h2><span>последние записи</span></div>
  ${weightCard()}`;
}

function adjustNote() {
  if (S.adjustHide && shiftDay(S.adjustHide, 7) > dayKey()) return "";
  const a = adjustCalc();
  if (!a.ready || !a.suggest) return "";
  return `<div class="card note-card"><b>Хрум может уточнить норму по твоему весу</b>
    <span class="muted small">${r0(targets().kcal)} → ${r0(a.newKcal)} ккал — по 3 неделям записей и взвешиваний</span>
    <div class="btn-row"><button class="btn ghost" data-a="tab" data-v="progress">Посмотреть</button><button class="btn ghost" data-a="hideAdjust">Позже</button></div></div>`;
}

/* Печенька: целая = лимит дня, 12 укусов */
function cookieSvg(bites) {
  const done = bites >= 12;
  let holes = "", crumbs = "";
  for (let i = 0; i < Math.min(bites, 12); i++) {
    const a = (-90 + 15 + i * 30) * Math.PI / 180;
    holes += `<circle cx="${(80 + 74 * Math.cos(a)).toFixed(1)}" cy="${(80 + 74 * Math.sin(a)).toFixed(1)}" r="21" fill="#000"/>`;
    if (i % 2 === 0) {
      const r = 94 + (i % 4) * 2;
      crumbs += `<circle cx="${(80 + r * Math.cos(a + .2)).toFixed(1)}" cy="${(80 + r * Math.sin(a + .2)).toFixed(1)}" r="${2 + (i % 3)}" fill="#D9A15A"/>`;
    }
  }
  if (done) {
    crumbs = [[62, 118, 5], [80, 124, 7], [98, 119, 5], [72, 110, 3], [90, 111, 4], [54, 126, 3], [106, 127, 3]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#D9A15A"/>`).join("");
  }
  const chips = [[52, 58], [96, 46], [70, 92], [108, 96], [44, 104], [86, 124], [120, 70], [62, 36]]
    .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${6 + i % 3}" ry="${5 + i % 2}" fill="#6B3F22" transform="rotate(${i * 23} ${x} ${y})"/>`).join("");
  return `<svg viewBox="-20 -20 200 200" aria-hidden="true">
    <defs><mask id="cbite"><rect x="-20" y="-20" width="200" height="200" fill="#fff"/>${holes}</mask></defs>
    ${done ? "" : `<g mask="url(#cbite)"><circle cx="80" cy="80" r="72" fill="#E7B46C"/>
      <circle cx="80" cy="80" r="72" fill="none" stroke="#C98B45" stroke-width="5"/>${chips}</g>`}${crumbs}</svg>`;
}

function cookieBlock(d) {
  const { t, eaten, burned, limit } = d;
  const left = limit - eaten.kcal, over = left < 0;
  const bites = over ? 12 : Math.min(12, Math.round(eaten.kcal / limit * 12));
  const bite = r0(limit / 12);
  const cap = over || bites >= 12 ? "Печенька на сегодня съедена — остались крошки"
    : bites === 0 ? `Целая печенька — это лимит дня. 1 укус ≈ ${bite} ккал`
    : `Откушено ${bites} ${plural(bites, ["укус", "укуса", "укусов"])} из 12 · 1 укус ≈ ${bite} ккал`;
  return `<div class="ring-row">
      <div class="cookie" role="img" aria-label="${cap}">${cookieSvg(bites)}</div>
      <div class="balance">
        <div><div class="big ${over ? "over" : ""}">${r0(Math.abs(left))}</div><div class="cap">${over ? "ккал сверх лимита" : "ккал ещё можно съесть"}</div></div>
        <div class="kv"><span>Норма</span><b>${r0(t.kcal)}</b></div>
        <div class="kv"><span>Откушено</span><b>${r0(eaten.kcal)}</b></div>
        <div class="kv"><span>Спорт</span><b class="plus">${burned ? "−" + r0(burned) : "0"}</b></div>
      </div>
    </div>
    <p class="cookie-cap">${cap}</p>
`;
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
      <button class="btn ghost" data-a="newProduct">+ Продукт</button>
      <button class="btn ghost" data-a="newRecipe">+ Рецепт</button>
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
      <span class="n">${esc(p.name)}${p.id[0] !== "b" && !p.id.startsWith("dd") && !p.id.startsWith("al") ? `<span class="tag">${p.recipe ? "рецепт" : p.id.startsWith("pk") ? "Перекрёсток" : p.barcode ? "штрихкод" : "мой"}</span>` : ""}</span>
      <span class="k">${r0(p.kcal)} ккал</span>
      <span class="m">на 100 г · Б ${fmt(p.p)} · Ж ${fmt(p.f)} · У ${fmt(p.c)}</span></button>`).join("");
}

/* ================= Экран: прогресс ================= */

function viewProgress() {
  const t = targets();
  const days = Array.from({ length: 14 }, (_, i) => shiftDay(dayKey(), i - 13));
  const data = days.map(k => { const d = dayData(k); return { k, eaten: d.eaten.kcal, limit: d.limit, burned: d.burned, has: d.es.length > 0 }; });

  // сегодняшний день ещё не закончен — в среднее не берём
  const last7 = data.slice(-8, -1).filter(x => x.has);
  let stats = `<p class="muted small">Записывай еду несколько дней — со следующего дня здесь появится средний дефицит и прогноз.</p>`;
  if (last7.length) {
    const avg = last7.reduce((s, x) => s + x.eaten, 0) / last7.length;
    const bal = last7.reduce((s, x) => s + (x.limit - x.eaten + x.burned), 0) / last7.length;
    const sport = last7.reduce((s, x) => s + x.burned, 0) / last7.length;
    const kgWeek = bal * 7 / 7700;
    stats = `<div class="stats">
      <div class="stat"><b>${r0(avg)}</b><span>ккал в день, в среднем</span></div>
      <div class="stat"><b>${bal >= 0 ? "−" : "+"}${r0(Math.abs(bal))}</b><span>${bal >= 0 ? "дефицит" : "профицит"} в день</span></div>
      <div class="stat"><b>${kgWeek >= 0 ? "−" : "+"}${fmt(Math.abs(kgWeek))}</b><span>кг в неделю при таком темпе</span></div>
    </div><p class="muted small">По ${last7.length} ${plural(last7.length, ["полному дню", "полным дням", "полным дням"])} с записями за неделю, без сегодняшнего. 1 кг жира ≈ 7700 ккал.${sport ? ` Из дефицита тренировки дают ${r0(sport)} ккал в день.` : ""}</p>`;
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
    <div class="section-title"><h2>Точность нормы</h2><span>${S.profile.adjust && S.profile.adjust !== 1 ? `поправка ${S.profile.adjust > 1 ? "+" : "−"}${r0(Math.abs(S.profile.adjust - 1) * 100)}%` : "по динамике веса"}</span></div>
    <section class="card adjust">${adjustCard(adjustCalc())}</section>
    <div class="section-title"><h2>Калории за 14 дней</h2><span>пунктир — норма</span></div>
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
      <div class="kv"><span>${esc(act[1])} (×${act[0]})${p.adjust && p.adjust !== 1 ? ", с поправкой" : ""}</span><b>${r0(t.tdee)} ккал</b></div>
      <div class="kv"><span>Цель: ${GOALS[p.goal][1].toLowerCase()}</span><b>${r0(t.kcal)} ккал</b></div>
      <div class="kv"><span>Белки · Жиры · Углеводы</span><b>${r0(t.p)} · ${r0(t.f)} · ${r0(t.c)} г</b></div>
      ${p.goal !== "keep" ? `<div class="kv"><span>Темп по плану</span><b>${planKgWeek(t) < 0 ? "−" : "+"}${fmt(Math.abs(planKgWeek(t)), 2)} кг ${p.goal === "cut" ? "жира " : ""}в неделю</b></div>` : ""}
      ${p.adjust && p.adjust !== 1 ? `<div class="kv"><span>Поправка по весу</span><b>${p.adjust > 1 ? "+" : "−"}${r0(Math.abs(p.adjust - 1) * 100)}% <button class="link" data-a="resetAdjust">сбросить</button></b></div>` : ""}
    </section>
    <details class="card">
      <summary><b>Как считается норма</b></summary>
      <p class="small">Сухая масса = вес × (1 − % жира). Базовый обмен по формуле Кетча-МакАрдла: 370 + 21,6 × сухая масса.
      Он точнее обычных формул, потому что жир почти не тратит энергию, а мышцы тратят.</p>
      <p class="small">Базовый обмен умножается на бытовую активность без тренировок, затем корректируется под цель.
      Тренировки лимит не увеличивают: сожжённое на них идёт сверх дефицита и ускоряет похудение.</p>
      <p class="small">Белок: ${p.goal === "cut" ? "2,2" : "2,0"} г на кг сухой массы. Жиры: 30% калорий, но не меньше 0,8 г на кг сухой массы. Углеводы — остаток калорий.</p>
      <p class="small">В первые недели весы обычно показывают больше — уходит вода. Через 3 недели записей Хрум сравнит план с реальным весом
      и предложит поправить норму (экран «Прогресс»).</p>
    </details>
    <button class="btn" data-a="addWeight">Записать вес</button>
    <button class="btn ghost" data-a="editProfile">Изменить профиль</button>
    <div class="section-title"><h2>Второй человек</h2><span>для общих блюд</span></div>
    <button class="row-card" data-a="editPartner">
      <span class="t"><b>${S.partner ? esc(S.partner.name) : "Не указан"}</b>
      <span>${S.partner ? `норма ${r0(S.partner.kcal)} ккал${S.partner.weight ? ` · вес ${fmt(S.partner.weight)} кг` : ""}${S.partner.date ? ` · от ${shortDate(S.partner.date)}` : ""}` : "укажи норму — Хрум будет делить блюда пропорционально"}</span></span>
      <span class="p">›</span></button>
    <button class="btn ghost" data-a="shareNorm">Отправить мою норму</button>
    <button class="btn ghost" data-a="pasteLink">Вставить ссылку</button>
    <div class="section-title"><h2>Оформление</h2></div>
    <div class="seg">
      <button data-a="setSkin" data-v="green" aria-pressed="${S.skin !== "cookie"}">Зелёный</button>
      <button data-a="setSkin" data-v="cookie" aria-pressed="${S.skin === "cookie"}">Печенька</button>
    </div>
    <div class="section-title"><h2>Данные</h2></div>
    <p class="note">Всё хранится только на этом телефоне. Раз в пару недель сохраняй копию — пригодится при смене телефона.</p>
    <div class="btn-row">
      <button class="btn ghost" data-a="exportData">Сохранить копию</button>
      <label class="btn ghost">Загрузить копию<input type="file" id="importFile" accept="application/json,.json" hidden></label>
    </div>
    <button class="btn ghost" data-a="install">Установить на главный экран</button>
    <button class="btn danger" data-a="askReset">Стереть все данные</button>
    <p class="muted small" id="appVer" style="text-align:center"></p>`;
}
function mountProfile() {
  // номер версии — чтобы видеть, дошло ли обновление (это имя кэша из sw.js)
  if (window.caches) caches.keys().then(k => {
    const v = k.filter(x => x.startsWith("hrum-")).map(x => +x.slice(5)).sort((a, b) => b - a)[0];
    if (v && $("#appVer")) $("#appVer").textContent = `Версия ${v}`;
  }).catch(() => {});
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

const SHARE_HASH = /#(recipe|norm|food)=[\w-]+/;
// Ссылка открылась там, где Хрум ещё не заполнен (на iPhone — Safari, а Хрум живёт на иконке)
function linkCard() {
  const m = location.hash.match(SHARE_HASH);
  if (S.profile || !m) return "";
  const what = { recipe: "рецепт", norm: "норму", food: "еду" }[m[1]];
  return `<div class="card link-card"><h2>Тебе прислали ${what}</h2>
    <p class="muted small">Если Хрум уже стоит у тебя на главном экране, ссылка открылась не там: у иконки своя память.
    Скопируй ссылку, открой Хрум с иконки и нажми в Профиле «Вставить ссылку».</p>
    <button class="btn" data-a="copyLink">Скопировать ссылку</button>
    <p class="muted small">Хрума на главном экране ещё нет? Заполни профиль ниже — и ${what === "норму" ? "норма" : what === "рецепт" ? "рецепт" : "еда"} откроется сразу после этого.</p></div>`;
}
function pasteLinkSheet() {
  openSheet(`<h2>Вставить ссылку</h2>
    <p class="muted small">Ссылка на рецепт, еду или норму, которую тебе прислали. Скопируй её в мессенджере и вставь сюда.</p>
    <textarea id="linkIn" class="input" rows="3" placeholder="https://chukachups.github.io/hrum/#…"></textarea>
    <p id="linkErr" class="note" style="color:var(--danger)" hidden>Это не ссылка Хрума — скопируй её целиком.</p>
    <button class="btn" data-a="openLink">Открыть</button>`);
  // если буфер обмена доступен — вставим сами
  navigator.clipboard?.readText?.().then(t => { if (SHARE_HASH.test(t) && $("#linkIn") && !$("#linkIn").value) $("#linkIn").value = t.trim(); }).catch(() => {});
}
function viewSetup() {
  const p = S.profile || {};
  const seg = (group, val, label) => `<button type="button" data-a="pick" data-val="${val}" aria-pressed="${p[group] === val}">${label}</button>`;
  const opt = (val, title, sub, cur) => `<button type="button" class="option" data-a="pick" data-val="${val}" aria-pressed="${cur === val}"><b>${title}</b><span>${sub}</span></button>`;
  return `<header class="top"><div class="brand" style="font-size:22px"><img src="icons/icon-192.png" alt="" style="width:34px;height:34px">хрум</div></header>
  ${linkCard()}
  ${S.profile || location.hash.match(SHARE_HASH) ? "" : installCard(IS_IOS)}
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
    S.profile = { sex, age: r0(age), height, weight, bodyFat, activity: act, goal, ...(S.profile?.adjust ? { adjust: S.profile.adjust } : {}) };
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

// tall — лист на всю высоту: строка поиска остаётся наверху, когда список сжимается и открыта клавиатура
function openSheet(html, tall = false) {
  if (ui.view !== "setup") ui.onPick = null;
  $("#sheetBody").innerHTML = html;
  $(".sheet-panel").classList.toggle("tall", tall);
  $("#sheet").hidden = false;
  document.body.style.overflow = "hidden";
}
// Закрывает сразу (синхронно), чтобы следующий openSheet не стёрся; камера гасится в фоне
function closeSheet() {
  ui.scanTarget = null;
  stopScanner();
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
      <button class="btn ghost" data-a="newProduct">+ Продукт</button>
      <button class="btn ghost" data-a="newRecipe">+ Рецепт</button>
    </div>
    <div id="flabel" class="muted small"></div>
    <div id="flist" class="list"></div>`, true);
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
  const portion = !entry && p.recipe && p.recipe.portions ? recipeWeight(p.recipe) / p.recipe.portions : 0;
  const piece = findProduct(entry ? entry.pid : p.id);
  const pc = piece && piece.pc ? [piece.pc, piece.pcName || "шт"] : null;
  const opts = piece && piece.opts; // готовые порции: «¼ пиццы», «1 порция»
  const g0 = entry ? entry.grams : portion || (opts ? opts[0][1] : pc ? pc[0] : 100);
  ui.gctx = { p: per100, entry };
  openSheet(`<div><h2>${esc(per100.name)}</h2><p class="muted small">На 100 г: ${kbju(per100)}</p></div>
    <label class="field"><span>Сколько грамм</span><input id="grams" class="input" inputmode="decimal" value="${fmt(g0, 0)}"></label>
    <div class="chips">${portion
      ? [[0.5, "½ порции"], [1, "1 порция"], [1.5, "1½ порции"], [2, "2 порции"]].map(([k, l]) => `<button class="chip" data-a="setGrams" data-g="${r0(portion * k)}">${l} · ${r0(portion * k)} г</button>`).join("")
      : opts
        ? opts.map(([l, g]) => `<button class="chip" data-a="setGrams" data-g="${g}">${esc(l)}${/мл|л$/.test(l) ? "" : ` · ${g} г`}</button>`).join("")
      : pc
        ? [1, 2, 3, 4].map(k => `<button class="chip" data-a="setGrams" data-g="${pc[0] * k}">${k} ${pc[1]} · ${pc[0] * k} г</button>`).join("")
        : [30, 50, 100, 150, 200, 250, 300].map(g => `<button class="chip" data-a="setGrams" data-g="${g}">${g}</button>`).join("")}</div>
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
    if (ui.scanTarget === "recipe" && !edit) {
      recipeIngGrams(ingredientFrom(prod), null);
    } else if (ui.addMeal && !edit) {
      gramsSheet(prod, ui.addMeal);
    } else {
      closeSheet();
      render();
      toast("Продукт сохранён");
    }
  });
}

function productSheet(p) {
  if (p.recipe) return recipeInfoSheet(p);
  const mine = p.id[0] !== "b";
  openSheet(`<div><h2>${esc(p.name)}</h2><p class="muted small">На 100 г: ${kbju(p)}${p.barcode ? `<br>Штрихкод ${esc(p.barcode)}` : ""}</p></div>
    <button class="btn" data-a="productToDiary" data-id="${p.id}">Добавить в дневник</button>
    ${mine ? `<div class="btn-row"><button class="btn ghost" data-a="editProduct" data-id="${p.id}">Изменить</button>
      <button class="btn danger" data-a="deleteProduct" data-id="${p.id}">Удалить</button></div>` : `<p class="muted small">Продукт из стартовой базы.</p>`}`);
}

/* ================= Рецепты ================= */

function recipeInfoSheet(p) {
  const r = p.recipe, c = recipeCalc(r);
  const portion = r.portions ? c.weight / r.portions : 0;
  openSheet(`<div><h2>${esc(p.name)}</h2><p class="muted small">На 100 г: ${kbju(c.per100)}</p></div>
    <div class="card form">
      <div class="kv"><span>Всё блюдо, ${fmt(c.weight, 0)} г${r.cooked ? " (готовое)" : ""}</span><b>${r0(c.total.kcal)} ккал</b></div>
      ${portion ? `<div class="kv"><span>1 порция из ${r.portions}, ${fmt(portion, 0)} г</span><b>${r0(c.per100.kcal * portion / 100)} ккал</b></div>` : ""}
      <hr class="rule">
      ${r.items.map(x => `<div class="kv"><span>${esc(x.name)}</span><b>${fmt(x.grams, 0)} г</b></div>`).join("")}
    </div>
    ${splitCard(c, r)}
    <button class="btn" data-a="productToDiary" data-id="${p.id}">Добавить в дневник</button>
    <div class="btn-row">
      <button class="btn ghost" data-a="editProduct" data-id="${p.id}">Изменить</button>
      <button class="btn ghost" data-a="shareRecipe" data-id="${p.id}">Поделиться</button>
    </div>
    <button class="btn danger" data-a="deleteProduct" data-id="${p.id}">Удалить рецепт</button>`);
}

// Делим блюдо пропорционально нормам: кому больше калорий — тому больше грамм
// Делим пропорционально нормам. Если указаны порции — делим один совместный приём (2 порции),
// а не всю кастрюлю: порция — это еда одного человека на один раз.
function splitCard(c, r) {
  const partner = S.partner;
  if (!partner || !partner.kcal) {
    return `<button class="row-card dashed" data-a="editPartner">Разделить на двоих — укажи норму второго человека</button>`;
  }
  const mine = targets().kcal, share = mine / (mine + partner.kcal);
  const k = c.per100.kcal / 100, pct = Math.round(share * 100);
  const mealPortions = r.portions ? Math.min(2, r.portions) : 0;
  const base = mealPortions ? c.weight / r.portions * mealPortions : c.weight;
  const g1 = base * share, g2 = base - g1;
  const title = mealPortions
    ? `На один приём вдвоём — ${mealPortions} ${plural(mealPortions, ["порция", "порции", "порций"])} из ${r.portions}, ${fmt(base, 0)} г`
    : `Вся кастрюля, ${fmt(base, 0)} г`;
  const meals = mealPortions && r.portions >= 2 ? Math.floor(r.portions / 2) : 0;
  return `<div class="card form split">
    <b>Разделить на двоих</b>
    <span class="muted small">${title}</span>
    <div class="kv"><span>Тебе (${pct}%)</span><b>${fmt(g1, 0)} г · ${r0(g1 * k)} ккал</b></div>
    <div class="kv"><span>${esc(partner.name)} (${100 - pct}%)</span><b>${fmt(g2, 0)} г · ${r0(g2 * k)} ккал</b></div>
    <p class="muted small">Пропорционально нормам: ${r0(mine)} и ${r0(partner.kcal)} ккал в день.${
      meals > 1 ? ` Блюда хватит на ${meals} ${plural(meals, ["приём", "приёма", "приёмов"])} вдвоём.` : ""}${
      mealPortions ? "" : " Укажи в рецепте число порций — тогда разделю один приём, а не всю кастрюлю."}</p>
  </div>`;
}

function incomingNormSheet(n) {
  ui.incomingNorm = n;
  openSheet(`<h2>Тебе прислали норму</h2>
    <div class="card form">
      <div class="kv"><span>Вес</span><b>${fmt(n.weight)} кг</b></div>
      <div class="kv"><span>Норма</span><b>${r0(n.kcal)} ккал в день</b></div>
      <div class="kv"><span>Обновлено</span><b>${shortDate(n.date)}</b></div>
    </div>
    <label class="field"><span>Чья это норма</span><input id="inName" class="input" value="${esc(S.partner?.name || "")}" placeholder="Муж"></label>
    <p class="muted small">Сохраню как «второго человека» — по этой норме Хрум делит общие блюда на двоих.</p>
    <button class="btn" data-a="acceptNorm">Сохранить</button>
    <button class="btn ghost" data-a="closeSheet">Не нужно</button>`);
}

function partnerSheet() {
  const pt = S.partner || {};
  openSheet(`<h2>Второй человек</h2>
    <p class="muted small">Чтобы делить общие блюда: Хрум разложит кастрюлю пропорционально вашим нормам. Норму второго человека посмотри в его Хруме — Профиль, строка «Цель».</p>
    <div class="grid2">
      <label class="field"><span>Кто</span><input id="ptName" class="input" value="${esc(pt.name || "")}" placeholder="Жена"></label>
      <label class="field"><span>Норма, ккал в день</span><input id="ptKcal" class="input" inputmode="numeric" value="${pt.kcal ? r0(pt.kcal) : ""}" placeholder="1500"></label>
    </div>
    <button class="btn" data-a="savePartner">Сохранить</button>
    ${S.partner ? `<button class="btn danger" data-a="clearPartner">Убрать</button>` : ""}`);
}

function openRecipeEditor(p) {
  ui.rd = p
    ? { id: p.id, name: p.name, items: p.recipe.items.map(x => ({ ...x })), cooked: p.recipe.cooked, portions: p.recipe.portions }
    : { id: null, name: "", items: [], cooked: null, portions: null };
  recipeSheet();
}

function syncDraft() {
  if (!$("#rName")) return;
  ui.rd.name = $("#rName").value.trim();
  ui.rd.cooked = num($("#rCooked").value) || null;
  ui.rd.portions = Math.round(num($("#rPortions").value) || 0) || null;
}

function recipeSheet() {
  const rd = ui.rd;
  const rows = rd.items.length
    ? rd.items.map((x, i) => `<button class="item" data-a="rIngEdit" data-i="${i}">
        <span class="n">${esc(x.name)}</span><span class="k">${r0(x.kcal * x.grams / 100)}</span>
        <span class="g">${fmt(x.grams, 0)} г</span><span class="m">ккал</span></button>`).join("")
    : `<div class="empty">Добавь продукты, из которых готовится блюдо</div>`;
  openSheet(`<h2>${rd.id ? "Изменить рецепт" : "Новый рецепт"}</h2>
    <label class="field"><span>Название блюда</span><input id="rName" class="input" value="${esc(rd.name)}" placeholder="Борщ как у Ани"></label>
    <div class="section-title"><h2>Ингредиенты</h2><span>сырыми, в граммах</span></div>
    <div class="meal">${rows}</div>
    <button class="btn ghost" data-a="rIngAdd">+ Ингредиент</button>
    <div class="grid2">
      <label class="field"><span>Вес готового блюда, г</span><input id="rCooked" class="input" inputmode="decimal" value="${rd.cooked ?? ""}" placeholder="не обязательно"></label>
      <label class="field"><span>Сколько порций</span><input id="rPortions" class="input" inputmode="numeric" value="${rd.portions ?? ""}" placeholder="не обязательно"></label>
    </div>
    <p class="note">Взвесь готовое блюдо без кастрюли — так учтётся выкипевшая или впитанная вода. Если не взвешивать, считаю по весу сырых продуктов.</p>
    <div class="card preview" id="rSum"></div>
    <p id="rErr" class="note" style="color:var(--danger)" hidden></p>
    <button class="btn" data-a="rSave">Сохранить рецепт</button>`);
  const upd = () => {
    syncDraft();
    if (!rd.items.length) { $("#rSum").innerHTML = `<span class="muted small">Здесь появится КБЖУ блюда</span>`; return; }
    const c = recipeCalc(rd);
    const portion = rd.portions ? `<span class="muted small">1 порция ≈ ${fmt(c.weight / rd.portions, 0)} г, ${r0(c.per100.kcal * c.weight / rd.portions / 100)} ккал</span>` : "";
    $("#rSum").innerHTML = `<span><b>${r0(c.per100.kcal)}</b> ккал на 100 г</span><span>Б ${fmt(c.per100.p)}</span><span>Ж ${fmt(c.per100.f)}</span><span>У ${fmt(c.per100.c)}</span>${portion}`;
  };
  ["#rCooked", "#rPortions"].forEach(id => $(id).addEventListener("input", upd));
  upd();
}

function recipeIngSearch() {
  openSheet(`<h2>Ингредиент</h2>
    <input id="isearch" class="input" type="search" placeholder="Например, свёкла" autocomplete="off">
    <div class="btn-row">
      <button class="btn ghost" data-a="rScan">Штрихкод</button>
      <button class="btn ghost" data-a="rNewProduct">+ Продукт</button>
      <button class="btn ghost" data-a="rBack">Назад</button>
    </div>
    <div id="ilist" class="list"></div>`, true);
  const inp = $("#isearch");
  const draw = () => {
    const list = searchProducts(inp.value).filter(x => x.id !== ui.rd.id).slice(0, 60);
    $("#ilist").innerHTML = list.length ? productRows(list, "rIngPick", inp.value)
      : `<p class="muted">Не нашёл «${esc(inp.value)}».</p>
        <button class="btn ghost" data-a="rNewProduct" data-name="${esc(inp.value)}">Создать продукт «${esc(inp.value)}»</button>`;
  };
  inp.addEventListener("input", draw);
  draw();
}

// Продукт → ингредиент рецепта (для вложенного рецепта берём его КБЖУ на 100 г)
function ingredientFrom(p) {
  const per = p.recipe ? recipeCalc(p.recipe).per100 : p;
  return { name: p.name, kcal: per.kcal, p: per.p, f: per.f, c: per.c, grams: 0 };
}

function recipeIngGrams(item, idx) {
  ui.rIng = { item, idx };
  openSheet(`<div><h2>${esc(item.name)}</h2><p class="muted small">На 100 г: ${kbju(item)}</p></div>
    <label class="field"><span>Сколько грамм в рецепте (сырыми)</span>
      <input id="igrams" class="input" inputmode="decimal" value="${idx != null ? fmt(item.grams, 0) : ""}" placeholder="например, 500"></label>
    <button class="btn" data-a="rIngSave">${idx != null ? "Сохранить" : "Добавить в рецепт"}</button>
    ${idx != null ? `<button class="btn danger" data-a="rIngDelete">Убрать из рецепта</button>` : ""}
    <button class="btn ghost" data-a="rBack">Назад к рецепту</button>`);
}

function incomingRecipeSheet(data) {
  const c = recipeCalc(data.recipe);
  openSheet(`<h2>Тебе прислали рецепт</h2>
    <div><b>${esc(data.name)}</b><p class="muted small">На 100 г: ${kbju(c.per100)}</p></div>
    <div class="card form">${data.recipe.items.map(x => `<div class="kv"><span>${esc(x.name)}</span><b>${fmt(x.grams, 0)} г</b></div>`).join("")}</div>
    <button class="btn" data-a="importRecipe">Добавить себе</button>
    <button class="btn ghost" data-a="closeSheet">Не нужно</button>`);
  ui.incoming = data;
}

function garnishSheet(meal) {
  const d = dayData(ui.day);
  const { T, m, opts } = garnishOptions(d, meal);
  const line = v => `${r0(v.kcal)} ккал · Б ${r0(v.p)} · Ж ${r0(v.f)} · У ${r0(v.c)}`;
  openSheet(`<div><h2>Гарнир: ${mealName(meal).toLowerCase()}</h2>
    <p class="muted small">С учётом остальной еды за день сюда стоит уложить примерно <b>${line(T)}</b>. Сейчас: ${line(m)}.</p></div>
    ${m.f > T.f * 1.1 ? `<p class="small">Жира в приёме уже больше нужного — гарнир лучше без масла и соусов.</p>` : ""}
    ${opts.length ? opts.map((o, i) => `<div class="card garnish">
        <div class="kv"><b>${esc(o.p.name)}, ${o.g} г</b><span>${r0(o.p.kcal * o.g / 100)} ккал</span></div>
        <p class="muted small">${i === 0 ? "Лучше всего по балансу: " : ""}${o.why}. Приём станет: ${line(o.v)}</p>
        <button class="btn ghost" data-a="addGarnish" data-id="${o.p.id}" data-g="${o.g}" data-meal="${meal}">Добавить ${o.g} г</button></div>`).join("")
      : `<p>На гарнир калорий почти не осталось — лучше добавить овощи.</p>`}
    <h3>Овощи — к любому гарниру</h3>
    <div class="chips">${VEGGIES.map(id => findProduct(id)).map(p => `<button class="chip" data-a="addGarnish" data-id="${p.id}" data-g="150" data-meal="${meal}">+ ${esc(p.name)}, 150 г</button>`).join("")}</div>
    <p class="muted small">Вес гарнира — в готовом виде. Добавленное можно поправить, нажав на него в дневнике.</p>
    <button class="btn ghost" data-a="closeSheet">Закрыть</button>`);
}

function incomingFoodSheet(data) {
  ui.incomingFood = data;
  const mine = targets().kcal;
  const ratio = data.kcal ? Math.min(2, Math.max(0.5, mine / data.kcal)) : 1;
  const scaled = Math.abs(ratio - 1) > 0.02;
  openSheet(`<h2>${data.meal ? `Тебе прислали: ${mealName(data.meal).toLowerCase()}` : "Тебе прислали меню на день"}</h2>
    ${scaled ? `<p class="muted small">Прислано под норму ${data.kcal} ккал, твоя — ${r0(mine)}. Граммы пересчитаны под тебя (×${fmt(ratio, 2)}), их можно поправить.</p>
      <div class="seg" id="fScale"><button data-a="pick" data-val="${ratio}" aria-pressed="true">Под мою норму</button><button data-a="pick" data-val="1" aria-pressed="false">Как прислали</button></div>` : ""}
    <div class="card form">${data.items.map((x, i) => `<label class="share-row">
        <span><b>${esc(x.name)}</b><small>${data.meal ? "" : mealName(x.meal) + " · "}${r0(x.kcal)} ккал на 100 г</small></span>
        <input class="input" inputmode="decimal" data-i="${i}"><span>г</span></label>`).join("")}</div>
    ${data.meal ? `<div class="seg" id="fMeal">${MEALS.map(([k, t]) => `<button data-a="pick" data-val="${k}" aria-pressed="${k === data.meal}">${t}</button>`).join("")}</div>` : ""}
    <div class="seg" id="fDay"><button data-a="pick" data-val="${dayKey()}" aria-pressed="true">Сегодня</button><button data-a="pick" data-val="${shiftDay(dayKey(), -1)}" aria-pressed="false">Вчера</button><button data-a="pick" data-val="${shiftDay(dayKey(), 1)}" aria-pressed="false">Завтра</button></div>
    <div class="card preview" id="fPrev"></div>
    <p class="note" id="fReplace" hidden></p>
    <button class="btn" data-a="importFood">Добавить в дневник</button>
    <button class="btn ghost" data-a="closeSheet">Не нужно</button>`, data.items.length > 4);
  const inputs = [...document.querySelectorAll("#sheetBody input[data-i]")];
  const fill = r => inputs.forEach(inp => { inp.value = Math.max(5, Math.round(data.items[inp.dataset.i].grams * r / 5) * 5); });
  const upd = () => {
    const t = { kcal: 0, p: 0, f: 0, c: 0 };
    for (const inp of inputs) {
      const x = data.items[inp.dataset.i], k = (num(inp.value) || 0) / 100;
      for (const q of KEYS) t[q] += x[q] * k;
    }
    $("#fPrev").innerHTML = `<span><b>${r0(t.kcal)}</b> ккал</span><span>Б ${r0(t.p)}</span><span>Ж ${r0(t.f)}</span><span>У ${r0(t.c)}</span>`;
  };
  const replaceNote = () => {
    const { day, meals } = foodTarget(data);
    const old = sharedIn(day, meals);
    const el = $("#fReplace");
    el.hidden = !old.length;
    if (old.length) {
      const names = [...new Set(old.map(e => mealName(e.meal).toLowerCase()))].join(", ");
      el.textContent = `Присланное раньше (${names}, ${old.length} ${plural(old.length, ["запись", "записи", "записей"])}) заменится этим. Своё записанное останется.`;
    }
  };
  let cur = scaled ? ratio : 1;
  fill(cur); upd(); replaceNote();
  inputs.forEach(inp => inp.addEventListener("input", upd));
  // выбор дня или приёма не сбрасывает поправленные граммы — только смена «под мою норму / как прислали»
  ui.onPick = () => {
    const r = +($('#fScale [aria-pressed="true"]')?.dataset.val || 1);
    if (r !== cur) { cur = r; fill(r); upd(); }
    replaceNote();
  };
}

// Присланная еда: pid null — так помечались и записи до флага shared
const isShared = e => e.shared || e.pid === null;
const sharedIn = (day, meals) => (S.entries[day] || []).filter(e => isShared(e) && meals.includes(e.meal));
// Куда ляжет присланное: выбранный день и приёмы (один выбранный или все из меню дня)
function foodTarget(d) {
  const day = $('#fDay [aria-pressed="true"]').dataset.val;
  const meals = d.meal ? [$('#fMeal [aria-pressed="true"]').dataset.val] : [...new Set(d.items.map(x => x.meal))];
  return { day, meals };
}

async function shareFood(meal) {
  const url = foodLink(meal);
  const text = meal
    ? `${mealName(meal)} из Хрума — откроется с граммами под твою норму:`
    : "Моё меню на день из Хрума — откроется с граммами под твою норму:";
  if (navigator.share) {
    try { await navigator.share({ title: "Еда из Хрума", text, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast("Ссылка скопирована — отправь её в мессенджер");
  } catch (e) {
    openSheet(`<h2>Ссылка на еду</h2><p class="muted small">Скопируй и отправь в мессенджер:</p>
      <textarea class="input" rows="4" readonly>${esc(url)}</textarea>
      <button class="btn ghost" data-a="closeSheet">Готово</button>`);
  }
}

function workoutSheet() {
  openSheet(`<h2>Тренировка</h2>
    <div class="chips" id="wType">${WORKOUTS.map(([n], i) => `<button class="chip" data-a="pick" data-val="${i}" aria-pressed="${i === 0}">${n}</button>`).join("")}</div>
    <div class="grid2">
      <label class="field"><span>Сколько минут</span><input id="wMin" class="input" inputmode="numeric" value="30"></label>
      <label class="field"><span>Ккал по часам</span><input id="wKcal" class="input" inputmode="numeric" placeholder="если знаешь"></label>
    </div>
    <div class="card preview" id="wPrev"></div>
    <p class="note">Вноси только специальные занятия: зал, бег, бассейн, прогулку ради прогулки. Дорога, офис и дела по дому уже учтены в норме. Тренировки не увеличивают лимит еды — они ускоряют похудение.</p>
    <button class="btn" data-a="saveWorkout">Добавить</button>`);
  const upd = () => {
    const [, met] = WORKOUTS[+$('#wType [aria-pressed="true"]').dataset.val];
    const min = num($("#wMin").value) || 0, own = num($("#wKcal").value);
    const kc = own != null && own > 0 ? own : workoutKcal(met, S.profile.weight, min);
    const how = own != null && own > 0 ? "по данным твоих часов"
      : `${fmt(min, 0)} мин × ${fmt(S.profile.weight)} кг × (${fmt(met)} − 1) ÷ 60 — расчёт по нагрузке`;
    $("#wPrev").innerHTML = `<span><b>−${r0(kc)}</b> ккал ≈ ${r0(kc / 7.7)} г жира</span><span class="muted small">${how}</span>`;
  };
  ui.onPick = upd;
  $("#wMin").addEventListener("input", upd);
  $("#wKcal").addEventListener("input", upd);
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
  clearTimeout(ui.scanTip1);
  clearTimeout(ui.scanTip2);
  if (!scanner) return;
  const s = scanner;
  scanner = null;
  try { if (s.isScanning) await s.stop(); } catch (e) { /* уже остановлен */ }
  try { s.clear(); } catch (e) { /* ignore */ }
}
function scanMsg(text, tip = false) {
  const el = $("#scanMsg");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("scan-tip", tip);
}

async function scanSheet() {
  if (!ui.addMeal && ui.scanTarget !== "recipe") ui.addMeal = mealByTime();
  openSheet(`<h2>Штрихкод</h2>
    <div id="reader"></div>
    <p id="scanMsg" class="muted small">Наведи камеру на штрихкод товара</p>
    ${IS_IOS ? `<p class="muted small">Safari спрашивает про камеру каждый раз? В Safari нажми «аА» слева от адреса → «Настройки веб-сайта» → «Камера» → «Разрешить».</p>` : ""}
    <div class="btn-row">
      <label class="btn ghost">Из фото<input type="file" id="scanFile" accept="image/*" hidden></label>
      <button class="btn ghost" data-a="manualCode">Ввести цифры</button>
    </div>
    ${ui.scanTarget === "recipe" ? `<button class="btn ghost" data-a="rBack">Назад к рецепту</button>` : ""}
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
    // не читается — сначала подсказка, потом сразу ввод цифр
    ui.scanTip1 = setTimeout(() => scanMsg(
      "Не читается? Поднеси телефон ближе, чтобы полоски заняли почти всю рамку, держи ровно и без бликов. Помогает яркий свет.", true), 8000);
    ui.scanTip2 = setTimeout(() => {
      const form = $("#codeForm");
      if (!form) return;
      form.hidden = false;
      scanMsg("Камера никак не прочитает код. Введи цифры, которые напечатаны под полосками, — так быстрее.", true);
    }, 15000);
  } catch (e) {
    const form = $("#codeForm");
    if (!form) return; // лист уже закрыли
    form.hidden = false;
    scanMsg("Камера недоступна. Разреши доступ к камере в настройках браузера, выбери фото штрихкода или введи цифры под полосками.", true);
  }
}

async function onCode(code) {
  if (ui.codeBusy) return;
  ui.codeBusy = true;
  try {
    await stopScanner();
    if (navigator.vibrate) navigator.vibrate(40);
    let p = allProducts().find(x => x.barcode === code);
    let off = null;
    if (!p) {
      scanMsg(`Прочитал: ${code}. Ищу в открытой базе…`);
      off = await fetchOFF(code);
      if (off.product) {
        p = { id: "u" + uid(), ...off.product, barcode: code };
        S.products.unshift(p);
        save();
      }
    }
    if (p && ui.scanTarget === "recipe") recipeIngGrams(ingredientFrom(p), null);
    else if (p) gramsSheet(p, ui.addMeal || mealByTime());
    else {
      const tail = "Перепиши КБЖУ с этикетки один раз — дальше Хрум будет узнавать этот товар сразу.";
      const note = off.error
        ? `<b>Не удалось связаться с базой</b> — похоже, нет интернета. Штрихкод ${esc(code)} прочитан. ${tail}`
        : off.name
          ? `<b>Товар есть в базе, но без КБЖУ.</b> Название подставил. ${tail}`
          : `<b>Товара ${esc(code)} нет в открытой базе</b> — с российскими товарами так бывает часто. ${tail}`;
      productFormSheet({ barcode: code, name: off.name || "", note });
    }
  } finally {
    ui.codeBusy = false;
  }
}

/* ================= Действия ================= */

const actions = {
  tab(el) { ui.view = el.dataset.v; if (ui.view === "diary") ui.day = ui.day || dayKey(); render(); window.scrollTo(0, 0); },
  prevDay() { ui.day = shiftDay(ui.day, -1); render(); },
  nextDay() { if (ui.day < shiftDay(dayKey(), PLAN_DAYS)) { ui.day = shiftDay(ui.day, 1); render(); } },
  toToday() { if (ui.day !== dayKey()) { ui.day = dayKey(); render(); } },
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
    ui.scanTarget = null;
    if ($("#sheet").hidden) ui.addMeal = ui.view === "diary" ? mealByTime() : null;
    if (!ui.addMeal) ui.addMeal = mealByTime();
    if (ui.view !== "diary") { ui.view = "diary"; render(); }
    scanSheet();
  },
  manualCode() { $("#codeForm").hidden = false; $("#codeInput").focus(); },
  newProduct(el) {
    if ($("#sheet").hidden) ui.addMeal = null;
    productFormSheet({ name: el.dataset.name || $("#fsearch")?.value.trim() || "" });
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
  editProduct(el) {
    const p = findProduct(el.dataset.id);
    ui.addMeal = null;
    if (p.recipe) openRecipeEditor(p); else productFormSheet({ edit: p });
  },
  newRecipe() {
    if ($("#sheet").hidden) ui.addMeal = null;
    openRecipeEditor(null);
  },
  rIngAdd() { syncDraft(); recipeIngSearch(); },
  rIngPick(el) { recipeIngGrams(ingredientFrom(findProduct(el.dataset.id)), null); },
  rScan() { ui.scanTarget = "recipe"; scanSheet(); },
  rNewProduct(el) { ui.scanTarget = "recipe"; productFormSheet({ name: el.dataset.name || $("#isearch")?.value.trim() || "" }); },
  rIngEdit(el) { syncDraft(); const i = +el.dataset.i; recipeIngGrams(ui.rd.items[i], i); },
  rIngSave() {
    const g = num($("#igrams").value);
    if (!g || g <= 0 || g > 20000) { toast("Укажи граммы"); return; }
    const { item, idx } = ui.rIng;
    if (idx != null) ui.rd.items[idx].grams = g;
    else ui.rd.items.push({ ...item, grams: g });
    ui.scanTarget = null;
    recipeSheet();
  },
  rIngDelete() { ui.rd.items.splice(ui.rIng.idx, 1); recipeSheet(); },
  async rBack() { ui.scanTarget = null; await stopScanner(); recipeSheet(); },
  rSave() {
    syncDraft();
    const rd = ui.rd;
    const bad = m => { const el = $("#rErr"); el.textContent = m; el.hidden = false; };
    if (!rd.name) return bad("Назови блюдо.");
    if (!rd.items.length) return bad("Добавь хотя бы один ингредиент.");
    const c = recipeCalc(rd);
    if (rd.cooked && rd.cooked < c.raw * 0.2) return bad("Вес готового блюда слишком маленький — проверь число.");
    const recipe = { items: rd.items, cooked: rd.cooked, portions: rd.portions };
    let prod;
    if (rd.id) {
      prod = Object.assign(findProduct(rd.id), { name: rd.name, ...c.per100, recipe });
    } else {
      prod = { id: "u" + uid(), name: rd.name, ...c.per100, recipe };
      S.products.unshift(prod);
    }
    save();
    if (ui.addMeal && !rd.id) { gramsSheet(prod, ui.addMeal); return; }
    closeSheet(); render(); toast("Рецепт сохранён");
  },
  async shareRecipe(el) {
    const p = findProduct(el.dataset.id);
    const url = recipeLink(p);
    const text = `Рецепт «${p.name}» для Хрума`;
    if (navigator.share) {
      try { await navigator.share({ title: text, text, url }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Ссылка скопирована — отправь её в мессенджер");
    } catch (e) {
      openSheet(`<h2>Ссылка на рецепт</h2><p class="muted small">Скопируй и отправь в мессенджер:</p>
        <textarea class="input" rows="4" readonly>${esc(url)}</textarea>
        <button class="btn ghost" data-a="closeSheet">Готово</button>`);
    }
  },
  importRecipe() {
    const d = ui.incoming;
    const prod = { id: "u" + uid(), name: d.name, ...recipeCalc(d.recipe).per100, recipe: d.recipe };
    S.products.unshift(prod);
    save(); ui.incoming = null; closeSheet(); render();
    toast(`Рецепт «${d.name}» добавлен`);
  },
  editPartner() { partnerSheet(); },
  applyAdjust(el) {
    S.profile.adjust = +el.dataset.f;
    S.adjustHide = dayKey();
    save(); render();
    toast(`Норма: ${r0(targets().kcal)} ккал в день`);
  },
  resetAdjust() {
    delete S.profile.adjust;
    save(); render();
    toast(`Поправка сброшена. Норма: ${r0(targets().kcal)} ккал`);
  },
  hideAdjust() { S.adjustHide = dayKey(); save(); render(); },
  pasteLink() { pasteLinkSheet(); },
  openLink() {
    const m = ($("#linkIn").value || "").match(SHARE_HASH);
    if (!m) { $("#linkErr").hidden = false; return; }
    closeSheet();
    location.hash = m[0]; // дальше — как при открытии ссылки (hashchange)
  },
  async copyLink() {
    try { await navigator.clipboard.writeText(location.href); toast("Скопировано — теперь открой Хрум с иконки"); }
    catch (e) {
      openSheet(`<h2>Ссылка</h2><p class="muted small">Выдели и скопируй:</p>
        <textarea class="input" rows="4" readonly>${esc(location.href)}</textarea>
        <button class="btn ghost" data-a="closeSheet">Готово</button>`);
    }
  },
  shareMeal(el) { shareFood(el.dataset.meal); },
  shareDay() { shareFood(null); },
  garnish(el) { garnishSheet(el.dataset.meal); },
  addGarnish(el) {
    const p = findProduct(el.dataset.id), g = +el.dataset.g, k = g / 100;
    (S.entries[ui.day] ||= []).push({ id: uid(), pid: p.id, name: p.name, meal: el.dataset.meal, grams: g,
      kcal: p.kcal * k, p: p.p * k, f: p.f * k, c: p.c * k });
    touchRecent(p.id);
    save(); closeSheet(); render();
    toast(`Хрум! +${r0(p.kcal * k)} ккал`);
  },
  importFood() {
    const d = ui.incomingFood;
    const { day, meals } = foodTarget(d);
    const meal = d.meal && meals[0];
    // последнее присланное заменяет присланное раньше в те же приёмы; своё не трогаем
    const replaced = sharedIn(day, meals).length;
    if (replaced) S.entries[day] = S.entries[day].filter(e => !(isShared(e) && meals.includes(e.meal)));
    let n = 0, kc = 0;
    for (const inp of document.querySelectorAll("#sheetBody input[data-i]")) {
      const g = num(inp.value);
      if (!g || g <= 0 || g > 5000) continue;
      const x = d.items[inp.dataset.i], k = g / 100;
      (S.entries[day] ||= []).push({ id: uid(), pid: null, shared: true, name: x.name, meal: meal || x.meal, grams: g,
        kcal: x.kcal * k, p: x.p * k, f: x.f * k, c: x.c * k });
      n++; kc += x.kcal * k;
    }
    if (!n) { toast("Укажи граммы"); return; }
    ui.incomingFood = null; ui.day = day; ui.view = "diary";
    save(); closeSheet(); render();
    toast(`${replaced ? "Заменил присланное раньше. " : ""}Добавлено: ${n} ${plural(n, ["продукт", "продукта", "продуктов"])}, ${r0(kc)} ккал`);
  },
  async shareNorm() {
    const url = normLink();
    const text = `Моя норма в Хруме: вес ${fmt(S.profile.weight)} кг, ${r0(targets().kcal)} ккал в день. Открой ссылку, чтобы обновить:`;
    if (navigator.share) {
      try { await navigator.share({ title: "Моя норма в Хруме", text, url }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast("Ссылка скопирована — отправь её в мессенджер");
    } catch (e) {
      openSheet(`<h2>Ссылка с нормой</h2><p class="muted small">Скопируй и отправь в мессенджер:</p>
        <textarea class="input" rows="4" readonly>${esc(url)}</textarea>
        <button class="btn ghost" data-a="closeSheet">Готово</button>`);
    }
  },
  acceptNorm() {
    const n = ui.incomingNorm;
    S.partner = { name: $("#inName").value.trim() || S.partner?.name || "Второй человек", kcal: n.kcal, weight: n.weight, date: n.date };
    ui.incomingNorm = null;
    save(); closeSheet(); render();
    toast(`Норма обновлена: ${r0(n.kcal)} ккал`);
  },
  savePartner() {
    const kcal = num($("#ptKcal").value);
    if (!kcal || kcal < 800 || kcal > 6000) { toast("Норма — от 800 до 6000 ккал"); return; }
    const same = S.partner && r0(S.partner.kcal) === r0(kcal);
    S.partner = { name: $("#ptName").value.trim() || "Второй человек", kcal,
      weight: same ? S.partner.weight : null, date: same ? S.partner.date : dayKey() };
    save(); closeSheet(); render(); toast("Сохранено — общие блюда теперь делятся на двоих");
  },
  clearPartner() { S.partner = null; save(); closeSheet(); render(); },
  setSkin(el) { S.skin = el.dataset.v; save(); render(); },
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
    const own = num($("#wKcal").value);
    if (own != null && (own <= 0 || own > 5000)) { toast("Калории — от 1 до 5000"); return; }
    const kcal = own || workoutKcal(met, S.profile.weight, min);
    (S.workouts[ui.day] ||= []).push({ id: uid(), name, minutes: min, kcal, manual: !!own });
    save(); closeSheet(); render(); toast("Тренировка добавлена");
  },
  editWorkout(el) {
    const w = (S.workouts[ui.day] || []).find(x => x.id === el.dataset.id);
    if (!w) return;
    ui.wEdit = w;
    openSheet(`<h2>${esc(w.name)}</h2><p class="muted">${fmt(w.minutes, 0)} мин · −${r0(w.kcal)} ккал ≈ ${r0(w.kcal / 7.7)} г жира${w.manual ? " · по часам" : ""}</p>
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
    if (S.partner) {
      openSheet(`<h2>Вес записан</h2>
        <p>Новая норма: <b>${r0(targets().kcal)} ккал</b> в день.</p>
        <p class="muted small">Отправь её ${esc(S.partner.name)}, чтобы общие блюда делились по-новому.</p>
        <button class="btn" data-a="shareNorm">Отправить мою норму</button>
        <button class="btn ghost" data-a="closeSheet">Потом</button>`);
    } else {
      toast(`Записал. Норма: ${r0(targets().kcal)} ккал`);
    }
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
  askReset() {
    openSheet(`<h2>Стереть все данные?</h2>
      <p>Удалятся профиль, все записи еды, тренировки, вес и твои продукты. Хрум начнётся с чистого листа.</p>
      <p class="note">Вернуть можно только из файла копии. Если данные нужны — сначала нажми «Сохранить копию».</p>
      <button class="btn danger" data-a="doReset">Да, стереть всё</button>
      <button class="btn ghost" data-a="closeSheet">Отмена</button>`);
  },
  doReset() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    S = blank();
    ui.day = dayKey();
    closeSheet();
    render();
    window.scrollTo(0, 0);
    toast("Всё стёрто. Начнём заново!");
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
// числовые поля: при касании выделяем значение целиком — новое число пишется поверх старого
document.addEventListener("focusin", e => {
  const el = e.target;
  if (el.matches?.("input[inputmode=decimal], input[inputmode=numeric]") && el.value) setTimeout(() => el.select(), 0);
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
  document.documentElement.dataset.skin = S.skin === "cookie" ? "cookie" : "green";
  if (!S.profile) ui.view = "setup";
  if (ui.view !== "setup") ui.onPick = null;
  const [view, mount] = VIEWS[ui.view];
  const root = $("#view");
  root.className = "app" + (ui.view === "setup" ? " plain" : "");
  root.innerHTML = view() + footer();
  $("#tabs").hidden = ui.view === "setup";
  renderTabs();
  mount?.();
  // ссылка «Отправить мою норму»
  if (S.profile && location.hash.startsWith("#norm=") && $("#sheet").hidden) {
    const n = parseNormHash();
    history.replaceState(null, "", location.pathname);
    if (n) incomingNormSheet(n); else toast("Ссылка с нормой повреждена");
  }
  // ссылка «Поделиться едой» (приём или день)
  if (S.profile && location.hash.startsWith("#food=") && $("#sheet").hidden) {
    const data = parseFoodHash();
    history.replaceState(null, "", location.pathname);
    if (data) incomingFoodSheet(data); else toast("Ссылка на еду повреждена");
  }
  // ссылка «Поделиться рецептом»
  if (S.profile && location.hash.startsWith("#recipe=") && $("#sheet").hidden) {
    const data = parseRecipeHash();
    history.replaceState(null, "", location.pathname);
    if (data) incomingRecipeSheet(data); else toast("Ссылка на рецепт повреждена");
  }
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  ui.installPrompt = e;
  if ($("#sheet").hidden && (ui.view === "diary" || ui.view === "setup")) render();
});
// ссылка с рецептом или нормой открыта, когда Хрум уже был открыт
window.addEventListener("hashchange", () => {
  if (/^#(recipe|norm|food)=/.test(location.hash)) { closeSheet(); render(); }
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
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
  // Новая версия взяла управление — перезагружаемся один раз, чтобы сразу её показать.
  // Если открыто окно (что-то вводят) — не мешаем, просим перезапустить.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    if ($("#sheet").hidden && ui.view !== "setup") { reloaded = true; location.reload(); }
    else toast("Хрум обновился — закрой и открой его, чтобы увидеть новое");
  });
}

render();
