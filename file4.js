// Small custom error type to carry status/body
class FetchError extends Error {
  constructor(message, { status = null, body = null } = {}) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.body = body;
  }
}

// Fetch with improved error handling: throws FetchError for non-ok responses
async function fetchKnowledge({ siteId, accountId, data } = {}) {
  const urlParams = new URLSearchParams(window.location.search);
  siteId = siteId || urlParams.get("siteId") || urlParams.get("siteid");
  accountId = accountId || urlParams.get("accountId") || urlParams.get("accountid");
  data = data !== undefined ? data : urlParams.get("data") || urlParams.get("msg") || "";

  if (!siteId || !accountId) {
    throw new FetchError("Missing required query parameters: siteId and accountId");
  }

  let response;
  try {
    response = await fetch("https://app.netlify.com/spark-proxy/api/v1/knowledge/", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "*/*", "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        scopes: { siteId, accountId },
        id: "general-context-for-agent-runners",
        type: "general-context-for-agent-runners",
        data,
      }),
    });
  } catch (netErr) {
    // Network-level errors -> could be CORS or offline
    throw new FetchError("Network error while fetching knowledge", { body: String(netErr) });
  }

  const text = await response.text().catch(() => null);

  if (!response.ok) {
    // Attach body for debugging
    throw new FetchError(`API returned ${response.status}`, { status: response.status, body: text });
  }

  // Optionally parse JSON if you expect JSON: try { return JSON.parse(text) } catch {}
  return { status: response.status, text };
}

// Retry helper (exponential backoff)
async function retryWithBackoff(fn, { retries = 3, initialDelay = 500 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      // If user aborted or non-transient, rethrow immediately
      if (attempt > retries) throw err;

      const isTransient =
        err instanceof FetchError &&
        (err.status === null || err.status >= 500 || err.status === 429) // network or server errors or rate-limit
        || err instanceof TypeError; // some fetch implementations produce TypeError for network

      if (!isTransient) throw err;

      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.warn(`Transient error, retrying in ${delay}ms (attempt ${attempt} of ${retries})`, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Example UI-friendly auto-run with retry button and more helpful messages
(async function autoRunWithUI() {
  function makeOut() {
    let el = document.getElementById("fetchKnowledgeResult");
    if (!el) {
      el = document.createElement("div");
      el.id = "fetchKnowledgeResult";
      Object.assign(el.style, {
        position: "fixed", right: "12px", bottom: "12px",
        maxWidth: "45vw", maxHeight: "45vh", overflow: "auto",
        background: "rgba(0,0,0,0.85)", color: "#fff", padding: "12px",
        zIndex: 2147483647, fontSize: "13px", borderRadius: "8px"
      });
      document.body.appendChild(el);
    }
    return el;
  }
  const out = makeOut();

  async function runFetch() {
    out.innerHTML = "Running fetchKnowledge()… (check console too)";
    try {
      const result = await retryWithBackoff(() => fetchKnowledge(), { retries: 2, initialDelay: 700 });
      console.log("fetchKnowledge success:", result);
      out.innerHTML = `<strong>Success</strong><br/>Status: ${result.status}<br/><pre style="white-space:pre-wrap;color:#ddd;">${String(result.text).slice(0,2000)}</pre>`;
    } catch (err) {
      console.error("fetchKnowledge failed:", err);
      // Nicely format the error for the user and provide remediation hints
      let publicMessage = "Request failed.";
      let debugDetails = "";
      if (err instanceof FetchError) {
        if (err.status === 401) {
          publicMessage = "Not authenticated. Please sign in and try again.";
        } else if (err.status === 403) {
          publicMessage = "You don't have permission to perform this action.";
        } else if (err.status === 429) {
          publicMessage = "Rate limited. Please wait and try again.";
        } else if (err.status >= 500) {
          publicMessage = "Server error. Please try again later.";
        } else if (err.status === null) {
          publicMessage = "Network/CORS error or request blocked. Check browser console / network tab.";
        }
        debugDetails = `Status: ${String(err.status)}\nBody: ${String(err.body).slice(0,2000)}`;
      } else {
        debugDetails = String(err && err.stack ? err.stack : err);
      }

      out.innerHTML = `<strong>${publicMessage}</strong>
        <div style="margin-top:8px;color:#ddd;white-space:pre-wrap">${debugDetails}</div>`;

      // Retry button
      const btn = document.createElement("button");
      btn.textContent = "Retry";
      Object.assign(btn.style, { marginTop: "8px", padding: "6px 10px", cursor: "pointer" });
      btn.onclick = () => runFetch();
      out.appendChild(btn);

      // Telemetry: send to your logging endpoint (example)
      // navigator.sendBeacon or fetch to your backend with limited detail
      // Example (uncomment and replace URL to enable):
      /*
      fetch("/api/log-client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "fetchKnowledge_failure",
          message: debugDetails,
          page: location.href,
          userAgent: navigator.userAgent
        }),
      }).catch(() => {});
      */
    }
  }

  // Start
  runFetch();
})();
