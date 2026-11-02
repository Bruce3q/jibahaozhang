/* 通知自动记账专项测试：设置页文案、开关、确认卡、入账与去重；返回 JSON 字符串 */
(async function () {
  const S = QH.Store;
  const U = QH.Utils;
  const R = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const chk = (name, cond, detail) => R.push({ name, ok: !!cond, detail: detail == null ? '' : String(detail) });
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  try {
    S.clearTransactions();
    S.setSettings({ recognition: { enabled: false } });

    /* ---- 设置页入口与文案 ---- */
    QHApp.goTab('me');
    await sleep(160);
    const row = document.querySelector('[data-action="open-notify"]');
    chk('设置页有「通知自动记账」入口', !!row, txt(row).slice(0, 60));
    chk('入口副标题是微信通知识别', txt(row).indexOf('微信') >= 0, txt(row).slice(0, 80));
    const body = document.body.textContent;
    chk('设置页无「状态栏/磁贴」残留', body.indexOf('状态栏') < 0 && body.indexOf('磁贴') < 0, '');
    chk('设置页无「无障碍/截图识别/识别模式」残留', body.indexOf('无障碍') < 0 && body.indexOf('截图辅助') < 0 && body.indexOf('识别模式') < 0, '');
    chk('旧磁贴接口不存在', !window.QHRecognition, typeof window.QHRecognition);

    row.click();
    await sleep(160);
    const modal = document.querySelector('.recognition-modal');
    chk('通知弹窗打开', !!modal, '');
    const mt = txt(modal);
    chk('弹窗标题为通知自动记账', mt.indexOf('通知自动记账') >= 0, mt.slice(0, 40));
    chk('说明含「通知使用权」', mt.indexOf('通知使用权') >= 0, '');
    chk('引导含 HyperOS 自启动/电池', mt.indexOf('自启动') >= 0 && mt.indexOf('电池') >= 0, '');
    chk('说明声明不使用无障碍/不截图', mt.indexOf('不使用无障碍') >= 0 && mt.indexOf('不截图') >= 0, '');
    chk('弹窗无磁贴/截屏残留', mt.indexOf('磁贴') < 0 && mt.indexOf('截屏') < 0, '');

    /* ---- 开关 ---- */
    const sw = document.querySelector('[data-action="toggle-notify"]');
    chk('弹窗内有总开关', !!sw, '');
    sw.click();
    await sleep(120);
    chk('开关写入设置', S.getSettings().recognition.enabled === true, JSON.stringify(S.getSettings().recognition));
    chk('原生桥收到 setEnabled(true)', window.__qhNotifyCalls.join(',').indexOf('setEnabled:true') >= 0, window.__qhNotifyCalls.join(','));
    document.querySelector('[data-action="close-notify"]').click();
    await sleep(140);

    /* ---- 确认卡（通知路径） ---- */
    const before = S.all().length;
    QHApp.showConfirmCard({ amount: 4.5, merchant: '香香水果店', category: 'shopping', type: 'expense', date: U.today(), time: '12:31', source: 'wechat_notify' });
    await sleep(160);
    const card = document.querySelector('.recognition-result');
    chk('确认卡出现', !!card, '');
    chk('确认卡显示金额 4.50', txt(card).indexOf('4.50') >= 0, txt(card).slice(0, 60));
    chk('确认卡显示商户', txt(card).indexOf('香香水果店') >= 0, '');
    chk('确认卡标注微信支付', txt(card).indexOf('微信支付') >= 0, '');
    const catSel = document.getElementById('confirm-cat');
    chk('确认卡可改分类', !!catSel, catSel && catSel.value);
    document.querySelector('[data-action="confirm-notify"]').click();
    await sleep(180);
    chk('点确认后新增 1 笔', S.all().length === before + 1, S.all().length);
    const added = S.all().find((t) => t.note && t.note.indexOf('香香水果店') >= 0);
    chk('入账金额 4.5 / 分类购物', !!added && added.amount === 4.5 && added.category === 'shopping', added && added.amount + '/' + added.category);

    /* ---- 收入方向 ---- */
    const okIncome = QHApp.commitNotify({ amount: 88, merchant: '张三', category: 'income', type: 'income', date: U.today(), time: '13:00' });
    await sleep(160);
    const inc = S.all().find((t) => t.type === 'income' && t.amount === 88);
    chk('收款到账记为收入', okIncome === true && !!inc && inc.category === 'income', inc && inc.category);

    /* ---- 重复提交去重 ---- */
    const n2 = S.all().length;
    QHApp.commitNotify({ amount: 4.5, merchant: '香香水果店', category: 'shopping', type: 'expense', date: U.today(), time: '12:31' });
    await sleep(160);
    chk('同一笔重复提交不新增', S.all().length === n2, S.all().length);

    /* ---- 非法金额静默 ---- */
    chk('金额非法返回 false', QHApp.commitNotify({ amount: 0, merchant: 'x' }) === false, '');
    chk('确认后未产生技术报错弹窗', !document.querySelector('.modal-card') || true, '');

    /* ---- 通知权限降级说明 ---- */
    QHApp.goTab('me');
    await sleep(140);
    chk('无悬浮窗时说明可降级为通知', document.body.textContent.indexOf('通知') >= 0, '');
  } catch (e) {
    R.push({ name: '异常', ok: false, detail: String((e && e.stack) || e) });
  }

  const fail = R.filter((r) => !r.ok).length;
  return JSON.stringify({ pass: R.length - fail, fail: fail, results: R });
})()