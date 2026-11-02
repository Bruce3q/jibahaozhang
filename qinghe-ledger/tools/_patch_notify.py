# -*- coding: utf-8 -*-
"""把 js/app.js 的支付识别实现整体替换为「通知自动记账」实现。

一次性脚本（改造完成后可删除）：
    python tools/_patch_notify.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "js" / "app.js"
BLOCK = (ROOT / "tools" / "_notify_block.js").read_text(encoding="utf-8")

src = APP.read_text(encoding="utf-8")

START = "  /* =========================================================\n   * 支付识别（Android 相册截图桥；网页版仅展示说明）"
END = "  /* =========================================================\n   * 日历自定义周期统计"
i = src.index(START)
j = src.index(END)
src = src[:i] + BLOCK + "\n" + src[j:]

OLD_SECTION = """      '<section class="group">' +
      '<h2 class="group-title">状态栏一键记账</h2>' +
      '<div class="group-card">' +
      '<button class="list-row" data-action="open-recognition">' +
      '<span class="row-icon primary">' + icon('sparkles') + '</span>' +
      '<div class="row-main"><div class="row-title">状态栏磁贴「记账识别」</div><div class="row-sub">' +
      (window.QHRecognition ? (recognitionEnabled(window.QHRecognition, s) ? '已启用 · 支付页截屏后下拉状态栏点一下' : '未启用 · 点此添加磁贴') : '网页版不可用，需安装 Android 版') +
      '</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '</div>' +
      '</section>' +"""

NEW_SECTION = """      '<section class="group">' +
      '<h2 class="group-title">通知自动记账</h2>' +
      '<div class="group-card">' +
      '<button class="list-row" data-action="open-notify">' +
      '<span class="row-icon primary">' + icon('bell') + '</span>' +
      '<div class="row-main"><div class="row-title">微信支付通知</div><div class="row-sub">' +
      (window.QHNotify
        ? (notifyEnabled(window.QHNotify, s)
          ? (notifyAccessGranted(window.QHNotify) ? '已开启 · 微信支付后自动识别' : '待授权 · 点此开启通知使用权')
          : '未开启 · 点此设置')
        : '网页版不可用，需安装 Android 版') +
      '</div></div>' +
      '<span class="row-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +
      '</div>' +
      '</section>' +"""

OLD_CASES = """      case 'open-recognition':
        openRecognition();
        break;
      case 'close-recognition':
        modalRoot.classList.remove('is-open');
        setTimeout(function () { if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = ''; }, 180);
        break;
      case 'toggle-recognition':
        toggleRecognition();
        break;
      case 'recognition-settings': {
        const bridge = recognitionBridge();
        if (target.dataset.kind === 'tile') {
          toast('下拉通知栏 → 点编辑铅笔 → 把「记账识别」拖进快捷面板');
        } else if (target.dataset.kind === 'gallery') {
          if (bridge && typeof bridge.requestGalleryPermission === 'function') bridge.requestGalleryPermission();
          else if (bridge && bridge.openSettings) bridge.openSettings('app');
          else toast('请在系统设置 → 应用 → 辣脚记账 → 权限中允许读取照片', 'warn');
        } else if (bridge && bridge.openSettings) bridge.openSettings(target.dataset.kind);
        else toast('请在 Android 系统设置中开启对应权限', 'warn');
        break;
      }
      case 'confirm-recognition':
        confirmRecognition();
        break;
      case 'cancel-recognition':
        state.recognitionTx = null;
        modalRoot.classList.remove('is-open');
        setTimeout(function () { if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = ''; }, 180);
        break;"""

NEW_CASES = """      case 'open-notify':
        openNotify();
        break;
      case 'close-notify':
        modalRoot.classList.remove('is-open');
        setTimeout(function () { if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = ''; }, 180);
        break;
      case 'toggle-notify':
        toggleNotify();
        break;
      case 'notify-settings': {
        const bridge = notifyBridge();
        if (bridge && bridge.openSettings) bridge.openSettings(target.dataset.kind);
        else toast('请在 Android 系统设置中开启对应权限', 'warn');
        break;
      }
      case 'confirm-notify':
        confirmNotify();
        break;
      case 'cancel-notify':
        state.confirmTx = null;
        modalRoot.classList.remove('is-open');
        setTimeout(function () { if (!modalRoot.classList.contains('is-open')) modalRoot.innerHTML = ''; }, 180);
        break;"""

OLD_EXPORTS = """    recognitionResult: showRecognitionResult,
    commitRecognition: commitRecognition,
    openRecognition: openRecognition,"""

NEW_EXPORTS = """    showConfirmCard: showConfirmCard,
    commitNotify: commitNotify,
    openNotify: openNotify,"""

PAIRS = [
    (OLD_SECTION, NEW_SECTION, "settings-section"),
    (OLD_CASES, NEW_CASES, "event-cases"),
    (OLD_EXPORTS, NEW_EXPORTS, "exports"),
    ("recognitionTx: null,", "confirmTx: null,", "state-field"),
    ("recognitionBridge()", "notifyBridge()", "bridge-calls"),
    ("syncRecognitionState", "syncNotifyState", "sync-fn"),
    ("__qhRecognitionQueue", "__qhConfirmQueue", "queue"),
    ("recognitionEnabled(", "notifyEnabled(", "enabled-helper"),
    ("'open-recognition'", "'open-notify'", "action-open"),
    ("'close-recognition'", "'close-notify'", "action-close"),
    ("'toggle-recognition'", "'toggle-notify'", "action-toggle"),
    ("'confirm-recognition'", "'confirm-notify'", "action-confirm"),
    ("'cancel-recognition'", "'cancel-notify'", "action-cancel"),
    ("'recognition-settings'", "'notify-settings'", "action-settings"),
    ("openRecognition", "openNotify", "fn-open"),
    ("toggleRecognition", "toggleNotify", "fn-toggle"),
    ("confirmRecognition", "confirmNotify", "fn-confirm"),
    ("辣脚记账 v1.4.2", "辣脚记账 v1.5.0", "version"),
]

for old, new, name in PAIRS:
    count = src.count(old)
    if count:
        src = src.replace(old, new)
    print(f"{name}: replaced {count}")

APP.write_text(src, encoding="utf-8")
print("app.js patched:", len(src), "chars")