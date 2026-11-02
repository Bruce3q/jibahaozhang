(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : null);

  // 首页只保留两个主操作
  out.homeActions = document.querySelectorAll('.home-actions .action-btn').length;
  out.homeHasOldDaily = !!document.querySelector('.daily-card');

  // 新手引导：4 步、最后一步“我知道了”、完成后永久标记
  QHApp.showTutorial(0);
  await sleep(60);
  out.tutorialSteps = document.querySelector('.tutorial-count').textContent.trim();
  for (let i = 0; i < 3; i++) {
    document.querySelector('[data-action="tutorial-next"]').click();
    await sleep(50);
  }
  out.tutorialLast = txt(document.querySelector('.tutorial-modal h3'));
  out.tutorialDoneBtn = !!document.querySelector('[data-action="tutorial-done"]');
  document.querySelector('[data-action="tutorial-done"]').click();
  await sleep(260);
  out.onboarded = QH.Store.getMeta().onboarded;
  out.tutorialClosed = !document.getElementById('modal-root').classList.contains('is-open');

  // 记一笔 → 分类面板 → 早餐 → 金额 → 保存
  QHApp.openCatPicker();
  await sleep(260);
  out.pickerItems = document.querySelectorAll('.picker-item').length;
  out.pickerHasMeals = ['breakfast', 'lunch', 'dinner'].every((c) =>
    document.querySelector('.picker-item[data-cat="' + c + '"]')
  );
  document.querySelector('.picker-item[data-cat="breakfast"]').click();
  await sleep(260);
  out.sheetOpen = document.getElementById('sheet-root').classList.contains('is-open');
  out.sheetCat = txt(document.querySelector('.sheet-cat strong'));
  const amt = document.getElementById('amount-input');
  amt.value = '12.5';
  amt.dispatchEvent(new Event('input', { bubbles: true }));
  const note = document.getElementById('note-input');
  note.value = 'NEWTEST';
  note.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('[data-action="save-tx"]').click();
  await sleep(320);
  const today = QH.Utils.today();
  const saved = QH.Store.byDate(today).filter((t) => t.note === 'NEWTEST');
  out.savedAmount = saved.length ? saved[0].amount : null;
  out.sheetClosed = !document.getElementById('sheet-root').classList.contains('is-open');

  // 日历页选中当天，直接显示总收支 / 分类明细 / 账单
  QHApp.goTab('calendar');
  await sleep(260);
  out.dayTotals = txt(document.querySelector('.day-totals'));
  out.dayLegend = txt(document.querySelector('.day-legend'));
  out.dayRows = document.querySelectorAll('.day-panel .tx-row').length;
  out.dayPanelBelowCalendar = !!document.querySelector('.cal-card + .day-panel');

  // 预算：可自由分配实时联动
  QHApp.goTab('home');
  await sleep(120);
  document.querySelector('.budget-strip').click();
  await sleep(260);
  out.allocCard = !!document.getElementById('alloc-card');
  const setVal = (name, v) => {
    const el = document.querySelector('[name="' + name + '"]');
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  // 从演示预算出发校验公式：总预算 − 已分配
  QH.Store.loadDemo();
  await sleep(180);
  const b0 = QH.Store.getBudgets();
  const allocated0 = Object.keys(b0.categories).reduce((a, k) => a + Number(b0.categories[k] || 0), 0);
  const expect0 = Math.round((b0.monthly - allocated0) * 100) / 100;
  out.allocFormula = [txt(document.getElementById('alloc-value')), QH.Utils.money(expect0, '¥')];
  const m0 = b0.monthly;
  setVal('monthly', String(m0 + 1000));
  out.allocDelta = txt(document.getElementById('alloc-value'));
  setVal('monthly', String(m0));
  setVal('cat_breakfast', String(Number(b0.categories.breakfast || 0) + 100));
  out.allocCatDelta = txt(document.getElementById('alloc-value'));
  setVal('monthly', '500');
  out.allocOver = document.getElementById('alloc-card').classList.contains('is-over');
  out.allocOverVal = txt(document.getElementById('alloc-value'));
  document.getElementById('budget-form').requestSubmit();
  await sleep(220);
  out.savedBudget = QH.Store.getBudgets().monthly;

  // 恢复演示数据，避免测试账单留在截图里
  QH.Store.loadDemo();
  await sleep(160);
  return JSON.stringify(out);
})()
