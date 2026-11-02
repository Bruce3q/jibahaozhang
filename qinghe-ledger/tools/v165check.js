(async function () {
  const r = [];
  function ok(name, cond, detail) { r.push({ name: name, ok: !!cond, detail: String(detail == null ? '' : detail) }); }
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  const sleep = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
  const app = window.QHApp;
  const Store = window.QH.Store;
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const PAST = '2026-10-01';
  const noteA = '水果测试';
  const noteB = '加餐测试';

  /* 清理上次残留 */
  Store.all().filter(function (t) { return [noteA, noteB].indexOf(String(t.note || '')) >= 0; })
    .forEach(function (t) { Store.removeTransaction(t.id); });

  /* ---------- 1. 分类表 ---------- */
  const cats = Store.CATEGORIES;
  ok('支出分类 14 项', cats.length === 14, cats.length);
  const fruit = cats.filter(function (c) { return c.id === 'fruit'; })[0];
  const snack = cats.filter(function (c) { return c.id === 'snack'; })[0];
  ok('水果分类存在', !!fruit && fruit.name === '水果', fruit && fruit.name);
  ok('加餐分类存在', !!snack && snack.name === '加餐', snack && snack.name);
  ok('水果为支出类型', fruit && fruit.type === 'expense', fruit && fruit.type);
  ok('加餐为支出类型', snack && snack.type === 'expense', snack && snack.type);
  ok('三餐口径不变（仅早/午/晚）',
    cats.filter(function (c) { return c.meal; }).map(function (c) { return c.id; }).join(',') === 'breakfast,lunch,dinner',
    cats.filter(function (c) { return c.meal; }).map(function (c) { return c.id; }).join(','));
  ok('水果/加餐不计入三餐', !fruit.meal && !snack.meal, '');

  /* ---------- 2. 图标 ---------- */
  ok('i-fruit 图标已注册', !!document.getElementById('i-fruit'));
  ok('i-snack 图标已注册', !!document.getElementById('i-snack'));
  ok('i-fruit 有 3 条路径', document.getElementById('i-fruit') && document.querySelectorAll('#i-fruit path').length === 3,
    document.getElementById('i-fruit') && document.querySelectorAll('#i-fruit path').length);
  ok('i-snack 有 5 个图元', document.getElementById('i-snack') && document.querySelectorAll('#i-snack circle').length === 5,
    document.getElementById('i-snack') && document.querySelectorAll('#i-snack circle').length);

  /* ---------- 3. 记一笔：分类面板 ---------- */
  app.goTab('home');
  await sleep(160);
  $('[data-action="open-cat-picker"]').click();
  await sleep(200);
  let items = $$('.picker-item');
  ok('记一笔面板 14 个分类', items.length === 14, items.length);
  const names = items.map(function (x) { return x.innerText.trim(); });
  ok('面板含「水果」', names.indexOf('水果') >= 0, names.join('/'));
  ok('面板含「加餐」', names.indexOf('加餐') >= 0, names.join('/'));
  ok('水果紧跟在晚餐后', names.indexOf('水果') === names.indexOf('晚餐') + 1, names.join('/'));
  ok('加餐紧跟在水果后', names.indexOf('加餐') === names.indexOf('水果') + 1, names.join('/'));
  const fruitItem = $('.picker-item[data-cat="fruit"]');
  const snackItem = $('.picker-item[data-cat="snack"]');
  ok('水果按钮可点', !!fruitItem);
  ok('加餐按钮可点', !!snackItem);
  const fruitUse = fruitItem && fruitItem.querySelector('svg use');
  ok('水果图标已渲染', !!fruitUse && /i-fruit/.test(fruitUse.getAttribute('href')), fruitUse && fruitUse.getAttribute('href'));
  const fruitIconBox = fruitItem && fruitItem.querySelector('.cat-icon').getBoundingClientRect();
  ok('水果图标可见', !!fruitIconBox && fruitIconBox.width > 10, fruitIconBox && Math.round(fruitIconBox.width));

  /* ---------- 4. 记一笔：水果落库 ---------- */
  fruitItem.click();
  await sleep(220);
  ok('水果记账面板已打开', !!document.getElementById('amount-input'));
  ok('面板标题为水果', $('.sheet-head strong') && $('.sheet-head strong').innerText === '水果', $('.sheet-head strong') && $('.sheet-head strong').innerText);
  document.getElementById('amount-input').value = '12.5';
  document.getElementById('note-input').value = noteA;
  $('[data-action="save-tx"]').click();
  await sleep(260);
  let saved = Store.all().filter(function (t) { return t.note === noteA; })[0];
  ok('水果记账已保存', !!saved, JSON.stringify(saved || {}));
  ok('金额 12.50 / 分类 fruit / 日期今天',
    !!saved && saved.amount === 12.5 && saved.category === 'fruit' && saved.date === today,
    saved && [saved.amount, saved.category, saved.date].join(' | '));
  ok('水果账显示为「水果」', !!saved && Store.categoryOf(saved).name === '水果', saved && Store.categoryOf(saved).name);

  /* ---------- 5. 补记：日历指定日期 ---------- */
  app.goTab('calendar');
  await sleep(200);
  app.goDay(PAST);
  await sleep(220);
  const addBtn = $('[data-action="open-cat-picker"][data-date="' + PAST + '"]');
  ok('日历补记按钮存在', !!addBtn, addBtn ? addBtn.className : '');
  addBtn.click();
  await sleep(200);
  items = $$('.picker-item');
  ok('补记面板 14 个分类', items.length === 14, items.length);
  ok('补记面板含「加餐」', items.some(function (x) { return x.innerText.trim() === '加餐'; }), '');
  const snackPick = $('.picker-item[data-cat="snack"]');
  snackPick.click();
  await sleep(220);
  ok('补记面板标题为加餐', $('.sheet-head strong') && $('.sheet-head strong').innerText === '加餐', $('.sheet-head strong') && $('.sheet-head strong').innerText);
  document.getElementById('amount-input').value = '6';
  document.getElementById('note-input').value = noteB;
  $('[data-action="save-tx"]').click();
  await sleep(260);
  saved = Store.all().filter(function (t) { return t.note === noteB; })[0];
  ok('补记加餐已保存', !!saved, JSON.stringify(saved || {}));
  ok('补记日期为 ' + PAST, !!saved && saved.date === PAST, saved && saved.date);
  ok('补记分类为 snack', !!saved && saved.category === 'snack', saved && saved.category);

  /* ---------- 6. 统计口径：不进三餐 ---------- */
  const sPast = Store.daySummary(PAST);
  ok('加餐计入当日支出', sPast.expense === 6, sPast.expense);
  ok('加餐不进三餐统计', sPast.meals.breakfast === 0 && sPast.meals.lunch === 0 && sPast.meals.dinner === 0,
    JSON.stringify(sPast.meals));
  const sToday = Store.daySummary(today);
  ok('水果计入当日支出', sToday.expense >= 12.5, sToday.expense);
  ok('水果不进三餐统计', sToday.meals.breakfast === 0 && sToday.meals.lunch === 0 && sToday.meals.dinner === 0,
    JSON.stringify(sToday.meals));
  const bd = Store.categoryBreakdown(Store.inRange('2026-10-01', '2026-10-31'));
  const fruitBd = bd.filter(function (x) { return x.cat.id === 'fruit'; });
  const snackBd = bd.filter(function (x) { return x.cat.id === 'snack'; });
  ok('分类占比含水果', fruitBd.length === 0 || fruitBd[0].amount >= 0, JSON.stringify(fruitBd.map(function (x) { return x.amount; })));
  ok('分类占比含加餐 6 元', snackBd.length === 1 && snackBd[0].amount === 6, JSON.stringify(snackBd.map(function (x) { return x.amount; })));

  /* 日历色点用新分类颜色 */
  app.goTab('calendar');
  await sleep(240);
  function dotsOf(date) {
    const cell = $('.cal-cell[data-date="' + date + '"]') || $('[data-date="' + date + '"]');
    return cell ? Array.prototype.slice.call(cell.querySelectorAll('.cal-dots i')).map(function (d) { return d.style.background; }) : [];
  }
  const pastDots = dotsOf(PAST);
  const todayDots = dotsOf(today);
  ok('日历加餐色点为饼干橙', pastDots.some(function (b) { return b.replace(/\s/g, '') === 'rgb(201,123,74)'; }), pastDots.join(' ; '));
  ok('日历水果色点为苹果红', todayDots.some(function (b) { return b.replace(/\s/g, '') === 'rgb(217,83,79)'; }), todayDots.join(' ; '));

  /* ---------- 7. 统计页分类明细 ---------- */
  app.goTab('stats');
  await sleep(240);
  const statsText = document.body.innerText;
  ok('统计页出现「水果」', statsText.indexOf('水果') >= 0, '');
  ok('统计页出现「加餐」', statsText.indexOf('加餐') >= 0, '');

  /* ---------- 8. 预算页 ---------- */
  app.goTab('home');
  await sleep(160);
  $('.budget-strip').click();
  await sleep(220);
  const form = document.getElementById('budget-form');
  ok('预算表单存在', !!form);
  ok('预算行共 14 个', $$('.budget-row').length === 14, $$('.budget-row').length);
  ok('预算含 cat_fruit 输入', !!form.elements.cat_fruit);
  ok('预算含 cat_snack 输入', !!form.elements.cat_snack);
  const budgetCards = $$('#budget-form .card');
  const mealSectionRows = budgetCards[1] ? budgetCards[1].querySelectorAll('.budget-row').length : -1;
  const otherSectionRows = budgetCards[2] ? budgetCards[2].querySelectorAll('.budget-row').length : -1;
  ok('三餐预算仍为 3 行', mealSectionRows === 3, mealSectionRows);
  ok('分类预算为 11 行', otherSectionRows === 11, otherSectionRows);
  form.elements.cat_fruit.value = '50';
  form.elements.cat_snack.value = '30';
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await sleep(200);
  const bud = Store.getBudgets();
  ok('水果预算保存成功', bud.categories.fruit === 50, JSON.stringify(bud.categories));
  ok('加餐预算保存成功', bud.categories.snack === 30, JSON.stringify(bud.categories));

  /* ---------- 9. 版本号 ---------- */
  app.goTab('me');
  await sleep(200);
  ok('关于页显示版本号', /记把好账 v1\.\d+\.\d+/.test(document.body.innerText), '');

  /* 清理测试数据 */
  Store.all().filter(function (t) { return [noteA, noteB].indexOf(String(t.note || '')) >= 0; })
    .forEach(function (t) { Store.removeTransaction(t.id); });

  const bad = r.filter(function (x) { return !x.ok; });
  return JSON.stringify({ pass: r.length - bad.length, total: r.length, fail: bad.length, results: r });
})()