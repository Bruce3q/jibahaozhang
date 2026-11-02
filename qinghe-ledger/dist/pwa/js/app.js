/*!
 * 记把好账 · 应用界面与交互
 * 无框架、无构建依赖：原生 JS 渲染 + 事件委托 + localStorage。
 */
(function () {
  'use strict';

  const QH = window.QH;
  const U = QH.Utils;
  const Store = QH.Store;
  const Charts = QH.Charts;
  const CATS = Store.CATEGORIES;
  const INCOME = Store.INCOME_CAT;
  const CAT_MAP = Store.CAT_MAP;
  const MEALS = Store.MEALS;
  const THEMES = Store.THEMES;

  const viewEl = document.getElementById('view');
  const tabbarEl = document.getElementById('tabbar');
  const sheetRoot = document.getElementById('sheet-root');
  const modalRoot = document.getElementById('modal-root');
  const toastEl = document.getElementById('toast');
  const metaTheme = document.getElementById('meta-theme');

  const state = {
    tab: 'home',
    route: { name: 'home' },
    cal: { view: 'month', cursor: U.today(), selected: U.today() },
    stats: { mode: 'month', anchor: U.today() },
    cumMonth: '',
    noteFrom: '',
    noteTo: '',
    sheet: null,
    picker: null,
    tutorial: null,
    calibTarget: null,
    importRows: null,
    categoryManager: false,
    catIcon: 'dots',
    renaming: null,
    confirmTx: null,
    modalResolve: null,
    toastTimer: null
  };

  const REMINDER_LAST_KEY = 'qinghe.reminder.last';

  /* =========================================================
   * 小工具
   * ======================================================= */

  const esc = U.escapeHTML;

  function sym() {
    return Store.getSettings().currency || '¥';
  }

  function money(n) {
    return U.money(n, sym());
  }

  function moneyShort(n) {
    return U.moneyShort(n, sym());
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  function hexA(hex, alpha) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function catIcon(cat, extraClass) {
    return '<span class="cat-icon ' + (extraClass || '') + '" style="--c:' + cat.color + ';--cs:' + hexA(cat.color, 0.13) + '">' + icon(cat.icon) + '</span>';
  }

  function page(inner, cls) {
    return '<div class="page ' + (cls || '') + '">' + inner + '</div>';
  }

  function sectionHead(title, right) {
    return '<div class="section-head"><h2 class="section-title">' + esc(title) + '</h2>' + (right || '') + '</div>';
  }

  function iconBtn(action, ico, label, extra) {
    return '<button class="icon-btn" data-action="' + action + '" aria-label="' + esc(label) + '" ' + (extra || '') + '>' + icon(ico) + '</button>';
  }

  function emptyState(ico, title, sub, actionHtml) {
    return (
      '<div class="empty">' +
      '<span class="empty-icon">' + icon(ico) + '</span>' +
      '<strong>' + esc(title) + '</strong>' +
      '<p>' + esc(sub) + '</p>' +
      (actionHtml || '') +
      '</div>'
    );
  }

  function txRow(t, opts) {
    opts = opts || {};
    const cat = Store.categoryOf(t);
    const sign = t.type === 'income' ? '+' : '−';
    const uneaten = t.type === 'expense' && t.amount === 0 && t.uneaten;
    const note = t.note ? '<span class="tx-note">' + esc(t.note) + '</span>' : '';
    const acts = opts.actions
      ? '<span class="tx-acts">' +
        '<button class="mini-btn" data-action="edit-tx" data-id="' + esc(t.id) + '" aria-label="编辑">' + icon('pencil') + '</button>' +
        '<button class="mini-btn danger" data-action="delete-tx" data-id="' + esc(t.id) + '" aria-label="删除">' + icon('trash') + '</button>' +
        '</span>'
      : '';
    return (
      '<div class="tx-row' + (uneaten ? ' is-uneaten' : '') + '">' +
      catIcon(cat, 'tx-ico') +
      '<div class="tx-main">' +
      '<div class="tx-title"><span>' + esc(cat.name) + '</span>' + note + '</div>' +
      '<div class="tx-meta">' + esc(t.time) + (uneaten ? ' · 已记录 · 未用餐' : t.type === 'income' ? ' · 收入' : cat.meal ? ' · 三餐' : '') + '</div>' +
      '</div>' +
      '<div class="tx-right">' +
      (uneaten
        ? '<span class="tx-amt tx-uneaten">未用餐</span>'
        : '<span class="tx-amt ' + (t.type === 'income' ? 'income' : 'expense') + '">' + sign + money(t.amount) + '</span>') +
      acts +
      '</div>' +
      '</div>'
    );
  }

  function txList(list, opts) {
    return '<div class="tx-list">' + list.map(function (t) { return txRow(t, opts); }).join('') + '</div>';
  }

  function progressHTML(percent, color) {
    return '<div class="progress"><i style="width:' + U.clamp(percent, 0, 100).toFixed(1) + '%;' + (color ? 'background:' + color : '') + '"></i></div>';
  }

  function segmented(items, active, action, extra) {
    return (
      '<div class="segmented" ' + (extra || '') + '>' +
      items.map(function (it) {
        return '<button class="seg ' + (it.value === active ? 'is-active' : '') + '" data-action="' + action + '" data-value="' + esc(it.value) + '" aria-pressed="' + (it.value === active) + '">' + esc(it.label) + '</button>';
      }).join('') +
      '</div>'
    );
  }

  /* =========================================================
   * 外观 / 主题
   * ======================================================= */

  function applyAppearance() {
    const s = Store.getSettings();
    const theme = THEMES[s.theme] || THEMES.matcha;
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-strong', theme.strong);
    root.style.setProperty('--primary-soft', theme.soft);
    const dark = s.themeMode === 'dark' || (s.themeMode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-mode', dark ? 'dark' : 'light');
    if (metaTheme) metaTheme.setAttribute('content', dark ? '#111713' : theme.meta);
    // Android / Windows 桌面壳：同步原生状态栏、标题栏颜色
    const nativeShell = window.QHAndroid || window.QHDesktop;
    if (nativeShell && typeof nativeShell.setTheme === 'function') {
      try {
        nativeShell.setTheme(dark ? '#111713' : theme.meta, dark);
      } catch (e) { /* 非原生环境忽略 */ }
    }
  }

  /* =========================================================
   * 首页
   * ======================================================= */

  function renderHome() {
    const today = U.today();
    const todayDate = U.parseYmd(today);
    const y = todayDate.getFullYear();
    const m = todayDate.getMonth();
    const budget = Store.budgetStatus(y, m);
    const settings = Store.getSettings();
    const demo = Store.getMeta().demo;

    /* 首页只保留一个精简预算条 + 两个记账主按钮，
       三餐与分类快捷入口收进「记一笔」的二级面板。 */
    let budgetStrip;
    if (budget.noBudget) {
      budgetStrip =
        '<button class="budget-strip is-empty" data-action="nav-budget">' +
        '<span class="strip-icon">' + icon('target') + '</span>' +
        '<span class="strip-main"><strong>本月预算</strong><span>设置后实时查看剩余额度</span></span>' +
        '<span class="strip-value">去设置</span>' +
        '<span class="strip-arrow">' + icon('chevron-right') + '</span>' +
        '</button>';
    } else {
      budgetStrip =
        '<button class="budget-strip' + (budget.over ? ' is-over' : '') + '" data-action="nav-budget">' +
        '<span class="strip-icon">' + icon(budget.over ? 'fire' : 'target') + '</span>' +
        '<span class="strip-main"><strong>' + (budget.over ? '本月已超支' : '本月消费剩余') + '</strong><span>已用 ' + Math.round(budget.percent) + '% · 预算 ' + money(budget.total) + '</span></span>' +
        '<span class="strip-value">' + money(Math.abs(budget.remaining)) + '</span>' +
        '<span class="strip-arrow">' + icon('chevron-right') + '</span>' +
        '<span class="strip-progress"><i style="width:' + U.clamp(budget.percent, 0, 100).toFixed(1) + '%"></i></span>' +
        '</button>';
    }

    const demoBanner = demo
      ? '<div class="demo-banner"><span>' + icon('sparkles') + '这是示例账单，方便你先体验</span><button class="link-btn" data-action="clear-demo">清空示例</button></div>'
      : '';

    const header = (
      '<header class="home-header">' +
      '<div class="home-head-left">' +
      '<p class="eyebrow">' + U.greeting() + ' · ' + U.weekdayCN(today) + '</p>' +
      '<h1 class="home-date">' + (todayDate.getMonth() + 1) + '月' + todayDate.getDate() + '日</h1>' +
      '<p class="home-sub">' + (settings.reminders.summary.enabled ? '每日 ' + settings.reminders.summary.time + ' 生成消费小结' : '极简记账，认真生活') + '</p>' +
      '</div>' +
      '<button class="avatar-btn" data-action="tab" data-tab="me" aria-label="我的">' + icon('leaf') + '</button>' +
      '</header>'
    );

    return page(
      '<div class="home-shell">' +
      header +
      demoBanner +
      budgetStrip +
      '<div class="home-spacer"><div class="home-quiet">' + icon('leaf') + '<span>把日子，记成喜欢的样子</span></div></div>' +
      '<section class="home-actions" aria-label="记账操作">' +
      '<button class="action-btn action-expense" data-action="open-cat-picker" aria-label="记一笔支出">' +
      '<span class="action-ico">' + icon('pen') + '</span>' +
      '<span class="action-text"><strong>记一笔</strong><span>选分类 · 输金额 · 保存</span></span>' +
      '</button>' +
      '<button class="action-btn action-income" data-action="quick-add" data-type="income" aria-label="记一笔收入">' +
      '<span class="action-ico">' + icon('wallet') + '</span>' +
      '<span class="action-text"><strong>收入</strong><span>工资 · 红包 · 其他</span></span>' +
      '</button>' +
      '</section>' +
      '<p class="home-hint">' + icon('info') + '三步完成，不打断生活</p>' +
      '</div>',
      'page-home'
    );
  }

  /* =========================================================
   * 日历
   * ======================================================= */

  function calendarCell(date, opts) {
    const d = U.parseYmd(date);
    const info = opts.map[date] || { expense: 0, cats: {} };
    const inMonth = d.getMonth() === opts.month;
    const isToday = date === U.today();
    const isSelected = date === opts.selected;
    const dots = Object.keys(info.cats)
      .sort(function (a, b) { return info.cats[b] - info.cats[a]; })
      .slice(0, 3)
      .map(function (c) {
        const cat = CAT_MAP[c];
        return '<i style="background:' + (cat ? cat.color : '#999') + '"></i>';
      })
      .join('');
    const cls = [
      'cal-cell',
      inMonth ? '' : 'is-out',
      isToday ? 'is-today' : '',
      isSelected ? 'is-selected' : '',
      info.expense > 0 ? 'has-spend' : ''
    ].join(' ');
    return (
      '<button class="' + cls + '" data-action="cal-select" data-date="' + date + '" aria-label="' + U.fullDateLabel(date) + (info.expense > 0 ? '，支出' + info.expense + '元' : '，无支出') + '">' +
      '<span class="cal-num">' + d.getDate() + '</span>' +
      '<span class="cal-amt">' + (info.expense > 0 ? U.compact(info.expense) : '') + '</span>' +
      '<span class="cal-dots">' + dots + '</span>' +
      '</button>'
    );
  }

  function renderCalendar() {
    const view = state.cal.view;
    const selected = state.cal.selected;
    const cursor = state.cal.cursor;
    const anchorDate = U.parseYmd(selected || cursor);
    const y = anchorDate.getFullYear();
    const m = anchorDate.getMonth();
    const monthSum = Store.monthSummary(y, m);

    let title;
    let gridHTML;
    let rangeText;

    if (view === 'month') {
      title = U.monthLabel(selected);
      const grid = U.monthGrid(y, m);
      const map = Store.dayMap(grid[0], grid[41]);
      gridHTML =
        '<div class="cal-weekdays">' +
        ['一', '二', '三', '四', '五', '六', '日'].map(function (w) { return '<span>' + w + '</span>'; }).join('') +
        '</div>' +
        '<div class="cal-grid" id="cal-grid">' +
        grid.map(function (date) { return calendarCell(date, { map: map, month: m, selected: selected }); }).join('') +
        '</div>';
      rangeText = '本月支出 <b>' + money(monthSum.expense) + '</b>';
    } else {
      const days = U.weekDays(selected);
      const map = Store.dayMap(days[0], days[6]);
      title = U.monthLabel(selected);
      gridHTML =
        '<div class="week-grid" id="cal-grid">' +
        days.map(function (date) {
          const d = U.parseYmd(date);
          const info = map[date] || { expense: 0, cats: {} };
          const dots = Object.keys(info.cats).slice(0, 3).map(function (c) {
            const cat = CAT_MAP[c];
            return '<i style="background:' + (cat ? cat.color : '#999') + '"></i>';
          }).join('');
          return (
            '<button class="week-cell ' + (date === selected ? 'is-selected' : '') + ' ' + (date === U.today() ? 'is-today' : '') + '" data-action="cal-select" data-date="' + date + '">' +
            '<span class="week-wd">' + U.weekdayShort((d.getDay() + 6) % 7) + '</span>' +
            '<span class="week-num">' + d.getDate() + '</span>' +
            '<span class="week-amt">' + (info.expense > 0 ? U.compact(info.expense) : '—') + '</span>' +
            '<span class="cal-dots">' + dots + '</span>' +
            '</button>'
          );
        }).join('') +
        '</div>';
      const s = U.parseYmd(days[0]);
      const e = U.parseYmd(days[6]);
      rangeText = (s.getMonth() + 1) + '月' + s.getDate() + '日 - ' + (e.getMonth() + 1) + '月' + e.getDate() + '日';
    }

    /* 日历选中日期后，直接展示完整日总结：总收支 + 分类明细 + 账单列表。 */
    const day = Store.daySummary(selected);
    const dayList = Store.byDate(selected);
    const breakdown = Store.categoryBreakdown(dayList);

    const dayLegend = breakdown.map(function (b) {
      return (
        '<div class="legend-row">' +
        '<i style="background:' + b.cat.color + '"></i>' +
        '<span class="legend-name">' + esc(b.cat.name) + '</span>' +
        '<b>' + money(b.amount) + '</b>' +
        '<em>' + U.percentText(b.amount, day.expense) + '</em>' +
        '</div>'
      );
    }).join('');

    const dayBreakdown = day.expense > 0
      ? '<div class="donut-layout day-donut-layout">' +
        Charts.donut(
          breakdown.map(function (b) { return { name: b.cat.name, value: b.amount, color: b.cat.color }; }),
          { size: 112, stroke: 15, centerTop: '支出', centerValue: money(day.expense) }
        ) +
        '<div class="legend day-legend">' + dayLegend + '</div>' +
        '</div>'
      : '<div class="day-cats-empty">' + icon('chart') + '<span>这一天还没有支出分类</span></div>';

    const dayPanel =
      '<section class="day-panel">' +
      '<div class="day-panel-head">' +
      '<div><h2>' + U.relativeDay(selected) + ' · ' + U.monthDayLabel(selected) + '</h2>' +
      '<p>' + dayList.length + ' 笔账单 · 点击可修改</p></div>' +
      '<button class="link-btn" data-action="nav-day" data-date="' + selected + '">详细分析' + icon('chevron-right') + '</button>' +
      '</div>' +
      '<div class="day-note-bar">' +
      (Store.getDayNote(selected)
        ? '<span class="day-note-chip">' + icon('pen') + esc(Store.getDayNote(selected)) + '</span>'
        : '<span class="day-note-empty">给这一天加个备注，比如「放纵日」</span>') +
      '<button class="link-btn" data-action="open-day-note" data-date="' + selected + '">' +
      (Store.getDayNote(selected) ? '编辑' : '添加') + '</button>' +
      '</div>' +
      '<div class="day-totals">' +
      '<div class="day-total"><span>支出</span><strong class="expense">' + money(day.expense) + '</strong></div>' +
      '<div class="day-total"><span>收入</span><strong class="income">' + money(day.income) + '</strong></div>' +
      '<div class="day-total"><span>结余</span><strong class="' + (day.balance >= 0 ? 'income' : 'expense') + '">' + money(day.balance) + '</strong></div>' +
      '</div>' +
      '<div class="day-breakdown-head"><h3>分类明细</h3><span>' + (breakdown.length ? breakdown.length + ' 个分类' : '') + '</span></div>' +
      dayBreakdown +
      '<div class="day-list-head"><h3>账单明细</h3>' +
      '<button class="day-add-btn" data-action="open-cat-picker" data-date="' + selected + '">' + icon('plus') + '补记</button>' +
      '</div>' +
      (dayList.length
        ? txList(dayList, { actions: true })
        : emptyState('calendar', '这一天还没有账单', '补记一笔，别让花销悄悄溜走', '')) +
      '</section>';

    const header =
      '<header class="page-head">' +
      '<div class="page-head-main"><p class="eyebrow">日历账单</p><h1>每一天，都有迹可循</h1></div>' +
      '<button class="ghost-btn" data-action="cal-today">今天</button>' +
      '</header>';

    const toolbar =
      '<div class="cal-toolbar">' +
      '<button class="round-btn" data-action="cal-prev" aria-label="上一' + (view === 'month' ? '月' : '周') + '">' + icon('chevron-left') + '</button>' +
      '<div class="cal-title"><strong>' + esc(title) + '</strong><span>' + rangeText + '</span></div>' +
      '<button class="round-btn" data-action="cal-next" aria-label="下一' + (view === 'month' ? '月' : '周') + '">' + icon('chevron-right') + '</button>' +
      '</div>';

    const viewSwitch = segmented(
      [{ value: 'month', label: '月' }, { value: 'week', label: '周' }],
      view,
      'cal-view',
      'aria-label="日历视图"'
    );

    return page(
      header +
      '<div class="cal-topline">' + viewSwitch + '<button class="link-btn" data-action="open-range">' + icon('chart') + '周期统计</button></div>' +
      toolbar +
      '<section class="cal-card">' + gridHTML + '</section>' +
      dayPanel,
      'page-calendar'
    );
  }

  /* =========================================================
   * 日账单详情
   * ======================================================= */

  function renderDay() {
    const date = state.route.date || U.today();
    const list = Store.byDate(date);
    const s = Store.summarize(list);
    const yday = Store.daySummary(U.addDays(date, -1));
    const breakdown = Store.categoryBreakdown(list);
    const meals = Store.mealBreakdown(list);
    const mealTotal = U.round2(meals.reduce(function (a, b) { return a + b.amount; }, 0));
    const mealPercent = s.expense ? (mealTotal / s.expense) * 100 : 0;

    let compare;
    if (s.expense <= 0) {
      compare = '<div class="compare-card is-flat">' + icon('info') + '<div><b>今天还没有支出</b><span>记下第一笔，开始了解自己的花销</span></div></div>';
    } else if (yday.expense <= 0) {
      compare = '<div class="compare-card is-flat">' + icon('info') + '<div><b>昨日没有支出记录</b><span>今日支出 ' + money(s.expense) + '，暂无对比</span></div></div>';
    } else {
      const diff = U.round2(s.expense - yday.expense);
      const up = diff > 0.004;
      const down = diff < -0.004;
      const pct = yday.expense ? Math.abs((diff / yday.expense) * 100) : 0;
      compare =
        '<div class="compare-card ' + (up ? 'is-up' : down ? 'is-down' : 'is-flat') + '">' +
        icon(up ? 'fire' : down ? 'check' : 'info') +
        '<div><b>' + (up ? '比昨天多花 ' + money(diff) : down ? '比昨天少花 ' + money(-diff) : '和昨天花费持平') + '</b>' +
        '<span>昨日支出 ' + money(yday.expense) + (up || down ? ' · ' + (up ? '上升' : '下降') + ' ' + pct.toFixed(0) + '%' : '') + '</span></div>' +
        '</div>';
    }

    const pieHTML = s.expense > 0
      ? Charts.donut(
          breakdown.map(function (b) { return { name: b.cat.name, value: b.amount, color: b.cat.color }; }),
          { size: 152, stroke: 18, centerTop: '总支出', centerValue: money(s.expense) }
        ) +
        '<div class="legend">' +
        breakdown.map(function (b) {
          return (
            '<div class="legend-row">' +
            '<i style="background:' + b.cat.color + '"></i>' +
            '<span class="legend-name">' + esc(b.cat.name) + '</span>' +
            '<b>' + money(b.amount) + '</b>' +
            '<em>' + U.percentText(b.amount, s.expense) + '</em>' +
            '</div>'
          );
        }).join('') +
        '</div>'
      : emptyState('chart', '还没有支出数据', '记一笔后，这里会显示分类占比');

    const mealHTML = meals.map(function (m) {
      return (
        '<div class="meal-stat">' +
        '<span class="meal-stat-icon" style="--c:' + m.cat.color + ';--cs:' + hexA(m.cat.color, 0.13) + '">' + icon(m.cat.icon) + '</span>' +
        '<div class="meal-stat-main">' +
        '<div class="meal-stat-title"><span>' + esc(m.cat.name) + '</span><em>' + m.count + ' 笔</em></div>' +
        progressHTML(s.expense ? (m.amount / s.expense) * 100 : 0, m.cat.color) +
        '</div>' +
        '<div class="meal-stat-val"><b>' + money(m.amount) + '</b><span>占 ' + U.percentText(m.amount, s.expense) + '</span></div>' +
        '</div>'
      );
    }).join('');

    return page(
      '<header class="page-head detail-head">' +
      iconBtn('back', 'arrow-left', '返回') +
      '<div class="page-head-main"><p class="eyebrow">日账单</p><h1>' + U.fullDateLabel(date) + ' · ' + U.weekdayCN(date) + '</h1></div>' +
      '</header>' +
      '<section class="detail-hero">' +
      '<div class="hero-label">' + U.relativeDay(date) + '支出</div>' +
      '<div class="hero-amount"><span class="hero-cur">' + esc(sym()) + '</span><strong>' + U.round2(s.expense).toFixed(2) + '</strong></div>' +
      '<div class="hero-meta"><span>收入 <b>' + money(s.income) + '</b></span><span>结余 <b>' + money(s.balance) + '</b></span><span>共 <b>' + list.length + '</b> 笔</span></div>' +
      '</section>' +
      compare +
      '<section class="card">' +
      sectionHead('分类占比', '<span class="section-note">' + (s.expense > 0 ? breakdown.length + ' 个分类' : '') + '</span>') +
      (s.expense > 0 ? '<div class="donut-layout">' + pieHTML + '</div>' : pieHTML) +
      '</section>' +
      (meals.length
        ? '<section class="card">' +
          sectionHead('三餐单独统计', '<span class="section-note">占支出 ' + U.percentText(mealTotal, s.expense) + '</span>') +
          '<div class="meal-stats">' + mealHTML + '</div>' +
          '<div class="meal-sum">三餐合计 <b>' + money(mealTotal) + '</b><span>占当日总支出 ' + U.percentText(mealTotal, s.expense) + '</span></div>' +
          '</section>'
        : '') +
      '<section class="card">' +
      sectionHead('当日明细', list.length ? '<span class="section-note">' + list.length + ' 笔</span>' : '') +
      (list.length
        ? txList(list, { actions: true })
        : emptyState('pen', '还没有账单', '点下面按钮，补记这一天的花销',
            '<button class="btn-soft" data-action="open-cat-picker" data-date="' + date + '">' + icon('plus') + '补记一笔</button>')) +
      '</section>',
      'page-detail'
    );
  }

  /* =========================================================
   * 统计
   * ======================================================= */

  function shiftAnchor(mode, anchor, dir) {
    const d = U.parseYmd(anchor);
    if (mode === 'day') return U.ymd(U.addDays(d, dir));
    if (mode === 'week') return U.ymd(U.addDays(d, dir * 7));
    if (mode === 'month') return U.ymd(U.addMonths(d, dir));
    if (mode === 'quarter') return U.ymd(U.addMonths(d, dir * 3));
    if (mode === 'year') return U.ymd(new Date(d.getFullYear() + dir, d.getMonth(), 1));
    return anchor;
  }

  function statsRange(mode, anchor) {
    const d = U.parseYmd(anchor);
    const y = d.getFullYear();
    const m = d.getMonth();
    if (mode === 'day') {
      return {
        from: anchor,
        to: anchor,
        label: U.monthDayLabel(anchor),
        sub: U.weekdayCN(anchor) + (anchor === U.today() ? ' · 今天' : ''),
        unitDays: 1
      };
    }
    if (mode === 'week') {
      const from = U.ymd(U.startOfWeek(d));
      const to = U.ymd(U.addDays(U.startOfWeek(d), 6));
      return {
        from: from,
        to: to,
        label: U.monthDayLabel(from) + ' - ' + U.monthDayLabel(to),
        sub: '周一到周日',
        unitDays: 7
      };
    }
    if (mode === 'month') {
      const from = U.ymd(new Date(y, m, 1));
      const to = U.ymd(new Date(y, m, U.daysInMonth(y, m)));
      return { from: from, to: to, label: U.monthLabel(d), sub: '自然月', unitDays: U.daysInMonth(y, m) };
    }
    if (mode === 'quarter') {
      const q = U.quarter(d);
      const startMonth = (q - 1) * 3;
      const from = U.ymd(new Date(y, startMonth, 1));
      const to = U.ymd(new Date(y, startMonth + 2, U.daysInMonth(y, startMonth + 2)));
      return { from: from, to: to, label: y + '年 第' + ['一', '二', '三', '四'][q - 1] + '季度', sub: '3 个月', unitDays: U.daysBetween(from, to) };
    }
    const from = U.ymd(new Date(y, 0, 1));
    const to = U.ymd(new Date(y, 11, 31));
    return { from: from, to: to, label: y + '年', sub: '全年', unitDays: U.daysBetween(from, to) };
  }

  function trendData(mode, range) {
    let buckets;
    let labels;
    if (mode === 'day') {
      buckets = [];
      labels = [];
      for (let h = 0; h < 24; h++) {
        buckets.push({ expense: 0, income: 0 });
        labels.push(h + '时');
      }
      Store.inRange(range.from, range.to).forEach(function (t) {
        const h = parseInt(t.time.slice(0, 2), 10) || 0;
        if (t.type === 'income') buckets[h].income += t.amount;
        else buckets[h].expense += t.amount;
      });
    } else if (mode === 'week') {
      const days = U.weekDays(range.from);
      labels = days.map(function (d) { return '周' + U.weekdayShort((U.parseYmd(d).getDay() + 6) % 7); });
      buckets = days.map(function (d) {
        const s = Store.daySummary(d);
        return { expense: s.expense, income: s.income };
      });
    } else if (mode === 'month') {
      const start = U.parseYmd(range.from);
      const dim = U.daysInMonth(start.getFullYear(), start.getMonth());
      buckets = [];
      labels = [];
      for (let i = 1; i <= dim; i++) {
        buckets.push({ expense: 0, income: 0 });
        labels.push(i + '日');
      }
      Store.inRange(range.from, range.to).forEach(function (t) {
        const idx = U.parseYmd(t.date).getDate() - 1;
        if (!buckets[idx]) return;
        if (t.type === 'income') buckets[idx].income += t.amount;
        else buckets[idx].expense += t.amount;
      });
    } else if (mode === 'quarter') {
      const start = U.parseYmd(range.from);
      buckets = [0, 1, 2].map(function () { return { expense: 0, income: 0 }; });
      labels = [0, 1, 2].map(function (i) { return start.getMonth() + i + 1 + '月'; });
      Store.inRange(range.from, range.to).forEach(function (t) {
        const idx = U.parseYmd(t.date).getMonth() - start.getMonth();
        if (!buckets[idx]) return;
        if (t.type === 'income') buckets[idx].income += t.amount;
        else buckets[idx].expense += t.amount;
      });
    } else {
      buckets = [];
      labels = [];
      for (let i = 0; i < 12; i++) {
        buckets.push({ expense: 0, income: 0 });
        labels.push(i + 1 + '月');
      }
      Store.inRange(range.from, range.to).forEach(function (t) {
        const idx = U.parseYmd(t.date).getMonth();
        if (!buckets[idx]) return;
        if (t.type === 'income') buckets[idx].income += t.amount;
        else buckets[idx].expense += t.amount;
      });
    }
    return {
      labels: labels,
      expense: buckets.map(function (b) { return U.round2(b.expense); }),
      income: buckets.map(function (b) { return U.round2(b.income); })
    };
  }

  function renderStats() {
    const mode = state.stats.mode;
    const anchor = state.stats.anchor;
    const range = statsRange(mode, anchor);
    const list = Store.inRange(range.from, range.to);
    const s = Store.summarize(list);
    const breakdown = Store.categoryBreakdown(list);
    const meals = Store.mealBreakdown(list);
    const mealTotal = U.round2(meals.reduce(function (a, b) { return a + b.amount; }, 0));
    const today = U.today();
    let elapsed = range.unitDays;
    if (today < range.from) elapsed = 0;
    else if (today <= range.to) elapsed = U.daysBetween(range.from, today);
    const avg = elapsed > 0 ? U.round2(s.expense / elapsed) : 0;
    const trend = trendData(mode, range);
    const cumulative = Store.cumulativeBalance();
    const balances = Store.balanceHistory(12);
    const currentKey = U.ymd(new Date()).slice(0, 7);
    let cumKey = /^[0-9]{4}-[0-9]{2}$/.test(state.cumMonth || '') ? state.cumMonth : currentKey;
    let cumIndex = -1;
    balances.forEach(function (b, i) { if (b.key === cumKey) cumIndex = i; });
    if (cumIndex < 0) { cumIndex = balances.length - 1; cumKey = balances[cumIndex].key; }
    const cumItem = balances[cumIndex];
    const cumLabel = cumItem.year + '年' + (cumItem.month + 1) + '月';
    const maxAbs = Math.max.apply(null, balances.map(function (b) { return Math.abs(b.balance); }).concat([1]));
    const balanceChart =
      '<div class="balance-chart" aria-label="近 12 个月结余">' +
      balances.map(function (b) {
        const pos = b.balance >= 0;
        const h = Math.max(b.balance === 0 ? 0 : 3, Math.round((Math.abs(b.balance) / maxAbs) * 100));
        return (
          '<div class="bc-col' + (b.key === cumKey ? ' is-active' : '') + '" data-action="cum-pick" data-key="' + b.key + '" title="' + b.year + '年' + (b.month + 1) + '月 结余 ' + money(b.balance) + '">' +
          '<i class="bc-bar ' + (pos ? 'pos' : 'neg') + '" style="height:' + h + '%"></i>' +
          '<span>' + (b.month + 1) + '月</span>' +
          '</div>'
        );
      }).join('') +
      '</div>';

    const cumulativeHTML =
      '<section class="cum-card">' +
      '<div class="cum-top"><span class="cum-label">' + icon('chart') + '累计结余</span>' +
      '<div class="cum-month-nav">' +
      '<button class="cum-nav-btn" data-action="cum-prev"' + (cumIndex <= 0 ? ' disabled' : '') + ' aria-label="上一个月">' + icon('chevron-left') + '</button>' +
      '<span class="cum-month-label">' + cumLabel + '</span>' +
      '<button class="cum-nav-btn" data-action="cum-next"' + (cumIndex >= balances.length - 1 ? ' disabled' : '') + ' aria-label="下一个月">' + icon('chevron-right') + '</button>' +
      '</div></div>' +
      '<div class="cum-amount ' + (cumItem.balance >= 0 ? 'income' : 'expense') + '">' + money(cumItem.balance) + '</div>' +
      '<p class="cum-sub">' + cumLabel + '当月结余 · 截至本月累计 ' + money(cumulative.total) + '</p>' +
      balanceChart +
      '<div class="balance-legend"><span><i class="dot income"></i>结余</span><span><i class="dot expense"></i>超支</span><em>近 12 个月 · 点柱切换</em></div>' +
      '</section>';

    const pieHTML = s.expense > 0
      ? Charts.donut(
          breakdown.map(function (b) { return { name: b.cat.name, value: b.amount, color: b.cat.color }; }),
          { size: 160, stroke: 18, centerTop: '总支出', centerValue: moneyShort(s.expense) }
        ) +
        '<div class="legend">' +
        breakdown.map(function (b) {
          return (
            '<div class="legend-row">' +
            '<i style="background:' + b.cat.color + '"></i>' +
            '<span class="legend-name">' + esc(b.cat.name) + '</span>' +
            '<b>' + money(b.amount) + '</b>' +
            '<em>' + U.percentText(b.amount, s.expense) + '</em>' +
            '</div>'
          );
        }).join('') +
        '</div>'
      : emptyState('chart', '这个周期没有支出', '换个周期看看，或先记一笔');

    const trendHTML = list.length
      ? Charts.line({
          labels: trend.labels,
          series: [
            { name: '支出', color: '#E07A5F', values: trend.expense, fill: true },
            { name: '收入', color: '#3FA876', values: trend.income }
          ],
          labelEvery: mode === 'day' ? 3 : mode === 'month' ? 5 : mode === 'year' ? 1 : 1,
          format: function (n) { return U.axisShort(n); }
        })
      : emptyState('chart', '暂无趋势数据', '这个周期还没有收支记录');

    const mealRows = meals.map(function (m) {
      return (
        '<div class="meal-stat">' +
        '<span class="meal-stat-icon" style="--c:' + m.cat.color + ';--cs:' + hexA(m.cat.color, 0.13) + '">' + icon(m.cat.icon) + '</span>' +
        '<div class="meal-stat-main">' +
        '<div class="meal-stat-title"><span>' + esc(m.cat.name) + '</span><em>' + m.count + ' 笔 · 占 ' + U.percentText(m.amount, s.expense) + '</em></div>' +
        progressHTML(s.expense ? (m.amount / s.expense) * 100 : 0, m.cat.color) +
        '</div>' +
        '<div class="meal-stat-val"><b>' + money(m.amount) + '</b><span>' + (m.count ? '均 ' + money(m.amount / m.count) : '—') + '</span></div>' +
        '</div>'
      );
    }).join('');

    const noteQuery = state.noteQuery || '';
    const noteFrom = state.noteFrom || '';
    const noteTo = state.noteTo || '';
    const noteStat = noteQuery ? Store.noteStats(noteQuery, { from: noteFrom, to: noteTo }) : null;
    const noteSearchHTML =
      '<section class="card note-search-card">' +
      sectionHead('备注搜索', '<span class="section-note">全部账单</span>') +
      '<div class="note-search-box">' + icon('search') +
      '<input id="note-search" class="note-search-input" type="search" autocomplete="off" placeholder="输入备注关键词，如 奶茶 / 放纵日" value="' + esc(noteQuery) + '">' +
      (noteQuery ? '<button class="icon-btn note-search-clear" data-action="note-search-clear" aria-label="清空">' + icon('close') + '</button>' : '') +
      '</div>' +
      '<div class="note-range">' +
      '<label class="note-range-field"><span>从</span><input type="date" id="note-from" value="' + esc(noteFrom) + '"></label>' +
      '<label class="note-range-field"><span>到</span><input type="date" id="note-to" value="' + esc(noteTo) + '"></label>' +
      '<button class="note-range-clear" data-action="note-range-clear"' + (noteFrom || noteTo ? '' : ' disabled') + '>清除</button>' +
      '</div>' +
      '<div id="note-search-result">' + noteSearchResultHTML(noteStat) + '</div>' +
      '</section>';

    const periodBar =
      '<div class="period-bar">' +
      '<button class="round-btn" data-action="stats-prev" aria-label="上一周期">' + icon('chevron-left') + '</button>' +
      '<div class="period-title"><strong>' + esc(range.label) + '</strong><span>' + esc(range.sub) + '</span></div>' +
      '<button class="round-btn" data-action="stats-next" aria-label="下一周期">' + icon('chevron-right') + '</button>' +
      '</div>';

    return page(
      '<header class="page-head">' +
      '<div class="page-head-main"><p class="eyebrow">统计分析</p><h1>看懂每一笔花销</h1></div>' +
      '</header>' +
      segmented(
        [
          { value: 'day', label: '日' },
          { value: 'week', label: '周' },
          { value: 'month', label: '月' },
          { value: 'quarter', label: '季' },
          { value: 'year', label: '年' }
        ],
        mode,
        'stats-mode',
        'aria-label="统计维度"'
      ) +
      periodBar +
      '<section class="stat-summary">' +
      '<div class="stat-cell"><span>总支出</span><strong class="expense">' + money(s.expense) + '</strong><em>' + s.count + ' 笔</em></div>' +
      '<div class="stat-cell"><span>总收入</span><strong class="income">' + money(s.income) + '</strong><em>结余 ' + money(s.balance) + '</em></div>' +
      '<div class="stat-cell"><span>日均支出</span><strong>' + money(avg) + '</strong><em>' + elapsed + ' 天</em></div>' +
      '<div class="stat-cell"><span>三餐支出</span><strong>' + money(mealTotal) + '</strong><em>占 ' + U.percentText(mealTotal, s.expense) + '</em></div>' +
      '</section>' +
      '<section class="card">' +
      sectionHead('分类支出占比', '<span class="section-note">' + (breakdown.length ? breakdown.length + ' 类' : '') + '</span>') +
      (s.expense > 0 ? '<div class="donut-layout">' + pieHTML + '</div>' : pieHTML) +
      '</section>' +
      '<section class="card">' +
      sectionHead('收支趋势', '<div class="legend-inline"><span><i class="dot expense"></i>支出</span><span><i class="dot income"></i>收入</span></div>') +
      trendHTML +
      '</section>' +
      (meals.length
        ? '<section class="card">' +
          sectionHead('三餐专项统计', '<span class="section-note">合计 ' + money(mealTotal) + '</span>') +
          '<div class="meal-stats">' + mealRows + '</div>' +
          '<div class="meal-sum">三餐占周期总支出 <b>' + U.percentText(mealTotal, s.expense) + '</b>' +
          '<span>' + (s.expense > 0 ? meals.map(function (m) {
            return esc(m.cat.name) + ' ' + U.percentText(m.amount, mealTotal);
          }).join(' · ') : '暂无支出') + '</span></div>' +
          '</section>'
        : '') +
      cumulativeHTML +
      noteSearchHTML,
      'page-stats'
    );
  }

  /* =========================================================
   * 预算
   * ======================================================= */

  /* 预算分配余额 = 月度总预算 − 所有分类预算之和。
     注意：它是“还没分配出去的预算”，不是“还没花掉的钱”。 */
  function budgetAllocation(monthly, categories) {
    let allocated = 0;
    Object.keys(categories || {}).forEach(function (k) {
      allocated += U.toNumber(categories[k]);
    });
    allocated = U.round2(allocated);
    return {
      monthly: U.round2(U.toNumber(monthly)),
      allocated: allocated,
      free: U.round2(U.toNumber(monthly) - allocated)
    };
  }

  function updateAllocCard() {
    const form = document.getElementById('budget-form');
    const card = document.getElementById('alloc-card');
    if (!form || !card) return;
    const monthlyEl = form.querySelector('input[name="monthly"]');
    let allocated = 0;
    form.querySelectorAll('input[name^="cat_"]').forEach(function (el) {
      allocated += U.toNumber(el.value);
    });
    const monthly = U.toNumber(monthlyEl && monthlyEl.value);
    const free = U.round2(monthly - allocated);
    const over = free < -0.004;
    const noBudget = monthly <= 0;

    card.classList.toggle('is-over', over);
    const badge = document.getElementById('alloc-badge');
    const value = document.getElementById('alloc-value');
    const total = document.getElementById('alloc-total');
    const used = document.getElementById('alloc-used');
    const tip = document.getElementById('alloc-tip');
    if (badge) badge.textContent = noBudget ? '待设置' : over ? '已超分配' : '分配剩余';
    if (value) value.textContent = (over ? '−' : '') + money(Math.abs(free));
    if (total) total.textContent = money(monthly);
    if (used) used.textContent = money(U.round2(allocated));
    if (tip) {
      tip.textContent = noBudget && allocated <= 0
        ? '先填写月度总预算，再把预算分配到三餐和各个分类。'
        : over
          ? '分类预算合计已超出总预算 ' + money(Math.abs(free)) + '，请调低分类预算或提高总预算。该数值仅表示预算分配余额，不是消费剩余。'
          : '预算分配余额，仅用于规划尚未分配的分类预算，不等于本月消费剩余。';
    }
  }

  function openCalibration() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const cal = Store.getCalibration(y, m);
    const actual = Store.monthSummary(y, m).expense;
    state.calibTarget = { y: y, m: m };
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="close-calibration"></div>' +
      '<div class="modal-card calib-modal" role="dialog" aria-modal="true" aria-label="校准本月已消费">' +
      '<div class="modal-head"><h3>校准本月已消费</h3><button class="icon-btn" data-action="close-calibration" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<p class="modal-text">用于月中开始使用、或账单不完整时对齐预算。只影响预算与累计结余，不会修改任何账单明细。</p>' +
      '<label class="money-input large"><span>' + esc(sym()) + '</span><input id="calib-input" type="number" inputmode="decimal" min="0" step="1" value="' + (cal != null ? cal : actual) + '" placeholder="输入本月已消费" aria-label="本月已消费"></label>' +
      '<p class="form-tip">当前账单合计 ' + money(actual) + '；留空并保存则恢复为按账单自动统计。</p>' +
      '<div class="modal-actions">' +
      '<button class="btn-ghost" data-action="clear-calibration">恢复自动统计</button>' +
      '<button class="btn-primary" data-action="save-calibration">保存校准</button>' +
      '</div></div>';
    modalRoot.classList.add('is-open');
    setTimeout(function () {
      const input = document.getElementById('calib-input');
      if (input) { input.focus({ preventScroll: true }); input.select(); }
    }, 80);
  }

  function closeCalibration() {
    state.calibTarget = null;
    modalRoot.classList.remove('is-open');
    setTimeout(function () {
      if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = '';
    }, 180);
  }

  function saveCalibration(clear) {
    const t = state.calibTarget;
    if (!t) return;
    if (clear) {
      Store.setCalibration(t.y, t.m, null);
      toast('已恢复按账单自动统计');
    } else {
      const input = document.getElementById('calib-input');
      const v = input ? input.value.trim() : '';
      if (v === '') Store.setCalibration(t.y, t.m, null);
      else Store.setCalibration(t.y, t.m, U.toNumber(v));
      toast('已校准本月已消费');
    }
    closeCalibration();
  }

  function renderBudget() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const status = Store.budgetStatus(y, m);
    const budgets = Store.getBudgets();
    const month = Store.monthSummary(y, m);
    const spentByCat = month.byCat;

    const alloc = budgetAllocation(budgets.monthly, budgets.categories);
    const allocOver = alloc.free < -0.004;
    const allocHTML =
      '<section class="alloc-card' + (allocOver ? ' is-over' : '') + '" id="alloc-card">' +
      '<div class="alloc-top"><span class="alloc-label">' + icon('sliders') + '本月可自由分配</span><span class="alloc-badge" id="alloc-badge">' +
      (alloc.monthly <= 0 ? '待设置' : allocOver ? '已超分配' : '分配剩余') + '</span></div>' +
      '<div class="alloc-amount" id="alloc-value">' + (allocOver ? '−' : '') + money(Math.abs(alloc.free)) + '</div>' +
      '<div class="alloc-meta"><span>总预算 <b id="alloc-total">' + money(alloc.monthly) + '</b></span><span>已分配 <b id="alloc-used">' + money(alloc.allocated) + '</b></span></div>' +
      '<p class="alloc-tip" id="alloc-tip">' +
      (alloc.monthly <= 0 && alloc.allocated <= 0
        ? '先填写月度总预算，再把预算分配到三餐和各个分类。'
        : allocOver
          ? '分类预算合计已超出总预算 ' + money(Math.abs(alloc.free)) + '，请调低分类预算或提高总预算。该数值仅表示预算分配余额，不是消费剩余。'
          : '预算分配余额，仅用于规划尚未分配的分类预算，不等于本月消费剩余。') +
      '</p>' +
      '</section>';

    // 未设置总预算时不再重复一张空的“消费剩余”卡，避免与分配卡重复
    const hero = status.noBudget ? '' :
      '<section class="budget-hero' + (status.over ? ' is-over' : '') + '">' +
      '<div class="budget-hero-top"><span>本月消费剩余</span><span class="budget-hero-badge">' + (status.noBudget ? '未设置' : status.over ? '已超支' : '进行中') + '</span></div>' +
      (status.noBudget ? '' : '<div class="budget-hero-amount"><small>' + (status.over ? '已超支' : '剩余可用') + '</small><strong>' + money(Math.abs(status.remaining)) + '</strong></div>') +
      (status.noBudget
        ? '<p class="budget-hero-tip">填写下方月度总预算，开始管理花销</p>'
        : '<div class="budget-hero-progress">' + progressHTML(status.percent) + '<div class="budget-hero-meta"><span>已花费 ' + money(status.spent) + '</span><span>预算 ' + money(status.total) + '</span></div></div>') +
      '</section>';

    const insight =
      '<section class="insight-grid">' +
      '<div class="insight"><span>日均预算</span><b>' + money(status.dailyAvg) + '</b></div>' +
      '<div class="insight"><span>今日可用</span><b class="' + (status.over ? 'expense' : 'income') + '">' + (status.over ? money(0) : money(status.todayAvailable)) + '</b></div>' +
      '<div class="insight"><span>本月剩余天数</span><b>' + status.daysLeft + ' 天</b></div>' +
      '</section>';

    const catRow = function (cat) {
      const limit = budgets.categories[cat.id] || 0;
      const spent = U.round2(spentByCat[cat.id] || 0);
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      return (
        '<div class="budget-row">' +
        '<div class="budget-row-head">' +
        catIcon(cat) +
        '<div class="budget-row-main"><div class="budget-row-title"><span>' + esc(cat.name) + '</span><em>' + (limit > 0 ? (spent > limit ? '超 ' + money(spent - limit) : '剩 ' + money(limit - spent)) : '已用 ' + money(spent)) + '</em></div>' +
        (limit > 0 ? progressHTML(pct) : '') +
        '</div>' +
        '<label class="money-input compact"><span>' + esc(sym()) + '</span><input type="number" inputmode="decimal" min="0" step="1" name="cat_' + esc(cat.id) + '" value="' + (limit || '') + '" placeholder="0" aria-label="' + esc(cat.name) + '预算"></label>' +
        '</div>' +
        '</div>'
      );
    };

    const mealCats = CATS.filter(function (c) { return c.meal; });
    const otherCats = CATS.filter(function (c) { return !c.meal; });

    return page(
      '<header class="page-head detail-head">' +
      iconBtn('back', 'arrow-left', '返回') +
      '<div class="page-head-main"><p class="eyebrow">预算管理</p><h1>量入为出，心有底气</h1></div>' +
      '</header>' +
      allocHTML +
      hero +
      '<button class="calib-card' + (status.calibrated ? ' is-calibrated' : '') + '" data-action="open-calibration">' +
      '<span class="calib-ico">' + icon('sliders') + '</span>' +
      '<span class="calib-main"><strong>校准本月已消费</strong><em>' +
      (status.calibrated ? '已校准为 ' + money(status.spent) + ' · 账单实际 ' + money(status.actual) : '按账单自动统计 ' + money(status.actual) + '，可手动对齐') +
      '</em></span>' + icon('chevron-right') +
      '</button>' +
      insight +
      '<form id="budget-form" class="budget-form" novalidate>' +
      '<section class="card">' +
      sectionHead('月度总预算', '<span class="section-note">每月 1 日自动重置</span>') +
      '<label class="money-input large"><span>' + esc(sym()) + '</span><input type="number" inputmode="decimal" min="0" step="1" name="monthly" value="' + (budgets.monthly || '') + '" placeholder="例如 5000" aria-label="月度总预算"></label>' +
      '<p class="form-tip">建议设为月收入的 60%～70%，先跑一个月再调整。</p>' +
      '</section>' +
      (mealCats.length
        ? '<section class="card">' +
          sectionHead('三餐预算', '<span class="section-note">单独控制吃饭花销</span>') +
          mealCats.map(catRow).join('') +
          '</section>'
        : '') +
      '<section class="card">' +
      sectionHead('分类预算', '<span class="section-note">留空表示不限制</span>') +
      otherCats.map(catRow).join('') +
      '</section>' +
      '<button type="submit" class="btn-primary btn-block">保存预算</button>' +
      '</form>',
      'page-budget'
    );
  }

  /* =========================================================
   * 账单导入（微信 / 支付宝 CSV / XLSX，全程本地）
   * ======================================================= */

  function requestImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) return;
      toast('正在本地解析 ' + file.name + '…');
      QH.Import.parseFile(file).then(function (result) {
        showImportPreview(result);
      }).catch(function (err) {
        toast(err.message || '解析失败，请检查文件格式', 'warn');
      });
    });
    input.click();
  }

  function importCatOptions(item) {
    if (item.type === 'income') return '<option value="income" selected>收入</option>';
    return CATS.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === item.category ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
  }

  function importRowsHTML() {
    return (state.importRows || []).map(function (it, i) {
      return (
        '<div class="import-row' + (it.duplicate ? ' is-dup' : '') + '" data-idx="' + i + '">' +
        '<label class="import-check"><input type="checkbox" data-import-check="' + i + '"' + (it.checked ? ' checked' : '') + (it.duplicate ? ' disabled' : '') + '><span></span></label>' +
        '<div class="import-main">' +
        '<div class="import-line"><b>' + esc(it.note || '导入账单') + '</b><em class="' + (it.type === 'income' ? 'income' : 'expense') + '">' + (it.type === 'income' ? '+' : '−') + money(it.amount) + '</em></div>' +
        '<div class="import-sub">' + esc(it.date) + ' ' + esc(it.time) + (it.duplicate ? ' · 已存在，将跳过' : '') + '</div>' +
        '<select class="import-cat" data-import-cat="' + i + '" aria-label="分类">' + importCatOptions(it) + '</select>' +
        '</div></div>'
      );
    }).join('');
  }

  function updateImportSummary() {
    const rows = state.importRows || [];
    const checked = rows.filter(function (r) { return r.checked; }).length;
    const dup = rows.filter(function (r) { return r.duplicate; }).length;
    const sum = rows.reduce(function (a, r) { return a + (r.checked ? r.amount : 0); }, 0);
    const el = document.getElementById('import-summary');
    if (el) el.textContent = '已选 ' + checked + ' / ' + rows.length + ' 笔 · 合计 ' + money(sum) + (dup ? ' · 重复 ' + dup + ' 笔' : '');
    const all = document.getElementById('import-all');
    if (all) all.checked = rows.length > 0 && checked === rows.length;
    const btn = document.getElementById('import-confirm');
    if (btn) btn.disabled = checked === 0;
  }

  function showImportPreview(result) {
    const rows = (result.items || []).map(function (it) {
      return Object.assign({}, it, { checked: !it.duplicate });
    });
    if (!rows.length) {
      toast((result.warnings && result.warnings[0]) || '没有可入账的交易', 'warn');
      return;
    }
    state.importRows = rows;
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="close-import"></div>' +
      '<div class="modal-card import-modal" role="dialog" aria-modal="true" aria-label="导入账单预览">' +
      '<div class="modal-head"><h3>导入预览</h3><button class="icon-btn" data-action="close-import" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<p class="modal-text">来自 ' + esc(result.source || '账单文件') + '，解析后仅在本地处理。请确认交易和分类，重复账单会自动跳过。</p>' +
      '<label class="import-all-row"><input type="checkbox" id="import-all" checked><span>全选未重复交易</span><em id="import-summary"></em></label>' +
      '<div class="import-list">' + importRowsHTML() + '</div>' +
      '<div class="modal-actions"><button class="btn-ghost" data-action="close-import">取消</button>' +
      '<button class="btn-primary" id="import-confirm" data-action="confirm-import">确认入账</button></div>' +
      '</div>';
    modalRoot.classList.add('is-open');
    updateImportSummary();
    if (result.warnings && result.warnings.length) {
      const tip = document.createElement('p');
      tip.className = 'form-tip';
      tip.textContent = result.warnings[0] + (result.warnings.length > 1 ? ' 等 ' + result.warnings.length + ' 条提示' : '');
      const list = modalRoot.querySelector('.import-list');
      if (list) list.parentNode.insertBefore(tip, list);
    }
  }

  function closeImport() {
    state.importRows = null;
    modalRoot.classList.remove('is-open');
    setTimeout(function () {
      if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = '';
    }, 180);
  }

  function confirmImport() {
    const rows = (state.importRows || []).filter(function (r) { return r.checked; });
    if (!rows.length) return;
    const payload = rows.map(function (r) {
      return { type: r.type, amount: r.amount, category: r.category, note: r.note, date: r.date, time: r.time };
    });
    const res = Store.addTransactions(payload);
    closeImport();
    toast('已入账 ' + res.added + ' 笔' + (res.skipped ? '，跳过 ' + res.skipped + ' 笔重复' : ''));
  }

  /* =========================================================
   * 日历自定义周期统计
   * ======================================================= */

  function openRange() {
    const now = U.today();
    const d = U.parseYmd(now);
    const start = U.ymd(new Date(d.getFullYear(), d.getMonth(), 1));
    state.range = { start: start, end: now, list: [] };
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="close-range"></div>' +
      '<div class="modal-card range-modal" role="dialog" aria-modal="true" aria-label="自定义周期统计">' +
      '<div class="modal-head"><h3>自定义周期统计</h3><button class="icon-btn" data-action="close-range" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<div class="range-dates">' +
      '<label class="field"><span>开始日期</span><input type="date" id="range-start" value="' + start + '"></label>' +
      '<label class="field"><span>结束日期</span><input type="date" id="range-end" value="' + now + '"></label>' +
      '</div>' +
      '<button class="btn-primary btn-block" data-action="range-run">生成统计</button>' +
      '<div id="range-result" class="range-result"></div>' +
      '</div>';
    modalRoot.classList.add('is-open');
    runRange();
  }

  function rangeList() {
    const s = document.getElementById('range-start');
    const e = document.getElementById('range-end');
    let start = s ? s.value : '';
    let end = e ? e.value : '';
    if (!U.isYmd(start) || !U.isYmd(end)) return null;
    if (start > end) { const t = start; start = end; end = t; }
    return Store.all().filter(function (t) { return t.date >= start && t.date <= end; });
  }

  function runRange() {
    const list = rangeList();
    if (!list) return;
    const box = document.getElementById('range-result');
    if (!box) return;
    const s = Store.summarize(list);
    const breakdown = Store.categoryBreakdown(list);
    const start = document.getElementById('range-start').value;
    const end = document.getElementById('range-end').value;
    state.range = { start: start > end ? end : start, end: start > end ? start : end, list: list };
    box.innerHTML =
      '<div class="range-summary">' +
      '<div><span>支出</span><b class="expense">' + money(s.expense) + '</b></div>' +
      '<div><span>收入</span><b class="income">' + money(s.income) + '</b></div>' +
      '<div><span>结余</span><b>' + money(s.balance) + '</b></div>' +
      '<div><span>笔数</span><b>' + list.length + ' 笔</b></div>' +
      '</div>' +
      (breakdown.length
        ? '<div class="range-cats">' + breakdown.map(function (b) {
            return '<div class="range-cat"><i style="background:' + b.cat.color + '"></i><span>' + esc(b.cat.name) + '</span><b>' + money(b.amount) + '</b><em>' + U.percentText(b.amount, s.expense) + '</em></div>';
          }).join('') + '</div>'
        : '<p class="form-tip">这个周期还没有支出。</p>') +
      '<button class="btn-soft btn-block" data-action="range-export"' + (list.length ? '' : ' disabled') + '>' + icon('download') + '导出这段账单</button>';
  }

  function exportRange() {
    const r = state.range;
    if (!r || !r.list || !r.list.length) return toast('这个周期没有账单', 'warn');
    const rows = [['日期', '时间', '类型', '分类', '金额', '备注']];
    r.list.slice().sort(function (a, b) {
      return (a.date + a.time).localeCompare(b.date + b.time);
    }).forEach(function (t) {
      rows.push([t.date, t.time, t.type === 'income' ? '收入' : '支出', (CAT_MAP[t.category] || {}).name || t.category, t.amount.toFixed(2), t.note || (t.uneaten ? '未用餐' : '')]);
    });
    const csv = rows.map(function (row) {
      return row.map(function (v) {
        const s = String(v == null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
    U.download('记把好账_周期_' + r.start + '_' + r.end + '.csv', new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    toast('周期账单已导出');
  }

  /* =========================================================
   * 我的 / 设置
   * ======================================================= */

  /** 本地提醒所需的系统通知桥（Android 原生 QHNotify；网页版为 null）。 */
  function notifyBridge() {
    return window.QHNotify || null;
  }

  function renderMe() {
    const s = Store.getSettings();
    const b = Store.getBudgets();
    const all = Store.all();
    const today = U.today();
    const month = Store.monthSummary(U.parseYmd(today).getFullYear(), U.parseYmd(today).getMonth());
    const meta = Store.getMeta();
    const nBridge = notifyBridge();
    const notifyState = nBridge && nBridge.notificationGranted
      ? (nBridge.notificationGranted()
        ? { text: '系统通知已开启', ok: true }
        : { text: '开启系统通知，锁屏时也能收到提醒', ok: false, native: true })
      : !('Notification' in window)
        ? { text: '当前浏览器不支持系统通知，将使用应用内提醒', ok: false }
        : Notification.permission === 'granted'
          ? { text: '系统通知已开启', ok: true }
          : Notification.permission === 'denied'
            ? { text: '通知权限被浏览器拒绝，请在站点设置中开启', ok: false }
            : { text: '开启系统通知，锁屏时也能收到提醒', ok: false };

    const themeSwatches = Object.keys(THEMES).map(function (id) {
      const t = THEMES[id];
      return (
        '<button class="swatch ' + (s.theme === id ? 'is-active' : '') + '" style="--sw:' + t.primary + '" data-action="set-theme" data-theme="' + id + '" aria-label="' + t.name + '" aria-pressed="' + (s.theme === id) + '">' +
        (s.theme === id ? icon('check') : '') +
        '</button>'
      );
    }).join('');

    const reminderRow = function (kind, title, sub, ico) {
      const r = s.reminders[kind];
      return (
        '<div class="reminder-row">' +
        '<span class="row-icon">' + icon(ico) + '</span>' +
        '<div class="row-main"><div class="row-title">' + title + '</div><div class="row-sub">' + sub + '</div></div>' +
        '<div class="reminder-actions">' +
        '<input class="time-input" type="time" value="' + esc(r.time) + '" data-reminder-time="' + kind + '" aria-label="' + title + '时间" ' + (r.enabled ? '' : 'disabled') + '>' +
        '<button class="switch ' + (r.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + r.enabled + '" data-action="toggle-reminder" data-kind="' + kind + '" aria-label="开启' + title + '"><span></span></button>' +
        '</div>' +
        '</div>'
      );
    };

    const budgetSummary = b.monthly > 0
      ? '月度 ' + money(b.monthly) + ' · 已用 ' + money(month.expense)
      : '尚未设置月度预算';

    return page(
      '<header class="me-head">' +
      '<div class="me-brand">' +
      '<span class="logo">' + icon('leaf') + '</span>' +
      '<div><h1>记把好账</h1><p>极简 · 无广告 · 数据只存本地</p></div>' +
      '</div>' +
      '<div class="me-metrics">' +
      '<div><span>本月支出</span><b>' + money(month.expense) + '</b></div>' +
      '<div><span>累计账单</span><b>' + all.length + ' 笔</b></div>' +
      '<div><span>预算状态</span><b>' + (b.monthly > 0 ? (month.expense > b.monthly ? '已超支' : '正常') : '未设置') + '</b></div>' +
      '</div>' +
      '</header>' +

      '<section class="group">' +
      '<button class="list-row" data-action="nav-budget">' +
      '<span class="row-icon primary">' + icon('target') + '</span>' +
      '<div class="row-main"><div class="row-title">预算管理</div><div class="row-sub">' + budgetSummary + '</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '<button class="list-row" data-action="open-categories">' +
      '<span class="row-icon primary">' + icon('sliders') + '</span>' +
      '<div class="row-main"><div class="row-title">分类管理</div><div class="row-sub">' + CATS.length + ' 个支出分类 · 新增或删除</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '</section>' +

      '<section class="group">' +
      '<h2 class="group-title">提醒</h2>' +
      '<div class="group-card">' +
      reminderRow('summary', '每日消费小结', '看看今天花了多少', 'sparkles') +
      reminderRow('log', '每日记账提醒', '别忘了补记今天的账单', 'bell') +
      reminderRow('weekly', '每周总结', '每周一 · 上周总支出与 Top3 分类', 'calendar') +
      reminderRow('monthly', '每月总结', '每月 1 日 · 上月账单复盘', 'chart') +
      reminderRow('yearly', '每年总结', '每年 1 月 1 日 · 全年账单复盘', 'sparkles') +
      '<div class="permission-note ' + (notifyState.ok ? 'is-ok' : '') + '">' + icon(notifyState.ok ? 'check' : 'info') + '<span>' + notifyState.text + '</span>' +
      (!notifyState.ok && ('Notification' in window || (nBridge && nBridge.requestNotificationPermission)) ? '<button class="link-btn" data-action="notify-permission">去开启</button>' : '') +
      '</div>' +
      '</div>' +
      '</section>' +

      '<section class="group">' +
      '<h2 class="group-title">快速记账</h2>' +
      '<div class="group-card">' +
      '<button class="list-row" data-action="open-quick" data-kind="ball">' +
      '<span class="row-icon primary">' + icon('sparkles') + '</span>' +
      '<div class="row-main"><div class="row-title">悬浮球快捷记账</div><div class="row-sub">' +
      (window.QHQuick ? ((Store.getSettings().quick || {}).ball ? '已开启 · 可拖动，松手自动吸边' : '未开启 · 常驻小球，点一下弹记账小窗') : '网页版不可用，需安装 Android 版') +
      '</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '<button class="list-row" data-action="open-quick" data-kind="tile">' +
      '<span class="row-icon primary">' + icon('chart') + '</span>' +
      '<div class="row-main"><div class="row-title">状态栏磁贴「记一笔」</div><div class="row-sub">下拉控制中心点一下，直接打开记账面板</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '<button class="list-row" data-action="open-quick" data-kind="notify">' +
      '<span class="row-icon">' + icon('bell') + '</span>' +
      '<div class="row-main"><div class="row-title">通知栏常驻「记一笔」</div><div class="row-sub">' +
      (window.QHQuick ? ((Store.getSettings().quick || {}).notifyQuick ? '已开启 · 下拉状态栏点一下' : '未开启 · 不需要悬浮窗权限') : '网页版不可用，需安装 Android 版') +
      '</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '</div>' +
      '</section>' +

      '<section class="group">' +
      '<h2 class="group-title">外观</h2>' +
      '<div class="group-card">' +
      '<div class="setting-row"><div class="row-main"><div class="row-title">主题色</div><div class="row-sub">柔和低饱和，久看不累</div></div></div>' +
      '<div class="theme-swatches">' + themeSwatches + '</div>' +
      '<div class="setting-divider"></div>' +
      '<div class="setting-row"><div class="row-main"><div class="row-title">深色模式</div><div class="row-sub">跟随系统或手动选择</div></div></div>' +
      '<div class="mode-switch">' +
      segmented(
        [{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }],
        s.themeMode,
        'set-mode',
        'aria-label="深色模式"'
      ) +
      '</div>' +
      '<div class="setting-divider"></div>' +
      '<div class="setting-row"><div class="row-main"><div class="row-title">货币单位</div><div class="row-sub">显示在金额前面的符号</div></div>' +
      '<label class="currency-input"><input type="text" maxlength="3" value="' + esc(s.currency) + '" data-currency aria-label="货币单位"></label>' +
      '</div>' +
      '<p class="form-tip">可输入 ¥、$、€、£ 或“元”等自定义符号。</p>' +
      '</div>' +
      '</section>' +

      '<section class="group">' +
      '<h2 class="group-title">数据</h2>' +
      '<div class="group-card">' +
      '<button class="list-row" data-action="export-csv">' +
      '<span class="row-icon">' + icon('file') + '</span>' +
      '<div class="row-main"><div class="row-title">导出 CSV</div><div class="row-sub">Excel / WPS / Numbers 均可打开</div></div>' +
      '<span class="row-arrow">' + icon('download') + '</span>' +
      '</button>' +
      '<button class="list-row" data-action="export-excel">' +
      '<span class="row-icon">' + icon('database') + '</span>' +
      '<div class="row-main"><div class="row-title">导出 Excel</div><div class="row-sub">带表头样式的 .xls 表格</div></div>' +
      '<span class="row-arrow">' + icon('download') + '</span>' +
      '</button>' +
      '<button class="list-row" data-action="import-bill">' +
      '<span class="row-icon primary">' + icon('upload') + '</span>' +
      '<div class="row-main"><div class="row-title">导入微信 / 支付宝账单</div><div class="row-sub">CSV / XLSX，本地解析，先预览再入账</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '<button class="list-row" data-action="backup">' +
      '<span class="row-icon">' + icon('shield') + '</span>' +
      '<div class="row-main"><div class="row-title">备份数据</div><div class="row-sub">JSON 备份，换机或重装前先存一份</div></div>' +
      '<span class="row-arrow">' + icon('download') + '</span>' +
      '</button>' +
      '<button class="list-row" data-action="restore">' +
      '<span class="row-icon">' + icon('upload') + '</span>' +
      '<div class="row-main"><div class="row-title">恢复备份</div><div class="row-sub">从 JSON 备份恢复账单与设置</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '<input type="file" id="restore-file" accept=".json,application/json" hidden>' +
      '</div>' +
      '</section>' +

      '<section class="group">' +
      '<h2 class="group-title">其他</h2>' +
      '<div class="group-card">' +
      '<button class="list-row" data-action="show-tutorial">' +
      '<span class="row-icon primary">' + icon('sparkles') + '</span>' +
      '<div class="row-main"><div class="row-title">新手使用教程</div><div class="row-sub">3 分钟了解记账、日历和预算</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '<button class="list-row" data-action="load-demo">' +
      '<span class="row-icon">' + icon('sparkles') + '</span>' +
      '<div class="row-main"><div class="row-title">载入示例数据</div><div class="row-sub">会覆盖账单与预算，设置保留</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '<button class="list-row danger" data-action="clear-data">' +
      '<span class="row-icon danger">' + icon('trash') + '</span>' +
      '<div class="row-main"><div class="row-title">清空账单</div><div class="row-sub">删除全部账单，设置与预算保留</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '</div>' +
      '</section>' +

      '<section class="about-card">' +
      '<span class="about-logo">' + icon('leaf') + '</span>' +
      '<p>记把好账 v1.6.10</p>' +
      '<span>没有广告，没有社交，没有账号。所有数据仅保存在你的浏览器本地。</span>' +
      '<span class="storage-note">' + (Store.isStorageOK() ? icon('lock') + '本地存储正常' : icon('info') + '本地存储不可用，请勿清理浏览器数据') + '</span>' +
      (meta.lastBackupAt ? '<span class="storage-note">上次备份：' + esc(U.fullDateLabel(U.ymd(new Date(meta.lastBackupAt)))) + '</span>' : '') +
      '</section>',
      'page-me'
    );
  }

  /* =========================================================
   * 分类管理
   * ======================================================= */

  /* 新增分类时可挑选的图标，与 store.js 的白名单保持一致 */
  const CAT_ICON_CHOICES = ['dots', 'utensils', 'fruit', 'snack', 'leaf', 'fire', 'sunrise', 'bowl', 'moon',
    'bus', 'bag', 'game', 'basket', 'shower', 'water', 'shirt', 'home', 'sparkles', 'palette', 'target',
    'bell', 'shield', 'file', 'lock', 'sun', 'chart', 'calendar', 'pencil', 'download', 'upload',
    'refresh', 'search', 'info', 'database'];

  /** 优先推荐一个还没被占用的图标，新分类一眼能区分开。 */
  function suggestedCategoryIcon() {
    const used = {};
    CATS.forEach(function (c) {
      used[c.icon] = true;
    });
    for (let i = 0; i < CAT_ICON_CHOICES.length; i++) {
      if (!used[CAT_ICON_CHOICES[i]]) return CAT_ICON_CHOICES[i];
    }
    return 'dots';
  }

  /* 打开弹窗时不再自动聚焦输入框：移动端会立刻弹出输入法，
     删除分类后重新打开同样不该弹键盘。只有“添加成功后继续输入”才聚焦。 */
  function openCategoryManager() {
    state.categoryManager = true;
    state.catIcon = suggestedCategoryIcon();
    renderCategoryManager();
  }

  /** 重渲弹窗但保留列表滚动位置，避免添加后跳回顶部。 */
  function rerenderCategoryManager() {
    const list = modalRoot.querySelector('.category-list');
    const scrollTop = list ? list.scrollTop : 0;
    renderCategoryManager();
    const next = modalRoot.querySelector('.category-list');
    if (next) next.scrollTop = scrollTop;
  }

  function categoryRowHTML(cat, counts) {
    const count = counts[cat.id] || 0;
    const fixed = cat.id === 'other';
    const tag = fixed
      ? '<span class="category-lock">保留</span>'
      : (cat.meal ? '<span class="category-tag">三餐</span>' : '');
    const grip = '<button type="button" class="cat-grip' + (fixed ? ' is-fixed' : '') + '"' +
      ' data-cat-id="' + esc(cat.id) + '"' +
      (fixed ? ' disabled aria-disabled="true"' : '') +
      ' aria-label="' + (fixed ? '“其他”固定在最后' : '按住拖动排序：' + esc(cat.name)) + '">' +
      icon('grip') + '</button>';
    const del = fixed
      ? ''
      : '<button type="button" class="mini-btn danger" data-action="delete-category" data-id="' + esc(cat.id) + '" aria-label="删除分类 ' + esc(cat.name) + '">' + icon('trash') + '</button>';
    const nameLine = '<span class="category-name-line"><strong>' + esc(cat.name) + '</strong>' +
      (fixed ? '' : icon('pencil', 'cat-rename-ico')) + '</span>';
    const countText = '<span>' + (count ? count + ' 笔账单' : '暂无账单') + '</span>';
    const main = fixed
      ? '<div class="category-manage-main">' + nameLine + countText + '</div>'
      : '<button type="button" class="category-manage-main is-editable" data-action="rename-category"' +
        ' data-id="' + esc(cat.id) + '" aria-label="重命名分类 ' + esc(cat.name) + '">' +
        nameLine + countText + '</button>';

    return '<div class="category-manage-row' + (fixed ? ' is-fixed' : '') + '" data-cat-id="' + esc(cat.id) + '"' +
      (fixed ? ' data-fixed="1"' : '') + '>' +
      grip +
      catIcon(cat) +
      main +
      tag + del +
      '</div>';
  }

  function renderCategoryManager() {
    if (!state.categoryManager) return;
    const counts = {};
    Store.all().forEach(function (t) {
      if (t.type === 'expense') counts[t.category] = (counts[t.category] || 0) + 1;
    });
    const mealCats = CATS.filter(function (c) { return c.meal; });
    const normalCats = CATS.filter(function (c) { return !c.meal; });
    const group = function (title, note, list) {
      if (!list.length) return '';
      return '<section class="category-group">' +
        '<p class="category-group-title">' + esc(title) + '<span>' + esc(note) + '</span></p>' +
        list.map(function (c) { return categoryRowHTML(c, counts); }).join('') +
        '</section>';
    };
    const iconPicker = CAT_ICON_CHOICES.map(function (name) {
      const on = name === state.catIcon;
      return '<button type="button" class="icon-pick' + (on ? ' is-active' : '') + '" data-action="pick-cat-icon"' +
        ' data-icon="' + name + '" aria-label="选择图标" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        icon(name) + '</button>';
    }).join('');

    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="close-categories"></div>' +
      '<div class="modal-card category-manager-modal" role="dialog" aria-modal="true" aria-label="分类管理">' +
      '<div class="modal-head">' +
      '<div class="modal-head-main"><h3>分类管理</h3><p class="modal-sub">共 ' + CATS.length + ' 个支出分类</p></div>' +
      '<button class="icon-btn" data-action="close-categories" aria-label="关闭">' + icon('close') + '</button>' +
      '</div>' +
      '<p class="modal-text">新增分类会同步到记账、预算和统计。删除分类不会删除账单，关联账单会归入“其他”。</p>' +
      '<form id="category-form" class="category-add-form" novalidate>' +
      '<p class="category-field-label">选个图标</p>' +
      '<div class="icon-picker" role="group" aria-label="分类图标">' + iconPicker + '</div>' +
      '<div class="category-add-row">' +
      '<span class="category-preview" aria-hidden="true">' + icon(state.catIcon) + '</span>' +
      '<input id="category-name" class="modal-input" type="text" maxlength="12" autocomplete="off" placeholder="新分类名称，如：宠物" aria-label="新分类名称">' +
      '<button type="submit" class="btn-primary">' + icon('plus') + '添加</button>' +
      '</div>' +
      '</form>' +
      '<div class="category-list">' +
      group('三餐', '独立统计与预算', mealCats) +
      group('日常分类', '记账与预算通用', normalCats) +
      '</div>' +
      '<p class="form-tip">按住行首横杠上下拖动排序；三餐与日常分类各自排序，“其他”固定最后。</p>' +
      '</div>';
    modalRoot.classList.add('is-open');
  }

  /* =========================================================
   * 分类拖拽排序（按住左侧横杠）
   * ======================================================= */

  const catDrag = { pending: null, active: null };

  function categoryGripOf(target) {
    const grip = target && target.closest ? target.closest('.cat-grip') : null;
    if (!grip || grip.disabled) return null;
    return grip;
  }

  function onCategoryGripDown(e) {
    if (!state.categoryManager) return;
    const grip = categoryGripOf(e.target);
    if (!grip) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const row = grip.closest('.category-manage-row');
    if (!row) return;
    catDrag.pending = { grip: grip, row: row, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    window.addEventListener('pointermove', onCategoryGripMove, { passive: false });
    window.addEventListener('pointerup', onCategoryGripUp);
    window.addEventListener('pointercancel', onCategoryGripUp);
  }

  function onCategoryGripMove(e) {
    if (catDrag.active) {
      moveCategoryGhost(e);
      return;
    }
    const p = catDrag.pending;
    if (!p) return;
    // 移动超过 5px 才判定为拖拽，避免点一下握把就闪出残影
    if (Math.abs(e.clientY - p.y) < 5 && Math.abs(e.clientX - p.x) < 5) return;
    beginCategoryDrag(p, e);
    moveCategoryGhost(e);
  }

  function beginCategoryDrag(p, e) {
    const rect = p.row.getBoundingClientRect();
    const ghost = p.row.cloneNode(true);
    ghost.classList.add('category-drag-ghost');
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    document.body.appendChild(ghost);
    p.row.classList.add('is-drag-placeholder');
    document.body.classList.add('is-cat-dragging');
    catDrag.pending = null;
    catDrag.active = {
      row: p.row,
      ghost: ghost,
      top: rect.top,
      startY: p.y,
      lastY: e.clientY,
      group: p.row.closest('.category-group'),
      list: modalRoot.querySelector('.category-list'),
      raf: 0
    };
    try {
      if (p.grip && p.grip.setPointerCapture) p.grip.setPointerCapture(p.pointerId);
    } catch (err) { /* 合成事件下可能不支持，忽略 */ }
    catDrag.active.raf = requestAnimationFrame(categoryAutoScroll);
  }

  function moveCategoryGhost(e) {
    const d = catDrag.active;
    if (!d) return;
    if (e.cancelable) e.preventDefault();
    d.lastY = e.clientY;
    d.ghost.style.transform = 'translate3d(0,' + (e.clientY - d.startY) + 'px,0)';
    categoryDropTarget(e.clientY);
  }

  /**
   * 一步一格地挪动占位行：只和紧邻的上下两行比中点。
   * 不用“全局找插入点”，是因为占位行移动后相邻行会跟着位移，
   * 那样在手指不动时会被反复判定为“还没到位”，一路滑到底。
   */
  function categoryDropTarget(clientY) {
    const d = catDrag.active;
    if (!d || !d.group) return;
    for (let guard = 0; guard < 40; guard++) {
      const next = d.row.nextElementSibling;
      const prev = d.row.previousElementSibling;
      const nextRow = next && next.classList.contains('category-manage-row') && next.dataset.fixed !== '1' ? next : null;
      const prevRow = prev && prev.classList.contains('category-manage-row') && prev.dataset.fixed !== '1' ? prev : null;
      let moved = false;
      if (nextRow) {
        const box = nextRow.getBoundingClientRect();
        if (clientY > box.top + box.height / 2) {
          d.group.insertBefore(nextRow, d.row); // 与下一行换位：占位行下移一格
          moved = true;
        }
      }
      if (!moved && prevRow) {
        const box = prevRow.getBoundingClientRect();
        if (clientY < box.top + box.height / 2) {
          d.group.insertBefore(d.row, prevRow); // 与上一行换位：占位行上移一格
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  /** 拖到列表上下边缘时自动滚动，长列表也能拖到底。 */
  function categoryAutoScroll() {
    const d = catDrag.active;
    if (!d) return;
    const list = d.list;
    if (list) {
      const box = list.getBoundingClientRect();
      const edge = 30;
      let delta = 0;
      if (d.lastY < box.top + edge) delta = -Math.min(8, (box.top + edge - d.lastY) / 3);
      else if (d.lastY > box.bottom - edge) delta = Math.min(8, (d.lastY - (box.bottom - edge)) / 3);
      if (delta) {
        const before = list.scrollTop;
        list.scrollTop = before + delta;
        if (list.scrollTop !== before) categoryDropTarget(d.lastY);
      }
    }
    d.raf = requestAnimationFrame(categoryAutoScroll);
  }

  function onCategoryGripUp() {
    window.removeEventListener('pointermove', onCategoryGripMove);
    window.removeEventListener('pointerup', onCategoryGripUp);
    window.removeEventListener('pointercancel', onCategoryGripUp);
    catDrag.pending = null;
    const d = catDrag.active;
    if (!d) return;
    catDrag.active = null;
    cancelAnimationFrame(d.raf);
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    d.row.classList.remove('is-drag-placeholder');
    document.body.classList.remove('is-cat-dragging');
    // 以分组为单位读回 DOM 顺序（三餐在前、日常在后），“其他”由 store 压到末位
    const ids = [];
    modalRoot.querySelectorAll('.category-group .category-manage-row').forEach(function (r) {
      if (r.dataset.catId) ids.push(r.dataset.catId);
    });
    Store.reorderCategories(ids);
  }

  /** 桌面/键盘：聚焦横杠后按 ↑↓ 微调，作为拖拽的无障碍替代。 */
  function onCategoryGripKey(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const grip = categoryGripOf(e.target);
    if (!grip) return;
    e.preventDefault();
    const id = grip.dataset.catId;
    if (!id) return;
    if (Store.moveCategory(id, e.key === 'ArrowUp' ? 'up' : 'down')) {
      rerenderCategoryManager();
      const again = modalRoot.querySelector('.cat-grip[data-cat-id="' + id + '"]');
      if (again) again.focus();
    }
  }

  /** 切换图标只更新高亮与预览，不重渲整个弹窗，避免输入框内容丢失。 */
  function selectCategoryIcon(name) {
    state.catIcon = name;
    modalRoot.querySelectorAll('.icon-pick').forEach(function (btn) {
      const on = btn.dataset.icon === name;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    const preview = modalRoot.querySelector('.category-preview');
    if (preview) preview.innerHTML = icon(name);
  }

  function closeCategoryManager() {
    state.categoryManager = false;
    state.renaming = null;
    modalRoot.classList.remove('is-open');
    setTimeout(function () {
      if (!state.categoryManager && !modalRoot.classList.contains('is-open')) modalRoot.innerHTML = '';
    }, 180);
  }

  function addCategoryFromForm(form) {
    const input = form.querySelector('#category-name');
    try {
      const cat = Store.addCategory({ name: input ? input.value : '', icon: state.catIcon });
      state.catIcon = suggestedCategoryIcon();
      rerenderCategoryManager();
      toast('已添加分类“' + cat.name + '”');
      // 新分类排在“其他”之前，可能落在可视区外，滚过去给个反馈
      const newRow = modalRoot.querySelector('.category-manage-row[data-cat-id="' + cat.id + '"]');
      if (newRow && newRow.scrollIntoView) newRow.scrollIntoView({ block: 'nearest' });
      // 刚打完字，键盘还在，保持焦点方便连续添加
      const nextInput = document.getElementById('category-name');
      if (nextInput) nextInput.focus({ preventScroll: true });
    } catch (e) {
      toast(e.message || '分类添加失败', 'warn');
      if (input) {
        input.focus({ preventScroll: true });
        input.select();
      }
    }
  }

  /* ---------------- 重命名 ---------------- */

  function openRenameCategory(id) {
    const cat = CAT_MAP[id];
    if (!cat || id === 'other') return;
    state.renaming = id;
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="close-rename"></div>' +
      '<div class="modal-card rename-modal" role="dialog" aria-modal="true" aria-label="重命名分类">' +
      '<div class="modal-head">' +
      '<div class="modal-head-main"><h3>重命名分类</h3><p class="modal-sub">只改显示名称，账单与预算按分类关联，不受影响</p></div>' +
      '<button class="icon-btn" data-action="close-rename" aria-label="关闭">' + icon('close') + '</button>' +
      '</div>' +
      '<form id="rename-form" novalidate>' +
      '<div class="rename-field">' +
      catIcon(cat) +
      '<input id="rename-input" class="modal-input" type="text" maxlength="12" autocomplete="off" value="' + esc(cat.name) + '" aria-label="分类名称">' +
      '</div>' +
      '<p class="form-tip">名称最多 12 个字符，不能与其它分类重名。</p>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn-ghost" data-action="close-rename">取消</button>' +
      '<button type="submit" class="btn-primary">保存</button>' +
      '</div>' +
      '</form>' +
      '</div>';
    modalRoot.classList.add('is-open');
    // 这里主动聚焦是合理的：用户本来就是来改名字的
    setTimeout(function () {
      const input = document.getElementById('rename-input');
      if (input && state.renaming) {
        input.focus({ preventScroll: true });
        input.select();
      }
    }, 80);
  }

  function closeRename() {
    state.renaming = null;
    openCategoryManager();
  }

  function saveRename() {
    const input = document.getElementById('rename-input');
    const id = state.renaming;
    if (!id) return;
    try {
      const cat = Store.renameCategory(id, input ? input.value : '');
      state.renaming = null;
      openCategoryManager();
      toast('已重命名为“' + cat.name + '”');
    } catch (e) {
      toast(e.message || '重命名失败', 'warn');
      if (input) {
        input.focus({ preventScroll: true });
        input.select();
      }
    }
  }

  async function deleteCategory(id) {
    const cat = CAT_MAP[id];
    if (!cat || cat.id === 'other') return;
    const count = Store.all().filter(function (t) {
      return t.type === 'expense' && t.category === id;
    }).length;
    const tips = [];
    if (count) tips.push('该分类有 ' + count + ' 笔账单，删除后会归入“其他”');
    else tips.push('该分类还没有账单');
    if (cat.meal) tips.push('三餐专项统计与三餐预算不再包含它');
    tips.push('对应分类预算会一并移除');
    closeCategoryManager();
    const ok = await confirmDialog({
      title: '删除“' + cat.name + '”分类？',
      message: tips.join('；') + '。账单本身不会被删除。',
      okText: '删除',
      danger: true
    });
    if (ok) {
      try {
        Store.removeCategory(id);
        toast(count ? '分类已删除，' + count + ' 笔账单已归入“其他”' : '分类已删除');
      } catch (e) {
        toast(e.message || '分类删除失败', 'warn');
      }
    }
    openCategoryManager();
  }

  /* =========================================================
   * 路由 / 渲染
   * ======================================================= */

  function render() {
    let html = '';
    const r = state.route;
    if (r.name === 'home') html = renderHome();
    else if (r.name === 'calendar') html = renderCalendar();
    else if (r.name === 'stats') html = renderStats();
    else if (r.name === 'me') html = renderMe();
    else if (r.name === 'day') html = renderDay();
    else if (r.name === 'budget') html = renderBudget();
    else html = renderHome();

    viewEl.innerHTML = html;
    viewEl.setAttribute('data-route', r.name);

    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.classList.toggle('is-active', r.name === state.tab && btn.dataset.tab === state.tab);
    });
    tabbarEl.style.display = 'flex';

    const titles = {
      home: '记把好账 · 极简日常记账',
      calendar: '日历账单 · 记把好账',
      stats: '统计分析 · 记把好账',
      me: '我的 · 记把好账',
      day: '日账单 · 记把好账',
      budget: '预算管理 · 记把好账'
    };
    document.title = titles[r.name] || titles.home;

    if (r.name === 'calendar') bindCalendarSwipe();
  }

  function refresh() {
    applyAppearance();
    render();
  }

  function goTab(tab) {
    if (['home', 'calendar', 'stats', 'me'].indexOf(tab) < 0) tab = 'home';
    state.tab = tab;
    state.route = { name: tab };
    if (tab === 'calendar') {
      state.cal.selected = U.today();
      state.cal.cursor = U.today();
    }
    render();
    window.scrollTo(0, 0);
  }

  function goDay(date) {
    if (!U.isYmd(date)) date = U.today();
    state.route = { name: 'day', date: date };
    render();
    window.scrollTo(0, 0);
  }

  function goBudget() {
    state.route = { name: 'budget' };
    render();
    window.scrollTo(0, 0);
  }

  function goBack() {
    state.route = { name: state.tab };
    render();
    window.scrollTo(0, 0);
  }

  /* =========================================================
   * 金额输入面板
   * ======================================================= */

  function dateLabelForSheet(date) {
    if (date === U.today()) return '今天';
    if (date === U.addDays(U.today(), -1)) return '昨天';
    return U.monthDayLabel(date);
  }

  /* =========================================================
   * 记一笔：先选分类，再进金额面板
   * ======================================================= */

  function openCatPicker(date) {
    state.picker = { date: U.isYmd(date) ? date : U.today() };
    renderCatPicker();
  }

  function renderCatPicker() {
    const p = state.picker;
    if (!p) return;
    const items = CATS.map(function (cat) {
      return (
        '<button class="picker-item" data-action="pick-cat" data-cat="' + esc(cat.id) + '">' +
        catIcon(cat) +
        '<span>' + esc(cat.name) + '</span>' +
        '</button>'
      );
    }).join('');

    sheetRoot.innerHTML =
      '<div class="sheet-backdrop" data-action="close-picker"></div>' +
      '<div class="sheet cat-picker" role="dialog" aria-modal="true" aria-label="选择记账分类">' +
      '<div class="sheet-grip"></div>' +
      '<div class="sheet-head">' +
      '<div class="sheet-cat"><span class="sheet-cat-icon picker-head-icon">' + icon('pen') + '</span>' +
      '<div><strong>记一笔</strong><span>先选一个分类 · ' + dateLabelForSheet(p.date) + '</span></div></div>' +
      '<button class="icon-btn" data-action="close-picker" aria-label="关闭">' + icon('close') + '</button>' +
      '</div>' +
      '<p class="picker-label">支出分类</p>' +
      '<div class="picker-grid">' + items + '</div>' +
      '<button class="picker-income" data-action="pick-income">' +
      '<span class="picker-income-ico">' + icon('wallet') + '</span>' +
      '<span class="picker-income-main"><strong>记收入</strong><span>工资、红包、报销等</span></span>' +
      icon('chevron-right') +
      '</button>' +
      '<p class="picker-tip">' + icon('info') + '选好分类后输入金额，两步保存</p>' +
      '</div>';

    sheetRoot.classList.add('is-open');
    document.body.classList.add('sheet-open');
  }

  function closePicker() {
    if (!state.picker) return;
    state.picker = null;
    sheetRoot.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    setTimeout(function () {
      if (!state.picker && !state.sheet) sheetRoot.innerHTML = '';
    }, 220);
  }

  /* =========================================================
   * 新人引导（首次启动自动弹出，设置页可重看）
   * ======================================================= */

  const TUTORIAL_STEPS = [
    {
      icon: 'pen',
      title: '三步记一笔',
      text: '点首页「记一笔」，先选早餐、午餐、晚餐或其它分类，再输入金额保存。常用金额可一键填入，备注可留空。',
      tip: '早餐 / 午餐 / 晚餐都在分类面板里'
    },
    {
      icon: 'calendar',
      title: '日历里查账',
      text: '打开底部「日历」，选中任意日期，下方会直接显示当天总收支、分类占比和每一笔账单；点账单就能修改或删除。',
      tip: '左右滑动可切换月份，也能切到周视图'
    },
    {
      icon: 'target',
      title: '预算分配有数',
      text: '在首页预算条或「我的 → 预算管理」设置月度总预算与分类预算。「可自由分配」实时显示还没分配出去的额度，它不是消费剩余。',
      tip: '改总预算或任一分类预算，数值立即刷新'
    },
    {
      icon: 'shield',
      title: '数据只属于你',
      text: '账单只保存在本机。你可以在「我的」导出 Excel / CSV、备份 JSON，或开启每日提醒。深色模式跟随系统，也能手动选择。',
      tip: '换手机前记得先备份'
    }
  ];

  function showTutorial(step) {
    const idx = U.clamp(Number(step) || 0, 0, TUTORIAL_STEPS.length - 1);
    state.tutorial = { step: idx };
    const s = TUTORIAL_STEPS[idx];
    const last = idx === TUTORIAL_STEPS.length - 1;
    const dots = TUTORIAL_STEPS.map(function (_, i) {
      return '<i class="' + (i === idx ? 'is-active' : '') + '"></i>';
    }).join('');

    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="tutorial-close"></div>' +
      '<div class="modal tutorial-modal" role="dialog" aria-modal="true" aria-label="新手使用教程">' +
      '<div class="tutorial-top"><span class="tutorial-count">' + (idx + 1) + ' / ' + TUTORIAL_STEPS.length + '</span>' +
      '<button class="tutorial-skip" data-action="tutorial-close">跳过</button></div>' +
      '<div class="tutorial-art">' + icon(s.icon) + '</div>' +
      '<h3>' + s.title + '</h3>' +
      '<p>' + s.text + '</p>' +
      '<div class="tutorial-tip">' + icon('sparkles') + '<span>' + s.tip + '</span></div>' +
      '<div class="tutorial-dots">' + dots + '</div>' +
      '<div class="tutorial-actions">' +
      (idx > 0 ? '<button class="btn-ghost" data-action="tutorial-prev">上一步</button>' : '<button class="btn-ghost" data-action="tutorial-close">以后再说</button>') +
      '<button class="btn-primary" data-action="' + (last ? 'tutorial-done' : 'tutorial-next') + '">' + (last ? '我知道了' : '下一步') + '</button>' +
      '</div></div>';
    modalRoot.classList.add('is-open');
  }

  function closeTutorial() {
    if (!state.tutorial) return;
    state.tutorial = null;
    Store.markOnboarded();
    modalRoot.classList.remove('is-open');
    setTimeout(function () {
      if (!state.tutorial && !state.modalResolve) modalRoot.innerHTML = '';
      maybeAutoRequestNotify();
    }, 700);
  }

  function openAdd(catId, type, date) {
    if (type === 'income') catId = 'income';
    if (!CAT_MAP[catId] || catId === 'income') {
      if (type !== 'income') catId = 'other';
    }
    state.sheet = {
      type: type === 'income' ? 'income' : 'expense',
      catId: type === 'income' ? 'income' : catId || 'other',
      baseCat: catId && catId !== 'income' ? catId : 'other',
      amount: '',
      note: '',
      uneaten: false,
      date: U.isYmd(date) ? date : U.today(),
      editId: null
    };
    renderSheet();
  }

  function openEdit(tx) {
    if (!tx) return;
    state.sheet = {
      type: tx.type,
      catId: tx.type === 'income' ? 'income' : tx.category,
      baseCat: tx.type === 'income' ? 'other' : tx.category,
      amount: String(tx.amount),
      note: tx.note || '',
      uneaten: !!tx.uneaten,
      date: tx.date,
      time: tx.time,
      editId: tx.id
    };
    renderSheet();
  }

  function renderSheet() {
    const sh = state.sheet;
    if (!sh) return;
    const isIncome = sh.type === 'income';
    const cat = isIncome ? INCOME : CAT_MAP[sh.catId] || CAT_MAP.other;
    const editing = !!sh.editId;
    const quick = [5, 10, 20, 50, 100];
    const mealZero = !isIncome && !!cat.meal;
    const uneatenOn = mealZero && U.toNumber(sh.amount) === 0 && !!sh.uneaten;

    sheetRoot.innerHTML =
      '<div class="sheet-backdrop" data-action="close-sheet"></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + (editing ? '编辑账单' : '记一笔') + '">' +
      '<div class="sheet-grip"></div>' +
      '<div class="sheet-head">' +
      '<div class="sheet-cat">' +
      '<span class="sheet-cat-icon" style="--c:' + cat.color + ';--cs:' + hexA(cat.color, 0.14) + '">' + icon(cat.icon) + '</span>' +
      '<div><strong>' + (editing ? '编辑账单' : esc(cat.name)) + '</strong><span>' + dateLabelForSheet(sh.date) + ' · ' + (isIncome ? '收入' : '支出') + '</span></div>' +
      '</div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="关闭">' + icon('close') + '</button>' +
      '</div>' +
      '<div class="type-toggle" role="tablist" aria-label="收支类型">' +
      '<button class="' + (!isIncome ? 'is-active' : '') + '" data-action="sheet-type" data-type="expense" role="tab" aria-selected="' + (!isIncome) + '">支出</button>' +
      '<button class="' + (isIncome ? 'is-active' : '') + '" data-action="sheet-type" data-type="income" role="tab" aria-selected="' + isIncome + '">收入</button>' +
      '</div>' +
      '<div class="amount-field">' +
      '<span class="amount-cur">' + esc(sym()) + '</span>' +
      '<input id="amount-input" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="0.00" value="' + esc(sh.amount) + '" aria-label="金额">' +
      '</div>' +
      '<div class="quick-amounts">' +
      quick.map(function (v) { return '<button data-action="quick-amount" data-value="' + v + '">' + esc(sym()) + v + '</button>'; }).join('') +
      '</div>' +
      (mealZero
        ? '<button class="uneaten-toggle' + (uneatenOn ? ' is-on' : '') + '" data-action="sheet-uneaten">' +
          icon('check') + '<span><b>这餐没吃</b><em>记 0 元，只标记未用餐，不计入支出</em></span>' + icon(uneatenOn ? 'check-circle' : 'plus') +
          '</button>'
        : '') +
      '<label class="note-field">' + icon('pencil') +
      '<input id="note-input" type="text" maxlength="30" placeholder="添加备注（可选）" value="' + esc(sh.note) + '" aria-label="备注">' +
      '</label>' +
      '<div class="sheet-date">' + icon('calendar') + '<span>' + (sh.date === U.today() ? '今天' : U.fullDateLabel(sh.date)) + '</span>' + (editing ? '<em>修改后立即生效</em>' : '') + '</div>' +
      '<button class="btn-primary btn-block btn-save" data-action="save-tx">' + (editing ? '保存修改' : '保存') + '</button>' +
      '</div>';

    sheetRoot.classList.add('is-open');
    document.body.classList.add('sheet-open');
    const input = document.getElementById('amount-input');
    if (input) {
      setTimeout(function () {
        try {
          input.focus({ preventScroll: true });
          const len = input.value.length;
          input.setSelectionRange(len, len);
        } catch (e) { /* 忽略 */ }
      }, 60);
    }
  }

  function closeSheet() {
    if (!sheetRoot.classList.contains('is-open')) return;
    sheetRoot.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    setTimeout(function () {
      if (!sheetRoot.classList.contains('is-open')) sheetRoot.innerHTML = '';
    }, 220);
    state.sheet = null;
  }

  function setSheetType(type) {
    if (!state.sheet) return;
    state.sheet.type = type === 'income' ? 'income' : 'expense';
    state.sheet.catId = state.sheet.type === 'income' ? 'income' : state.sheet.baseCat || 'other';
    state.sheet.amount = (document.getElementById('amount-input') || {}).value || state.sheet.amount;
    state.sheet.note = (document.getElementById('note-input') || {}).value || state.sheet.note;
    renderSheet();
  }

  function setAmount(value) {
    if (!state.sheet) return;
    state.sheet.amount = String(value);
    state.sheet.uneaten = U.toNumber(value) === 0;
    const input = document.getElementById('amount-input');
    if (input) {
      input.value = state.sheet.amount;
      input.focus({ preventScroll: true });
    }
    const toggle = document.querySelector('.uneaten-toggle');
    if (toggle) toggle.classList.toggle('is-on', state.sheet.uneaten);
  }

  function saveSheet() {
    const sh = state.sheet;
    if (!sh) return;
    const amountEl = document.getElementById('amount-input');
    const noteEl = document.getElementById('note-input');
    const amount = U.round2(U.toNumber(amountEl ? amountEl.value : sh.amount));
    const note = noteEl ? noteEl.value.trim().slice(0, 30) : sh.note;
    const type = sh.type;
    const category = type === 'income' ? 'income' : sh.catId === 'income' ? sh.baseCat : sh.catId;
    const mealZero = type === 'expense' && !!(CAT_MAP[category] && CAT_MAP[category].meal);
    // 三餐允许 0 元：表示“已记录·未用餐”，不是普通消费。
    if (amount < 0 || (amount === 0 && !mealZero)) {
      toast(mealZero ? '请输入金额' : '请输入大于 0 的金额', 'warn');
      if (amountEl) amountEl.focus();
      return;
    }
    if (amount > 9999999) {
      toast('金额过大，请检查', 'warn');
      return;
    }
    try {
      if (sh.editId) {
        Store.updateTransaction(sh.editId, {
          type: type,
          category: category,
          amount: amount,
          note: note,
          uneaten: amount === 0
        });
        toast(amount === 0 ? '已标记未用餐' : '已保存修改');
      } else {
        Store.addTransaction({
          type: type,
          category: category,
          amount: amount,
          note: note,
          uneaten: amount === 0,
          date: sh.date,
          time: U.hm(new Date())
        });
        const cat = type === 'income' ? INCOME : CAT_MAP[category] || CAT_MAP.other;
        toast(amount === 0 ? '已记录' + cat.name + ' · 未用餐' : '已记 ' + cat.name + ' ' + money(amount));
      }
      closeSheet();
    } catch (e) {
      toast(e.message || '保存失败，请重试', 'warn');
    }
  }

  /* =========================================================
   * 确认弹窗 / 提示
   * ======================================================= */

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      state.modalResolve = resolve;
      modalRoot.innerHTML =
        '<div class="modal-backdrop" data-action="modal-cancel"></div>' +
        '<div class="modal" role="alertdialog" aria-modal="true" aria-label="' + esc(opts.title || '确认') + '">' +
        '<h3>' + esc(opts.title || '请确认') + '</h3>' +
        '<p>' + esc(opts.message || '') + '</p>' +
        '<div class="modal-actions">' +
        '<button class="btn-ghost" data-action="modal-cancel">' + esc(opts.cancelText || '取消') + '</button>' +
        '<button class="btn-primary ' + (opts.danger ? 'btn-danger' : '') + '" data-action="modal-ok">' + esc(opts.okText || '确定') + '</button>' +
        '</div>' +
        '</div>';
      modalRoot.classList.add('is-open');
    });
  }

  function resolveModal(ok) {
    if (!state.modalResolve) return;
    const fn = state.modalResolve;
    state.modalResolve = null;
    modalRoot.classList.remove('is-open');
    setTimeout(function () {
      if (!state.modalResolve && !modalRoot.classList.contains('is-open')) modalRoot.innerHTML = '';
    }, 180);
    fn(!!ok);
  }

  function toast(msg, type) {
    clearTimeout(state.toastTimer);
    toastEl.textContent = msg;
    toastEl.className = 'toast is-show' + (type ? ' is-' + type : '');
    state.toastTimer = setTimeout(function () {
      toastEl.className = 'toast';
    }, 2400);
  }

  async function deleteTx(id) {
    const tx = Store.all().find(function (t) { return t.id === id; });
    if (!tx) return;
    const cat = Store.categoryOf(tx);
    const ok = await confirmDialog({
      title: '删除这笔账单？',
      message: cat.name + ' ' + money(tx.amount) + ' · ' + tx.date + ' ' + tx.time + (tx.note ? ' · ' + tx.note : ''),
      okText: '删除',
      danger: true
    });
    if (ok) {
      Store.removeTransaction(id);
      toast('已删除');
    }
  }

  /* =========================================================
   * 提醒
   * ======================================================= */

  function readLastReminder() {
    try {
      return JSON.parse(localStorage.getItem(REMINDER_LAST_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function writeLastReminder(obj) {
    try {
      localStorage.setItem(REMINDER_LAST_KEY, JSON.stringify(obj));
    } catch (e) { /* 忽略 */ }
  }

  async function ensureNotifyPermission() {
    // Android 原生版：WebView 不支持 Web Notification，必须走系统运行时权限 + 原生通知
    const bridge = notifyBridge();
    if (bridge && bridge.requestNotificationPermission) {
      if (bridge.notificationGranted && bridge.notificationGranted()) return true;
      bridge.requestNotificationPermission();
      // 等待用户在系统对话框中做出选择（最多 6 秒）
      for (let i = 0; i < 12; i++) {
        await new Promise(function (r) { setTimeout(r, 500); });
        if (bridge.notificationGranted && bridge.notificationGranted()) return true;
      }
      return false;
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const p = await Notification.requestPermission();
      return p === 'granted';
    } catch (e) {
      return false;
    }
  }

  /** 首次进入新版（或权限未开）时自动向 Android 请求一次系统通知权限。 */
  function maybeAutoRequestNotify() {
    const bridge = notifyBridge();
    if (!bridge || !bridge.requestNotificationPermission) return;
    try {
      if (bridge.notificationGranted && bridge.notificationGranted()) return;
      if (localStorage.getItem('qinghe.notify.autoAsked') === '1') return;
      localStorage.setItem('qinghe.notify.autoAsked', '1');
      ensureNotifyPermission().then(function () { render(); });
    } catch (e) { /* 忽略 */ }
  }

  function periodRange(kind) {
    const now = new Date();
    let start;
    let end;
    let label;
    if (kind === 'weekly') {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
      label = '上周';
    } else if (kind === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      label = (start.getMonth() + 1) + '月';
    } else {
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31);
      label = (now.getFullYear() - 1) + '年';
    }
    return { start: U.ymd(start), end: U.ymd(end), label: label };
  }

  function periodReminder(kind) {
    const range = periodRange(kind);
    const list = Store.all().filter(function (t) { return t.date >= range.start && t.date <= range.end; });
    const s = Store.summarize(list);
    const top = Store.categoryBreakdown(list).slice(0, 3).map(function (b) {
      return b.cat.name + ' ' + money(b.amount);
    }).join('、');
    return {
      title: range.label + '账单总结',
      body: '支出 ' + money(s.expense) + '，收入 ' + money(s.income) + '，结余 ' + money(s.balance) + '。' +
        (top ? 'Top3：' + top + '。' : '这个周期还没有账单。')
    };
  }

  function reminderText(kind) {
    if (kind === 'summary') {
      const s = Store.daySummary(U.today());
      return {
        title: '今日消费小结',
        body: '今天支出 ' + money(s.expense) + '，收入 ' + money(s.income) + '，结余 ' + money(s.balance) + '。'
      };
    }
    if (kind === 'weekly' || kind === 'monthly' || kind === 'yearly') return periodReminder(kind);
    return {
      title: '记账提醒',
      body: '今天还有没记的账吗？花 30 秒补上，明天更轻松。'
    };
  }

  function reminderIcon(kind) {
    if (kind === 'summary') return 'sparkles';
    if (kind === 'weekly') return 'calendar';
    if (kind === 'monthly') return 'chart';
    if (kind === 'yearly') return 'sparkles';
    return 'bell';
  }

  function pushSystemNotification(title, body, tag) {
    const bridge = notifyBridge();
    if (bridge && bridge.notify) {
      try { bridge.notify(title, body, tag); return true; } catch (e) { /* 回退 Web */ }
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: body, icon: 'assets/icon-192.png', tag: tag });
        return true;
      } catch (e) { /* 忽略 */ }
    }
    return false;
  }

  function showReminder(kind) {
    const txt = reminderText(kind);
    pushSystemNotification('记把好账 · ' + txt.title, txt.body, 'qinghe-' + kind);
    if (document.visibilityState === 'hidden') return;
    if (state.sheet || state.modalResolve || state.tutorial || state.picker) return;
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="reminder-close"></div>' +
      '<div class="modal reminder-modal" role="dialog" aria-modal="true" aria-label="' + esc(txt.title) + '">' +
      '<span class="reminder-icon">' + icon(reminderIcon(kind)) + '</span>' +
      '<h3>' + esc(txt.title) + '</h3>' +
      '<p>' + esc(txt.body) + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn-ghost" data-action="reminder-close">知道了</button>' +
      '<button class="btn-primary" data-action="reminder-go">去记一笔</button>' +
      '</div>' +
      '</div>';
    modalRoot.classList.add('is-open');
  }

  function closeReminder() {
    if (state.modalResolve) return;
    modalRoot.classList.remove('is-open');
    setTimeout(function () {
      if (!state.modalResolve) modalRoot.innerHTML = '';
    }, 180);
  }

  function checkReminders() {
    const settings = Store.getSettings();
    const now = new Date();
    const today = U.ymd(now);
    const last = readLastReminder();
    const periodKey = {
      summary: today,
      log: today,
      weekly: periodRange('weekly').end,
      monthly: periodRange('monthly').end,
      yearly: periodRange('yearly').end
    };
    const boundary = {
      weekly: now.getDay() === 1,
      monthly: now.getDate() === 1,
      yearly: now.getMonth() === 0 && now.getDate() === 1
    };
    ['summary', 'log', 'weekly', 'monthly', 'yearly'].forEach(function (kind) {
      const r = settings.reminders[kind];
      if (!r || !r.enabled) return;
      if (boundary[kind] === false) return;
      if (last[kind] === periodKey[kind]) return;
      const parts = String(r.time || '21:00').split(':');
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
      if (now < target) return;
      if (now - target > 6 * 3600 * 1000) return;
      if (state.sheet || state.modalResolve || state.tutorial || state.picker) return;
      last[kind] = periodKey[kind];
      writeLastReminder(last);
      showReminder(kind);
    });
  }

  /* =========================================================
   * 预算表单
   * ======================================================= */

  function saveBudgetForm(form) {
    const fd = new FormData(form);
    const categories = {};
    CATS.forEach(function (c) {
      categories[c.id] = Math.max(0, U.round2(U.toNumber(fd.get('cat_' + c.id))));
    });
    const monthly = Math.max(0, U.round2(U.toNumber(fd.get('monthly'))));
    Store.setBudgets({ monthly: monthly, categories: categories });
    toast('预算已保存');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* =========================================================
   * 导出 / 备份
   * ======================================================= */

  function exportCSV() {
    if (!Store.all().length) return toast('还没有账单可导出', 'warn');
    U.download('记把好账_账单_' + U.fileStamp() + '.csv', Store.exportCSV());
    toast('CSV 已导出');
  }

  function exportExcel() {
    if (!Store.all().length) return toast('还没有账单可导出', 'warn');
    U.download('记把好账_账单_' + U.fileStamp() + '.xls', Store.exportExcel());
    toast('Excel 已导出');
  }

  function backupData() {
    U.download('记把好账_备份_' + U.fileStamp() + '.json', Store.backupBlob());
    Store.markBackup();
    toast('备份文件已生成');
  }

  function restoreData() {
    const input = document.getElementById('restore-file');
    if (input) input.click();
  }

  async function handleRestoreFile(file) {
    if (!file) return;
    const text = await file.text();
    let data;
    try {
      data = Store.parseBackup(text);
    } catch (e) {
      toast(e.message || '备份文件无法识别', 'warn');
      return;
    }
    const ok = await confirmDialog({
      title: '恢复这份备份？',
      message: '备份包含 ' + data.transactions.length + ' 笔账单。恢复后将覆盖当前全部账单与设置。',
      okText: '恢复',
      danger: true
    });
    if (!ok) return;
    Store.restore(data);
    toast('备份已恢复');
    goTab('home');
  }

  /* =========================================================
   * 日历滑动
   * ======================================================= */

  function bindCalendarSwipe() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    grid.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    grid.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      shiftCalendar(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function shiftCalendar(dir) {
    const view = state.cal.view;
    if (view === 'month') {
      // 翻月时尽量保留原来的“日”，遇到 2 月等短月份自动收敛到月末
      const base = U.parseYmd(state.cal.selected || state.cal.cursor);
      const next = U.addMonths(base, dir);
      const day = Math.min(base.getDate(), U.daysInMonth(next.getFullYear(), next.getMonth()));
      next.setDate(day);
      state.cal.selected = U.ymd(next);
      state.cal.cursor = state.cal.selected;
    } else {
      const next = U.ymd(U.addDays(U.parseYmd(state.cal.selected), dir * 7));
      state.cal.cursor = next;
      state.cal.selected = next;
    }
    render();
  }

  /* =========================================================
   * 事件
   * ======================================================= */

  function onClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;

    switch (action) {
      case 'tab':
        goTab(target.dataset.tab);
        break;
      case 'back':
        goBack();
        break;
      case 'quick-add':
        openAdd(target.dataset.cat || 'other', target.dataset.type || 'expense', target.dataset.date || U.today());
        break;
      case 'open-cat-picker':
        openCatPicker(target.dataset.date);
        break;
      case 'pick-cat': {
        const pickDate = state.picker ? state.picker.date : U.today();
        const pickCat = target.dataset.cat;
        state.picker = null;
        openAdd(pickCat, 'expense', pickDate);
        break;
      }
      case 'pick-income': {
        const pickDate = state.picker ? state.picker.date : U.today();
        state.picker = null;
        openAdd('income', 'income', pickDate);
        break;
      }
      case 'close-picker':
        closePicker();
        break;
      case 'show-tutorial':
        showTutorial(0);
        break;
      case 'tutorial-next':
        showTutorial((state.tutorial ? state.tutorial.step : 0) + 1);
        break;
      case 'tutorial-prev':
        showTutorial((state.tutorial ? state.tutorial.step : 0) - 1);
        break;
      case 'tutorial-done':
        closeTutorial();
        break;
      case 'tutorial-close':
        closeTutorial();
        break;
      case 'edit-tx': {
        const tx = Store.all().find(function (t) { return t.id === id; });
        openEdit(tx);
        break;
      }
      case 'delete-tx':
        deleteTx(id);
        break;
      case 'close-sheet':
        closeSheet();
        break;
      case 'sheet-type':
        setSheetType(target.dataset.type);
        break;
      case 'quick-amount':
        setAmount(target.dataset.value);
        break;
      case 'sheet-uneaten': {
        const on = !state.sheet.uneaten;
        setAmount(on ? 0 : '');
        state.sheet.uneaten = on;
        target.classList.toggle('is-on', on);
        break;
      }
      case 'save-tx':
        saveSheet();
        break;
      case 'nav-day':
        goDay(target.dataset.date);
        break;
      case 'nav-budget':
        goBudget();
        break;
      case 'open-categories':
        openCategoryManager();
        break;
      case 'close-categories':
        closeCategoryManager();
        break;
      case 'delete-category':
        deleteCategory(id);
        break;
      case 'rename-category':
        openRenameCategory(id);
        break;
      case 'close-rename':
        closeRename();
        break;
      case 'pick-cat-icon':
        selectCategoryIcon(target.dataset.icon);
        break;
      case 'open-calibration':
        openCalibration();
        break;
      case 'save-calibration':
        saveCalibration(false);
        break;
      case 'clear-calibration':
        saveCalibration(true);
        break;
      case 'close-calibration':
        closeCalibration();
        break;
      case 'import-bill':
        requestImport();
        break;
      case 'open-day-note':
        openDayNote(target.dataset.date);
        break;
      case 'close-day-note':
        closeDayNote();
        break;
      case 'save-day-note':
        saveDayNote(target.dataset.date);
        break;
      case 'clear-day-note':
        clearDayNote(target.dataset.date);
        break;
      case 'note-search-clear':
        refreshNoteSearch('');
        render();
        break;
      case 'note-range-clear':
        clearNoteRange();
        break;
      case 'cum-prev':
        shiftCumMonth(-1);
        break;
      case 'cum-next':
        shiftCumMonth(1);
        break;
      case 'cum-pick':
        pickCumMonth(target.dataset.key);
        break;
      case 'open-quick':
        openQuick(target.dataset.kind || 'ball');
        break;
      case 'close-quick':
        modalRoot.classList.remove('is-open');
        setTimeout(function () { if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = ''; }, 180);
        break;
      case 'toggle-quick':
        toggleQuick(target.dataset.kind || 'ball');
        break;
      case 'quick-settings':
        quickSettings(target.dataset.kind || 'overlay');
        break;
      case 'open-range':
        openRange();
        break;
      case 'range-run':
        runRange();
        break;
      case 'range-export':
        exportRange();
        break;
      case 'close-range':
        state.range = null;
        modalRoot.classList.remove('is-open');
        setTimeout(function () { if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = ''; }, 180);
        break;
      case 'cal-prev':
        shiftCalendar(-1);
        break;
      case 'cal-next':
        shiftCalendar(1);
        break;
      case 'cal-today':
        state.cal.selected = U.today();
        state.cal.cursor = U.today();
        render();
        break;
      case 'cal-view':
        state.cal.view = target.dataset.value === 'week' ? 'week' : 'month';
        state.cal.selected = state.cal.selected || U.today();
        state.cal.cursor = state.cal.selected;
        render();
        break;
      case 'cal-select': {
        const date = target.dataset.date;
        state.cal.selected = date;
        state.cal.cursor = date;
        render();
        break;
      }
      case 'stats-mode':
        state.stats.mode = target.dataset.value;
        state.stats.anchor = U.today();
        render();
        break;
      case 'stats-prev':
        state.stats.anchor = shiftAnchor(state.stats.mode, state.stats.anchor, -1);
        render();
        break;
      case 'stats-next':
        state.stats.anchor = shiftAnchor(state.stats.mode, state.stats.anchor, 1);
        render();
        break;
      case 'toggle-reminder': {
        const kind = target.dataset.kind;
        const cur = Store.getSettings().reminders[kind] || { enabled: false };
        const next = !cur.enabled;
        if (next) {
          const last = readLastReminder();
          last[kind] = U.today();
          writeLastReminder(last);
          Store.setReminder(kind, { enabled: true });
          ensureNotifyPermission().then(function (granted) {
            if (granted) toast('提醒已开启，将发送系统通知');
            else toast('提醒已开启，将在应用内提示');
            refresh();
          });
        } else {
          Store.setReminder(kind, { enabled: false });
          toast('提醒已关闭');
        }
        break;
      }
      case 'set-theme':
        Store.setSettings({ theme: target.dataset.theme });
        break;
      case 'set-mode':
        Store.setSettings({ themeMode: target.dataset.value });
        break;
      case 'notify-permission':
        ensureNotifyPermission().then(function (granted) {
          toast(granted ? '系统通知已开启' : '未能开启系统通知，将使用应用内提醒', granted ? '' : 'warn');
          refresh();
        });
        break;
      case 'notify-check': {
        const bridge = notifyBridge();
        if (bridge && bridge.notificationGranted) {
          if (bridge.notificationGranted()) {
            toast('通知权限正常');
          } else {
            ensureNotifyPermission().then(function (ok) {
              toast(ok ? '系统通知已开启' : '请在系统设置中允许通知', ok ? '' : 'warn');
              refresh();
            });
          }
        } else if (!('Notification' in window)) {
          toast('当前环境不支持系统通知', 'warn');
        } else if (Notification.permission === 'granted') {
          toast('通知权限正常');
        } else {
          ensureNotifyPermission().then(function (ok) {
            toast(ok ? '系统通知已开启' : '请在浏览器站点设置中允许通知', ok ? '' : 'warn');
            refresh();
          });
        }
        break;
      }
      case 'export-csv':
        exportCSV();
        break;
      case 'export-excel':
        exportExcel();
        break;
      case 'backup':
        backupData();
        break;
      case 'restore':
        restoreData();
        break;
      case 'clear-data':
        confirmDialog({
          title: '清空全部账单？',
          message: '共 ' + Store.all().length + ' 笔账单将被永久删除，设置与预算会保留。建议先备份。',
          okText: '清空',
          danger: true
        }).then(function (ok) {
          if (ok) {
            Store.clearTransactions();
            toast('账单已清空');
          }
        });
        break;
      case 'clear-demo':
        confirmDialog({
          title: '清空示例数据？',
          message: '将删除示例账单，保留预算与设置。之后可以开始记录自己的账单。',
          okText: '清空',
          danger: true
        }).then(function (ok) {
          if (ok) {
            Store.clearTransactions();
            toast('示例已清空，开始记录吧');
          }
        });
        break;
      case 'load-demo':
        confirmDialog({
          title: '载入示例数据？',
          message: '将覆盖当前全部账单，用于快速体验完整功能。',
          okText: '载入',
          danger: true
        }).then(function (ok) {
          if (ok) {
            Store.loadDemo();
            toast('示例数据已载入');
            goTab('home');
          }
        });
        break;
      case 'modal-ok':
        resolveModal(true);
        break;
      case 'modal-cancel':
        resolveModal(false);
        break;
      case 'reminder-close':
        closeReminder();
        break;
      case 'reminder-go':
        closeReminder();
        goTab('home');
        setTimeout(function () { openAdd('lunch', 'expense', U.today()); }, 240);
        break;
      default:
        break;
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.id === 'note-from' || t.id === 'note-to') {
      const from = document.getElementById('note-from');
      const to = document.getElementById('note-to');
      state.noteFrom = from ? from.value : '';
      state.noteTo = to ? to.value : '';
      const clearBtn = document.querySelector('[data-action="note-range-clear"]');
      if (clearBtn) clearBtn.disabled = !(state.noteFrom || state.noteTo);
      refreshNoteSearch(state.noteQuery || '');
      return;
    }
    if (t.matches('[data-reminder-time]')) {
      Store.setReminder(t.dataset.reminderTime, { time: t.value || '21:00' });
      return;
    }
    if (t.matches('[data-currency]')) {
      const v = String(t.value || '').trim().slice(0, 3) || '¥';
      Store.setSettings({ currency: v });
      toast('货币单位已更新为 ' + v);
      return;
    }
    if (t.id === 'restore-file') {
      const file = t.files && t.files[0];
      t.value = '';
      handleRestoreFile(file);
      return;
    }
    if (t.id === 'import-all' && state.importRows) {
      state.importRows.forEach(function (r) {
        if (!r.duplicate) r.checked = t.checked;
      });
      document.querySelectorAll('[data-import-check]').forEach(function (box, i) {
        const row = state.importRows[Number(box.dataset.importCheck)];
        if (row && !row.duplicate) box.checked = row.checked;
      });
      updateImportSummary();
      return;
    }
    if (t.matches('[data-import-check]') && state.importRows) {
      const row = state.importRows[Number(t.dataset.importCheck)];
      if (row) row.checked = t.checked;
      updateImportSummary();
      return;
    }
    if (t.matches('[data-import-cat]') && state.importRows) {
      const row = state.importRows[Number(t.dataset.importCat)];
      if (row) row.category = t.value;
    }
  }

  function onInput(e) {
    const t = e.target;
    if (t.id === 'amount-input') {
      let v = String(t.value || '').replace(/[^\d.]/g, '');
      const dot = v.indexOf('.');
      if (dot >= 0) {
        v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
      }
      if (v.length > 12) v = v.slice(0, 12);
      if (v !== t.value) t.value = v;
      if (state.sheet) state.sheet.amount = v;
    } else if (t.id === 'note-search') {
      refreshNoteSearch(t.value);
    } else if (t.id === 'note-input' && state.sheet) {
      state.sheet.note = t.value;
    }
    // 预算页：总预算 / 分类预算任一变化，立即刷新“可自由分配”
    if (t.closest && t.closest('#budget-form')) updateAllocCard();
  }

  function onSubmit(e) {
    if (e.target && e.target.id === 'budget-form') {
      e.preventDefault();
      saveBudgetForm(e.target);
    } else if (e.target && e.target.id === 'category-form') {
      e.preventDefault();
      addCategoryFromForm(e.target);
    } else if (e.target && e.target.id === 'rename-form') {
      e.preventDefault();
      saveRename();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      if (state.tutorial) closeTutorial();
      else if (state.modalResolve) resolveModal(false);
      else if (state.picker) closePicker();
      else if (state.sheet) closeSheet();
      else if (state.renaming) closeRename();
      else if (state.categoryManager) closeCategoryManager();
      else if (modalRoot.classList.contains('is-open')) closeReminder();
    }
    if (e.key === 'Enter' && state.sheet && e.target && e.target.id === 'amount-input') {
      e.preventDefault();
      saveSheet();
    }
  }

  /* =========================================================
   * 启动
   * ======================================================= */

  function parseQuery() {
    const q = new URLSearchParams(window.location.search);
    const tab = q.get('tab');
    if (['home', 'calendar', 'stats', 'me'].indexOf(tab) >= 0) {
      state.tab = tab;
      state.route = { name: tab };
    }
    const mode = q.get('mode');
    if (['day', 'week', 'month', 'quarter', 'year'].indexOf(mode) >= 0) state.stats.mode = mode;
    const anchor = q.get('anchor');
    if (U.isYmd(anchor)) state.stats.anchor = anchor;
    const date = q.get('date');
    if (U.isYmd(date)) {
      state.cal.selected = date;
      state.cal.cursor = date;
    }
    const pageName = q.get('page');
    if (pageName === 'day') state.route = { name: 'day', date: U.isYmd(date) ? date : U.today() };
    else if (pageName === 'budget') state.route = { name: 'budget' };
    else if (pageName === 'add') state.pendingPicker = true;
    if (q.get('view') === 'week') state.cal.view = 'week';
    if (q.get('themeMode') === 'dark') Store.setSettings({ themeMode: 'dark' });
    if (q.get('theme') && THEMES[q.get('theme')]) Store.setSettings({ theme: q.get('theme') });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(window.location.protocol)) return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* 离线缓存失败不影响使用 */ });
  }

  function init() {
    Store.init();
    Store.subscribe(refresh);
    parseQuery();
    applyAppearance();
    render();

    // PWA 快捷方式 ?page=add：先弹出分类选择面板
    if (state.pendingPicker) {
      state.pendingPicker = null;
      openCatPicker();
    }

    document.addEventListener('click', onClick);
    document.addEventListener('pointerdown', onCategoryGripDown);
    document.addEventListener('keydown', onCategoryGripKey);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKeydown);
    // 从系统设置返回时刷新通知权限状态
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        setTimeout(syncNotifyState, 800);
        if (!state.sheet && !state.picker && !state.tutorial && !state.modalResolve) render();
      }
    });

    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = function () {
        if (Store.getSettings().themeMode === 'system') applyAppearance();
      };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    }

    // 首次启动自动展示新人引导；用户看过或点“我知道了/跳过”后永久标记
    if (!Store.getMeta().onboarded && !state.sheet && !state.picker) {
      setTimeout(function () {
        if (!Store.getMeta().onboarded && !state.sheet && !state.picker) showTutorial(0);
      }, 520);
    } else {
      setTimeout(maybeAutoRequestNotify, 1400);
    }

    setInterval(checkReminders, 30000);
    setTimeout(checkReminders, 2500);
    registerSW();

    if (!Store.isStorageOK()) {
      toast('浏览器禁用了本地存储，账单可能无法保存', 'warn');
    }

  }

  // 暴露少量调试接口，便于在控制台或自动化测试中检查
  /* =========================================================
   * 快速记账入口（Android）：悬浮球小窗 / 通知栏常驻 / 桌面小组件
   * 三个入口共用一条链路：原生 QuickStore 队列 → 本页 commitQuick()
   * ======================================================= */

  function quickBridge() {
    return window.QHQuick || null;
  }

  function quickLocal() {
    const s = Store.getSettings();
    return Object.assign({ ball: false, notifyQuick: false }, s.quick || {});
  }

  function quickFlag(bridge, method, fallback) {
    if (bridge && typeof bridge[method] === 'function') {
      try { return !!bridge[method](); } catch (e) { /* 用本地记录兜底 */ }
    }
    return !!fallback;
  }

  function quickState() {
    const bridge = quickBridge();
    const local = quickLocal();
    return {
      bridge: bridge,
      supported: !!bridge,
      ball: quickFlag(bridge, 'isBallEnabled', local.ball),
      overlay: quickFlag(bridge, 'overlayGranted', false),
      notifyQuick: quickFlag(bridge, 'isNotifyQuickEnabled', local.notifyQuick),
      queue: bridge && typeof bridge.queueSize === 'function' ? bridge.queueSize() : 0
    };
  }

  const QUICK_KINDS = {
    ball: {
      title: '悬浮球快捷记账',
      lead: '常驻一个可拖动的小球：点一下弹出记账小窗；松手会自动吸到屏幕左侧或右侧，收起后只留一个小图标，不挡视野。',
      steps: [
        { kind: 'overlay', title: '允许悬浮窗', sub: '系统设置 → 应用 → 记把好账 → 显示在其他应用上层' },
        { kind: 'battery', title: '关闭电池限制', sub: '小米/HyperOS 再打开「自启动」，避免小球被系统清理' }
      ]
    },
    tile: {
      title: '状态栏磁贴「记一笔」',
      lead: '系统级快捷入口：把磁贴拖进控制中心，下拉点一下就直接打开 App 的记账面板，不做任何识别。',
      steps: [
        { kind: 'tile', title: '添加磁贴', sub: '下拉控制中心 → 编辑 → 找到「记一笔」拖进快捷面板（小米：右上角编辑）' }
      ]
    },
    notify: {
      title: '通知栏常驻「记一笔」',
      lead: '常驻一条通知，下拉状态栏点一下就能记一笔；不需要悬浮窗权限，是最省心的备用入口。',
      steps: [
        { kind: 'notification', title: '允许通知', sub: 'Android 13+ 需要允许通知，否则看不到这条快捷入口' }
      ]
    }
  };

  function openQuick(kind) {
    const st = quickState();
    const conf = QUICK_KINDS[kind] || QUICK_KINDS.ball;
    const rows = conf.steps.map(function (step, i) {
      return '<button class="recognition-step" data-action="quick-settings" data-kind="' + step.kind + '"' + (st.supported ? '' : ' disabled') + '>' +
        '<span class="step-ico">' + icon('shield') + '</span>' +
        '<span class="step-main"><b>' + (i + 1) + '. ' + step.title + '</b><em>' + step.sub + '</em></span>' +
        (st.supported ? icon('chevron-right') : '') +
        '</button>';
    }).join('');
    const ballOn = kind === 'ball' && st.ball;
    const notifyOn = kind === 'notify' && st.notifyQuick;
    const canToggle = kind === 'ball' || kind === 'notify';
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="close-quick"></div>' +
      '<div class="modal-card recognition-modal" role="dialog" aria-modal="true" aria-label="' + esc(conf.title) + '">' +
      '<div class="modal-head"><h3>' + esc(conf.title) + '</h3><button class="icon-btn" data-action="close-quick" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<p class="modal-text">' + (st.supported ? conf.lead : '这些入口需要安装 Android 版 APK；网页版请直接点首页的「记一笔」。') + '</p>' +
      '<div class="recognition-steps">' + rows + '</div>' +
      (st.supported && st.queue
        ? '<div class="permission-note">' + icon('info') + '<span>还有 ' + st.queue + ' 笔快捷记账待确认，回到记账页会自动弹出确认卡。</span></div>'
        : '') +
      (st.supported && canToggle
        ? '<label class="setting-row recognition-switch"><div class="row-main"><div class="row-title">' +
          (kind === 'ball' ? '悬浮球' : '通知栏快捷入口') + '</div><div class="row-sub">' +
          (kind === 'ball'
            ? (ballOn ? '已开启 · 支付页点小球即可记账' : '已关闭 · 打开后常驻一个小球')
            : (notifyOn ? '已开启 · 下拉状态栏点「记一笔」' : '已关闭 · 打开后常驻一条通知')) +
          '</div></div><button class="switch ' + ((ballOn || notifyOn) ? 'is-on' : '') + '" role="switch" aria-checked="' + (ballOn || notifyOn) +
          '" data-action="toggle-quick" data-kind="' + kind + '"><span></span></button></label>'
        : '') +
      '<div class="modal-actions"><button class="btn-primary btn-block" data-action="close-quick">' + (st.supported ? '完成' : '我知道了') + '</button></div>' +
      '</div>';
    modalRoot.classList.add('is-open');
  }

  function toggleQuick(kind) {
    const st = quickState();
    if (!st.supported) {
      toast('悬浮球快捷记账需安装 Android 版', 'warn');
      return;
    }
    const bridge = st.bridge;
    const local = quickLocal();
    const next = kind === 'ball' ? !st.ball : !st.notifyQuick;
    try {
      if (kind === 'ball' && typeof bridge.setBallEnabled === 'function') bridge.setBallEnabled(next);
      if (kind === 'notify' && typeof bridge.setNotifyQuickEnabled === 'function') bridge.setNotifyQuickEnabled(next);
    } catch (e) {
      toast('系统服务未就绪，请稍后重试', 'warn');
      return;
    }
    Store.setSettings({ quick: Object.assign({}, local, kind === 'ball' ? { ball: next } : { notifyQuick: next }) });
    if (next && kind === 'ball' && !st.overlay) toast('已打开开关，请先允许悬浮窗');
    else toast(next ? '已开启' : '已关闭');
    openQuick(kind);
  }

  function quickSettings(kind) {
    const bridge = quickBridge();
    if (bridge && typeof bridge.openSettings === 'function') {
      bridge.openSettings(kind);
      return;
    }
    toast('请在 Android 系统设置中开启对应权限', 'warn');
  }

  /* 原生快捷入口（悬浮球小窗 / 通知栏 / 小组件）确认后调用：直接入账并刷新所有页面 */
  function commitQuick(data) {
    const info = typeof data === 'string' ? (function () {
      try { return JSON.parse(data); } catch (e) { return null; }
    })() : data;
    if (!info || !(U.toNumber(info.amount) > 0)) return false;
    const income = info.type === 'income';
    const amount = U.round2(U.toNumber(info.amount));
    const cat = income ? 'income' : (CAT_MAP[info.category] ? info.category : autoCategory(info.note || info.merchant || ''));
    const res = Store.addTransactions([{
      type: income ? 'income' : 'expense',
      amount: amount,
      category: cat,
      note: String(info.note || info.merchant || '快捷记账').slice(0, 40),
      date: U.isYmd(info.date) ? info.date : U.today(),
      time: /^\d{2}:\d{2}$/.test(info.time || '') ? info.time : U.hm(new Date())
    }]);
    render();   // 记账后立即刷新首页/日历/统计/预算
    toast(res.added ? '已入账 ' + money(amount) : '这笔账单已存在', res.added ? '' : 'warn');
    return true;
  }

  /* =========================================================
   * 日历备注 / 备注搜索
   * ======================================================= */

  function openDayNote(date) {
    const d = U.isYmd(date) ? date : U.today();
    const note = Store.getDayNote(d);
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="close-day-note"></div>' +
      '<div class="modal-card" role="dialog" aria-modal="true" aria-label="当日备注">' +
      '<div class="modal-head"><h3>' + U.monthDayLabel(d) + ' 的备注</h3>' +
      '<button class="icon-btn" data-action="close-day-note" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<p class="modal-text">备注会显示在日历和当日账单里，适合标记「放纵日」「聚餐」「出差」。</p>' +
      '<input id="day-note-input" class="modal-input" maxlength="20" value="' + esc(note) + '" placeholder="如：放纵日（最多 20 字）">' +
      '<div class="modal-actions">' +
      (note ? '<button class="btn-ghost btn-block" data-action="clear-day-note" data-date="' + d + '">删除备注</button>' : '') +
      '<button class="btn-primary btn-block" data-action="save-day-note" data-date="' + d + '">保存</button>' +
      '</div>' +
      '</div>';
    modalRoot.classList.add('is-open');
    setTimeout(function () {
      const input = document.getElementById('day-note-input');
      if (input) input.focus();
    }, 60);
  }

  function closeDayNote() {
    modalRoot.classList.remove('is-open');
    setTimeout(function () {
      if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = '';
    }, 180);
  }

  function saveDayNote(date) {
    const input = document.getElementById('day-note-input');
    Store.setDayNote(date, input ? input.value : '');
    closeDayNote();
    render();
    toast('备注已保存');
  }

  function clearDayNote(date) {
    Store.setDayNote(date, '');
    closeDayNote();
    render();
    toast('备注已删除');
  }

  function noteSearchResultHTML(stat) {
    if (!stat || !stat.query) {
      return '<p class="note-search-hint">输入关键词后，会检索所有账单备注并汇总关联花费；选择起止日期后只统计该时段。</p>';
    }
    const rangeOn = !!(stat.from || stat.to);
    const scope = rangeOn
      ? '<p class="note-search-hint">统计时段：' + (stat.from || '最早') + ' 至 ' + (stat.to || '今天') + '</p>'
      : '';
    if (!stat.count) {
      return scope + '<p class="note-search-hint">' + (rangeOn ? '该时段内' : '') + '没有找到含「' + esc(stat.query) + '」的备注。</p>';
    }
    const rows = stat.list.slice(0, 8).map(function (t) {
      const cat = Store.categoryOf(t);
      return '<div class="note-hit">' +
        '<span class="note-hit-date">' + t.date.slice(5) + '</span>' +
        '<span class="note-hit-note">' + esc(t.note) + '</span>' +
        '<span class="note-hit-cat" style="--c:' + cat.color + '">' + esc(cat.name) + '</span>' +
        '<b class="' + (t.type === 'income' ? 'income' : 'expense') + '">' + (t.type === 'income' ? '+' : '-') + money(t.amount) + '</b>' +
        '</div>';
    }).join('');
    return scope + '<div class="note-search-sum">' +
      '<div><span>关联账单</span><strong>' + stat.count + ' 笔</strong></div>' +
      '<div><span>关联总花费</span><strong class="expense">' + money(stat.expense) + '</strong></div>' +
      (stat.income > 0 ? '<div><span>关联收入</span><strong class="income">' + money(stat.income) + '</strong></div>' : '') +
      '</div>' +
      '<div class="note-hits">' + rows + '</div>' +
      (stat.count > 8 ? '<p class="note-search-hint">仅显示最近 8 笔，共 ' + stat.count + ' 笔。</p>' : '');
  }

  function refreshNoteSearch(value) {
    state.noteQuery = String(value || '');
    const box = document.getElementById('note-search-result');
    if (!box) return;
    box.innerHTML = state.noteQuery
      ? noteSearchResultHTML(Store.noteStats(state.noteQuery, { from: state.noteFrom || '', to: state.noteTo || '' }))
      : noteSearchResultHTML(null);
  }

  function clearNoteRange() {
    state.noteFrom = '';
    state.noteTo = '';
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  /** 累计结余：切换查看某个月份的结余（复用 balanceHistory 的单月结余）。 */
  function shiftCumMonth(delta) {
    const balances = Store.balanceHistory(12);
    const currentKey = U.ymd(new Date()).slice(0, 7);
    let idx = -1;
    const key = state.cumMonth || currentKey;
    balances.forEach(function (b, i) { if (b.key === key) idx = i; });
    if (idx < 0) idx = balances.length - 1;
    const next = Math.min(balances.length - 1, Math.max(0, idx + delta));
    state.cumMonth = balances[next].key;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  function pickCumMonth(key) {
    if (!key) return;
    state.cumMonth = key;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  window.QHApp = {
    state: state,
    goTab: goTab,
    goDay: goDay,
    render: render,
    openAdd: openAdd,
    openCatPicker: openCatPicker,
    showTutorial: showTutorial,
    openQuick: openQuick,
    openDayNote: openDayNote,
    commitQuick: commitQuick,
    openRange: openRange,
    showImportPreview: showImportPreview,
    toast: toast
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
