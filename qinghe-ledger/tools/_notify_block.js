/* =========================================================
   * 通知自动记账（Android NotificationListenerService 桥）
   * 微信支付/收款通知到达时在本机解析，确认后才入账
   * ======================================================= */

  function notifyBridge() {
    return window.QHNotify || null;
  }

  function notifyEnabled(bridge, settings) {
    if (bridge && typeof bridge.isEnabled === 'function') {
      try { return !!bridge.isEnabled(); } catch (e) { /* 回退到本地设置 */ }
    }
    return !!settings.recognition.enabled;
  }

  function notifyAccessGranted(bridge) {
    if (bridge && typeof bridge.isAccessGranted === 'function') {
      try { return !!bridge.isAccessGranted(); } catch (e) { return false; }
    }
    return false;
  }

  function notifyOverlayGranted(bridge) {
    if (bridge && typeof bridge.overlayGranted === 'function') {
      try { return !!bridge.overlayGranted(); } catch (e) { return false; }
    }
    return false;
  }

  function openNotify() {
    const s = Store.getSettings();
    const bridge = notifyBridge();
    const supported = !!bridge;
    const enabled = notifyEnabled(bridge, s);
    const access = supported && notifyAccessGranted(bridge);
    const overlay = supported && notifyOverlayGranted(bridge);
    const steps = [
      { kind: 'access', title: '开启「通知使用权」', sub: access ? '已授权 · 微信支付/收款通知会被本机解析' : '系统设置 → 通知使用权 → 允许辣脚记账读取微信通知', ico: 'bell' },
      { kind: 'overlay', title: '允许悬浮窗（可选）', sub: overlay ? '已允许 · 识别后直接弹确认卡' : '不开启也能用：改为发一条通知，点开再确认', ico: 'shield' },
      { kind: 'battery', title: '关闭电池限制', sub: '小米/HyperOS 建议同时允许「自启动」，避免监听被系统清理', ico: 'refresh' }
    ];
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="close-notify"></div>' +
      '<div class="modal-card recognition-modal" role="dialog" aria-modal="true" aria-label="通知自动记账">' +
      '<div class="modal-head"><h3>通知自动记账</h3><button class="icon-btn" data-action="close-notify" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<p class="modal-text">' + (supported
        ? '开启后，微信支付或收款通知到达时，App 在本机解析金额与商户（不联网、不上传），弹出确认卡，确认后才入账。不使用无障碍、不截图、不录屏。'
        : '网页版无法读取微信通知。安装 Android 版后开启「通知使用权」，即可自动识别微信支付。') + '</p>' +
      '<div class="recognition-steps">' +
      steps.map(function (st, i) {
        return '<button class="recognition-step" data-action="notify-settings" data-kind="' + st.kind + '"' + (supported ? '' : ' disabled') + '>' +
          '<span class="step-ico">' + icon(st.ico) + '</span>' +
          '<span class="step-main"><b>' + (i + 1) + '. ' + st.title + '</b><em>' + st.sub + '</em></span>' +
          (supported ? icon('chevron-right') : '') +
          '</button>';
      }).join('') +
      '</div>' +
      (supported && !access
        ? '<div class="permission-note">' + icon('info') + '<span>未授权「通知使用权」时，App 收不到微信通知，不会自动识别。</span></div>'
        : '') +
      (supported
        ? '<div class="permission-note is-ok">' + icon('info') + '<span>识别结果只在本机处理，直接忽略也不会产生账单。</span></div>'
        : '<div class="permission-note">' + icon('info') + '<span>当前是网页版，通知自动记账需安装 Android 版 APK。</span></div>') +
      (supported
        ? '<label class="setting-row recognition-switch"><div class="row-main"><div class="row-title">通知自动记账</div><div class="row-sub">' +
          (enabled
            ? (access ? '已开启 · 微信支付后自动识别' : '已开启 · 等待「通知使用权」授权')
            : '已关闭 · 打开后才会读取微信通知') + '</div></div>' +
          '<button class="switch ' + (enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + enabled + '" data-action="toggle-notify"><span></span></button></label>'
        : '') +
      '<div class="modal-actions"><button class="btn-primary btn-block" data-action="close-notify">' + (supported ? '完成' : '我知道了') + '</button></div>' +
      '</div>';
    modalRoot.classList.add('is-open');
  }

  function toggleNotify() {
    const s = Store.getSettings();
    const bridge = notifyBridge();
    if (!bridge) {
      toast('通知自动记账需安装 Android 版', 'warn');
      return;
    }
    const next = !notifyEnabled(bridge, s);
    try {
      if (typeof bridge.setEnabled === 'function') bridge.setEnabled(next);
    } catch (e) {
      toast('系统服务未就绪，请稍后重试', 'warn');
      return;
    }
    Store.setSettings({ recognition: Object.assign({}, s.recognition, { enabled: next }) });
    if (next && !notifyAccessGranted(bridge)) {
      toast('已打开开关，请先完成第 1 步授权');
    } else {
      toast(next ? '已开启通知自动记账' : '已关闭通知自动记账');
    }
    openNotify();
  }

  /* 原生层识别成功后调用：window.QHApp.showConfirmCard({amount,merchant,time,date,category,type}) */
  function showConfirmCard(data) {
    if (!modalRoot) {
      (window.__qhConfirmQueue = window.__qhConfirmQueue || []).push(data);
      return false;
    }
    if (!data || !(U.toNumber(data.amount) > 0)) return false;
    // 识别结果可能晚于页面初始化到达：先让分类面板/金额面板让位，避免被遮住
    if (state.picker) closePicker();
    if (state.sheet) closeSheet();
    if (state.tutorial) state.tutorial = null;
    const income = data.type === 'income';
    const amount = U.round2(U.toNumber(data.amount));
    const cat = income ? 'income' : (CAT_MAP[data.category] ? data.category : autoCategory(data.merchant));
    state.confirmTx = {
      type: income ? 'income' : 'expense',
      amount: amount,
      category: cat,
      note: String(data.note || data.merchant || (income ? '微信收款' : '微信支付')).slice(0, 40),
      date: U.isYmd(data.date) ? data.date : U.today(),
      time: /^\d{2}:\d{2}$/.test(data.time || '') ? data.time : U.hm(new Date())
    };
    const options = income ? [INCOME] : CATS;
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-action="cancel-notify"></div>' +
      '<div class="modal-card recognition-result" role="dialog" aria-modal="true" aria-label="通知识别确认">' +
      '<div class="recognized-badge">' + icon('check') + (income ? '识别到一笔微信收款' : '识别到一笔微信支付') + '</div>' +
      '<div class="recognized-amount">' + (income ? '+' : '−') + money(amount) + '</div>' +
      '<div class="recognized-merchant">' + esc(data.merchant || '未知商户') + '<span>' + state.confirmTx.date + ' ' + state.confirmTx.time + '</span></div>' +
      '<label class="setting-row"><div class="row-main"><div class="row-title">分类</div><div class="row-sub">可手动修改，确认后才入账</div></div>' +
      '<select class="import-cat" id="confirm-cat">' + options.map(function (c) {
        return '<option value="' + c.id + '"' + (c.id === cat ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field"><span>备注</span><input id="confirm-note" type="text" maxlength="40" value="' + esc(state.confirmTx.note) + '"></label>' +
      '<div class="modal-actions"><button class="btn-ghost" data-action="cancel-notify">忽略</button>' +
      '<button class="btn-primary" data-action="confirm-notify">确认入账</button></div>' +
      '</div>';
    modalRoot.classList.add('is-open');
    return true;
  }

  function autoCategory(text) {
    const s = String(text || '');
    if (/早餐|包子|豆浆|油条|粥/.test(s)) return 'breakfast';
    if (/午餐|午饭|快餐|盖饭|面馆|小吃|米线|麻辣烫|饺子|沙县/.test(s)) return 'lunch';
    if (/晚餐|晚饭|烧烤|火锅/.test(s)) return 'dinner';
    if (/地铁|公交|打车|滴滴|高铁|火车|加油/.test(s)) return 'transport';
    if (/超市|便利店|商场|淘宝|京东|拼多多/.test(s)) return 'shopping';
    if (/电影|游戏|KTV|咖啡|奶茶/.test(s)) return 'entertainment';
    if (/水费|电费|燃气|物业/.test(s)) return 'housing';
    if (/洗澡|浴资|洗浴/.test(s)) return 'bath';
    if (/饮水|矿泉水|纯净水/.test(s)) return 'water';
    return 'other';
  }

  function confirmNotify() {
    const tx = state.confirmTx;
    if (!tx) return;
    const catEl = document.getElementById('confirm-cat');
    const noteEl = document.getElementById('confirm-note');
    const payload = Object.assign({}, tx, {
      category: catEl ? catEl.value : tx.category,
      note: noteEl ? noteEl.value.trim() : tx.note
    });
    const res = Store.addTransactions([payload]);
    state.confirmTx = null;
    modalRoot.classList.remove('is-open');
    setTimeout(function () { if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = ''; }, 180);
    toast(res.added ? '已入账 ' + money(payload.amount) + (res.skipped ? '，重复账单已跳过' : '') : '这笔账单已存在');
  }

  /* 悬浮卡已确认时直接入账，不再弹第二张卡。返回 true 让原生清 pending。 */
  function commitNotify(data) {
    if (!data || !(U.toNumber(data.amount) > 0)) return false;
    const income = data.type === 'income';
    const amount = U.round2(U.toNumber(data.amount));
    const cat = income ? 'income' : (CAT_MAP[data.category] ? data.category : autoCategory(data.merchant));
    const payload = {
      type: income ? 'income' : 'expense',
      amount: amount,
      category: cat,
      note: String(data.note || data.merchant || '通知记账').slice(0, 40),
      date: U.isYmd(data.date) ? data.date : U.today(),
      time: /^\d{2}:\d{2}$/.test(data.time || '') ? data.time : U.hm(new Date())
    };
    const res = Store.addTransactions([payload]);
    toast(res.added ? '已入账 ' + money(amount) : '这笔账单已存在，未重复入账');
    return true;
  }