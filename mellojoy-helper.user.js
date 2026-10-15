 // ==UserScript==
 // @name         Mellojoy 13:00予約自動サポート
 // @namespace    local.mellojoy.helper
 // @version      2.1.0
 // @description  予約サポートパネルと予約操作の補助
 // @match        https://mellojoylucky.cn/*
 // @match        https://*.mellojoylucky.cn/*
 // @run-at       document-end
 // @grant        none
 // ==/UserScript==

 (function () {
   'use strict';
   if (window.top !== window.self) return;

   const TARGET_TIME = '16:30–17:30';
   const RELEASE_DAY_OFFSET = 6;
   const PREFIX = 'mellojoy-auto-';
   const today = new Date().toLocaleDateString('sv-SE');
   const stageKey = PREFIX + 'stage-' + today;
   const refreshedKey = PREFIX + 'refreshed-' + today;

   let stage = sessionStorage.getItem(stageKey) || 'wait';
   let busy = false;

   const panel = document.createElement('div');
   panel.id = 'mellojoy-helper-panel';
   Object.assign(panel.style, {
     position: 'fixed', right: '10px', bottom: '16px',
     zIndex: '2147483647',
     width: 'min(290px, calc(100vw - 20px))',
     padding: '14px', boxSizing: 'border-box',
     background: '#fff', color: '#222',
     border: '2px solid #ef8bb6', borderRadius: '14px',
     boxShadow: '0 4px 18px rgba(0,0,0,.22)',
     font: '14px/1.5 -apple-system, BlinkMacSystemFont, sans-serif'
   });

   panel.innerHTML = `
     <div style="font-weight:700;font-size:16px;color:#d94f88;margin-bottom:8px">
       🍬 Mellojoy予約サポート
     </div>
     <div id="mj-countdown" style="margin-bottom:6px">13:00まで --:--</div>
     <div id="mj-status" style="margin-bottom:10px">準備中…</div>
     <button id="mj-refresh" style="width:100%;padding:10px;border:0;border-radius:9px;background:#ef8bb6;color:#fff;font-weight:700;font-size:14px">
       ページを更新する
     </button>
     <div style="font-size:11px;color:#777;margin-top:7px">
       目標枠：16:30–17:30
     </div>
   `;
   document.body.appendChild(panel);

   const statusEl = panel.querySelector('#mj-status');
   const countdownEl = panel.querySelector('#mj-countdown');

   function setStage(next, message) {
     stage = next;
     sessionStorage.setItem(stageKey, next);
     statusEl.textContent = message || ({
       wait: '13:00の予約枠開放を待っています',
       date: '開放日の選択を確認中',
       slot: '16:30–17:30の枠を確認中',
       lottery: '抽選参加ボタンを確認中',
       agree: '参加確認画面を確認中',
       result: '抽選結果を確認中',
       save: '入場券の保存ボタンを確認中',
       done: '保存ボタンを押しました'
     }[next] || '処理中…');
   }

   function normalize(s) {
     return (s || '').replace(/\s+/g, '')
       .replace(/[－−–—〜～]/g, '-');
   }

   function visible(el) {
     if (!el || !el.isConnected) return false;
     const r = el.getBoundingClientRect();
     const cs = getComputedStyle(el);
     return r.width > 0 && r.height > 0 &&
       cs.display !== 'none' && cs.visibility !== 'hidden';
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

     elements.sort((a, b) => {
       const ra = a.getBoundingClientRect();
       const rb = b.getBoundingClientRect();
       return ra.width * ra.height - rb.width * rb.height;
     });

     for (const el of elements) {
       const txt = labelOf(el);
       if (!txt.includes(wanted)) continue;
       if (options.exclude &&
           options.exclude.some(x => txt.includes(normalize(x)))) continue;
       const target = clickable(el);
       if (!visible(target) || target.disabled ||
           target.getAttribute('aria-disabled') === 'true') continue;
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

   panel.querySelector('#mj-refresh').addEventListener('click', () => {
     setStage('date', 'ページを更新しています…');
     sessionStorage.setItem(refreshedKey, '1');
     location.reload();
   });

   function updateCountdown() {
     const now = new Date();
     const target = new Date(now);
     target.setHours(13, 0, 0, 0);

     if (now >= target) {
       countdownEl.textContent = '予約枠開放時刻を過ぎています';
       return;
     }
     const secs = Math.floor((target - now) / 1000);
     const mm = String(Math.floor(secs / 60)).padStart(2, '0');
     const ss = String(secs % 60).padStart(2, '0');
     countdownEl.textContent = `13:00まで ${mm}:${ss}`;
   }

   function scheduleRefresh() {
     if (sessionStorage.getItem(refreshedKey) === '1') return;

     const now = new Date();
     const target = new Date(now);
     target.setHours(13, 0, 0, 0);

     if (now >= target) {
       sessionStorage.setItem(refreshedKey, '1');
       setStage('date', '13:00になりました。ページを更新します…');
       location.reload();
       return;
     }

     setTimeout(() => {
       sessionStorage.setItem(refreshedKey, '1');
       setStage('date', '13:00になりました。ページを更新します…');
       location.reload();
     }, target.getTime() - now.getTime());
   }

   function runFlow() {
     if (busy) return;
     busy = true;
     try {
       if (stage === 'wait') return;

       if (stage === 'date') {
         if (clickText(targetDateLabel())) {
           setStage('slot', '開放日を選択しました。希望時間を探しています');
           return;
         }
       }

       if (stage === 'slot') {
         const slot = findText(TARGET_TIME, {
           exclude: ['満席', '受付終了', '売り切れ']
         });
         if (slot) {
           slot.click();
           setStage('lottery', '希望時間を選択しました');
           return;
         }
       }

       if (stage === 'lottery') {
         if (clickText('抽選に参加', {
           exclude: ['参加済み', '受付終了', '満席']
         })) {
           setStage('agree', '抽選参加画面へ進みました');
           return;
         }
       }

       if (stage === 'agree') {
         if (clickText('同意して参加する')) {
           setStage('result', '抽選結果を確認しています');
           return;
         }
         if (findText('入場券を保存する')) {
           setStage('save', '当選画面を検知しました');
           return;
         }
       }

       if (stage === 'result' || stage === 'save') {
         if (findText('入場券を保存する')) {
           setStage('save', '当選画面を検知しました。保存ボタンを確認してください');
         }
       }
     } catch (e) {
       console.error('[Mellojoy] error:', e);
       setStage(stage, 'エラーが発生しました。ページを確認してください');
     } finally {
       busy = false;
     }
   }

   updateCountdown();
   setInterval(updateCountdown, 1000);
   scheduleRefresh();
   setInterval(runFlow, 500);

   const observer = new MutationObserver(runFlow);
   observer.observe(document.documentElement, {
     childList: true, subtree: true, characterData: true
   });

   setStage(stage);
 })();
