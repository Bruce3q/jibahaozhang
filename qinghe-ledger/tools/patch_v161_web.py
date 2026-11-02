import io

# ---------------- store.js ----------------
p = 'js/store.js'
s = io.open(p, encoding='utf-8').read()


def rep(old, new, count=1):
    global s
    assert old in s, 'store missing: ' + old[:80]
    s = s.replace(old, new, count)


rep("""    quick: { ball: false, notifyQuick: false },""",
    """    quick: { ball: false, notifyQuick: false },""")

# defaults 增加 dayNotes
rep("""      settings: defaultSettings(),
      meta: { demo: false, lastBackupAt: null, onboarded: false }""",
    """      settings: defaultSettings(),
      dayNotes: {},
      meta: { demo: false, lastBackupAt: null, onboarded: false }""")

# migrate 补齐 dayNotes
rep("""      settings: Object.assign({}, base.settings, raw.settings || {}),
      meta: Object.assign({}, base.meta, raw.meta || {})""",
    """      settings: Object.assign({}, base.settings, raw.settings || {}),
      dayNotes: Object.assign({}, (raw && raw.dayNotes) || {}),
      meta: Object.assign({}, base.meta, raw.meta || {})""")

# 新增 API：日历备注 + 备注搜索
rep("""    clearTransactions: clearTransactions,""",
    """    clearTransactions: clearTransactions,

    /* ---- 日历备注：只存“日期 → 短备注”，与账单联动展示 ---- */
    getDayNote: function (date) {
      if (!U.isYmd(date)) return '';
      const notes = db.dayNotes || {};
      return notes[date] || '';
    },
    setDayNote: function (date, text) {
      if (!U.isYmd(date)) return false;
      if (!db.dayNotes) db.dayNotes = {};
      const value = String(text == null ? '' : text).trim().slice(0, 20);
      if (value) db.dayNotes[date] = value;
      else delete db.dayNotes[date];
      commit();
      return true;
    },
    notesBetween: function (from, to) {
      const out = {};
      Object.keys(db.dayNotes || {}).forEach(function (k) {
        if (k >= from && k <= to) out[k] = db.dayNotes[k];
      });
      return out;
    },
    /* 备注关键词搜索：检索全部账单备注，同时给出关联总花费 */
    noteStats: function (keyword) {
      const q = String(keyword || '').trim().toLowerCase();
      if (!q) return { query: '', count: 0, expense: 0, income: 0, list: [] };
      const list = db.transactions.filter(function (t) {
        return String(t.note || '').toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
      let expense = 0;
      let income = 0;
      list.forEach(function (t) {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      });
      return { query: q, count: list.length, expense: U.round2(expense), income: U.round2(income), list: list };
    },""")

io.open(p, 'w', encoding='utf-8').write(s)

# ---------------- app.js ----------------
p = 'js/app.js'
s = io.open(p, encoding='utf-8').read()

# 1) 补记 → 全部分类选择
rep("""      '<button class="day-add-btn" data-action="quick-add" data-cat="other" data-type="expense" data-date="' + selected + '">' + icon('plus') + '补记</button>' +""",
    """      '<button class="day-add-btn" data-action="open-cat-picker" data-date="' + selected + '">' + icon('plus') + '补记</button>' +""")

rep("""            '<button class="btn-soft" data-action="quick-add" data-cat="other" data-type="expense" data-date="' + date + '">' + icon('plus') + '补记一笔</button>')) +""",
    """            '<button class="btn-soft" data-action="open-cat-picker" data-date="' + date + '">' + icon('plus') + '补记一笔</button>')) +""")

# 2) 日历日面板：备注条
rep("""      '</div>' +
      '<div class="day-totals">' +""",
    """      '</div>' +
      '<div class="day-note-bar">' +
      (Store.getDayNote(selected)
        ? '<span class="day-note-chip">' + icon('pen') + esc(Store.getDayNote(selected)) + '</span>'
        : '<span class="day-note-empty">给这一天加个备注，比如「放纵日」</span>') +
      '<button class="link-btn" data-action="open-day-note" data-date="' + selected + '">' +
      (Store.getDayNote(selected) ? '编辑' : '添加') + '</button>' +
      '</div>' +
      '<div class="day-totals">' +""")

# 3) 统计页：累计结余移到三餐专项之后
rep("""      '</header>' +
      cumulativeHTML +
      segmented(""",
    """      '</header>' +
      segmented(""")

rep("""      '</section>',
      'page-stats'""",
    """      '</section>' +
      cumulativeHTML +
      noteSearchHTML,
      'page-stats'""")

# 4) 备注搜索卡（放在 periodBar 之前计算）
rep("""    const periodBar =""",
    """    const noteQuery = state.noteQuery || '';
    const noteStat = noteQuery ? Store.noteStats(noteQuery) : null;
    const noteSearchHTML =
      '<section class="card note-search-card">' +
      sectionHead('备注搜索', '<span class="section-note">全部账单</span>') +
      '<div class="note-search-box">' + icon('search') +
      '<input id="note-search" class="note-search-input" type="search" autocomplete="off" placeholder="输入备注关键词，如 奶茶 / 放纵日" value="' + esc(noteQuery) + '">' +
      (noteQuery ? '<button class="icon-btn note-search-clear" data-action="note-search-clear" aria-label="清空">' + icon('close') + '</button>' : '') +
      '</div>' +
      '<div id="note-search-result">' + noteSearchResultHTML(noteStat) + '</div>' +
      '</section>';

    const periodBar =""")

# 5) 设置页快速记账：去掉识别，加磁贴/自定义
rep("""      '<button class="list-row" data-action="open-quick" data-kind="shot">' +
      '<span class="row-icon primary">' + icon('file') + '</span>' +
      '<div class="row-main"><div class="row-title">小窗「识别截图」</div><div class="row-sub">截屏后本地 OCR 出金额与商户，填入小窗</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +""",
    """      '<button class="list-row" data-action="open-quick" data-kind="tile">' +
      '<span class="row-icon primary">' + icon('chart') + '</span>' +
      '<div class="row-main"><div class="row-title">状态栏磁贴「记一笔」</div><div class="row-sub">下拉控制中心点一下，直接打开记账面板</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +""")

rep("""      (window.QHQuick ? ((Store.getSettings().quick || {}).ball ? '已开启 · 支付页点小球记一笔' : '未开启 · 常驻小球，点一下弹记账小窗') : '网页版不可用，需安装 Android 版') +""",
    """      (window.QHQuick ? ((Store.getSettings().quick || {}).ball ? '已开启 · 可拖动，松手自动吸边' : '未开启 · 常驻小球，点一下弹记账小窗') : '网页版不可用，需安装 Android 版') +""")

rep("""      '<div class="row-main"><div class="row-title">桌面小组件</div><div class="row-sub">早餐 ¥10 / 午餐 ¥20 / 记一笔，点一下就入账</div></div>' +""",
    """      '<div class="row-main"><div class="row-title">桌面小组件</div><div class="row-sub">按钮与金额可自定义，点一下就入账</div></div>' +""")

# 6) QUICK_KINDS：移除 shot，新增 tile，更新文案
rep("""    shot: {
      title: '小窗里的「识别截图」',
      lead: '先按音量下 + 电源截屏，再点悬浮球里的识别按钮：读取最新截图，在本机 OCR 出金额与商户，填进小窗。',
      steps: [
        { kind: 'gallery', title: '允许读取相册截图', sub: '只读取你刚截的那张图，本地识别，不上传、不联网' }
      ]
    },""",
    """    tile: {
      title: '状态栏磁贴「记一笔」',
      lead: '系统级快捷入口：把磁贴拖进控制中心，下拉点一下就直接打开 App 的记账面板，不做任何识别。',
      steps: [
        { kind: 'tile', title: '添加磁贴', sub: '下拉控制中心 → 编辑 → 找到「记一笔」拖进快捷面板（小米：右上角编辑）' }
      ]
    },""")

rep("""      lead: '常驻一个可拖动的小球：在支付页点一下弹出记账小窗，记完即走，不用切回 App。',""",
    """      lead: '常驻一个可拖动的小球：点一下弹出记账小窗；松手会自动吸到屏幕左侧或右侧，收起后只留一个小图标，不挡视野。',""")

rep("""      lead: '桌面放一个小组件：早餐 ¥10 / 午餐 ¥20 / 记一笔，点一下就入账，适合出门前的惯常消费。',""",
    """      lead: '桌面放一个小组件：早餐 / 午餐 / 记一笔三个按钮，金额和显示项都能自己配，点一下就入账。',""")

# 7) openQuick：tile 不显示开关，widget 增加自定义
rep("""    const ballOn = kind === 'ball' && st.ball;
    const notifyOn = kind === 'notify' && st.notifyQuick;
    const canToggle = kind === 'ball' || kind === 'notify';""",
    """    const ballOn = kind === 'ball' && st.ball;
    const notifyOn = kind === 'notify' && st.notifyQuick;
    const canToggle = kind === 'ball' || kind === 'notify';""")

rep("""      (st.supported && kind === 'widget'
        ? '<div class="modal-actions"><button class="btn-ghost btn-block" data-action="quick-widget-pin">请求添加到桌面</button></div>'
        : '') +""",
    """      (st.supported && kind === 'widget'
        ? '<div class="modal-actions"><button class="btn-ghost btn-block" data-action="open-widget-config">自定义金额与显示项</button>' +
          '<button class="btn-ghost btn-block" data-action="quick-widget-pin">请求添加到桌面</button></div>'
        : '') +""")

# 8) quickState 去掉相册
rep("""      gallery: quickFlag(bridge, 'hasGalleryPermission', false),
""", "")

# 9) 删除 applyOcrPrefill
start = s.index("  /* 悬浮球小窗里点「识别截图」后的结果：填入金额面板，交给用户确认保存 */")
end = s.index("  window.QHApp = {")
s = s[:start] + s[end:]

# 10) 新增：日历备注、备注搜索、小组件自定义
NEW_FUNCS = r"""  /* =========================================================
   * 日历备注 / 备注搜索 / 小组件自定义
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
      return '<p class="note-search-hint">输入关键词后，会检索所有账单备注并汇总关联花费。</p>';
    }
    if (!stat.count) {
      return '<p class="note-search-hint">没有找到含「' + esc(stat.query) + '」的备注。</p>';
    }
    const rows = stat.list.slice(0, 8).map(function (t) {
      const cat = Store.categoryOf(t);
      return '<div class="note-hit">' +
        '<span class="note-hit-date">' + t.date.slice(5) + '</span>' +
        '<span class="note-hit-note">' + esc(t.note) + '</span>' +
        '<span class="note-hit-cat" style="--c:' + cat.color + '">' + cat.name + '</span>' +
        '<b class="' + (t.type === 'income' ? 'income' : 'expense') + '">' + (t.type === 'income' ? '+' : '-') + money(t.amount) + '</b>' +
        '</div>';
    }).join('');
    return '<div class="note-search-sum">' +
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
    if (box) box.innerHTML = noteSearchResultHTML(state.noteQuery ? Store.noteStats(state.noteQuery) : null);
  }

  function widgetConfig() {
    const fallback = { show_breakfast: true, show_lunch: true, show_quick: true, breakfast_amount: 10, lunch_amount: 20, title: '辣脚记账' };
    const bridge = quickBridge();
    if (bridge && typeof bridge.getWidgetConfig === 'function') {
      try {
        const raw = bridge.getWidgetConfig();
        if (raw) return Object.assign(fallback, JSON.parse(raw));
      } catch (e) { /* 用默认值 */ }
    }
    try {
      return Object.assign(fallback, JSON.parse(localStorage.getItem('qinghe.quick.widget') || '{}'));
    } catch (e) {
      return fallback;
    }
  }

  function openWidgetConfig() {
    const cfg = widgetConfig();
    const check = function (key, label, sub) {
      return '<label class="setting-row"><div class="row-main"><div class="row-title">' + label +
        '</div><div class="row-sub">' + sub + '</div></div>' +
        '<button class="switch ' + (cfg[key] ? 'is-on' : '') + '" role="switch" aria-checked="' + !!cfg[key] +
        '" data-action="widget-toggle" data-key="' + key + '"><span></span></button></label>';
    };
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="close-widget-config"></div>' +
      '<div class="modal-card" role="dialog" aria-modal="true" aria-label="小组件设置">' +
      '<div class="modal-head"><h3>桌面小组件</h3><button class="icon-btn" data-action="close-widget-config" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<p class="modal-text">选择显示哪些按钮，并设置两个常用金额。改动会立即刷新已添加到桌面上的小组件。</p>' +
      check('show_breakfast', '显示「早餐」按钮', '点一下按早餐金额直接入账') +
      check('show_lunch', '显示「午餐」按钮', '点一下按午餐金额直接入账') +
      check('show_quick', '显示「记一笔」按钮', '打开 App 的记账面板，自己填') +
      '<div class="widget-config-grid">' +
      '<label><span>早餐金额</span><input id="widget-breakfast" class="modal-input" type="number" inputmode="decimal" min="0.01" step="0.01" value="' + Number(cfg.breakfast_amount || 10) + '"></label>' +
      '<label><span>午餐金额</span><input id="widget-lunch" class="modal-input" type="number" inputmode="decimal" min="0.01" step="0.01" value="' + Number(cfg.lunch_amount || 20) + '"></label>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn-primary btn-block" data-action="save-widget-config">保存</button></div>' +
      '</div>';
    modalRoot.classList.add('is-open');
    state.widgetCfg = cfg;
  }

  function toggleWidgetOption(key) {
    if (!state.widgetCfg) state.widgetCfg = widgetConfig();
    state.widgetCfg[key] = !state.widgetCfg[key];
    openWidgetConfigFromCfg(state.widgetCfg);
  }

  function openWidgetConfigFromCfg(cfg) {
    state.widgetCfg = cfg;
    const values = {
      breakfast: document.getElementById('widget-breakfast'),
      lunch: document.getElementById('widget-lunch')
    };
    const keep = {
      breakfast: values.breakfast ? values.breakfast.value : cfg.breakfast_amount,
      lunch: values.lunch ? values.lunch.value : cfg.lunch_amount
    };
    openWidgetConfig();
    const b = document.getElementById('widget-breakfast');
    const l = document.getElementById('widget-lunch');
    if (b) b.value = keep.breakfast;
    if (l) l.value = keep.lunch;
  }

  function saveWidgetConfig() {
    const cfg = state.widgetCfg || widgetConfig();
    const b = document.getElementById('widget-breakfast');
    const l = document.getElementById('widget-lunch');
    cfg.breakfast_amount = Math.max(0.01, U.round2(U.toNumber(b ? b.value : cfg.breakfast_amount) || 10));
    cfg.lunch_amount = Math.max(0.01, U.round2(U.toNumber(l ? l.value : cfg.lunch_amount) || 20));
    cfg.title = '辣脚记账';
    const bridge = quickBridge();
    let ok = false;
    if (bridge && typeof bridge.setWidgetConfig === 'function') {
      try { bridge.setWidgetConfig(JSON.stringify(cfg)); ok = true; } catch (e) { ok = false; }
    }
    try { localStorage.setItem('qinghe.quick.widget', JSON.stringify(cfg)); } catch (e) { /* 忽略 */ }
    modalRoot.classList.remove('is-open');
    setTimeout(function () {
      if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = '';
    }, 180);
    toast(ok ? '小组件已更新' : '已保存，网页版无桌面小组件', ok ? '' : 'warn');
  }

  window.QHApp = {"""

s = s.replace("  window.QHApp = {", NEW_FUNCS, 1)

# 11) 事件：新增 case
rep("""      case 'open-quick':""",
    """      case 'open-day-note':
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
      case 'open-widget-config':
        openWidgetConfig();
        break;
      case 'close-widget-config':
        modalRoot.classList.remove('is-open');
        setTimeout(function () {
          if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = '';
        }, 180);
        break;
      case 'widget-toggle':
        toggleWidgetOption(target.dataset.key);
        break;
      case 'save-widget-config':
        saveWidgetConfig();
        break;
      case 'open-quick':""")

# 12) 输入：备注搜索
rep("""    } else if (t.id === 'note-input' && state.sheet) {""",
    """    } else if (t.id === 'note-search') {
      refreshNoteSearch(t.value);
    } else if (t.id === 'note-input' && state.sheet) {""")

# 13) 导出
rep("""    openQuick: openQuick,
    commitQuick: commitQuick,
    applyOcrPrefill: applyOcrPrefill,""",
    """    openQuick: openQuick,
    openWidgetConfig: openWidgetConfig,
    openDayNote: openDayNote,
    commitQuick: commitQuick,""")

# 14) 版本号
s = s.replace('辣脚记账 v1.6.0', '辣脚记账 v1.6.1')

io.open(p, 'w', encoding='utf-8').write(s)
print('web patched')