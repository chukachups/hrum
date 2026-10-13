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
  // готовая еда (роли r…) есть только во ВкусВилле — блюда появляются, когда он выбран
  ["vvbreak", "Готовые сырники, запеканка или омлет и яблоко", "breakfast", 2, [["rbreak", 200], ["apple", 150]], "Сырники и запеканку разогреть 1–2 минуты или съесть холодными."],

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
  ["vvmeal", "Готовое второе с гарниром и свежие овощи", "main", 2, [["rmeal", 300], ["cucumber", 100], ["tomato", 100]], "Разогреть в микроволновке 2–3 минуты, овощи нарезать."],
  ["vvcutbuck", "Готовые котлеты с гречкой и огурцом", "main", 2, [["rcutlet", 160], ["buckwheat", 60], ["cucumber", 120]], "Котлеты только разогреть, гречку отварить."],
  ["vvcutpasta", "Готовые котлеты с макаронами и салатом из капусты", "main", 2, [["rcutlet", 160], ["pasta", 60], ["cabbage", 120], ["carrot", 30], ["oil", 5]], "Котлеты разогреть, капусту и морковь натереть."],
  ["vvsoup", "Готовый суп и бутерброды с сыром", "main", 2, [["rsoup", 390], ["bread", 60], ["cheese", 40]], "Суп разогреть."],

  ["kefirban", "Кефир и банан", "snack", 1, [["kefir", 250], ["banana", 100]], ""],
  ["yogberry", "Йогурт с ягодами", "snack", 2, [["yogurt", 150], ["berries", 80]], ""],
  ["tvorapple", "Творог с яблоком", "snack", 1, [["tvorog", 150], ["apple", 150]], ""],
  ["applesand", "Яблоко и бутерброд с сыром", "snack", 2, [["apple", 150], ["bread", 30], ["cheese", 20]], ""],
].map(([id, name, meal, tier, ing, how]) => ({ id, name, meal, tier, ing, how }));

const BASKET_MEALS = [["breakfast", "Завтрак"], ["lunch", "Обед"], ["dinner", "Ужин"], ["snack", "Перекус"]];
const BASKET_DEPTS = [["meat", "Мясо и птица"], ["fish", "Рыба"], ["dairy", "Молочное и яйца"], ["grain", "Крупы, макароны, хлеб"],
  ["veg", "Овощи"], ["fruit", "Фрукты и ягоды"], ["ready", "Готовая еда"], ["other", "Прочее"]];
const BUDGETS = [5000, 10000, 12000];
// от «получше» к «подешевле»: какой по цене товар брать в роли (доля списка) и можно ли блюда подороже
const BASKET_LEVELS = [[0.8, 2], [0.5, 2], [0.25, 2], [0, 2], [0, 1]];
const rub = n => r0(n).toLocaleString("ru-RU") + " ₽";

const hasBasketData = () => typeof BASKET_DATA !== "undefined";
// Выбранные магазины (можно несколько — для каждой позиции берётся товар из любого из них).
// Старые настройки и корзины знали один магазин (store) — читаем и их
let storeOverride = null;
function basketStores() {
  const ok = xs => (xs || []).filter(k => BASKET_DATA.stores[k]);
  const o = S.basketOpts || {};
  const xs = ok(storeOverride).length ? ok(storeOverride) : ok(o.stores).length ? ok(o.stores) : ok([o.store]);
  return xs.length ? xs : [Object.keys(BASKET_DATA.stores)[0]];
}
const planStores = b => b.stores || [b.store];
const storeInfo = key => BASKET_DATA.stores[key] || BASKET_DATA.stores.perekrestok || Object.values(BASKET_DATA.stores)[0];
const storeNames = keys => keys.map(k => storeInfo(k).name).join(" + ");
// товары роли из всех выбранных магазинов; в конце каждого — ключ магазина
const roleCache = {};
function roleItems(role) {
  if (!hasBasketData()) return [];
  const keys = basketStores(), id = keys.join(",") + "|" + role;
  return roleCache[id] ||= keys.flatMap(k => (BASKET_DATA.stores[k].items[role] || []).map(it => [...it, k]));
}
// [название, обычная цена, цена сейчас, г в упаковке (весовое — 1000), шаг весового г или 0, ккал, Б, Ж, У, магазин]
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
  // готовая еда заменяет белковое блюдо — у неё «получше» значит больше белка за те же деньги, а не просто дороже
  if (BASKET_DATA.roles[role]?.[1] === "ready") {
    xs.sort((a, b) => a.cost / a.it[6] - b.cost / b.it[6]);
    level = Math.min(level, 0.25); // дальше по списку — дорогие блюда, где за те же деньги белка меньше
  }
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
// блюдо из готовой еды (роли отдела «ready» — есть только во ВкусВилле)
const isReady = d => d.ing.some(([r]) => BASKET_DATA.roles[r]?.[1] === "ready");
const readyOn = () => !!S.basketOpts?.ready && DISHES.some(d => isReady(d) && dishOk(d));
function dishNut(d) {
  const n = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const [r, g] of d.ing) { const x = roleNut(r); for (const k of KEYS) n[k] += x[k] * g / 100; }
  return n;
}
function dishCost(d) { // ₽ за базовую порцию по самому дешёвому за 100 г — только чтобы упорядочить блюда
  return d.ing.reduce((s, [r, g]) => s + Math.min(...roleItems(r).map(it => it[1] / it[3])) * g, 0);
}

// Выбор блюд: разные «главные» продукты у обедов-ужинов, в дешёвом режиме — сначала дешёвые
// ready — «побольше готовой еды»: сколько готовых блюд поставить первыми (0 — как обычно); уровень блюд им не помеха
function chooseDishes(meal, count, maxTier, seed, no, cheap, ready) {
  const rand = rng(seed + meal.length * 7919);
  let pool = DISHES.filter(d => d.meal === meal && (d.tier <= maxTier || ready && isReady(d)) && dishOk(d));
  const allowed = pool.filter(d => !no.includes(d.id));
  if (allowed.length) pool = allowed;
  pool = pool.map(d => ({ d, k: rand() })).sort((a, b) => a.k - b.k).map(x => x.d);
  if (cheap) pool.sort((a, b) => dishCost(a) - dishCost(b));
  if (ready) pool = [...pool.filter(isReady).slice(0, ready), ...pool.filter(d => !isReady(d))]; // готовые блюда первыми
  const out = [], mains = new Set();
  // разные «главные» продукты; в режиме «побольше готовой еды» готовым блюдам повтор котлет не мешает
  for (const d of pool) if (out.length < count && (!mains.has(d.ing[0][0]) || ready && isReady(d))) { out.push(d); mains.add(d.ing[0][0]); }
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
  let res = null, readyCost = 0;
  // «побольше готовой еды» — чтобы не готовить: не влезает — простые блюда и 3, 2, 1 готовых, но не ноль
  // (лучше показать, сколько не хватает, чем молча вернуть готовку)
  const full = readyOn() ? Infinity : 0;
  const tries = BASKET_LEVELS.map(([level, maxTier]) => [level, maxTier, full]);
  if (full) tries.splice(-1, 1, ...[full, 3, 2, 1].map(n => [0, 1, n]));
  for (const [level, maxTier, ready] of tries) {
    const cheap = maxTier === 1;
    const br = chooseDishes("breakfast", 3, maxTier, seed, no, cheap, ready);
    const mains = chooseDishes("main", 7, maxTier, seed, no, cheap, ready);
    const sn = chooseDishes("snack", 2, maxTier, seed, no, cheap, ready);
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
    for (const r in need) items[r] = pickItem(r, need[r], level);
    // порции считались по средней калорийности роли; у выбранного товара она другая (у готовой еды — заметно) —
    // пересчитываем порции по нему и докупаем упаковки под новые граммы
    for (const r in need) need[r] = 0;
    for (const { day, meals } of days) for (const [m] of BASKET_MEALS) {
      const dish = meals[m], base = dish.ing.reduce((s, [r, g]) => s + itemNut(items[r].it).kcal * g / 100, 0);
      const ks = people.map(p => Math.min(2.2, Math.max(0.5, p.kcal * MEAL_SHARE[m] / base)));
      portions[day + "|" + m] = ks;
      for (const [r, g] of dish.ing) need[r] += g * ks.reduce((a, b) => a + b, 0);
    }
    for (const r in need) { items[r] = { ...items[r], ...itemCost(items[r].it, need[r]), need: need[r] }; cost += items[r].cost; }
    // съедено за неделю — по КБЖУ выбранных товаров
    for (const { day, meals } of days) for (const [m] of BASKET_MEALS) {
      portions[day + "|" + m].forEach((k, i) => {
        for (const [r, g] of meals[m].ing) { const n = itemNut(items[r].it); for (const key of KEYS) eat[i][key] += n[key] * g * k / 100; }
      });
    }
    res = { budget, seed, cost, start, level, cheap, stores: basketStores(), people: people.map((p, i) => ({ ...p, eat: eat[i] })),
      days: days.map(d => ({ day: d.day, meals: Object.fromEntries(BASKET_MEALS.map(([m]) => [m, d.meals[m].id])) })),
      portions, items: Object.fromEntries(Object.entries(items).map(([r, x]) => [r, { name: x.it[0], price: x.it[1], pack: x.it[3], kg: !!x.it[4], step: x.it[4],
        store: x.it[9], packs: x.packs, cost: x.cost, grams: x.grams, need: x.need, nut: itemNut(x.it) }])) };
    if (ready === Infinity) readyCost = cost;
    else if (full) { res.readyCut = true; res.readyCost = readyCost; } // готовой еды меньше, чем просили
    if (cost <= budget) return res;
  }
  res.over = true; // даже самое простое не влезает — показываем его и сколько не хватает
  return res;
}

/* ---------- План в дневнике ---------- */
// В пустом приёме дневника — блюдо из корзины на этот день: записать свою порцию одним нажатием
function planHint(day, meal) {
  const b = S.basket, d = b && b.days.find(x => x.day === day);
  const dish = d && DISHES.find(x => x.id === d.meals[meal]);
  if (!dish || !b.portions[day + "|" + meal]) return "";
  return `<button class="garnish-hint" data-a="bkToDiary" data-day="${day}" data-meal="${meal}">По плану: ${esc(dish.name)} — записать мою порцию</button>`;
}

/* ---------- Меню на двоих: отправить второму человеку ---------- */
// Ссылка #plan= несёт меню, порции обоих и товары. У получателя люди меняются местами: он — «Ты»
function planLink() {
  const b = S.basket, r2 = x => Math.round(x * 100) / 100;
  return location.origin + location.pathname + "#plan=" + packLink({
    s: planStores(b), b: b.budget, c: r0(b.cost), o: b.over ? 1 : 0, kc: b.people.map(x => r0(x.kcal)),
    d: b.days.map(d => [d.day, ...BASKET_MEALS.map(([m]) => d.meals[m])]),
    k: b.days.map(d => BASKET_MEALS.map(([m]) => (b.portions[d.day + "|" + m] || []).map(r2))),
    i: Object.fromEntries(Object.entries(b.items).map(([r, x]) => [r, [x.name, x.price, x.pack, x.kg ? 1 : 0, x.packs, r0(x.cost),
      r0(x.grams), r0(x.need), ...KEYS.map(key => r2(x.nut[key])), x.store || planStores(b)[0]]])),
  });
}
function parsePlanHash() {
  const m = location.hash.match(/^#plan=([\w-]+)$/);
  if (!m) return null;
  try {
    const d = unpackLink(m[1]);
    const meals = BASKET_MEALS.map(x => x[0]);
    if (!Array.isArray(d.d) || d.d.length !== 7 || d.kc.length !== 2) return null;
    const days = d.d.map(([day, ...ids]) => ({ day, meals: Object.fromEntries(meals.map((mm, j) => [mm, ids[j]])) }));
    if (days.some(x => !/^\d{4}-\d\d-\d\d$/.test(x.day) || meals.some(mm => !DISHES.find(z => z.id === x.meals[mm])))) return null;
    const portions = {};
    days.forEach((x, i) => meals.forEach((mm, j) => { portions[x.day + "|" + mm] = d.k[i][j].slice().reverse(); }));
    const items = Object.fromEntries(Object.entries(d.i).map(([r, v]) => [r, { name: String(v[0]).slice(0, 160), price: +v[1], pack: +v[2], kg: !!v[3],
      packs: +v[4], cost: +v[5], grams: +v[6], need: +v[7], nut: { kcal: +v[8], p: +v[9], f: +v[10], c: +v[11] },
      store: String(v[12] || [].concat(d.s)[0]) }]));
    return { stores: [].concat(d.s).map(String), budget: +d.b, cost: +d.c, over: !!d.o, kcalFor: d.kc[1], kcalFrom: d.kc[0], days, portions, items };
  } catch (e) {
    return null;
  }
}
// Съедено за неделю по порциям — для получателя пересчитываем сами
function planEat(days, portions, items, n) {
  const eat = Array.from({ length: n }, () => ({ kcal: 0, p: 0, f: 0, c: 0 }));
  for (const { day, meals } of days) for (const [m] of BASKET_MEALS) {
    const dish = DISHES.find(x => x.id === meals[m]);
    (portions[day + "|" + m] || []).forEach((k, i) => {
      for (const [r, g] of dish.ing) for (const key of KEYS) eat[i][key] += (items[r]?.nut[key] || 0) * g * k / 100;
    });
  }
  return eat;
}
function incomingPlanSheet(pl) {
  ui.incomingPlan = pl;
  const mine = r0(targets().kcal), diff = Math.abs(mine - pl.kcalFor) / mine > 0.05;
  const span = `${shortDate(pl.days[0].day)} – ${shortDate(pl.days[6].day)}`;
  openSheet(`<h2>Тебе прислали меню на неделю</h2>
    <p>${span} · ${esc(storeNames(pl.stores))} · ≈ ${rub(pl.cost)} на двоих.</p>
    <p class="muted small">Твои порции посчитаны под ${pl.kcalFor} ккал в день. В дневнике у каждого приёма появится «По плану…» —
      записывать еду можно одним нажатием. Список покупок тоже будет у тебя.</p>
    ${diff ? `<p class="note">Твоя норма сейчас ${mine} ккал — порции немного разойдутся. Отправь свою норму (Профиль → «Отправить мою норму»),
      и пусть меню пришлют заново.</p>` : ""}
    ${S.basket ? `<p class="muted small">Твоя текущая корзина заменится этой.</p>` : ""}
    <button class="btn" data-a="bkTakePlan">Взять это меню</button>
    <button class="btn ghost" data-a="closeSheet">Не сейчас</button>`);
}

/* ---------- Напоминание обновить цены ---------- */
// Цены — снимок с сайтов на день сбора; обновляются на компьютере (scrape/), сам Хрум этого не умеет.
// Через месяц напоминаем: в «Корзине» всегда, в дневнике — если «Корзиной» пользовались (скрыть на неделю)
const PRICE_MAX_DAYS = 30;
function stalePrices() {
  if (!hasBasketData()) return [];
  return Object.values(BASKET_DATA.stores).filter(st => st.date && daysSince(st.date) >= PRICE_MAX_DAYS);
}
function staleText(list) {
  const what = list.map(st => `${st.name} — от ${shortDate(st.date)}, ${daysSince(st.date)} ${plural(daysSince(st.date), ["день", "дня", "дней"])}`).join("; ");
  return `Цены в «Корзине» устарели: ${what}. В магазине всё может стоить иначе — корзина выйдет дороже или дешевле расчёта.
    Попроси обновить цены на компьютере (Claude: «обнови цены в Хруме»), потом обнови Хрум.`;
}
function pricesNote() {
  const list = stalePrices();
  if (!list.length || !S.basket) return "";
  if (S.pricesHide && daysSince(S.pricesHide) < 7) return "";
  return `<div class="card note-card"><b>Пора обновить цены</b>
    <span class="muted small">${staleText(list)}</span>
    <div class="btn-row"><button class="btn ghost" data-a="tab" data-v="basket">В Корзину</button><button class="btn ghost" data-a="hidePrices">Позже</button></div></div>`;
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
      ${o.two && !S.partner ? `<p class="note">Чтобы посчитать порции на двоих, Хруму нужна норма второго человека.</p>
        <button class="btn ghost" data-a="editPartner">Указать второго человека</button>` : ""}
      <div class="field"><span>Магазины — можно несколько</span>
        <div class="chips">${Object.entries(BASKET_DATA.stores).map(([k, st]) =>
          `<button class="chip" data-a="bkStore" data-v="${k}" aria-pressed="${basketStores().includes(k)}">${esc(st.name)}</button>`).join("")}</div>
        ${basketStores().length > 1 ? `<span class="muted small">Каждую позицию Хрум возьмёт там, где выгоднее; список покупок — по магазинам.</span>` : ""}</div>
      ${DISHES.some(d => isReady(d) && dishOk(d)) ? `<div class="field"><span>Готовая еда</span>
        <div class="seg"><button data-a="bkReady" data-v="0" aria-pressed="${!o.ready}">Немного</button>
          <button data-a="bkReady" data-v="1" aria-pressed="${!!o.ready}">Побольше</button></div>
        <span class="muted small">${o.ready ? "Примерно половина обедов и ужинов — готовые: только разогреть. Выходит дороже."
          : "Готовые блюда изредка, остальное готовится самому."}</span></div>` : ""}
      <button class="btn" data-a="bkBuild">${b ? "Собрать заново" : "Собрать корзину"}</button>
    </section>`;
  return `<header class="top"><h1>Корзина</h1><span class="muted small">меню на неделю под норму</span></header>
    ${stalePrices().length ? `<div class="card note-card"><b>Пора обновить цены</b><span class="muted small">${staleText(stalePrices())}</span></div>` : ""}
    ${form}${b ? basketResult(b) : `<p class="muted small">Хрум подберёт блюда на 7 дней под ${o.two && S.partner ? "ваши нормы" : "твою норму"} и составит список покупок по ценам выбранных магазинов.</p>`}`;
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
      ${b.readyCut ? `<p class="note">Готовой еды меньше, чем просили: на всю неделю с готовыми блюдами нужно примерно ${rub(b.readyCost)}.
          ${b.over ? `Даже так не хватает ${rub(-left)} — прибавь к бюджету или выбери «Немного».` : "Прибавь к бюджету — и готовить почти не придётся."}</p>` : ""}
      ${b.over && b.readyCut ? "" : b.over ? `<p class="note">Даже самые простые блюда не помещаются в ${rub(b.budget)}. Это самый недорогой вариант — проще всего добавить к бюджету ${rub(-left)} или убрать перекусы.</p>`
        : left > b.budget * 0.15 ? `<p class="muted small">Взяты товары получше, и всё равно остаётся запас — хватит на чай, специи и фрукты сверх плана.</p>`
        : b.cheap ? `<p class="muted small">Чтобы уложиться, Хрум выбрал недорогие товары и простые блюда.</p>` : ""}
      ${lowP ? `<p class="muted small">Белка выходит меньше нормы — добавь творог или яйца в перекусы.</p>` : ""}
      <div class="btn-row"><button class="btn ghost" data-a="bkReroll">Другие блюда</button><button class="btn ghost" data-a="bkClear">Очистить</button></div>
    </section>`;

  const today = dayKey(), past = b.days.filter(d => d.day < today);
  const shown = ui.bkPast ? b.days : b.days.filter(d => d.day >= today);
  const dayHead = d => d.day === today ? `Сегодня, ${daySub(d.day)}` : d.day === shiftDay(today, 1) ? `Завтра, ${daySub(d.day)}`
    : daySub(d.day).replace(/^./, c => c.toUpperCase());
  const menu = (past.length && shown.length ? `<button class="row-card dashed" data-a="bkPast">${ui.bkPast ? "Скрыть прошедшие дни"
      : `Прошедшие дни: ${past.length} — показать`}</button>` : "") + shown.map(d => `<article class="meal ${d.day === today ? "bk-today" : ""}">
      <div class="meal-head"><h3>${dayHead(d)}</h3></div>
      ${BASKET_MEALS.map(([m, t]) => {
        const x = dish(d.meals[m]);
        if (!x) return "";
        const left = m === "lunch" && d.day !== b.days[0].day;
        return `<button class="item" data-a="bkDish" data-day="${d.day}" data-meal="${m}">
          <span class="n">${esc(x.name)}${left ? `<span class="tag">со вчера</span>` : ""}</span><span class="k">${t}</span></button>`;
      }).join("")}</article>`).join("");

  const checked = S.basketChecked || {};
  const byDept = basketGroups(b).map(({ title, sub, rows }) => {
    return (title ? `<h3 class="bk-store">${esc(title)}<span>${rub(sub)}</span></h3>` : "") + rows.map(([dt, rs]) => `<h3 class="bk-dept">${dt}</h3>` + rs.map(([r, x]) => `<label class="bk-row ${checked[r] ? "done" : ""}">
        <input type="checkbox" data-role="${r}" ${checked[r] ? "checked" : ""}>
        <span class="n">${esc(x.name)}${x.added ? `<span class="tag">новое</span>` : ""}<small>${x.kg ? `${fmt(x.grams / 1000, 1)} кг` : `${x.packs} × ${x.pack >= 1000 ? fmt(x.pack / 1000, 2) + " кг" : x.pack + " г"}`}
          · нужно ${x.need >= 1000 ? fmt(x.need / 1000, 1) + " кг" : r0(x.need / 10) * 10 + " г"}${!x.kg && x.grams > x.need * 1.8 ? " · останется" : ""}</small></span>
        <span class="k">${rub(x.cost)}</span></label>`).join("")).join("");
  }).join("");

  const last = b.days[b.days.length - 1].day;
  const span = `${shortDate(b.days[0].day)} – ${shortDate(last)}`;
  const status = today > last
    ? `<div class="card note-card"><b>Неделя этой корзины закончилась (${span})</b>
        <span class="muted small">Собери новую — Хрум подберёт другие блюда на следующие 7 дней.</span>
        <button class="btn" data-a="bkBuild">Собрать на новую неделю</button></div>`
    : "";
  const dayNo = b.days.findIndex(d => d.day === today) + 1;
  return `${status}${summary}
    <div class="section-title"><h2>Меню</h2><span>${dayNo ? `день ${dayNo} из 7 · ` : ""}нажми блюдо — граммы и рецепт</span></div>
    ${menu || `<p class="muted small">Все дни этой корзины прошли.</p>`}
    <div class="section-title"><h2>Список покупок</h2><span>${Object.keys(b.items).length} позиций</span></div>
    <section class="card bk-list">${byDept}</section>
    <button class="row-card dashed" data-a="bkShare">${icon("share", 18)} Отправить список покупок</button>
    ${b.people.length > 1 ? `<button class="row-card dashed" data-a="bkSendPlan">${icon("share", 18)} Отправить меню с порциями на телефон: ${esc(b.people[1].name)}</button>` : ""}
    <p class="muted small">Цены: ${planStores(b).map(k => `${esc(storeInfo(k).name)}, ${shortDate(storeInfo(k).date)}`).join("; ")}, обычные — без скидок и карты. В магазине могут немного отличаться.
      Масло, крупы и специи обычно остаются на следующую неделю.</p>`;
}

const fmtG = g => g >= 1000 ? fmt(g / 1000, 2) + " кг" : r0(g / 10) * 10 + " г";

// Список покупок: по магазинам (если их несколько), внутри — по отделам
function basketGroups(b) {
  const def = planStores(b)[0];
  const used = [...new Set(Object.values(b.items).map(x => x.store || def))];
  const order = [...planStores(b).filter(k => used.includes(k)), ...used.filter(k => !planStores(b).includes(k))];
  return order.map(k => {
    const mine = Object.entries(b.items).filter(([, x]) => (x.store || def) === k);
    const rows = BASKET_DEPTS.map(([dep, title]) => [title, mine.filter(([r]) => BASKET_DATA.roles[r]?.[1] === dep)]).filter(([, rs]) => rs.length);
    return { key: k, title: order.length > 1 ? storeInfo(k).name : "", sub: mine.reduce((a, [, x]) => a + x.cost, 0), rows };
  });
}
// Список покупок текстом — в мессенджер (например, тому, кто идёт в магазин)
function basketText(b) {
  const groups = basketGroups(b);
  const lines = [`Список покупок · ${storeNames(groups.map(g => g.key))} · ≈ ${rub(b.cost)}`];
  for (const g of groups) {
    if (g.title) lines.push("", `=== ${g.title} · ≈ ${rub(g.sub)} ===`);
    for (const [title, rows] of g.rows) {
      lines.push("", title + ":");
      for (const [, x] of rows) lines.push(`— ${x.name}, ${x.kg ? fmt(x.grams / 1000, 1) + " кг" : x.packs + " уп."}`);
    }
  }
  return lines.join("\n");
}

function basketDishSheet(day, meal) {
  const b = S.basket, d = b.days.find(x => x.day === day);
  const dish = DISHES.find(x => x.id === d.meals[meal]);
  const ks = b.portions[day + "|" + meal];
  const head = b.people.map(p => `<th>${esc(p.name)}</th>`).join("");
  const rows = dish.ing.map(([r, g]) => `<tr><td>${esc(BASKET_DATA.roles[r][0])}</td>${ks.map(k => `<td>${r0(g * k / 5) * 5} г</td>`).join("")}</tr>`).join("");
  const kc = ks.map(k => dish.ing.reduce((s, [r, g]) => s + b.items[r].nut.kcal * g * k / 100, 0));
  // ужин готовится сразу и на обед завтра — сколько продуктов взять на всю кастрюлю
  const next = meal === "dinner" && b.days.find(x => x.day === shiftDay(day, 1));
  const ks2 = next && next.meals.lunch === dish.id ? b.portions[next.day + "|lunch"] : null;
  const total = ks2 ? [...ks, ...ks2].reduce((a, k) => a + k, 0) : 0;
  const cookRows = ks2 ? dish.ing.map(([r, g]) => `<tr><td>${esc(BASKET_DATA.roles[r][0])}</td><td>${fmtG(g * total)}</td></tr>`).join("") : "";
  const leftover = meal === "lunch" && day !== b.days[0].day;
  openSheet(`<h2>${esc(dish.name)}</h2>
    <p class="muted small">${daySub(day)} · ${BASKET_MEALS.find(x => x[0] === meal)[1].toLowerCase()} · вес продуктов сырыми</p>
    <table class="bk-table"><tr><th></th>${head}</tr>${rows}
      <tr class="sum"><td>Ккал</td>${kc.map(x => `<td>${r0(x)}</td>`).join("")}</tr></table>
    ${dish.how ? `<p class="small">${esc(dish.how)}</p>` : ""}
    ${leftover ? `<p class="note">Это вчерашний ужин — готовить не нужно, просто разогрей свою порцию.</p>` : ""}
    ${ks2 ? `<h3 class="bk-dept">Готовить сразу на два раза — ужин и обед завтра${b.people.length > 1 ? ", на двоих" : ""}</h3>
      <table class="bk-table">${cookRows}</table>` : ""}
    ${day >= dayKey() && day <= shiftDay(dayKey(), PLAN_DAYS) ? `<button class="btn" data-a="bkToDiary" data-day="${day}" data-meal="${meal}">Записать мою порцию в дневник</button>` : ""}
    <button class="btn ghost" data-a="bkSwapList" data-day="${day}" data-meal="${meal}">Заменить блюдо</button>
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

/* ---------- Замена одного блюда ---------- */
// Обед-ужин готовится на два раза: заменяем ужин дня и обед следующего (одна кастрюля). Завтрак и перекус — только этот день.
function swapSlots(b, day, meal) {
  const id = b.days.find(x => x.day === day).meals[meal];
  if (meal === "breakfast" || meal === "snack") return [[day, meal]];
  const i = b.days.findIndex(x => x.day === day);
  const pair = meal === "dinner" ? [[day, "dinner"], [b.days[(i + 1) % 7].day, "lunch"]] : [[day, "lunch"], [b.days[(i + 6) % 7].day, "dinner"]];
  return pair.filter(([d, m]) => b.days.find(x => x.day === d).meals[m] === id);
}
// Пересчёт списка: уже выбранные товары остаются, новые продукты — тем же уровнем цен, ненужные уходят
function recalcBasket(b) {
  const need = {};
  for (const { day, meals } of b.days) for (const [m] of BASKET_MEALS) {
    const dish = DISHES.find(x => x.id === meals[m]), ks = b.portions[day + "|" + m] || [];
    for (const [r, g] of dish.ing) need[r] = (need[r] || 0) + g * ks.reduce((a, k) => a + k, 0);
  }
  const items = {};
  for (const r in need) {
    const x = b.items[r];
    if (x) {
      const it = [x.name, x.price, x.price, x.pack, x.step ?? (x.kg ? 100 : 0)];
      items[r] = { ...x, ...itemCost(it, need[r]), need: need[r] };
    } else {
      const y = pickItem(r, need[r], b.level ?? 0);
      items[r] = { name: y.it[0], price: y.it[1], pack: y.it[3], kg: !!y.it[4], step: y.it[4], store: y.it[9], packs: y.packs, cost: y.cost,
        grams: y.grams, need: need[r], nut: itemNut(y.it), added: true };
    }
  }
  b.items = items;
  b.cost = Object.values(items).reduce((a, x) => a + x.cost, 0);
  b.over = b.cost > b.budget;
  const eat = planEat(b.days, b.portions, b.items, b.people.length);
  b.people = b.people.map((x, i) => ({ ...x, eat: eat[i] }));
  return b;
}
function swapDish(b, day, meal, newId) {
  const nb = JSON.parse(JSON.stringify(b)), dish = DISHES.find(x => x.id === newId);
  const base = dishNut(dish).kcal;
  for (const [d, m] of swapSlots(b, day, meal)) {
    nb.days.find(x => x.day === d).meals[m] = newId;
    nb.portions[d + "|" + m] = nb.people.map(x => Math.min(2.2, Math.max(0.5, x.kcal * MEAL_SHARE[m] / base)));
  }
  return recalcBasket(nb);
}
function withStore(b, fn) {
  storeOverride = planStores(b);
  try { return fn(); } finally { storeOverride = null; }
}
function swapListSheet(day, meal) {
  const b = S.basket, cur = b.days.find(x => x.day === day).meals[meal];
  const kind = meal === "lunch" || meal === "dinner" ? "main" : meal;
  const inPlan = new Set(b.days.flatMap(x => Object.values(x.meals)));
  const opts = withStore(b, () => DISHES.filter(x => x.meal === kind && x.id !== cur && dishOk(x) && !(S.basketNo || []).includes(x.id))
    .map(x => ({ x, delta: swapDish(b, day, meal, x.id).cost - b.cost })))
    .sort((a, c) => a.delta - c.delta);
  const slots = swapSlots(b, day, meal);
  const where = slots.map(([d, m]) => `${m === "lunch" ? "обед" : m === "dinner" ? "ужин" : m === "breakfast" ? "завтрак" : "перекус"} ${shortDate(d)}`).join(" и ");
  const dlt = v => Math.abs(v) < 20 ? "≈ так же" : (v > 0 ? "+" : "−") + rub(Math.abs(v));
  openSheet(`<h2>Чем заменить?</h2>
    <p class="muted small">Заменится ${where}. Список покупок пересчитается${boughtCount() ? ", отметки купленного останутся" : ""}.</p>
    <div class="list">${opts.map(({ x, delta }) => `<button class="prod" data-a="bkSwap" data-id="${x.id}" data-day="${day}" data-meal="${meal}">
      <span class="n">${esc(x.name)}${inPlan.has(x.id) ? `<span class="tag">уже в меню</span>` : ""}</span>
      <span class="k ${delta > 0 ? "" : "plus"}">${dlt(delta)}</span></button>`).join("")}</div>
    <button class="btn ghost" data-a="closeSheet">Оставить как есть</button>`, true);
}

const boughtCount = () => Object.values(S.basketChecked || {}).filter(Boolean).length;
// Новое меню = новый список покупок: если в магазине уже что-то отмечено — спросить
function confirmRebuild(fn) {
  const n = boughtCount();
  if (!S.basket || !n) return fn();
  ui.bkPending = fn;
  openSheet(`<h2>Собрать новое меню?</h2>
    <p>В списке уже отмечено ${n} ${plural(n, ["покупка", "покупки", "покупок"])}. Новое меню — это новый список, отметки сбросятся.</p>
    <button class="btn" data-a="bkRebuildYes">Да, собрать новое</button>
    <button class="btn ghost" data-a="closeSheet">Оставить как есть</button>`);
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
  bkReady(el) { S.basketOpts.ready = el.dataset.v === "1"; save(); render(); },
  hidePrices() { S.pricesHide = dayKey(); save(); render(); },
  bkStore(el) {
    const k = el.dataset.v, cur = basketStores();
    const next = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k];
    if (!next.length) { toast("Нужен хотя бы один магазин"); return; }
    S.basketOpts.stores = next; delete S.basketOpts.store;
    save(); render();
  },
  bkBuild() { confirmRebuild(() => buildBasket(S.basket?.seed || 1)); },
  bkReroll() { confirmRebuild(() => buildBasket((S.basket?.seed || 1) + 1)); },
  async bkSendPlan() {
    const b = S.basket, url = planLink();
    const text = `Меню на неделю из Хрума (${shortDate(b.days[0].day)} – ${shortDate(b.days[6].day)}) — твои порции уже посчитаны. Открой ссылку:`;
    if (navigator.share) {
      try { await navigator.share({ title: "Меню на неделю", text, url }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Ссылка скопирована — отправь её в мессенджер"); }
    catch (e) {
      openSheet(`<h2>Ссылка на меню</h2><p class="muted small">Скопируй и отправь:</p>
        <textarea class="input" rows="4" readonly>${esc(url)}</textarea>
        <button class="btn ghost" data-a="closeSheet">Готово</button>`);
    }
  },
  bkTakePlan() {
    const pl = ui.incomingPlan, me = targets();
    const other = S.partner?.name || "Второй человек", k = pl.kcalFrom / me.kcal;
    const people = [{ name: "Ты", kcal: pl.kcalFor, p: me.p * pl.kcalFor / me.kcal, f: me.f * pl.kcalFor / me.kcal, c: me.c * pl.kcalFor / me.kcal, me: true },
      { name: other, kcal: pl.kcalFrom, p: me.p * k, f: me.f * k, c: me.c * k }];
    const eat = planEat(pl.days, pl.portions, pl.items, 2);
    S.basket = { budget: pl.budget, seed: 1, cost: pl.cost, start: pl.days[0].day, stores: pl.stores, over: pl.over, shared: true,
      people: people.map((x, i) => ({ ...x, eat: eat[i] })), days: pl.days, portions: pl.portions, items: pl.items };
    S.basketChecked = {};
    (S.basketOpts ||= { budget: pl.budget, two: true }).two = true;
    ui.incomingPlan = null; ui.view = "basket";
    save(); closeSheet(); render(); window.scrollTo(0, 0);
    toast("Меню на неделю — у тебя");
  },
  bkSwapList(el) { swapListSheet(el.dataset.day, el.dataset.meal); },
  bkSwap(el) {
    const b = S.basket, { id, day, meal } = el.dataset, was = b.cost;
    const nb = withStore(b, () => swapDish(b, day, meal, id));
    // отметки «куплено» остаются только у товаров, которые есть в новом списке
    for (const r of Object.keys(S.basketChecked || {})) if (!nb.items[r]) delete S.basketChecked[r];
    S.basket = nb;
    save(); closeSheet(); render();
    const d = nb.cost - was, added = Object.values(nb.items).filter(x => x.added).length;
    toast(`${DISHES.find(x => x.id === id).name}: ${Math.abs(d) < 20 ? "сумма та же" : (d > 0 ? "+" : "−") + rub(Math.abs(d))}${added ? `, в списке ${added} ${plural(added, ["новый товар", "новых товара", "новых товаров"])}` : ""}`);
  },
  bkPast() { ui.bkPast = !ui.bkPast; render(); },
  bkRebuildYes() { const fn = ui.bkPending; ui.bkPending = null; closeSheet(); fn?.(); },
  async bkShare() {
    const text = basketText(S.basket);
    if (navigator.share) {
      try { await navigator.share({ title: "Список покупок", text }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); toast("Список скопирован — вставь его в мессенджер"); }
    catch (e) {
      openSheet(`<h2>Список покупок</h2><p class="muted small">Выдели и скопируй:</p>
        <textarea class="input" rows="10" readonly>${esc(text)}</textarea>
        <button class="btn ghost" data-a="closeSheet">Готово</button>`);
    }
  },
  bkClear() { confirmRebuild(() => { S.basket = null; S.basketChecked = {}; save(); render(); }); },
  bkDish(el) { basketDishSheet(el.dataset.day, el.dataset.meal); },
  bkNo(el) {
    S.basketNo = [...new Set([...(S.basketNo || []), el.dataset.id])];
    const name = DISHES.find(d => d.id === el.dataset.id).name;
    save(); closeSheet();
    // продукты уже куплены — меню этой недели не трогаем, блюдо уйдёт со следующей корзины
    if (boughtCount()) { render(); toast(`«${name}» больше не предложу — со следующей корзины`); return; }
    buildBasket(S.basket?.seed || 1);
    toast(`«${name}» больше не предлагаю`);
  },
  bkToDiary(el) {
    const b = S.basket, { day, meal } = el.dataset;
    const dish = DISHES.find(x => x.id === b.days.find(x => x.day === day).meals[meal]);
    const k = b.portions[day + "|" + meal][0];
    // одной строкой — названием блюда, а не семью товарами с длинными названиями; вес — сумма сырых продуктов
    const e = { id: uid(), pid: null, plan: true, name: dish.name, meal, grams: 0, kcal: 0, p: 0, f: 0, c: 0 };
    for (const [r, g] of dish.ing) {
      const x = b.items[r], grams = g * k;
      e.grams += grams;
      for (const key of KEYS) e[key] += x.nut[key] * grams / 100;
    }
    e.grams = r0(e.grams / 5) * 5;
    (S.entries[day] ||= []).push(e);
    save(); closeSheet(); render();
    toast(`${dish.name} — в дневник на ${dayTitle(day).toLowerCase()}`);
  },
});
VIEWS.basket = [viewBasket, mountBasket];
// app.js нарисовал первый экран раньше, чем загрузился этот файл, — перерисуем, чтобы показать напоминание о ценах
if (ui.view === "diary" && $("#sheet").hidden && S.profile) render();
