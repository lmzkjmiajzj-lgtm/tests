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
        siteId: "9ad56146-bc04-4e9d-9680-8474db7a9b99",
        accountId: "69f0aaf88e7d06aad872c909",
      },
      id: "general-context-for-agent-runners",
      type: "general-context-for-agent-runners",
      data: "ewqewq",
    }),
  },
);

console.log(response.status, await response.text());
