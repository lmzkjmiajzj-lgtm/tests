// Get siteId and accountId from URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const siteId = urlParams.get("siteId");
const accountId = urlParams.get("accountId");

if (!siteId || !accountId) {
  throw new Error("Missing required query parameters: siteId and accountId");
}

const response = await fetch(
  "https://app.netlify.com/spark-proxy/api/v1/knowledge/",
  {
    method: "POST",
    credentials: "include", // Sends all eligible app.netlify.com cookies
    headers: {
      Accept: "*/*",
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify({
      scopes: {
        siteId: siteId,
        accountId: accountId,
      },
      id: "general-context-for-agent-runners",
      type: "general-context-for-agent-runners",
      data: "ewqewq",
    }),
  },
);

console.log(response.status, await response.text());
