// file9.js — safely handle an access token from a URL hash without calling untrusted brokers,
// writing cross-site cookies for other domains, or forcing redirects to opener windows.

// Only read tokens from the current page's URL hash and set a same-site cookie on the
// current origin if running in a secure context.

const AUTH_COOKIE_NAME = "accessToken";

function getAccessTokenFromHash(hash = (typeof window !== "undefined" ? window.location.hash : "")) {
  if (!hash) return null;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return params.get("access_token");
}

function setAuthCookie(token, { path = "/", sameSite = "Lax" } = {}) {
  if (!token || typeof document === "undefined") return false;

  // Only set Secure flag when on HTTPS.
  const isSecure = (typeof window !== "undefined") && window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";

  // Do not set cookies for other domains. Keep cookie scoped to the current origin.
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=${path}; SameSite=${sameSite}${secureFlag}`;
  return true;
}

export function initializeAuthFromHash() {
  const token = getAccessTokenFromHash();
  if (!token) return null;
  setAuthCookie(token, { path: "/" });
  return token;
}

// If this file is included in a browser page, initialize on load.
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    try {
      const token = initializeAuthFromHash();
      if (token) console.log("Auth token found and stored (same-origin cookie).");
    } catch (e) {
      // Do not reveal sensitive info to console in production.
      console.error("Failed to initialize auth from hash.");
    }
  });
}
