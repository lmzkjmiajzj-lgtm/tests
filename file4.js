async function fetchKnowledge() {
  // Get siteId and accountId from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const siteId = urlParams.get("siteId");
  const accountId = urlParams.get("accountId");
  const data = urlParams.get("data") || "";

  if (!siteId || !accountId) {
    throw new Error("Missing required query parameters: siteId and accountId");
  }

  try {
    const response = await fetch(
      "https://app.netlify.com/spark-proxy/api/v1/knowledge/",
      {
        method: "POST",
        credentials: "include",
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
          data: data,
        }),
      },
    );

    const text = await response.text();
    
    if (!response.ok) {
      console.error(`Request failed: ${response.status}`, text);
      throw new Error(`API returned ${response.status}`);
    }

    console.log("Success:", response.status, text);
    return text;
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

// Call the function
fetchKnowledge().catch(error => console.error("Failed:", error));
