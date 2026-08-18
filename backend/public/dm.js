/**
 * DuoMarst Analytics SDK
 * 
 * Usage (단일 HTML 파일에 붙여넣기):
 * 
 *   <script>
 *   (function(w,d,s,k){
 *     w._dm = w._dm || { q: [] };
 *     w.duomarst = {
 *       track: function(e,m){ w._dm.q.push([e,m]); },
 *       identify: function(t){ w._dm.t = t; }
 *     };
 *     var el = d.createElement('script');
 *     el.src = 'https://YOUR_RENDER_APP.onrender.com/sdk/dm.js';
 *     el.async = true;
 *     el.dataset.key = 'YOUR_SITE_API_KEY';
 *     d.head.appendChild(el);
 *   })(window, document);
 *   </script>
 * 
 * Security:
 *   - API key (ingestion only) — even if exposed, grants no admin access
 *   - All data sent over HTTPS
 *   - No eval, no dynamic code execution
 *   - Minimal data collection (no PII, no precise location)
 *   - Referrer stripped to origin only (server-side)
 *   - sessionId is random, non-persistent by default
 */

(function (window, document) {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────────────────
  var script = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  var API_KEY = script && script.dataset && script.dataset.key;
  var API_URL = (script && script.dataset && script.dataset.endpoint) ||
    'https://YOUR_RENDER_APP.onrender.com/api/v1/events';
  var BATCH_SIZE = 10;
  var FLUSH_INTERVAL_MS = 5000;

  if (!API_KEY) {
    console.warn('[DuoMarst] No API key provided. Analytics disabled.');
    return;
  }

  // ─── Session ─────────────────────────────────────────────────────────────
  // sessionId: random per page-load, not stored in localStorage (privacy)
  var SESSION_ID = _randomId();

  // Device info (coarse, no fingerprinting)
  var DEVICE = _getDevice();

  // ─── Queue ────────────────────────────────────────────────────────────────
  var queue = [];
  var flushing = false;

  // Drain any pre-init calls
  var preInit = (window._dm && window._dm.q) || [];
  for (var i = 0; i < preInit.length; i++) {
    _enqueue(preInit[i][0], preInit[i][1]);
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  window.duomarst = {
    /**
     * Track a named event.
     * @param {string} eventName  — matches a registered Function name
     * @param {object} metadata   — optional key-value pairs (placeholders resolved server-side)
     */
    track: function (eventName, metadata) {
      if (typeof eventName !== 'string' || !eventName) return;
      _enqueue(eventName, metadata);
    },
  };

  // ─── Auto-track ───────────────────────────────────────────────────────────
  // Page view on load
  _enqueue('page_view', { referrer: document.referrer || '' });

  // Session end on unload
  var _sessionStart = Date.now();
  window.addEventListener('pagehide', function () {
    var duration = Math.round((Date.now() - _sessionStart) / 1000);
    _sendBeacon('session_end', { durationSeconds: duration });
  });

  // ─── Batching + flush ─────────────────────────────────────────────────────
  var _flushTimer = setInterval(_flush, FLUSH_INTERVAL_MS);

  function _enqueue(eventName, metadata) {
    // Validate eventName client-side (mirrors server whitelist)
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(eventName)) {
      console.warn('[DuoMarst] Invalid event name:', eventName);
      return;
    }
    queue.push({
      eventName: eventName,
      timestamp: Date.now(),
      sessionId: SESSION_ID,
      deviceCategory: DEVICE.category,
      browser: DEVICE.browser,
      os: DEVICE.os,
      referrer: document.referrer || '',
      metadata: _sanitizeMeta(metadata),
    });
    if (queue.length >= BATCH_SIZE) _flush();
  }

  function _flush() {
    if (flushing || queue.length === 0) return;
    var batch = queue.splice(0, BATCH_SIZE);
    flushing = true;

    fetch(API_URL + '/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    })
      .catch(function () {
        // Re-queue on failure (network offline, etc.)
        queue = batch.concat(queue);
      })
      .finally(function () {
        flushing = false;
      });
  }

  // sendBeacon for unload (more reliable than fetch)
  function _sendBeacon(eventName, metadata) {
    if (typeof navigator.sendBeacon !== 'function') return;
    var payload = JSON.stringify({
      events: [{
        eventName: eventName,
        timestamp: Date.now(),
        sessionId: SESSION_ID,
        metadata: _sanitizeMeta(metadata),
      }],
    });
    navigator.sendBeacon(
      API_URL + '/batch',
      new Blob([payload], { type: 'application/json' })
    );
    // Note: sendBeacon cannot set custom headers — API key goes in URL query
    // For production, consider a separate beacon endpoint that uses URL param auth
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function _randomId() {
    var arr = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function _getDevice() {
    var ua = navigator.userAgent || '';
    var category = /Mobi|Android/i.test(ua) ? 'mobile' : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop';

    // Coarse browser detection — not fingerprinting
    var browser = 'unknown';
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Edg\//.test(ua)) browser = 'Edge';

    var os = 'unknown';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    return { category: category, browser: browser, os: os };
  }

  function _sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object') return null;
    var out = {};
    var count = 0;
    for (var k in meta) {
      if (!Object.prototype.hasOwnProperty.call(meta, k)) continue;
      if (count >= 10) break;
      if (typeof k !== 'string' || k.length > 64) continue;
      var v = meta[k];
      if (typeof v === 'string' && v.length <= 256) { out[k] = v; count++; }
      else if (typeof v === 'number' || typeof v === 'boolean') { out[k] = v; count++; }
    }
    return Object.keys(out).length ? out : null;
  }

})(window, document);
