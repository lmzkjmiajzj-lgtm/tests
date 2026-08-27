var d = parent.document;

var a = d.createElement("a");
a.href = "https://api.netlify.com/auth" +
  "?provider=github" +
  "&site_id=app.netlify.com" +
  "&tracking_session_id=afc7d48b-e925-432a-a170-9121236eda09" +
  "&login=true" +
  "&entry_point=direct" +
  "&browser_fingerprint=cbdb5739abc754bdcc16cbd4fb07cd0f" +
  "&device_fingerprint=bbbac72e6221cf088819fff54ca43b40" +
  "&redirect=" + encodeURIComponent("https://www.netlify.com/") +
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

a.addEventListener("click", function () {
  // Safe JavaScript executed synchronously during the click.
  alert()
});

d.body.appendChild(a);
