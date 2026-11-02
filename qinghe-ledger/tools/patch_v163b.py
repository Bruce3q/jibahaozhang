# -*- coding: utf-8 -*-
"""v1.6.3：累计结余按月查看 + 备注搜索时段筛选 + 洗衣分类。"""
import io

COUNT = 0


def read_text(path):
    raw = io.open(path, encoding='utf-8', newline='').read()
    return raw, raw.replace('\r\n', '\n')


def write_text(path, text, crlf):
    out = text.replace('\n', '\r\n') if crlf else text
    io.open(path, 'w', encoding='utf-8', newline='').write(out)


def patch(path, pairs):
    global COUNT
    raw, s = read_text(path)
    crlf = '\r\n' in raw
    for old, new in pairs:
        if old not in s:
            raise SystemExit('MISS in %s: %r' % (path, old[:80]))
        s = s.replace(old, new, 1)
        COUNT += 1
    write_text(path, s, crlf)
    print('patched', path, 'crlf' if crlf else 'lf')


# ---------------- store.js ----------------
patch('js/store.js', [
    ("    { id: 'water', name: '饮水', icon: 'water', color: '#5A9BD5', type: 'expense' },",
     "    { id: 'water', name: '饮水', icon: 'water', color: '#5A9BD5', type: 'expense' },\n"
     "    { id: 'laundry', name: '洗衣', icon: 'shirt', color: '#6E86C9', type: 'expense' },"),

    ("""    /* 备注关键词搜索：检索全部账单备注，同时给出关联总花费 */
    noteStats: function (keyword) {
      const q = String(keyword || '').trim().toLowerCase();
      if (!q) return { query: '', count: 0, expense: 0, income: 0, list: [] };
      const list = db.transactions.filter(function (t) {
        return String(t.note || '').toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });""",
     """    /* 备注关键词搜索：检索全部账单备注，同时给出关联总花费；可限定起止日期 */
    noteStats: function (keyword, range) {
      const q = String(keyword || '').trim().toLowerCase();
      const from = range && U.isYmd(range.from) ? range.from : '';
      const to = range && U.isYmd(range.to) ? range.to : '';
      if (!q) return { query: '', from: from, to: to, count: 0, expense: 0, income: 0, list: [] };
      const list = db.transactions.filter(function (t) {
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        return String(t.note || '').toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });"""),

    ("      return { query: q, count: list.length, expense: U.round2(expense), income: U.round2(income), list: list };",
     "      return { query: q, from: from, to: to, count: list.length, expense: U.round2(expense), income: U.round2(income), list: list };"),

    ("    monthBudget: monthBudget,\n    effectiveSpent: effectiveSpent,",
     "    monthBudget: monthBudget,\n    monthBalance: monthBalance,\n    effectiveSpent: effectiveSpent,"),
])

# ---------------- index.html（洗衣图标） ----------------
patch('index.html', [
    ('    <symbol id="i-water" viewBox="0 0 24 24">',
     '    <symbol id="i-shirt" viewBox="0 0 24 24">\n'
     '      <path d="M8.5 4 4 6.5l1.5 3.5L8 9v10.5h8V9l2.5 1L20 6.5 15.5 4c-.6 1.2-1.8 2-3.5 2S9.1 5.2 8.5 4Z"/>\n'
     '    </symbol>\n'
     '    <symbol id="i-water" viewBox="0 0 24 24">'),
])

# ---------------- sw.js / Manifest ----------------
patch('sw.js', [("const VERSION = 'qinghe-v21';", "const VERSION = 'qinghe-v22';")])
patch('android/app/src/main/AndroidManifest.xml', [
    ('android:versionCode="18"', 'android:versionCode="19"'),
    ('android:versionName="1.6.2"', 'android:versionName="1.6.3"'),
])

# ---------------- app.js ----------------
patch('js/app.js', [
    ("    stats: { mode: 'month', anchor: U.today() },\n    sheet: null,",
     "    stats: { mode: 'month', anchor: U.today() },\n    cumMonth: '',\n    noteFrom: '',\n    noteTo: '',\n    sheet: null,"),

    ("""    const cumulative = Store.cumulativeBalance();
    const balances = Store.balanceHistory(12);
    const maxAbs = Math.max.apply(null, balances.map(function (b) { return Math.abs(b.balance); }).concat([1]));
    const balanceChart =
      '<div class="balance-chart" aria-label="近 12 个月结余">' +
      balances.map(function (b, i) {
        const pos = b.balance >= 0;
        const h = Math.max(b.balance === 0 ? 0 : 3, Math.round((Math.abs(b.balance) / maxAbs) * 100));
        return (
          '<div class="bc-col" title="' + b.year + '年' + (b.month + 1) + '月 结余 ' + money(b.balance) + '">' +
          '<i class="bc-bar ' + (pos ? 'pos' : 'neg') + '" style="height:' + h + '%"></i>' +
          '<span>' + (b.month + 1) + '月</span>' +
          '</div>'
        );
      }).join('') +
      '</div>';

    const cumulativeHTML =
      '<section class="cum-card">' +
      '<div class="cum-top"><span class="cum-label">' + icon('chart') + '累计结余</span><span class="cum-months">' + (cumulative.months ? cumulative.months + ' 个月' : '暂无账单') + '</span></div>' +
      '<div class="cum-amount ' + (cumulative.total >= 0 ? 'income' : 'expense') + '">' + money(cumulative.total) + '</div>' +
      '<p class="cum-sub">单月结余 = 当月总预算 − 当月实际支出，累加所有月份</p>' +
      balanceChart +
      '<div class="balance-legend"><span><i class="dot income"></i>结余</span><span><i class="dot expense"></i>超支</span><em>近 12 个月</em></div>' +
      '</section>';""",
     """    const cumulative = Store.cumulativeBalance();
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
      '</section>';"""),

    ("""    const noteQuery = state.noteQuery || '';
    const noteStat = noteQuery ? Store.noteStats(noteQuery) : null;
    const noteSearchHTML =
      '<section class="card note-search-card">' +
      sectionHead('备注搜索', '<span class="section-note">全部账单</span>') +
      '<div class="note-search-box">' + icon('search') +
      '<input id="note-search" class="note-search-input" type="search" autocomplete="off" placeholder="输入备注关键词，如 奶茶 / 放纵日" value="' + esc(noteQuery) + '">' +
      (noteQuery ? '<button class="icon-btn note-search-clear" data-action="note-search-clear" aria-label="清空">' + icon('close') + '</button>' : '') +
      '</div>' +
      '<div id="note-search-result">' + noteSearchResultHTML(noteStat) + '</div>' +
      '</section>';""",
     """    const noteQuery = state.noteQuery || '';
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
      '</section>';"""),

    ("""      case 'note-search-clear':
        refreshNoteSearch('');
        render();
        break;""",
     """      case 'note-search-clear':
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
        break;"""),

    ("""  function onChange(e) {
    const t = e.target;""",
     """  function onChange(e) {
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
    }"""),

    ("""  function noteSearchResultHTML(stat) {
    if (!stat || !stat.query) {
      return '<p class="note-search-hint">输入关键词后，会检索所有账单备注并汇总关联花费。</p>';
    }
    if (!stat.count) {
      return '<p class="note-search-hint">没有找到含「' + esc(stat.query) + '」的备注。</p>';
    }""",
     """  function noteSearchResultHTML(stat) {
    if (!stat || !stat.query) {
      return '<p class="note-search-hint">输入关键词后，会检索所有账单备注并汇总关联花费；选择起止日期后只统计该时段。</p>';
    }
    const rangeOn = !!(stat.from || stat.to);
    const scope = rangeOn
      ? '<p class="note-search-hint">统计时段：' + (stat.from || '最早') + ' 至 ' + (stat.to || '今天') + '</p>'
      : '';
    if (!stat.count) {
      return scope + '<p class="note-search-hint">' + (rangeOn ? '该时段内' : '') + '没有找到含「' + esc(stat.query) + '」的备注。</p>';
    }"""),

    ("    return '<div class=\"note-search-sum\">' +",
     "    return scope + '<div class=\"note-search-sum\">' +"),

    ("""  function refreshNoteSearch(value) {
    state.noteQuery = String(value || '');
    const box = document.getElementById('note-search-result');
    if (box) box.innerHTML = noteSearchResultHTML(state.noteQuery ? Store.noteStats(state.noteQuery) : null);
  }""",
     """  function refreshNoteSearch(value) {
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
  }"""),

    ("'<p>辣脚记账 v1.6.2</p>' +", "'<p>辣脚记账 v1.6.3</p>' +"),
])

# ---------------- CSS ----------------
css_add = """

/* ---- v1.6.3：累计结余月份切换 / 备注搜索时段 / 洗衣分类 ---- */
.cum-month-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.cum-nav-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: var(--primary-soft);
  color: var(--primary-strong);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.cum-nav-btn svg { width: 16px; height: 16px; }
.cum-nav-btn:disabled { opacity: .35; cursor: default; }
.cum-month-label {
  min-width: 78px;
  text-align: center;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
}
.bc-col { cursor: pointer; border-radius: 10px; }
.bc-col.is-active { background: var(--primary-soft); box-shadow: inset 0 0 0 1px rgba(79,157,105,.22); }
.note-range {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.note-range-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 12px;
  background: var(--card-2);
  border: 1px solid var(--line);
}
.note-range-field span { font-size: 12px; color: var(--text-3); flex: none; }
.note-range-field input {
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  color: var(--text);
  padding: 0;
  min-width: 106px;
}
.note-range-field input:focus { outline: none; }
.note-range-clear {
  border: 0;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 11px;
  cursor: pointer;
}
.note-range-clear:disabled { opacity: .4; cursor: default; }
"""
raw, css = read_text('css/app.css')
crlf = '\r\n' in raw
write_text('css/app.css', css + css_add, crlf)
print('appended css')

print('total replacements', COUNT)