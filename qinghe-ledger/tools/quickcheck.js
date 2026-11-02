/* 快速记账专项测试：悬浮球 / 识别截图预填 / 通知栏快捷 / 桌面小组件
 * 由 tools/quickcheck.py 在真实页面里执行，原生桥 QHQuick 用 mock。 */
(async () => {
  const results = [];
  let pass = 0, fail = 0;
  const t = (name, ok, detail) => {
    results.push({ name: name, ok: !!ok, detail: String(detail == null ? '' : detail) });
    if (ok) pass++; else fail++;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
  const calls = () => (window.__qhQuickCalls || []);

  try {
    const U = window.QH.Utils;
    const Store = window.QH.Store;
    const App = window.QHApp;
    const today = U.ymd(new Date());

    t('原生桥 QHQuick 已注入', !!window.QHQuick, typeof window.QHQuick);

    /* 1. 设置页出现 4 个快速记账入口 */
    App.goTab('me');
    await sleep(150);
    const rows = $$('[data-action="open-quick"]');
    t('我的页「快速记账」4 个入口', rows.length === 4, 'count=' + rows.length);
    const kinds = rows.map((r) => r.dataset.kind).join(',');
    t('入口类型为 ball/shot/notify/widget', kinds === 'ball,shot,notify,widget', kinds);

    /* 2. 悬浮球弹窗：说明 + 2 步授权 + 开关 */
    App.openQuick('ball');
    await sleep(120);
    const ballModal = $('.modal-card.recognition-modal');
    t('悬浮球弹窗已打开', !!ballModal, ballModal ? ballModal.querySelector('h3').textContent : '');
    t('悬浮球弹窗含 2 个授权步骤', $$('.modal-card .recognition-step').length === 2, $$('.modal-card .recognition-step').length);
    const ballSwitch = $('.modal-card .switch[data-action="toggle-quick"]');
    t('悬浮球弹窗含开关', !!ballSwitch, ballSwitch ? ballSwitch.className : '');

    /* 3. 打开开关：写原生 + 写本地设置 */
    if (ballSwitch) ballSwitch.click();
    await sleep(150);
    t('原生收到 setBallEnabled:true', calls().indexOf('setBallEnabled:true') >= 0, calls().join('|'));
    t('本地设置 quick.ball=true', Store.getSettings().quick.ball === true, JSON.stringify(Store.getSettings().quick));
    const ballSwitch2 = $('.modal-card .switch[data-action="toggle-quick"]');
    t('开关显示为已开启', !!ballSwitch2 && ballSwitch2.className.indexOf('is-on') >= 0, ballSwitch2 ? ballSwitch2.className : '');

    /* 4. 识别截图预填：金额与备注进入记账面板 */
    if (ballSwitch2) $('[data-action="close-quick"]').click();
    await sleep(120);
    const filled = App.applyOcrPrefill({ amount: 8.5, merchant: '包子铺', category: 'breakfast' });
    await sleep(150);
    const amountInput = $('#amount-input');
    const noteInput = $('#note-input');
    t('applyOcrPrefill 返回 true', filled === true, filled);
    t('金额已预填 8.5', !!amountInput && amountInput.value === '8.5', amountInput ? amountInput.value : 'no-input');
    t('备注已预填商户', !!noteInput && noteInput.value === '包子铺', noteInput ? noteInput.value : 'no-input');
    if ($('[data-action="close-sheet"]')) $('[data-action="close-sheet"]').click();
    await sleep(120);

    /* 5. 快捷入账：入账一次，重复的第二次不再新增 */
    const before = Store.all().length;
    const ok1 = App.commitQuick({ category: 'lunch', amount: 12.5, merchant: '沙县小吃', date: today, type: 'expense' });
    await sleep(120);
    const after1 = Store.all().length;
    t('commitQuick 返回 true', ok1 === true, ok1);
    t('账单新增 1 笔', after1 === before + 1, before + ' -> ' + after1);
    App.commitQuick({ category: 'lunch', amount: 12.5, merchant: '沙县小吃', date: today, type: 'expense' });
    await sleep(120);
    t('重复账单被去重', Store.all().length === after1, after1 + ' -> ' + Store.all().length);
    t('入账后页面已刷新', !!$('.page, .home-shell'), 'render ok');

    /* 6. 收入方向 */
    App.commitQuick({ category: 'income', amount: 30, type: 'income', date: today, merchant: '同事转账' });
    await sleep(120);
    const last = Store.all()[Store.all().length - 1];
    t('收入记为 income', last && last.type === 'income', last ? last.type : 'none');

    /* 7. 通知栏快捷入口开关 */
    App.openQuick('notify');
    await sleep(120);
    const notifySwitch = $('.modal-card .switch[data-action="toggle-quick"]');
    t('通知栏入口弹窗含开关', !!notifySwitch, notifySwitch ? notifySwitch.className : '');
    if (notifySwitch) notifySwitch.click();
    await sleep(150);
    t('原生收到 setNotifyQuickEnabled:true', calls().indexOf('setNotifyQuickEnabled:true') >= 0, calls().join('|'));
    t('本地设置 quick.notifyQuick=true', Store.getSettings().quick.notifyQuick === true, JSON.stringify(Store.getSettings().quick));

    /* 8. 桌面小组件：请求添加 + 权限跳转 */
    $('[data-action="close-quick"]').click();
    await sleep(100);
    App.openQuick('widget');
    await sleep(120);
    const pin = $('[data-action="quick-widget-pin"]');
    t('小组件弹窗含「请求添加到桌面」', !!pin, pin ? pin.textContent.trim() : '');
    if (pin) pin.click();
    await sleep(120);
    t('原生收到 requestPinWidget', calls().indexOf('requestPinWidget') >= 0, calls().join('|'));

    /* 9. 权限跳转 */
    $('[data-action="close-quick"]').click();
    await sleep(100);
    App.openQuick('shot');
    await sleep(120);
    const permBtn = $('.modal-card [data-action="quick-settings"]');
    t('识别截图弹窗含相册授权步骤', !!permBtn, permBtn ? permBtn.dataset.kind : '');
    if (permBtn) permBtn.click();
    await sleep(120);
    t('原生收到 openSettings:gallery', calls().indexOf('openSettings:gallery') >= 0, calls().join('|'));
    $('[data-action="close-quick"]').click();
    await sleep(100);
  } catch (e) {
    return JSON.stringify({ pass: pass, fail: fail + 1, results: results, error: String(e && e.stack || e) });
  }
  return JSON.stringify({ pass: pass, fail: fail, results: results });
})()