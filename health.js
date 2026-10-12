"use strict";

/* ================= Здоровье iPhone =================
   Браузер не видит «Здоровье», поэтому мост — команда в приложении «Команды»:
   она читает вес и тренировки (свои и от Huawei Health) и копирует текст в буфер,
   а Хрум его вставляет. Строки текста:
     вес;<дата>;<кг>[;<жир %>]
     тренировка;<начало>;<конец>;<название>;<ккал>
   Дата — ISO 8601 или как её пишет iPhone («12 окт. 2026 г., 19:30»). */

const HK_SHORTCUT = "Хрум Здоровье";
const HK_NAMES = [
  [/run|бег/i, "Бег"], [/walk|ходьб|прогул/i, "Ходьба"], [/cycl|bik|велос/i, "Велосипед"],
  [/swim|плав/i, "Плавание"], [/strength|weight|силов/i, "Силовая"], [/yoga|йог/i, "Йога"],
  [/hiit|interval|интерв/i, "HIIT"], [/danc|танц/i, "Танцы"], [/ski|лыж/i, "Лыжи"],
  [/soccer|football|футб/i, "Футбол"], [/martial|box|единоб|бокс/i, "Единоборства"],
  [/ellip|эллипс/i, "Эллипс"], [/row|греб/i, "Гребля"],
];
const HK_MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// дата из команды → Date (null, если не разобрать)
function hkDate(s) {
  s = String(s || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d\d-\d\d$/.test(s)) return parseDay(s);
  if (/^\d{4}-\d\d-\d\d[T ]/.test(s)) { const d = new Date(s.replace(" ", "T")); return isNaN(d) ? null : d; }
  const tm = s.match(/(\d{1,2}):(\d\d)/);
  const [h, mi] = tm ? [+tm[1], +tm[2]] : [12, 0];
  let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);            // 12.10.2026, 19:30
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], h, mi);
  m = s.toLowerCase().match(/^(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4})/);  // 12 окт. 2026 г., 19:30
  if (m) {
    const mon = HK_MONTHS.findIndex(x => m[2].startsWith(x) || (x === "мая" && m[2].startsWith("май")));
    if (mon >= 0) return new Date(+m[3], mon, +m[1], h, mi);
  }
  return null;
}
const hkNum = s => num(String(s || "").replace(/\s/g, "").replace(/[^\d.,-]/g, ""));
function hkName(s) {
  s = String(s || "").trim();
  const hit = HK_NAMES.find(([re]) => re.test(s));
  return hit ? hit[1] : s ? s.slice(0, 40) : "Тренировка";
}

// текст из буфера → { weights: [{day, w, bf}], workouts: [{day, start, name, minutes, kcal, est}] }
function parseHealth(text) {
  const weights = [], workouts = [];
  const today = dayKey();
  for (const line of String(text || "").split(/\r?\n/)) {
    const f = line.split(/[;\t|]/).map(x => x.trim());
    const kind = (f[0] || "").toLowerCase();
    if (/^(вес|weight)$/.test(kind)) {
      const d = hkDate(f[1]), w = hkNum(f[2]);
      if (!d || !w || w < 30 || w > 300 || dayKey(d) > today) continue;
      let bf = hkNum(f[3]);
      if (bf != null && bf > 0 && bf < 1) bf = Math.round(bf * 1000) / 10;  // 0,224 → 22,4 %
      weights.push({ day: dayKey(d), w: Math.round(w * 10) / 10, bf: bf >= 3 && bf <= 60 ? bf : null, t: +d });
    } else if (/^(тренировка|workout)$/.test(kind)) {
      const a = hkDate(f[1]), b = hkDate(f[2]);
      if (!a || dayKey(a) > today) continue;
      const minutes = b && b > a ? Math.round((b - a) / 6e4) : null;
      if (!minutes || minutes > 600) continue;
      const name = hkName(f[3]);
      let kcal = hkNum(f[4]), est = false;
      if (!kcal || kcal <= 0 || kcal > 5000) {  // часы калории не дали — считаем по нагрузке, как вручную
        const met = (WORKOUTS.find(([n]) => n === name) || [, 5])[1];
        kcal = workoutKcal(met, S.profile.weight, minutes);
        est = true;
      }
      workouts.push({ day: dayKey(a), start: a.toISOString(), name, minutes, kcal: Math.round(kcal), est });
    }
  }
  // по одному весу на день — последний за день
  const byDay = {};
  for (const x of weights.sort((p, q) => p.t - q.t)) byDay[x.day] = x;
  const seen = new Set();
  return {
    weights: Object.values(byDay).sort((p, q) => q.day.localeCompare(p.day)),
    workouts: workouts.filter(w => !seen.has(w.start) && seen.add(w.start)).sort((p, q) => q.start.localeCompare(p.start)),
  };
}

function healthSheet() {
  openSheet(`<h2>Из Здоровья</h2>
    <p class="muted small">Вес и тренировки с iPhone, часов и весов Huawei. Чего там нет — вноси вручную, как раньше.</p>
    <a class="btn ghost" style="text-decoration:none" href="shortcuts://run-shortcut?name=${encodeURIComponent(HK_SHORTCUT)}">1. Запустить команду</a>
    <p class="muted small">Она скопирует данные. Потом вернись сюда.</p>
    <button class="btn" data-a="healthPaste">2. Вставить из Здоровья</button>
    <textarea id="hkIn" class="input" rows="3" placeholder="Или вставь текст команды сюда вручную" hidden></textarea>
    <p id="hkErr" class="note" hidden></p>
    <button class="btn ghost" data-a="healthHelp">${S.healthAt ? "Как настроить команду" : "Сначала настрой команду — это один раз"}</button>`);
}

function healthHelp() {
  const code = t => `<b>${t}</b>`;
  openSheet(`<h2>Команда «${HK_SHORTCUT}»</h2>
    <p class="muted small">Делается один раз на каждом iPhone. Названия действий могут чуть отличаться в разных версиях iOS.</p>
    <h3>Если есть часы или весы Huawei</h3>
    <ol class="steps">
      <li>Huawei Health → вкладка «Я» → пункт про конфиденциальность или обмен данными («Управление конфиденциальностью», «Обмен данными», «Сторонние сервисы» — зависит от версии) → «Здоровье» → включить. В «Настройках» этого пункта нет.</li>
      <li>В окне «Здоровья» разрешить хотя бы «Вес» и «Тренировки». Проверить: Настройки iPhone → Здоровье → Доступ к данным и устройства → Huawei Health.</li>
      <li>Huawei передаёт данные, когда открыт. Перед командой открой Huawei Health на пару секунд.</li>
    </ol>
    <h3>Собрать команду</h3>
    <ol class="steps">
      <li>Приложение «Команды» → «+». Назови команду ровно ${code(HK_SHORTCUT)}.</li>
      <li>Действие ${code("«Найти образцы здоровья»")}: тип «Вес», дата начала «за последние 14 дней».</li>
      <li>${code("«Повторить с каждым»")}, внутри — ${code("«Текст»")}:<br>
        <code>вес;</code>[Повторить объект → Дата начала]<code>;</code>[Повторить объект → Значение]<br>
        и ${code("«Добавить к переменной»")} с именем «Хрум».</li>
      <li>Снова ${code("«Найти образцы здоровья»")}: тип «Тренировки», за последние 14 дней.</li>
      <li>${code("«Повторить с каждым»")}, внутри — ${code("«Текст»")}:<br>
        <code>тренировка;</code>[Дата начала]<code>;</code>[Дата окончания]<code>;</code>[Тип]<code>;</code>[Активные калории]<br>
        и ${code("«Добавить к переменной»")} «Хрум». Нет поля с калориями — оставь пустым, Хрум посчитает сам.</li>
      <li>В конце ${code("«Скопировать в буфер обмена»")} → переменная «Хрум».</li>
      <li>При первом запуске iPhone спросит доступ к «Здоровью» — разреши.</li>
    </ol>
    <p class="note">Каждая строка — одна запись, например:<br><code>вес;2026-10-12;82,4</code><br><code>тренировка;2026-10-11T19:00;2026-10-11T19:40;Бег;380</code><br>
      Хрум запоминает, что уже забрал, поэтому повторная вставка не задвоит записи. Не стоит ставить ручной ввод и Здоровье на одну и ту же тренировку.</p>
    <p class="muted small">Можно запускать команду автоматически: «Команды» → «Автоматизация» → «Время суток», например каждый вечер. Тогда остаётся открыть Хрум и нажать «Вставить из Здоровья».</p>
    <button class="btn" data-a="healthOpen">Понятно</button>`, true);
}

const hkWKey = x => `w:${x.day}:${x.w}`;

function healthPreview(data) {
  const wk = S.workouts;
  // пропущенное в прошлый раз (сняли галочку) больше не предлагаем
  const skip = new Set(S.hkSkip || []);
  const newW = data.weights.filter(x => S.weights[x.day]?.w !== x.w && !skip.has(hkWKey(x)));
  const known = new Set(Object.values(wk).flat().map(w => w.hk).filter(Boolean));
  const newT = data.workouts.filter(x => !known.has(x.start) && !skip.has(x.start));
  const same = data.weights.length - newW.length + data.workouts.length - newT.length;
  if (!newW.length && !newT.length) {
    openSheet(`<h2>Всё уже в Хруме</h2>
      <p class="muted">${same ? `Из Здоровья пришло ${same} ${plural(same, ["запись", "записи", "записей"])}, все уже записаны.` : "В данных нет ни веса, ни тренировок."}</p>
      <button class="btn ghost" data-a="closeSheet">Хорошо</button>`);
    return;
  }
  ui.hkData = { weights: newW, workouts: newT };
  const row = (kind, i, on, title, sub, right) => `<label class="bk-row">
      <input type="checkbox" data-hk="${kind}" data-i="${i}" ${on ? "checked" : ""}>
      <span class="n">${title}<small>${sub}</small></span><span class="k">${right}</span></label>`;
  const ws = newW.map((x, i) => {
    const old = S.weights[x.day];
    return row("w", i, true, `${shortDate(x.day)}`, old ? `вместо ${fmt(old.w)} кг` : "новое взвешивание", `${fmt(x.w)} кг`);
  }).join("");
  const ts = newT.map((x, i) => {
    const manual = (wk[x.day] || []).some(w => !w.hk);
    return row("t", i, !manual, `${esc(x.name)} · ${shortDate(x.day)}`,
      `${fmt(x.minutes, 0)} мин${x.est ? " · ккал по нагрузке" : ""}${manual ? " · в этот день уже есть тренировка вручную" : ""}`, `−${r0(x.kcal)}`);
  }).join("");
  openSheet(`<h2>Из Здоровья</h2>
    ${ws ? `<h3>Вес</h3>${ws}` : ""}
    ${ts ? `<h3>Тренировки</h3>${ts}` : ""}
    ${same ? `<p class="muted small">Ещё ${same} ${plural(same, ["запись", "записи", "записей"])} уже в Хруме.</p>` : ""}
    <p class="note">Снимай галочку с того, что уже внесено вручную, и с обычной ходьбы по делам: она учтена в норме. Без галочки запись больше не предложится.</p>
    <button class="btn" data-a="healthSave">Добавить</button>`, true);
}

Object.assign(actions, {
  healthImport() { healthSheet(); },
  healthOpen() { healthSheet(); },
  healthHelp() { healthHelp(); },
  async healthPaste() {
    const box = $("#hkIn"), err = $("#hkErr");
    let text = box && !box.hidden ? box.value : "";
    if (!text) {
      try { text = await navigator.clipboard.readText(); } catch (e) { text = ""; }
    }
    const data = parseHealth(text);
    if (data.weights.length || data.workouts.length) { healthPreview(data); return; }
    // буфер не прочитался или там не то — даём вставить руками
    if (box) { box.hidden = false; box.focus(); }
    if (err) {
      err.hidden = false;
      err.textContent = text
        ? "В буфере не данные Хрума. Запусти команду ещё раз или вставь её текст в поле и нажми «Вставить» снова."
        : "Буфер пуст или iPhone не дал его прочитать. Запусти команду, вернись и нажми «Вставить» ещё раз — или вставь текст в поле.";
    }
  },
  healthSave() {
    const { weights, workouts } = ui.hkData || { weights: [], workouts: [] };
    const on = kind => [...document.querySelectorAll(`[data-hk="${kind}"]`)].filter(x => x.checked).map(x => +x.dataset.i);
    const W = on("w").map(i => weights[i]), T = on("t").map(i => workouts[i]);
    const off = [...weights.filter(x => !W.includes(x)).map(hkWKey), ...workouts.filter(x => !T.includes(x)).map(x => x.start)];
    if (off.length) S.hkSkip = [...(S.hkSkip || []), ...off].slice(-300);
    for (const x of W) S.weights[x.day] = { w: x.w, bf: x.bf ?? S.weights[x.day]?.bf ?? S.profile.bodyFat, hk: 1 };
    // самый свежий вес становится текущим — норма пересчитается
    const last = Object.keys(S.weights).sort().pop();
    if (W.some(x => x.day === last)) {
      S.profile.weight = S.weights[last].w;
      if (W.find(x => x.day === last).bf != null) S.profile.bodyFat = S.weights[last].bf;
    }
    for (const x of T) (S.workouts[x.day] ||= []).push({ id: uid(), name: x.name, minutes: x.minutes, kcal: x.kcal, manual: !x.est, hk: x.start });
    S.healthAt = dayKey();
    ui.hkData = null;
    save(); closeSheet(); render();
    const parts = [];
    if (W.length) parts.push(`вес: ${W.length}`);
    if (T.length) parts.push(`тренировки: ${T.length}`);
    toast(parts.length ? `Из Здоровья — ${parts.join(", ")}` : "Ничего не добавлено");
  },
});
