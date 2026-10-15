
// ==UserScript==
// @name         Mellojoy 13:00予約サポート
// @namespace    local.mellojoy.helper
// @version      3.0.0
// @description  13時の更新から予約操作を順番に補助
// @match        https://mellojoylucky.cn/*
// @match        https://*.mellojoylucky.cn/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const TARGET_TIME = '16:30';
  const RELEASE_OFFSET_DAYS = 6;
  const PREFIX = 'mellojoyHelperV3';

  if (window.__mellojoyHelperV3) return;
  window.__mellojoyHelperV3 = true;

  const $ = (id) => document.getElementById(id);

  function normalize(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[ \t\r\n　]/g, '')
      .replace(/[–—−－〜～]/g, '-')
      .replace(/：/g, ':');
  }

  function getTargetDate() {
    const d = new Date();
    d.setDate(d.getDate() + RELEASE_OFFSET_DAYS);
    return {
      month: d.getMonth() + 1,
      day: d.getDate(),
      label: `${d.getMonth() + 1}月${d.getDate()}日`,
      slash: `${d.getMonth() + 1}/${d.getDate()}`,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    };
  }

  const target = getTargetDate();
  const stateKey = `${PREFIX}:${target.key}`;
  const refreshKey = `${PREFIX}:refreshed:${new Date().toDateString()}`;

  function getStage() {
    return sessionStorage.getItem(stateKey) || 'waiting';
  }

  function setStage(stage) {
    sessionStorage.setItem(stateKey, stage);
    showStatus(`進行状況：${stageText(stage)}`);
  }

  function stageText(stage) {
    const labels = {
      waiting: '13時の更新待ち',
      date: '対象日の表示・選択待ち',
      slot: '16:30〜17:30の枠を探しています',
      join: '「抽選に参加」を探しています',
      consent: '同意画面を確認しています',
      save: '当選画面・入場券保存を確認しています',
      done: '操作完了。画面を確認してください'
    };
    return labels[stage] || stage;
  }

  function showStatus(message) {
    const el = $('mellojoy-status');
    if (el) el.textContent = message;
  }

  // ページ上で表示されている文字から、押せそうな要素を探す
  function findClickable(phrases, exact = false) {
    const candidates = Array.from(document.querySelectorAll(
      'button,a,[role="button"],input[type="button"],input[type="submit"],div,span,li'
    ));

    const matches = candidates.filter((el) => {
      if (!el.isConnected) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (el.getClientRects().length === 0) return false;

      const raw = el.innerText || el.value || el.getAttribute('aria-label') || '';
      const text = normalize(raw);
      if (!text) return false;

      return phrases.some((phrase) => {
        const p = normalize(phrase);
        return exact ? text === p : text.includes(p);
      });
    });

    // 文字が一致する中で、できるだけ小さい要素を優先
    matches.sort((a, b) => {
      const ta = normalize(a.innerText || a.value || '');
      const tb = normalize(b.innerText || b.value || '');
      return ta.length - tb.length;
    });

    const el = matches[0];
    if (!el) return null;

    return el.closest(
      'button,a,[role="button"],input[type="button"],input[type="submit"]'
    ) || el;
  }

  function clickText(phrases, exact = false) {
    const el = findClickable(phrases, exact);
    if (!el) return false;

    const disabled =
      el.disabled ||
      el.getAttribute('aria-disabled') === 'true';

    if (disabled) return false;

    el.click();
    return true;
  }

  function datePhrases() {
    return [
      target.label,
      target.slash,
      `${target.month}月${target.day}日`,
      `${String(target.month).padStart(2, '0')}/${String(target.day).padStart(2, '0')}`
    ];
  }

  // ピンクのサポートパネル
  function createPanel() {
    if ($('mellojoy-helper-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'mellojoy-helper-panel';
    panel.style.cssText = [
      'position:fixed',
      'right:10px',
      'bottom:16px',
      'z-index:2147483647',
      'width:245px',
      'padding:13px',
      'background:#fff0f6',
      'border:2px solid #f4a6c7',
      'border-radius:14px',
      'box-shadow:0 3px 14px #0003',
      'font:14px/1.45 -apple-system,BlinkMacSystemFont,sans-serif',
      'color:#5c2942'
    ].join(';');

    panel.innerHTML = `
      <div style="font-weight:800;font-size:15px;margin-bottom:6px">
        🎀 Mellojoy 予約サポート
      </div>
      <div style="margin-bottom:5px">
        対象日：<b id="mellojoy-date"></b>
      </div>
      <div style="margin-bottom:7px">
        予約枠：16:30〜17:30
      </div>
      <div id="mellojoy-countdown" style="font-weight:700;margin-bottom:7px">
        13:00まで確認中…
      </div>
      <div id="mellojoy-status" style="font-size:12px;margin-bottom:9px">
        準備中…
      </div>
      <button id="mellojoy-refresh" style="width:100%;padding:8px;margin-bottom:6px;border:0;border-radius:8px;background:#e879ad;color:white;font-weight:700">
        今すぐページを更新
      </button>
      <button id="mellojoy-start" style="width:100%;padding:8px;margin-bottom:6px;border:0;border-radius:8px;background:#d94f91;color:white;font-weight:700">
        自動操作を開始
      </button>
      <button id="mellojoy-stop" style="width:100%;padding:7px;border:1px solid #e3a2c0;border-radius:8px;background:white;color:#7b3656">
        自動操作を停止
      </button>
      <div style="font-size:11px;margin-top:7px;color:#875b70">
        ※位置情報などの端末側の確認は手動になる場合があります。
      </div>
    `;

    document.body.appendChild(panel);
    $('mellojoy-date').textContent = target.label;

    $('mellojoy-refresh').onclick = () => location.reload();

    $('mellojoy-start').onclick = () => {
      localStorage.setItem(`${PREFIX}:enabled`, 'yes');
      if (getStage() === 'waiting') setStage('date');
      showStatus('自動操作を開始しました。ページを確認中…');
      runAutomation();
    };

    $('mellojoy-stop').onclick = () => {
      localStorage.setItem(`${PREFIX}:enabled`, 'no');
      showStatus('自動操作を停止しました');
    };
  }

  function updateCountdown() {
    const now = new Date();
    const release = new Date();
    release.setHours(13, 0, 0, 0);

    if (now >= release) {
      $('mellojoy-countdown').textContent = '13:00を過ぎています';
    } else {
      const ms = release - now;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      $('mellojoy-countdown').textContent =
        `13:00まで ${h}時間${m}分${s}秒`;
    }

    // 13時に一度だけ更新する。自動操作がONのときのみ実行
    if (
      now >= release &&
      localStorage.getItem(`${PREFIX}:enabled`) === 'yes' &&
      sessionStorage.getItem(refreshKey) !== 'yes' &&
      getStage() === 'waiting'
    ) {
      sessionStorage.setItem(refreshKey, 'yes');
      setStage('date');
      location.reload();
    }
  }

  function runAutomation() {
    if (localStorage.getItem(`${PREFIX}:enabled`) !== 'yes') return;

    const stage = getStage();

    if (stage === 'waiting') {
      showStatus('自動操作はONです。13時の更新を待っています');
      return;
    }

    if (stage === 'date') {
      const dateButton = findClickable(datePhrases());
      if (dateButton) {
        dateButton.click();
        setStage('slot');
      } else {
        showStatus(`対象日 ${target.label} の表示を待っています`);
      }
      return;
    }

    if (stage === 'slot') {
      const slot = findClickable([
        '16:30-17:30',
        '16:30-17:30',
        '16:30'
      ]);

      if (slot) {
        slot.click();
        setStage('join');
      } else {
        showStatus('16:30〜17:30の枠が表示されるのを待っています');
      }
      return;
    }

    if (stage === 'join') {
      if (clickText(['抽選に参加'])) {
        setStage('consent');
      } else {
        showStatus('「抽選に参加」の表示を待っています');
      }
      return;
    }

    if (stage === 'consent') {
      if (clickText(['同意して参加する'])) {
        setStage('save');
      } else {
        showStatus('同意画面が表示されたら確認します');
      }
      return;
    }

    if (stage === 'save') {
      if (clickText(['入場券を保存する'])) {
        setStage('done');
        localStorage.setItem(`${PREFIX}:enabled`, 'no');
      } else {
        showStatus('結果画面を確認中です。位置情報などの確認は手動で進めてください');
      }
    }
  }

  function start() {
    createPanel();
    updateCountdown();

    setInterval(updateCountdown, 1000);
    setInterval(runAutomation, 1000);

    if (localStorage.getItem(`${PREFIX}:enabled`) === 'yes') {
      if (getStage() === 'waiting') {
        showStatus('自動操作ON。13時の更新を待っています');
      } else {
        showStatus(`自動操作ON。${stageText(getStage())}`);
      }
    } else {
      showStatus('自動操作OFF。開始ボタンで有効にできます');
    }
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
