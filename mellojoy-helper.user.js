
 // ==UserScript==
// @name         Mellojoy 13:00予約サポート
// @namespace    local.mellojoy.helper
// @version      1.0.0
// @description  13時の予約開始を知らせ、手動更新をすばやく行う補助パネル
// @match        https://mellojoylucky.cn/*
// @match        https://*.mellojoylucky.cn/*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  if (window.top !== window.self) return;
  if (document.getElementById('mellojoy-helper-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'mellojoy-helper-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'メロジョイ予約サポート');
  Object.assign(panel.style, {
    position: 'fixed', right: '10px', bottom: '16px',
    zIndex: '2147483647',
    width: 'min(280px, calc(100vw - 20px))', padding: '12px',
    background: '#fff', color: '#222', border: '2px solid #ef8bb6',
    borderRadius: '14px', boxShadow: '0 4px 18px rgba(0,0,0,.22)',
    font: '14px/1.45 -apple-system, BlinkMacSystemFont, sans-serif'
  });

  const heading = document.createElement('div');
  heading.textContent = '🎟️ メロジョイ予約サポート';
  heading.style.fontWeight = '700';
  heading.style.marginBottom = '6px';

  const status = document.createElement('div');
  status.style.marginBottom = '9px';
  status.setAttribute('aria-live', 'polite');

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'ページを更新する';
  Object.assign(reload.style, {
    width: '100%', padding: '10px', border: '0', borderRadius: '9px',
    background: '#ef8bb6', color: '#fff',
    fontWeight: '700', fontSize: '15px'
  });
  reload.addEventListener('click', () => window.location.reload());

  const note = document.createElement('div');
  note.textContent =
    '抽選参加・同意・位置情報・入場券保存は、画面を確認して手動で操作してください。';
  Object.assign(note.style, {
    fontSize: '12px', color: '#555', marginTop: '8px'
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '閉じる';
  Object.assign(close.style, {
    marginTop: '8px', border: '0', background: 'transparent',
    color: '#555', textDecoration: 'underline', padding: '4px'
  });
  close.addEventListener('click', () => panel.remove());

  panel.append(heading, status, reload, note, close);
  document.body.appendChild(panel);

  let notifiedDate = '';
  function update() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(13, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);

    const diff = Math.max(0, target.getTime() - now.getTime());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    status.textContent =
      `次の13:00まで ${h}時間 ${m}分 ${s}秒`;

    const todayKey =
      `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;

    if (now.getHours() === 13 && now.getMinutes() === 0 &&
        notifiedDate !== todayKey) {
      notifiedDate = todayKey;
      status.textContent =
        '⏰ 13:00です！「ページを更新する」を押してください。';
      if (navigator.vibrate) {
        try { navigator.vibrate([180, 80, 180]); } catch (_) {}
      }
    }
  }

  update();
  window.setInterval(update, 250);
})();
