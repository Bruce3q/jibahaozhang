(async function () {
  const r = [];
  function ok(name, cond, detail) { r.push({ name: name, ok: !!cond, detail: String(detail == null ? '' : detail) }); }
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  const sleep = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
  const app = window.QHApp;
  const Store = window.QH.Store;
  const today = new Date().toISOString().slice(0, 10);
  // 清理上次测试残留，保证每次运行结果一致
  Store.all().filter(function (t) { return /洗衣测试|时段测试奶茶/.test(String(t.note || '')); })
    .forEach(function (t) { Store.removeTransaction(t.id); });

  /* ---------- 1. 洗衣分类 ---------- */
  app.goTab('home');
  await sleep(150);
  app.openCatPicker();
  await sleep(180);
  const items = $$('.picker-item');
  ok('分类共 14 项', items.length === 14, items.length);
  ok('洗衣图标已注册', !!document.getElementById('i-shirt'));
  const laundryItem = items.filter(function (x) { return x.innerText.indexOf('洗衣') >= 0; })[0];
  ok('记一笔含洗衣分类', !!laundryItem);
  if (laundryItem) laundryItem.click();
  await sleep(220);
  ok('洗衣记账面板已打开', !!document.getElementById('amount-input'));
  const closePick = $('[data-action="close-picker"]');
  if (closePick) closePick.click();
  await sleep(120);

  Store.addTransaction({ type: 'expense', category: 'laundry', amount: 6, note: '洗衣测试A', date: today, time: '10:00' });
  Store.addTransaction({ type: 'expense', category: 'laundry', amount: 4, note: '洗衣测试B', date: today, time: '10:01' });
  const laundryList = Store.all().filter(function (t) { return t.category === 'laundry' && String(t.note || '').indexOf('洗衣测试') === 0; });
  ok('洗衣分类可入账', laundryList.length === 2, laundryList.length);
  const laundrySum = Store.categoryBreakdown(Store.all()).filter(function (b) { return b.cat.id === 'laundry'; })[0];
  ok('统计汇总洗衣金额', laundrySum && Math.abs(laundrySum.amount - 10) < 1e-6, laundrySum && laundrySum.amount);

  app.goTab('me');
  await sleep(180);
  const budgetEntry = $('[data-action="nav-budget"]');
  if (budgetEntry) budgetEntry.click();
  await sleep(220);
  ok('预算页有洗衣分类预算', !!$('input[name="cat_laundry"]'));

  /* ---------- 2. 累计结余按月查看 ---------- */
  app.goTab('stats');
  await sleep(220);
  ok('累计结余有月份切换', !!$('.cum-month-nav'));
  const balances = Store.balanceHistory(12);
  const last = balances[balances.length - 1];
  const label0 = $('.cum-month-label').textContent.trim();
  ok('默认显示当前月', label0 === (last.year + '年' + (last.month + 1) + '月'), label0);
  const prev = $('[data-action="cum-prev"]');
  ok('上一月按钮可用', !!prev && !prev.disabled);
  if (prev) prev.click();
  await sleep(220);
  const expected = balances[balances.length - 2];
  const label1 = $('.cum-month-label').textContent.trim();
  ok('切换到上一月', label1 === (expected.year + '年' + (expected.month + 1) + '月'), label1);
  const amount = parseFloat(String($('.cum-amount').textContent).replace(/[^0-9.-]/g, ''));
  ok('显示该月结余金额', Math.abs(amount - expected.balance) < 0.02, amount + ' vs ' + expected.balance);
  const firstBar = $$('.bc-col')[0];
  if (firstBar) firstBar.click();
  await sleep(220);
  ok('点柱切换月份', $('.cum-month-label').textContent.trim() === (balances[0].year + '年' + (balances[0].month + 1) + '月'), $('.cum-month-label').textContent);
  ok('选中柱高亮', !!$('.bc-col.is-active'));

  /* ---------- 3. 备注搜索时段 ---------- */
  Store.addTransaction({ type: 'expense', category: 'daily', amount: 3, note: '时段测试奶茶', date: '2026-10-01', time: '09:00' });
  Store.addTransaction({ type: 'expense', category: 'daily', amount: 7, note: '时段测试奶茶', date: '2026-10-20', time: '09:00' });
  app.goTab('stats');
  await sleep(220);
  const q = document.getElementById('note-search');
  q.value = '时段测试奶茶';
  q.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(160);
  const globalText = document.getElementById('note-search-result').innerText;
  ok('全局搜索统计 2 笔', globalText.indexOf('2 笔') >= 0, globalText.replace(/\n/g, ' '));
  ok('全局搜索总花费 ¥10.00', globalText.indexOf('10.00') >= 0, globalText);

  const from = document.getElementById('note-from');
  const to = document.getElementById('note-to');
  from.value = '2026-10-15';
  from.dispatchEvent(new Event('change', { bubbles: true }));
  to.value = '2026-10-31';
  to.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(180);
  const rangedText = document.getElementById('note-search-result').innerText;
  ok('时段筛选只统计 1 笔', rangedText.indexOf('1 笔') >= 0, rangedText.replace(/\n/g, ' '));
  ok('时段筛选总花费 ¥7.00', rangedText.indexOf('7.00') >= 0, rangedText);
  ok('展示统计时段', rangedText.indexOf('统计时段') >= 0, rangedText);

  const clearBtn = $('[data-action="note-range-clear"]');
  ok('清除按钮可用', !!clearBtn && !clearBtn.disabled);
  if (clearBtn) clearBtn.click();
  await sleep(240);
  ok('清除时段恢复全局', document.getElementById('note-search-result').innerText.indexOf('2 笔') >= 0);

  const bad = r.filter(function (x) { return !x.ok; });
  return JSON.stringify({ pass: r.length - bad.length, total: r.length, fail: bad.length, results: r });
})()