"use strict";
/* ================= Корзина: бюджет на неделю → меню под норму и список покупок =================
   Цены и упаковки — prices.js (BASKET_DATA). Блюда собраны из «ролей» (куриное филе, гречка…):
   под каждую роль берётся товар магазина. Порции блюда масштабируются под норму каждого человека
   (доли приёмов 25/35/30/10 %), граммы за неделю складываются, товары округляются до целых упаковок.
   Сначала пробуем товары подороже и все блюда; не влезает в бюджет — дешевле, потом только дешёвые блюда. */

// [id, название, приём, уровень (1 — недорогое, 2 — подороже), [[роль, г сырого на базовую порцию]], как готовить]
// базовая порция — примерно на человека с нормой ~2000 ккал; дальше Хрум масштабирует под норму
const DISHES = [
  ["omelet", "Омлет с помидорами и хлебом", "breakfast", 1, [["eggs", 165], ["milk", 50], ["tomato", 120], ["bread", 50], ["oil", 5]], "Яйца взбить с молоком, жарить под крышкой; помидоры — дольками."],
  ["oatmeal", "Овсянка на молоке с бананом и творогом", "breakfast", 1, [["oats", 50], ["milk", 200], ["banana", 100], ["tvorog", 120]], "Хлопья варить в молоке 5 минут, сверху банан, творог — рядом или в кашу."],
  ["tvorog", "Творог со сметаной и ягодами", "breakfast", 1, [["tvorog", 200], ["sourcream", 30], ["berries", 100], ["bread", 30]], "Ягоды разморозить с вечера."],
  ["syrniki", "Сырники со сметаной", "breakfast", 1, [["tvorog", 250], ["eggs", 55], ["oats", 40], ["sourcream", 30], ["oil", 10]], "Овсянку смолоть или взять мелкую; жарить на среднем огне."],
  ["eggsand", "Яичница и бутерброды с сыром", "breakfast", 2, [["eggs", 110], ["bread", 60], ["cheese", 30], ["cucumber", 120]], ""],
  ["yogbowl", "Греческий йогурт с бананом и овсянкой", "breakfast", 2, [["yogurt", 200], ["banana", 120], ["oats", 40]], "Хлопья можно не варить — залить йогуртом с вечера."],

  ["chkbuck", "Курица с гречкой и салатом", "main", 1, [["chicken", 180], ["buckwheat", 60], ["cucumber", 100], ["tomato", 100], ["oil", 10]], "Филе запечь или обжарить, гречку отварить."],
  ["plov", "Плов с курицей", "main", 1, [["thigh", 170], ["rice", 65], ["carrot", 80], ["onion", 50], ["oil", 10]], "Мясо, лук и морковь обжарить, засыпать рис, залить водой на 2 пальца, 25 минут под крышкой."],
  ["flot", "Макароны по-флотски и салат из капусты", "main", 1, [["beefmince", 140], ["pasta", 70], ["onion", 40], ["cabbage", 120], ["carrot", 30], ["oil", 5]], "Фарш обжарить с луком, смешать с макаронами; капусту и морковь натереть."],
  ["meatball", "Тефтели в томате с булгуром", "main", 1, [["mince", 180], ["bulgur", 60], ["onion", 30], ["tomato", 120], ["oil", 5]], "Тефтели тушить в тёртых помидорах 20 минут."],
  ["pollock", "Белая рыба с картошкой в духовке", "main", 1, [["whitefish", 250], ["potato", 200], ["onion", 40], ["sourcream", 30], ["oil", 5]], "Картошку кружками, сверху рыба, лук и сметана; 35 минут при 200°."],
  ["salmon", "Горбуша с рисом и брокколи", "main", 2, [["redfish", 170], ["rice", 60], ["frozenveg", 150]], "Рыбу запечь 20 минут при 200°, овощи — на пару."],
  ["goulash", "Гуляш из говядины с гречкой", "main", 2, [["beef", 170], ["buckwheat", 60], ["onion", 50], ["carrot", 50], ["tomato", 80], ["oil", 5]], "Тушить мясо с овощами 1–1,5 часа."],
  ["porkcab", "Свинина с тушёной капустой и картофелем", "main", 1, [["pork", 160], ["cabbage", 200], ["potato", 150], ["carrot", 50], ["onion", 30], ["oil", 5]], "Всё нарезать и тушить вместе 40 минут."],
  ["liver", "Печень с луком и гречкой", "main", 1, [["liver", 180], ["onion", 60], ["buckwheat", 60], ["sourcream", 30], ["oil", 5]], "Печень обжарить 3–4 минуты с луком, потушить в сметане 5 минут."],
  ["lentsoup", "Суп с чечевицей и курицей", "main", 1, [["lentils", 50], ["chicken", 130], ["potato", 100], ["carrot", 50], ["onion", 30], ["oil", 5], ["bread", 40]], "Курицу варить 20 минут, добавить чечевицу и овощи ещё на 20."],
  ["tunapasta", "Паста с тунцом и помидорами", "main", 1, [["tuna", 150], ["pasta", 70], ["tomato", 150], ["oil", 5]], "Помидоры потушить 5 минут, добавить тунец и макароны."],
  ["turkeyrice", "Индейка с овощами и рисом", "main", 2, [["turkey", 180], ["rice", 60], ["frozenveg", 200], ["oil", 5]], "Индейку кусочками обжарить, добавить овощи на 10 минут."],
  ["thighbake", "Куриные бёдра с картошкой в духовке", "main", 1, [["thigh", 180], ["potato", 200], ["carrot", 60], ["onion", 40], ["oil", 5]], "Всё в форму, 40 минут при 200°."],
  ["cutlets", "Куриные котлеты с макаронами и огурцом", "main", 1, [["mince", 180], ["oats", 15], ["pasta", 60], ["cucumber", 120], ["oil", 5]], "В фарш — овсяные хлопья вместо хлеба; жарить или запечь."],

  ["kefirban", "Кефир и банан", "snack", 1, [["kefir", 250], ["banana", 100]], ""],
  ["yogberry", "Йогурт с ягодами", "snack", 2, [["yogurt", 150], ["berries", 80]], ""],
  ["tvorapple", "Творог с яблоком", "snack", 1, [["tvorog", 150], ["apple", 150]], ""],
  ["applesand", "Яблоко и бутерброд с сыром", "snack", 2, [["apple", 150], ["bread", 30], ["cheese", 20]], ""],
].map(([id, name, meal, tier, ing, how]) => ({ id, name, meal, tier, ing, how }));

const BASKET_MEALS = [["breakfast", "Завтрак"], ["lunch", "Обед"], ["dinner", "Ужин"], ["snack", "Перекус"]];
const BASKET_DEPTS = [["meat", "Мясо и птица"], ["fish", "Рыба"], ["dairy", "Молочное и яйца"], ["grain", "Крупы, макароны, хлеб"],
  ["veg", "Овощи"], ["fruit", "Фрукты и ягоды"], ["other", "Прочее"]];
const BUDGETS = [5000, 10000, 12000];
// от «получше» к «подешевле»: какой по цене товар брать в роли (доля списка) и можно ли блюда подороже
const BASKET_LEVELS = [[0.8, 2], [0.5, 2], [0.25, 2], [0, 2], [0, 1]];
const rub = n => r0(n).toLocaleString("ru-RU") + " ₽";

const hasBasketData = () => typeof BASKET_DATA !== "undefined";
const roleItems = role => (hasBasketData() && BASKET_DATA.items[role]) || [];
// [название, обычная цена, цена сейчас, г в упаковке (весовое — 1000), шаг весового г или 0, ккал, Б, Ж, У]
const itemNut = it => ({ kcal: it[5], p: it[6], f: it[7], c: it[8] });
// Табличное КБЖУ роли — среднее по товарам (для расчёта порций до выбора товара)
function roleNut(role) {
  const xs = roleItems(role);
  const n = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const it of xs) for (const k of KEYS) n[k] += itemNut(it)[k] / xs.length;
  return n;
}
// Сколько заплатить за нужные граммы: целые упаковки; весовое — шагом it[4] (100 г, сетка или кочан целиком)
function itemCost(it, grams) {
  if (it[4]) { const g = Math.max(1, Math.ceil(grams / it[4] - 0.05)) * it[4]; return { packs: g / 1000, cost: it[1] * g / 1000, grams: g }; }
  const packs = Math.max(1, Math.ceil(grams / it[3] - 0.05)); // 5 % запаса: 930 г кефира на 950 г нужды хватит
  return { packs, cost: packs * it[1], grams: packs * it[3] };
}
function pickItem(role, grams, level) {
  let xs = roleItems(role).map(it => ({ it, ...itemCost(it, grams) })).sort((a, b) => a.cost - b.cost);
  // не 21 баночка по 140 г, если есть упаковки крупнее: не больше 6 штук или полутора от самого малого числа
  const fewest = Math.min(...xs.map(x => x.it[4] ? 1 : x.packs));
  const sane = xs.filter(x => x.it[4] || x.packs <= Math.max(6, fewest * 1.5));
  if (sane.length) xs = sane;
  return xs[Math.min(xs.length - 1, Math.floor(level * (xs.length - 1) + 1e-9))];
}

function rng(seed) { // mulberry32 — «Другие блюда» дают новый набор, но тот же seed — тот же набор
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const dishOk = d => d.ing.every(([r]) => roleItems(r).length);
function dishNut(d) {
  const n = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const [r, g] of d.ing) { const x = roleNut(r); for (const k of KEYS) n[k] += x[k] * g / 100; }
  return n;
}
function dishCost(d) { // ₽ за базовую порцию по самому дешёвому за 100 г — только чтобы упорядочить блюда
  return d.ing.reduce((s, [r, g]) => s + Math.min(...roleItems(r).map(it => it[1] / it[3])) * g, 0);
}

// Выбор блюд: разные «главные» продукты у обедов-ужинов, в дешёвом режиме — сначала дешёвые
function chooseDishes(meal, count, maxTier, seed, no, cheap) {
  const rand = rng(seed + meal.length * 7919);
  let pool = DISHES.filter(d => d.meal === meal && d.tier <= maxTier && dishOk(d));
  const allowed = pool.filter(d => !no.includes(d.id));
  if (allowed.length) pool = allowed;
  pool = pool.map(d => ({ d, k: rand() })).sort((a, b) => a.k - b.k).map(x => x.d);
  if (cheap) pool.sort((a, b) => dishCost(a) - dishCost(b));
  const out = [], mains = new Set();
  for (const d of pool) if (out.length < count && !mains.has(d.ing[0][0])) { out.push(d); mains.add(d.ing[0][0]); }
  for (const d of pool) if (out.length < count && !out.includes(d)) out.push(d);
  while (out.length && out.length < count) out.push(out[out.length % pool.length]);
  return out;
}

function basketPeople() {
  const me = targets();
  const ppl = [{ name: "Ты", kcal: me.kcal, p: me.p, f: me.f, c: me.c, me: true }];
  if (S.basketOpts?.two && S.partner) { // у второго известна только норма калорий — Б/Ж/У в тех же долях
    const k = S.partner.kcal / me.kcal;
    ppl.push({ name: S.partner.name, kcal: S.partner.kcal, p: me.p * k, f: me.f * k, c: me.c * k });
  }
  return ppl;
}

function planWeek(budget, seed, no) {
  const people = basketPeople();
  const start = dayKey();
  let res = null;
  for (const [level, maxTier] of BASKET_LEVELS) {
    const cheap = maxTier === 1;
    const br = chooseDishes("breakfast", 3, maxTier, seed, no, cheap);
    const mains = chooseDishes("main", 7, maxTier, seed, no, cheap);
    const sn = chooseDishes("snack", 2, maxTier, seed, no, cheap);
    if (!br.length || !mains.length || !sn.length) return null;
    // обед дня = ужин вчерашнего (готовим вечером на два раза); первый обед — блюдо последнего ужина недели
    const days = Array.from({ length: 7 }, (_, d) => ({
      day: shiftDay(start, d),
      meals: { breakfast: br[d % br.length], lunch: mains[d], dinner: mains[(d + 1) % 7], snack: sn[d % sn.length] },
    }));
    const need = {}, eat = people.map(() => ({ kcal: 0, p: 0, f: 0, c: 0 }));
    const portions = {}; // «день|приём» → [коэффициент на каждого]
    for (const { day, meals } of days) {
      for (const [m] of BASKET_MEALS) {
        const dish = meals[m], base = dishNut(dish).kcal;
        const ks = people.map(p => Math.min(2.2, Math.max(0.5, p.kcal * MEAL_SHARE[m] / base)));
        portions[day + "|" + m] = ks;
        for (const [r, g] of dish.ing) need[r] = (need[r] || 0) + g * ks.reduce((a, b) => a + b, 0);
      }
    }
    const items = {};
    let cost = 0;
    for (const r in need) { const x = pickItem(r, need[r], level); items[r] = { ...x, need: need[r] }; cost += x.cost; }
    // съедено за неделю — по КБЖУ выбранных товаров
    for (const { day, meals } of days) for (const [m] of BASKET_MEALS) {
      portions[day + "|" + m].forEach((k, i) => {
        for (const [r, g] of meals[m].ing) { const n = itemNut(items[r].it); for (const key of KEYS) eat[i][key] += n[key] * g * k / 100; }
      });
    }
    res = { budget, seed, cost, start, level, cheap, people: people.map((p, i) => ({ ...p, eat: eat[i] })),
      days: days.map(d => ({ day: d.day, meals: Object.fromEntries(BASKET_MEALS.map(([m]) => [m, d.meals[m].id])) })),
      portions, items: Object.fromEntries(Object.entries(items).map(([r, x]) => [r, { name: x.it[0], price: x.it[1], pack: x.it[3], kg: !!x.it[4],
        packs: x.packs, cost: x.cost, grams: x.grams, need: x.need, nut: itemNut(x.it) }])) };
    if (cost <= budget) return res;
  }
  res.over = true; // даже самое простое не влезает — показываем его и сколько не хватает
  return res;
}

/* ---------- Экран ---------- */

function viewBasket() {
  if (!hasBasketData()) return `<header class="top"><h1>Корзина</h1></header><p class="note">Цены ещё не загружены — обнови Хрум.</p>`;
  const o = S.basketOpts ||= { budget: 10000, two: !!S.partner };
  const b = S.basket;
  const custom = !BUDGETS.includes(o.budget);
  const form = `<section class="card form">
      <div class="field"><span>Бюджет на неделю</span>
        <div class="chips">${BUDGETS.map(v => `<button class="chip" data-a="bkBudget" data-v="${v}" aria-pressed="${o.budget === v}">${rub(v)}</button>`).join("")}</div>
        <input id="bkSum" class="input" inputmode="numeric" placeholder="Своя сумма, ₽" value="${custom ? o.budget : ""}"></div>
      <div class="field"><span>На кого</span>
        <div class="seg"><button data-a="bkTwo" data-v="0" aria-pressed="${!o.two}">Только я</button>
          <button data-a="bkTwo" data-v="1" aria-pressed="${!!o.two}">${S.partner ? `Я и ${esc(S.partner.name)}` : "Нас двое"}</button></div></div>
      ${o.two && !S.partner ? `<p class="note">Укажи второго человека и его норму в Профиле — тогда Хрум посчитает порции на двоих.</p>` : ""}
      <div class="field"><span>Магазин</span>
        <div class="chips"><button class="chip" aria-pressed="true">Перекрёсток</button>
          <button class="chip" disabled>Пятёрочка · скоро</button><button class="chip" disabled>Глобус · скоро</button></div></div>
      <button class="btn" data-a="bkBuild">${b ? "Собрать заново" : "Собрать корзину"}</button>
    </section>`;
  return `<header class="top"><h1>Корзина</h1><span class="muted small">меню на неделю под норму</span></header>
    ${form}${b ? basketResult(b) : `<p class="muted small">Хрум подберёт блюда на 7 дней под ${o.two && S.partner ? "ваши нормы" : "твою норму"} и составит список покупок по ценам Перекрёстка.</p>`}`;
}

function basketResult(b) {
  const dish = id => DISHES.find(d => d.id === id);
  const left = b.budget - b.cost;
  const pct = (a, t) => r0(a / (t * 7) * 100);
  const ppl = b.people.map(p => `<div class="kv"><span>${esc(p.name)}: ккал ${pct(p.eat.kcal, p.kcal)}% · белок ${pct(p.eat.p, p.p)}%</span>
      <b>${r0(p.eat.kcal / 7)} ккал/день</b></div>`).join("");
  const lowP = b.people.some(p => p.eat.p < p.p * 7 * 0.85);
  const summary = `<section class="card bk-sum">
      <div class="stats">
        <div class="stat"><b>${rub(b.cost)}</b><span>корзина на 7 дней</span></div>
        <div class="stat"><b class="${left < 0 ? "over-txt" : ""}">${left < 0 ? "−" : ""}${rub(Math.abs(left))}</b><span>${left < 0 ? "не хватает до бюджета" : "остаётся от бюджета"}</span></div>
        <div class="stat"><b>${rub(b.cost / 7 / b.people.length)}</b><span>в день на человека</span></div>
      </div>
      <hr class="rule">${ppl}
      ${b.over ? `<p class="note">Даже самые простые блюда не помещаются в ${rub(b.budget)}. Это самый недорогой вариант — проще всего добавить к бюджету ${rub(-left)} или убрать перекусы.</p>`
        : left > b.budget * 0.15 ? `<p class="muted small">Взяты товары получше, и всё равно остаётся запас — хватит на чай, специи и фрукты сверх плана.</p>`
        : b.cheap ? `<p class="muted small">Чтобы уложиться, Хрум выбрал недорогие товары и простые блюда.</p>` : ""}
      ${lowP ? `<p class="muted small">Белка выходит меньше нормы — добавь творог или яйца в перекусы.</p>` : ""}
      <div class="btn-row"><button class="btn ghost" data-a="bkReroll">Другие блюда</button><button class="btn ghost" data-a="bkClear">Очистить</button></div>
    </section>`;

  const menu = b.days.map((d, i) => `<article class="meal">
      <div class="meal-head"><h3>${i === 0 ? "Сегодня" : daySub(d.day).replace(/^./, c => c.toUpperCase())}</h3></div>
      ${BASKET_MEALS.map(([m, t]) => {
        const x = dish(d.meals[m]);
        if (!x) return "";
        const left = m === "lunch" && i > 0;
        return `<button class="item" data-a="bkDish" data-day="${d.day}" data-meal="${m}">
          <span class="n">${esc(x.name)}${left ? `<span class="tag">со вчера</span>` : ""}</span><span class="k">${t}</span></button>`;
      }).join("")}</article>`).join("");

  const checked = S.basketChecked || {};
  const byDept = BASKET_DEPTS.map(([dep, title]) => {
    const rows = Object.entries(b.items).filter(([r]) => BASKET_DATA.roles[r]?.[1] === dep);
    if (!rows.length) return "";
    return `<h3 class="bk-dept">${title}</h3>` + rows.map(([r, x]) => `<label class="bk-row ${checked[r] ? "done" : ""}">
        <input type="checkbox" data-role="${r}" ${checked[r] ? "checked" : ""}>
        <span class="n">${esc(x.name)}<small>${x.kg ? `${fmt(x.grams / 1000, 1)} кг` : `${x.packs} × ${x.pack >= 1000 ? fmt(x.pack / 1000, 2) + " кг" : x.pack + " г"}`}
          · нужно ${x.need >= 1000 ? fmt(x.need / 1000, 1) + " кг" : r0(x.need / 10) * 10 + " г"}${!x.kg && x.grams > x.need * 1.8 ? " · останется" : ""}</small></span>
        <span class="k">${rub(x.cost)}</span></label>`).join("");
  }).join("");

  return `${summary}
    <div class="section-title"><h2>Меню</h2><span>нажми блюдо — граммы и рецепт</span></div>
    ${menu}
    <div class="section-title"><h2>Список покупок</h2><span>${Object.keys(b.items).length} позиций</span></div>
    <section class="card bk-list">${byDept}</section>
    <p class="muted small">Цены ${esc(BASKET_DATA.store)} на ${shortDate(BASKET_DATA.date)}, обычные — без скидок и карты. В магазине могут немного отличаться.
      Масло, крупы и специи обычно остаются на следующую неделю.</p>`;
}

function basketDishSheet(day, meal) {
  const b = S.basket, d = b.days.find(x => x.day === day);
  const dish = DISHES.find(x => x.id === d.meals[meal]);
  const ks = b.portions[day + "|" + meal];
  const head = b.people.map(p => `<th>${esc(p.name)}</th>`).join("");
  const rows = dish.ing.map(([r, g]) => `<tr><td>${esc(BASKET_DATA.roles[r][0])}</td>${ks.map(k => `<td>${r0(g * k / 5) * 5} г</td>`).join("")}</tr>`).join("");
  const kc = ks.map(k => dish.ing.reduce((s, [r, g]) => s + b.items[r].nut.kcal * g * k / 100, 0));
  openSheet(`<h2>${esc(dish.name)}</h2>
    <p class="muted small">${daySub(day)} · ${BASKET_MEALS.find(x => x[0] === meal)[1].toLowerCase()} · вес продуктов сырыми</p>
    <table class="bk-table"><tr><th></th>${head}</tr>${rows}
      <tr class="sum"><td>Ккал</td>${kc.map(x => `<td>${r0(x)}</td>`).join("")}</tr></table>
    ${dish.how ? `<p class="small">${esc(dish.how)}</p>` : ""}
    ${day >= dayKey() && day <= shiftDay(dayKey(), PLAN_DAYS) ? `<button class="btn" data-a="bkToDiary" data-day="${day}" data-meal="${meal}">Записать мою порцию в дневник</button>` : ""}
    <button class="btn ghost" data-a="bkNo" data-id="${dish.id}">Не предлагать это блюдо</button>`);
}

function mountBasket() {
  const inp = $("#bkSum");
  inp?.addEventListener("change", () => {
    const v = num(inp.value);
    if (v && v >= 500 && v <= 200000) { S.basketOpts.budget = r0(v); save(); render(); }
    else if (inp.value) toast("Сумма — от 500 до 200 000 ₽");
  });
  document.querySelectorAll(".bk-list input[type=checkbox]").forEach(cb => cb.addEventListener("change", () => {
    (S.basketChecked ||= {})[cb.dataset.role] = cb.checked;
    cb.closest(".bk-row").classList.toggle("done", cb.checked);
    save();
  }));
}

function buildBasket(seed) {
  const sum = num($("#bkSum")?.value);
  if (sum && sum >= 500 && sum <= 200000) S.basketOpts.budget = r0(sum);
  const res = planWeek(S.basketOpts.budget, seed, S.basketNo || []);
  if (!res) { toast("Не из чего собрать — все блюда скрыты"); return; }
  S.basket = res; S.basketChecked = {};
  save(); render();
  toast(res.over ? "Бюджета не хватает — показал самый недорогой вариант" : `Корзина: ${rub(res.cost)}`);
}

Object.assign(actions, {
  bkBudget(el) { S.basketOpts.budget = +el.dataset.v; save(); render(); },
  bkTwo(el) { S.basketOpts.two = el.dataset.v === "1"; save(); render(); },
  bkBuild() { buildBasket(S.basket?.seed || 1); },
  bkReroll() { buildBasket((S.basket?.seed || 1) + 1); },
  bkClear() { S.basket = null; S.basketChecked = {}; save(); render(); },
  bkDish(el) { basketDishSheet(el.dataset.day, el.dataset.meal); },
  bkNo(el) {
    S.basketNo = [...new Set([...(S.basketNo || []), el.dataset.id])];
    const name = DISHES.find(d => d.id === el.dataset.id).name;
    save(); closeSheet();
    buildBasket(S.basket?.seed || 1);
    toast(`«${name}» больше не предлагаю`);
  },
  bkToDiary(el) {
    const b = S.basket, { day, meal } = el.dataset;
    const dish = DISHES.find(x => x.id === b.days.find(x => x.day === day).meals[meal]);
    const k = b.portions[day + "|" + meal][0];
    const diaryMeal = meal === "snack" ? "snack" : meal;
    for (const [r, g] of dish.ing) {
      const x = b.items[r], grams = r0(g * k / 5) * 5, q = grams / 100;
      (S.entries[day] ||= []).push({ id: uid(), pid: null, name: x.name, meal: diaryMeal, grams,
        kcal: x.nut.kcal * q, p: x.nut.p * q, f: x.nut.f * q, c: x.nut.c * q });
    }
    save(); closeSheet();
    toast(`${dish.name} — в дневник на ${dayTitle(day).toLowerCase()}`);
  },
});
VIEWS.basket = [viewBasket, mountBasket];
