// ==UserScript==
// @name         Mellojoy 13:00予約サポート
// @namespace    local.mellojoy.helper
// @version      4.1.0
// @description  予約操作を補助し、満席判定と許可後の再開を改善
// @match        https://mellojoylucky.cn/*
// @match        https://*.mellojoylucky.cn/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__mellojoyHelperV41) return;
  window.__mellojoyHelperV41 = true;

  const PREFIX = 'mellojoyV41';
  const TARGET_TIME = '16:30';
  const RELEASE_OFFSET_DAYS = 6;

  const target = new Date();
  target.setDate(target.getDate() + RELEASE_OFFSET_DAYS);

  const mm = target.getMonth() + 1;
  const dd = target.getDate();
  const dateSlash = `${mm}/${dd}`;
  const dateKey = `${target.getFullYear()}-${mm}-${dd}`;

  const stageKey = `${PREFIX}:stage:${dateKey}`;
  const enabledKey = `${PREFIX}:enabled`;
  const refreshKey = `${PREFIX}:refreshed:${dateKey}`;

  let busy = false;

  function stage() {
    return sessionStorage.getItem(stageKey) || 'waiting';
  }

  function setStage(value, message) {
    sessionStorage.setItem(stageKey, value);
    status(message);
  }

  function norm(value) {
    return String(value || '')
      .replace(/[ \t\r\n　]/g, '')
      .replace(/[–—−－〜～]/g, '-')
      .replace(/：/g, ':');
  }

  function status(message) {
    const el = document.getElementById('mellojoy-v41-status');
    if (el) el.textContent = message;
  }

  function visible(el) {
    if (!el || !el.isConnected || !el.getClientRects().length) {
      return false;
    }

    const style = getComputedStyle(el);

    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0';
  }

  function disabled(el) {
    if (!el) return true;

    const style = getComputedStyle(el);

    return el.disabled === true ||
      el.getAttribute('aria-disabled') === 'true' ||
      /\bdisabled\b|\binactive\b|\bsoldout\b|\bsold-out\b/i.test(
        String(el.className || '')
      ) ||
      style.pointerEvents === 'none';
  }

  function clickableAncestor(el) {
    let current = el;

    for (let i = 0; current && i < 5; i++, current = current.parentElement) {
      if (current.matches &&
          current.matches(
            'button,a,[role="button"],input[type="button"],input[type="submit"]'
          )) {
        return current;
      }
    }

    return el;
  }

  function findTextElement(phrases, exact) {
    const elements = Array.from(document.querySelectorAll(
      'button,a,[role="button"],input[type="button"],input[type="submit"],div,span,li'
    ));

    const found = elements.filter(el => {
      if (!visible(el)) return false;

      const text = norm(
        el.innerText || el.value || el.getAttribute('aria-label') || ''
      );

      if (!text) return false;

      return phrases.some(phrase =>
        exact ? text === norm(phrase) : text.includes(norm(phrase))
      );
    });

    found.sort((a, b) => {
      const aText = norm(a.innerText || a.value || '');
      const bText = norm(b.innerText || b.value || '');
      return aText.length - bText.length;
    });

    return found.length ? clickableAncestor(found[0]) : null;
  }

  function tryClick(el) {
    if (!el || !visible(el) || disabled(el)) return false;

    el.click();
    return true;
  }

  // 時間枠と、その近くに表示された満席表示をまとめて確認する
  function timeSlotInfo() {
    const elements = Array.from(document.querySelectorAll(
      'button,a,[role="button"],div,span,li'
    ));

    const matches = elements.filter(el => {
      if (!visible(el)) return false;

      const text = norm(el.innerText || el.value || '');

      return text.includes('16:30-17:30') ||
        (text.includes('16:30') && text.includes('17:30'));
    });

    matches.sort((a, b) =>
      norm(a.innerText || '').length - norm(b.innerText || '').length
    );

    if (!matches.length) return null;

    const original = matches[0];
    let current = original;
    let combinedText = norm(original.innerText || original.value || '');
    let unavailable = disabled(original);

    // 親要素に「満席」があるケースにも対応
    for (let i = 0; current && i < 5; i++, current = current.parentElement) {
      const text = norm(current.innerText || current.value || '');

      if (text && text.length <= 120) {
        combinedText = text;

        if (text.includes('満席')) {
          unavailable = true;
          break;
        }
      }

      if (current !== original && disabled(current)) {
        unavailable = true;
      }
    }

    return {
      element: clickableAncestor(original),
      text: combinedText,
      unavailable
    };
  }

  function makePanel() {
    if (document.getElementById('mellojoy-v41-panel')) return;

    const panel = document.createElement('div');

    panel.id = 'mellojoy-v41-panel';
    panel.style.cssText =
      'position:fixed;right:10px;bottom:16px;z-index:2147483647;' +
      'width:245px;padding:13px;background:#fff0f6;' +
      'border:2px solid #f4a6c7;border-radius:14px;' +
      'box-shadow:0 3px 14px #0003;font:14px/1.45 sans-serif;' +
      'color:#5c2942;';

    panel.innerHTML = `
      <div style="font-weight:bold;font-size:15px;margin-bottom:6px">
        🎀 Mellojoy 予約サポート
      </div>
      <div>対象日：<b>${mm}/${dd}</b></div>
      <div style="margin:5px 0">予約枠：16:30–17:30</div>
      <div id="mellojoy-v41-count" style="font-weight:bold;margin:6px 0"></div>
      <div id="mellojoy-v41-status" style="font-size:12px;margin:7px 0">
        準備中
      </div>
      <button id="mellojoy-v41-refresh"
        style="width:100%;padding:8px;margin:3px 0;border:0;
        border-radius:8px;background:#e879ad;color:white">
        今すぐページを更新
      </button>
      <button id="mellojoy-v41-start"
        style="width:100%;padding:8px;margin:3px 0;border:0;
        border-radius:8px;background:#d94f91;color:white">
        自動操作を開始
      </button>
      <button id="mellojoy-v41-stop"
        style="width:100%;padding:7px;margin:3px 0;border:1px solid #e3a2c0;
        border-radius:8px;background:white;color:#7b3656">
        自動操作を停止
      </button>
      <div style="font-size:11px;margin-top:6px">
        位置情報の確認が出たら手動で許可してください。
        許可後は画面を再確認します。
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('mellojoy-v41-refresh').onclick = () => {
      location.reload();
    };

    document.getElementById('mellojoy-v41-start').onclick = () => {
      localStorage.setItem(enabledKey, 'yes');

      if (stage() === 'waiting') {
        setStage('date', '対象日を探しています');
      }

      if (new Date().getHours() >= 13 &&
          sessionStorage.getItem(refreshKey) !== 'yes') {
        sessionStorage.setItem(refreshKey, 'yes');
        location.reload();
        return;
      }

      status('自動操作を開始しました');
    };

    document.getElementById('mellojoy-v41-stop').onclick = () => {
      localStorage.setItem(enabledKey, 'no');
      status('自動操作を停止しました');
    };
  }

  function countdown() {
    const now = new Date();
    const release = new Date();

    release.setHours(13, 0, 0, 0);

    const el = document.getElementById('mellojoy-v41-count');
    if (!el) return;

    if (now >= release) {
      el.textContent = '13:00を過ぎています';

      if (localStorage.getItem(enabledKey) === 'yes' &&
          stage() === 'waiting' &&
          sessionStorage.getItem(refreshKey) !== 'yes') {
        sessionStorage.setItem(refreshKey, 'yes');
        setStage('date', '13時の更新を実行します');
        location.reload();
      }
    } else {
      const ms = release - now;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);

      el.textContent = `13:00まで ${h}時間${m}分${s}秒`;
    }
  }

  function run() {
    if (busy || localStorage.getItem(enabledKey) !== 'yes') return;

    busy = true;

    try {
      const current = stage();

      if (current === 'waiting') {
        status('自動操作ON。13時の更新を待っています');
        return;
      }

      if (current === 'date') {
        const dateButton = findTextElement([dateSlash], false);

        if (dateButton && tryClick(dateButton)) {
          setStage('slot', '対象日を選択しました。時間枠を確認しています');
        } else {
          status(`${dateSlash} の日付ボタンを探しています`);
        }

        return;
      }

      if (current === 'slot') {
        const slot = timeSlotInfo();

        if (!slot) {
          status('16:30–17:30の枠が表示されるのを待っています');
          return;
        }

        if (slot.text.includes('満席') || slot.unavailable) {
          status('16:30–17:30は満席または選択不可です。画面を確認してください');
          return;
        }

        if (tryClick(slot.element)) {
          setStage(
            'join',
            '時間枠を選択しました。「抽選に参加」の表示を待っています'
          );
        } else {
          status('時間枠を選択できません。画面を確認してください');
        }

        return;
      }

      if (current === 'join') {
        const button = findTextElement(['抽選に参加'], false);

        if (button && tryClick(button)) {
          setStage(
            'consent',
            '参加ボタンを押しました。位置情報の確認が出たら手動で許可してください'
          );
        } else {
          status('「抽選に参加」の表示を待っています');
        }

        return;
      }

      if (current === 'consent') {
        const button = findTextElement(['同意して参加する'], false);

        if (button && tryClick(button)) {
          setStage('save', '同意ボタンを押しました。結果画面を確認しています');
        } else {
          status('位置情報の許可後、次の画面を確認しています');
        }

        return;
      }

      if (current === 'save') {
        const button = findTextElement(['入場券を保存する'], false);

        if (button && tryClick(button)) {
          setStage(
            'done',
            '保存ボタンを押しました。保存できたか画面を確認してください'
          );
          localStorage.setItem(enabledKey, 'no');
        } else {
          status('結果画面を確認中です。必要な確認操作は手動で進めてください');
        }

        return;
      }

      if (current === 'done') {
        status('操作は終了しました。結果を確認してください');
      }
    } finally {
      busy = false;
    }
  }

  function start() {
    makePanel();
    countdown();

    setInterval(countdown, 1000);
    setInterval(run, 1200);

    if (localStorage.getItem(enabledKey) === 'yes') {
      status('自動操作ON。画面を確認しています');
    } else {
      status('自動操作OFF。開始ボタンで有効にできます');
    }
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
