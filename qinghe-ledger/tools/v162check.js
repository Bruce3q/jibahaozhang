(async function () {
  const r = [];
  function ok(name, cond, detail) { r.push({ name: name, ok: !!cond, detail: String(detail == null ? '' : detail) }); }
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  const sleep = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
  const app = window.QHApp;
  ok('QHApp 已加载', !!app);

  app.goTab('me');
  await sleep(180);
  const rows = $$('[data-action="open-quick"]');
  ok('快速记账入口只剩 3 个', rows.length === 3, 'count=' + rows.length);
  const kinds = rows.map(function (x) { return x.dataset.kind; }).join(',');
  ok('入口类型 ball/tile/notify', kinds === 'ball,tile,notify', kinds);
  ok('页面无「桌面小组件」字样', document.body.innerText.indexOf('桌面小组件') < 0);
  ok('无 widget 动作节点', $$('[data-action*="widget"]').length === 0, $$('[data-action*="widget"]').length);
  ok('无 widget 配置节点', $$('[data-kind="widget"]').length === 0, $$('[data-kind="widget"]').length);
  ok('openWidgetConfig 已移除', typeof app.openWidgetConfig === 'undefined', typeof app.openWidgetConfig);

  app.openQuick('tile');
  await sleep(140);
  ok('磁贴入口仍可用', !!($('.modal-card') && $('.modal-card').innerText.indexOf('状态栏磁贴') >= 0));
  $('[data-action="close-quick"]').click();
  await sleep(120);

  app.openQuick('ball');
  await sleep(140);
  ok('悬浮球入口仍可用', !!($('.modal-card') && $('.modal-card').innerText.indexOf('悬浮球') >= 0));
  $('[data-action="close-quick"]').click();
  await sleep(120);

  app.openDayNote(new Date().toISOString().slice(0, 10));
  await sleep(120);
  ok('日历备注仍可用', !!document.getElementById('day-note-input'));
  $('[data-action="close-day-note"]').click();
  await sleep(100);

  app.goTab('stats');
  await sleep(180);
  ok('备注搜索仍可用', !!document.getElementById('note-search'));
  ok('累计结余仍存在', !!document.querySelector('.cum-card'));

  app.goTab('home');
  await sleep(120);
  app.openCatPicker();
  await sleep(140);
  ok('记账分类为 14 类', $$('.picker-item').length === 14, $$('.picker-item').length);
  ok('分类含收入', !!$('.picker-income'));
  $('[data-action="close-picker"]').click();

  const bad = r.filter(function (x) { return !x.ok; });
  return JSON.stringify({ pass: r.length - bad.length, total: r.length, fail: bad.length, results: r });
})()
