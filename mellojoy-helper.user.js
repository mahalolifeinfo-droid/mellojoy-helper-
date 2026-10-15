
// ==UserScript==
// @name         Mellojoy 13:00予約自動サポート
// @namespace    local.mellojoy.helper
// @version      2.0.0
// @description  13時更新、予約枠選択、抽選参加、当選後の保存を補助
// @match        https://mellojoylucky.cn/*
// @match        https://*.mellojoylucky.cn/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) return;

  const TARGET_TIME = '16:30–17:30';
  const RELEASE_DAY_OFFSET = 6; // 10/15の13時 → 10/21の例に合わせる
  const PREFIX = 'mellojoy-auto-';

  const dateKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const today = dateKey();
  const stageKey = PREFIX + 'stage-' + today;
  const refreshedKey = PREFIX + 'refreshed-' + today;

  let stage = sessionStorage.getItem(stageKey) || 'wait';
  let busy = false;

  function normalize(s) {
    return (s || '').replace(/\s+/g, '').replace(/[－−–—〜～]/g, '-');
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 &&
      cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function setStage(next) {
    stage = next;
    sessionStorage.setItem(stageKey, next);
    console.log('[Mellojoy]', next);
  }

  function labelOf(el) {
    return normalize(el.innerText || el.textContent || el.value || '');
  }

  function clickable(el) {
    return el.closest(
      'button,a,[role="button"],input[type="button"],input[type="submit"],' +
      '[onclick],[class*="btn"],[class*="button"]'
    ) || el;
  }

  function findText(label, options = {}) {
    const wanted = normalize(label);
    const elements = [...document.querySelectorAll(
      'button,a,[role="button"],input,div,span,p'
    )].filter(visible);

    // 小さな要素を優先し、同じ文言の外側コンテナを避ける
    elements.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.width * ra.height) - (rb.width * rb.height);
    });

    for (const el of elements) {
      const txt = labelOf(el);
      if (!txt.includes(wanted)) continue;
      if (options.exact && txt !== wanted) continue;
      if (options.exclude && options.exclude.some(x => txt.includes(normalize(x)))) continue;

      const target = clickable(el);
      if (!visible(target)) continue;
      if (target.disabled || target.getAttribute('aria-disabled') === 'true') continue;
      return target;
    }
    return null;
  }

  function clickText(label, options = {}) {
    const el = findText(label, options);
    if (!el) return false;
    el.click();
    console.log('[Mellojoy] click:', label);
    return true;
  }

  function targetDateLabel() {
    const d = new Date();
    d.setDate(d.getDate() + RELEASE_DAY_OFFSET);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // 13:00ちょうどに一度だけ更新
  function scheduleRefresh() {
    if (sessionStorage.getItem(refreshedKey) === '1') return;

    const now = new Date();
    const target = new Date(now);
    target.setHours(13, 0, 0, 0);

    if (now >= target) {
      sessionStorage.setItem(refreshedKey, '1');
      setStage('date');
      location.reload();
      return;
    }

    const delay = target.getTime() - now.getTime();
    setTimeout(() => {
      sessionStorage.setItem(refreshedKey, '1');
      setStage('date');
      location.reload();
    }, delay);
  }

  function runFlow() {
    if (busy) return;
    busy = true;

    try {
      if (stage === 'wait') return;

      // 開放対象の日付を選択
      if (stage === 'date') {
        const dateLabel = targetDateLabel();
        if (clickText(dateLabel)) {
          setStage('slot');
          return;
        }
      }

      // 16:30–17:30の枠を選択。満席表示なら押さない
      if (stage === 'slot') {
        const slot = findText(TARGET_TIME, {
          exclude: ['満席', '受付終了', '売り切れ', '受付終了しました']
        });

        if (slot) {
          slot.click();
          setStage('lottery');
          return;
        }

        // 時間表示に満席が付いている場合は待機
        return;
      }

      // 抽選に参加
      if (stage === 'lottery') {
        if (clickText('抽選に参加', {
          exclude: ['参加済み', '受付終了', '満席']
        })) {
          setStage('agree');
          return;
        }
      }

      // 位置情報の許可後に同意画面が出たら続行
      if (stage === 'agree') {
        if (clickText('同意して参加する')) {
          setStage('result');
          return;
        }

        // すでに当選画面へ進んでいる場合にも対応
        if (findText('入場券を保存する')) {
          setStage('save');
          return;
        }
      }

      // 当選画面で入場券を保存
      if (stage === 'result' || stage === 'save') {
        if (clickText('入場券を保存する')) {
          setStage('done');
          return;
        }
      }
    } catch (e) {
      console.error('[Mellojoy] error:', e);
    } finally {
      busy = false;
    }
  }

  // 画面の表示が遅れても、定期的に確認する
  scheduleRefresh();
  setInterval(runFlow, 500);

  // ページ内の表示変化にも反応
  const observer = new MutationObserver(() => runFlow());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log('[Mellojoy] 自動サポート開始。現在の段階:', stage);
})();
