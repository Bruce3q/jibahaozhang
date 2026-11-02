(function () {
  const r = [];
  const ok = function (n, c) { r.push({ name: n, ok: !!c }); };
  const app = window.QHApp;
  const store = QH.Store;
  const U = QH.Utils;

  /* 1. 删除类：设置页不再出现识别截图 / 无障碍 / 通知自动记账 */
  app.goTab('me');
  let me = document.getElementById('view').innerText;
  ok('设置页无「识别截图」', me.indexOf('识别截图') < 0);
  ok('设置页无「无障碍」', me.indexOf('无障碍') < 0);
  ok('设置页无「通知自动记账」', me.indexOf('通知自动记账') < 0);
  ok('设置页无「微信通知」', me.indexOf('微信通知') < 0);
  ok('快速记账入口 3 个', document.querySelectorAll('[data-action="open-quick"]').length === 3);

  /* 2. 磁贴入口：只做跳转，不含识别 */
  ok('设置页有磁贴入口', me.indexOf('状态栏磁贴') >= 0);
  app.openQuick('tile');
  const tileText = document.querySelector('.modal-card').innerText;
  ok('磁贴引导含控制中心', tileText.indexOf('控制中心') >= 0);
  ok('磁贴引导不含识别', tileText.indexOf('识别') < 0);
  document.querySelector('[data-action="close-quick"]').click();

  /* 3. 统计页顺序：三餐专项在累计结余之前 */
  app.goTab('stats');
  const cards = Array.prototype.slice.call(
    document.querySelectorAll('.page-stats .card, .page-stats .cum-card')
  );
  const iMeal = cards.findIndex(function (e) { return e.innerText.indexOf('三餐专项') >= 0; });
  const iCum = cards.findIndex(function (e) { return e.className.indexOf('cum-card') >= 0; });
  ok('三餐专项存在', iMeal >= 0);
  ok('累计结余在三餐之后', iCum > iMeal);
  ok('备注搜索框存在', !!document.getElementById('note-search'));

  /* 4. 日历备注 + 备注搜索统计 */
  const d = U.today();
  store.setDayNote(d, '放纵日');
  ok('日备注写入', store.getDayNote(d) === '放纵日');
  store.addTransactions([{
    type: 'expense', category: 'lunch', amount: 33.5,
    note: '奶茶放纵日', date: d, time: '12:00'
  }]);
  const stat = store.noteStats('放纵日');
  ok('备注搜索命中', stat.count >= 1);
  ok('备注搜索汇总花费', stat.expense >= 33.5);

  app.goTab('calendar');
  const chip = document.querySelector('.day-note-chip');
  ok('日历显示备注', !!chip && chip.innerText.indexOf('放纵日') >= 0);

  /* 5. 补记：分类与记一笔完全一致 */
  const addBtn = document.querySelector('.day-add-btn');
  ok('补记按钮走分类选择', !!addBtn && addBtn.dataset.action === 'open-cat-picker');
  addBtn.click();
  ok('补记面板 14 个分类', document.querySelectorAll('.picker-item').length === 14);
  ok('补记面板含收入', !!document.querySelector('.picker-income'));
  document.querySelector('[data-action="close-picker"]').click();

  /* 6. 备注搜索 UI 联动 */
  app.goTab('stats');
  const input = document.getElementById('note-search');
  input.value = '放纵日';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const box = document.getElementById('note-search-result');
  ok('备注搜索 UI 显示汇总', !!box && box.innerText.indexOf('关联总花费') >= 0);

  const bad = r.filter(function (x) { return !x.ok; });
  return JSON.stringify({ pass: r.length - bad.length, total: r.length, fail: bad.length, results: r });
})()