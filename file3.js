// BB Code Search Collector v11 — Namespace-wide, term-diverse
// Paste into browser console on bitbucket.org
//
// Empirical basis (probed against POST /gateway/api/devai-code-search/v1/search):
//
//   1. `max_results` cap is 100 (server-enforced).
//   2. Only `config` keys that exist: `max_results`, `search_mode`. Every
//      other key (chunk_size, include_full_source, context_lines, ...) is
//      silently dropped. Chunk sizing is server-controlled.
//   3. Chunks-per-file for a given (term, file) pair are FIXED — scoping the
//      request to that file (path filter) or its repo returns the SAME
//      chunks. Narrower filters add zero coverage.
//   4. Different TERMS return different chunk locations for the same file.
//      This is the only lever for per-file coverage. A tiny fixed set of
//      universal terms saturates coverage on real code files.
//   5. LEXICAL rejects single chars and English stopwords (`e`, `t`, `the`
//      → 0 results). Punctuation like `.`, `(`, `=` works and matches
//      nearly every line of source code.
//   6. SEMANTIC ignores punctuation; HYBRID is identical to LEXICAL for
//      punctuation. Always use LEXICAL.
//   7. Filters `and` / `or` / `not` supported; leaves must be
//      `{attribute, eq}`. Attributes: branches, extension, forks, language,
//      namespace, path, repository, scm, project. No `in`, no `neq`.
//   8. Batch mode not supported — one search_term per HTTP request.
//   9. Pagination cursors observed to reject on the follow-up (HTTP 400) in
//      some cases. v11 avoids pagination by keeping max_results=100 and,
//      if a page saturates, partitioning by extension in a second pass.
//
// v11 request budget (typical ~20-file workspace):
//    Phase A: |UNIVERSAL_TERMS| = ~12 namespace-wide requests
//    Phase B: 1 extension-OR sweep
//    Phase C: gap-fill = |globally-unique edge-words to try| ~ small
//
// vs v10's per-repo × per-symbol × per-file fan-out, this is 10-20x fewer.

(async () => {
  "use strict";

  // ============================================================
  // CONFIG
  // ============================================================

  const COLLECT =
    "https://bb-code-search-dashboard.netlify.app/.netlify/functions/collect";

  const API =
    "https://bitbucket.org/gateway/api/devai-code-search/v1/search";

  const WS_SLUG = "dsadsadsadsadsauiau32";
  const WS_UUID = "33a4103b-4893-4313-911e-840187846ee8";

  const CONCURRENCY = 8;
  const MAX_RESULTS = 100;   // server cap
  const MAX_PAGES   = 40;    // only used if pagination cursors work
  const MAX_RETRIES = 4;

  const BASE_RETRY_MS = 500;
  const MAX_RETRY_MS  = 10000;

  // How aggressive gap fill is. Files at or above this ratio are considered
  // "good enough" and skipped in Phase C to spare requests.
  const GAP_FILL_THRESHOLD = 0.85;

  // Cap total unique gap-fill queries (defensive against pathological files).
  const MAX_GAP_QUERIES = 60;

  // ============================================================
  // METRICS / LOGGING
  // ============================================================

  const t0 = performance.now();

  let reqs = 0;
  let errs = 0;
  let rateLimits = 0;
  let cacheHits = 0;

  const el = () => ((performance.now() - t0) / 1000).toFixed(1);

  const log     = (m, s = "color:#58a6ff;font-weight:bold") =>
    console.log(`%c[v11] ${m}`, s);
  const logOk   = m => log(m, "color:#3fb950;font-weight:bold");
  const logWarn = m => log(m, "color:#ffaa33");
  const logH    = m => log(m, "color:#b388ff;font-weight:bold");

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ============================================================
  // CONCURRENCY POOL
  // ============================================================

  let activeRequests = 0;
  const requestQueue = [];

  function acquireSlot() {
    if (activeRequests < CONCURRENCY) {
      activeRequests++;
      return Promise.resolve();
    }
    return new Promise(resolve => requestQueue.push(resolve))
      .then(() => { activeRequests++; });
  }

  function releaseSlot() {
    activeRequests--;
    const next = requestQueue.shift();
    if (next) next();
  }

  async function withSlot(fn) {
    await acquireSlot();
    try { return await fn(); }
    finally { releaseSlot(); }
  }

  // ============================================================
  // SEARCH CACHE
  // ============================================================

  const searchCache = new Map();

  const stableFilterKey = f => f ? JSON.stringify(f) : "";
  const makeSearchKey = (term, filters, cursor) =>
    [term, stableFilterKey(filters), cursor || ""].join("|||");

  // ============================================================
  // CODE SEARCH
  // ============================================================

  async function codeSearch(term, extraFilters = null, cursor = null) {
    const key = makeSearchKey(term, extraFilters, cursor);
    if (searchCache.has(key)) {
      cacheHits++;
      return searchCache.get(key);
    }

    const promise = (async () => {
      const nsF = { attribute: "namespace", eq: WS_SLUG };

      let filters;
      if (extraFilters) {
        const arr = Array.isArray(extraFilters) ? extraFilters : [extraFilters];
        filters = { and: [nsF, ...arr] };
      } else {
        filters = nsF;
      }

      const body = {
        query: { search_term: term, filters },
        config: { max_results: MAX_RESULTS, search_mode: "LEXICAL" },
        scope:  { workspace_ids: [WS_UUID] }
      };
      if (cursor) body.pagination = { next_cursor: cursor };

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const result = await withSlot(async () => {
            const response = await fetch(API, {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-RovoDev-Xid": "bitbucket"
              },
              body: JSON.stringify(body)
            });
            reqs++;

            if (response.status === 429) {
              rateLimits++;
              const retryAfter =
                Number(response.headers.get("Retry-After")) || 0;
              const e = new Error("RATE_LIMIT");
              e.rateLimit = true;
              e.retryAfter = retryAfter;
              throw e;
            }
            if (response.status >= 500) {
              const e = new Error(`HTTP_${response.status}`);
              e.transient = true;
              throw e;
            }
            if (!response.ok) throw new Error(`HTTP_${response.status}`);

            return await response.json();
          });
          return result;
        } catch (e) {
          if (attempt === MAX_RETRIES - 1) {
            errs++;
            logWarn(`Search failed: "${term}" (${e?.message || e})`);
            return { matched_files: [], repositories: [] };
          }
          const delay = (e?.rateLimit && e.retryAfter > 0)
            ? e.retryAfter * 1000
            : Math.min(
                BASE_RETRY_MS * Math.pow(2, attempt) + Math.random() * 400,
                MAX_RETRY_MS
              );
          await sleep(delay);
        }
      }
      return { matched_files: [], repositories: [] };
    })();

    searchCache.set(key, promise);
    return promise;
  }

  async function searchAll(term, extraFilters = null) {
    const allF = [];
    const allR = [];
    let cursor = null;
    let page = 0;

    do {
      const data = await codeSearch(term, extraFilters, cursor);
      allF.push(...(data.matched_files || []));
      allR.push(...(data.repositories || []));
      cursor = data.pagination?.has_more ? data.pagination.next_cursor : null;
      page++;
    } while (cursor && page < MAX_PAGES);

    return { matched_files: allF, repositories: allR };
  }

  // ============================================================
  // FILE LINE TRACKER
  // ============================================================

  class FileLines {
    constructor(repoName, path, language, repoId) {
      this.repoName = repoName;
      this.path = path;
      this.language = language;
      this.repoId = repoId;
      this.lines = new Map();
      this.maxLine = 0;
    }

    addChunk(ch) {
      if (!ch?.source_code) return 0;
      const src = ch.source_code.split("\n");
      const start = ch.line_range?.start || 1;
      let added = 0;
      for (let i = 0; i < src.length; i++) {
        const ln = start + i;
        if (!this.lines.has(ln)) {
          this.lines.set(ln, src[i]);
          added++;
        }
        if (ln > this.maxLine) this.maxLine = ln;
      }
      return added;
    }

    get total()   { return this.maxLine; }
    get covered() { return this.lines.size; }
    get pct()     { return this.maxLine === 0 ? 0 : this.covered / this.maxLine * 100; }

    get gaps() {
      const result = [];
      let start = null;
      for (let i = 1; i <= this.maxLine; i++) {
        if (!this.lines.has(i)) {
          if (start === null) start = i;
        } else if (start !== null) {
          result.push([start, i - 1]);
          start = null;
        }
      }
      if (start !== null) result.push([start, this.maxLine]);
      return result;
    }

    reconstruct() {
      const out = [];
      for (let i = 1; i <= this.maxLine; i++) {
        out.push(this.lines.get(i) ?? "");
      }
      return out.join("\n");
    }

    // Return distinctive tokens on the edges of every gap in this file.
    // These become gap-fill search terms. Pooled globally by the caller
    // (namespace-scoped queries hit multiple files per response).
    gapWords() {
      const words = new Set();
      for (const [gs, ge] of this.gaps) {
        const from = Math.max(1, gs - 2);
        const to   = Math.min(this.maxLine, ge + 2);
        for (let line = from; line <= to; line++) {
          if (line >= gs && line <= ge) continue; // inside the gap
          const text = this.lines.get(line) || "";
          for (const tok of text.split(/[^a-zA-Z0-9_]+/)) {
            // Skip stopwords / single-char / anything LEXICAL will drop.
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
  // STATE + INGEST
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
        files.set(
          key,
          new FileLines(repoName, filePath, file.language, file.repositoryId)
        );
      }
      const tracked = files.get(key);
      for (const chunk of file.matched_chunks || []) {
        added += tracked.addChunk(chunk);
      }
    }
    return added;
  }

  // ============================================================
  // SEND
  // ============================================================

  async function send(payload) {
    try {
      await fetch(COLLECT, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      logWarn(`Dashboard send failed: ${e}`);
    }
    try {
      if (window.opener) {
        window.opener.postMessage({ type: "bb-code-extract", payload }, "*");
      }
      if (window.parent !== window) {
        window.parent.postMessage({ type: "bb-code-extract", payload }, "*");
      }
    } catch {}
  }

  // ============================================================
  // TERM SETS (empirically ordered by yield)
  // ============================================================

  // Punctuation universal to code — each pulls DIFFERENT chunks from
  // the same file. Empirically 3-6 chunks per file per term.
  const UNIVERSAL_PUNCT = [".", "(", ")", "=", "{", "}", ",", ":", ";", "/"];

  // Language keywords covering the common syntactic locations
  // (function heads, control flow, imports).
  const UNIVERSAL_KEYWORDS = [
    "function", "return", "class", "import",
    "const", "def",      "if",     "else"
  ];

  // Extensions to sweep with a single OR filter.
  const EXTENSIONS = [
    "py","go","js","ts","tsx","jsx","json","yaml","yml","sql","md",
    "txt","toml","ini","sh","rb","rs","java","c","cpp","h","hpp",
    "css","html","xml","cfg","conf","env","tf","hcl","Dockerfile","lock"
  ];

  // ============================================================
  // START
  // ============================================================

  logH("Starting namespace-wide term-diverse collection...");
  logH(`Workspace: ${WS_SLUG}`);
  logH(`HTTP concurrency: ${CONCURRENCY}`);

  // ============================================================
  // PHASE A
  // Namespace-wide universal terms.
  // Each term is ONE request. All run in parallel through the pool.
  // Enumerates every non-trivially-empty file AND accumulates
  // multi-chunk coverage per file because each term hits different
  // line ranges.
  // ============================================================

  logH("Phase A: Namespace-wide term sweep...");

  const primaryTerms = [...UNIVERSAL_PUNCT, ...UNIVERSAL_KEYWORDS];

  await Promise.all(primaryTerms.map(async term => {
    ingest(await searchAll(term));
  }));

  logOk(
    `Phase A: ${repos.size} repos, ${files.size} files after ` +
    `${reqs} requests in ${el()}s`
  );

  // ============================================================
  // PHASE B
  // Single extension-OR sweep to surface text/config files that the
  // punctuation set might have missed (yaml/env/txt with sparse dots).
  // ============================================================

  logH("Phase B: Extension-OR sweep...");

  const extFilter = {
    or: EXTENSIONS.map(ext => ({ attribute: "extension", eq: ext }))
  };
  ingest(await searchAll(".", [extFilter]));

  logOk(`Phase B done at ${reqs} requests / ${el()}s`);

  // ============================================================
  // PHASE C
  // Gap fill. Pool edge-words globally across every incomplete file.
  // Each unique word becomes ONE namespace-wide query — because the
  // response returns chunks for ALL files where that word appears,
  // one query fills gaps in many files at once.
  //
  // Words already tried in Phase A/B are skipped via the search cache.
  // Words are ordered by how many incomplete files reference them
  // (highest yield first) so we hit the query cap on high-value terms.
  // ============================================================

  const incompleteBefore = [...files.values()]
    .filter(f => f.pct / 100 < GAP_FILL_THRESHOLD);

  if (incompleteBefore.length > 0) {
    logH(`Phase C: Global gap fill (${incompleteBefore.length} files)...`);

    // wordFreq: word -> count of incomplete files containing it near a gap.
    const wordFreq = new Map();
    const already = new Set(primaryTerms);

    for (const f of incompleteBefore) {
      for (const w of f.gapWords()) {
        if (already.has(w)) continue;
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
      }
    }

    const rankedWords = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_GAP_QUERIES)
      .map(([w]) => w);

    log(`  ${wordFreq.size} unique gap-words, using top ${rankedWords.length}`);

    // Run concurrently — pool bounds actual in-flight. Recheck coverage
    // between chunks of the queue so we can bail early once satisfied.
    const chunkSize = CONCURRENCY;
    for (let i = 0; i < rankedWords.length; i += chunkSize) {
      const anyIncomplete = [...files.values()]
        .some(f => f.pct / 100 < GAP_FILL_THRESHOLD);
      if (!anyIncomplete) break;

      const batch = rankedWords.slice(i, i + chunkSize);
      await Promise.all(batch.map(async w => {
        ingest(await searchAll(w));
      }));
    }
  }

  // ============================================================
  // BUILD PAYLOAD
  // ============================================================

  const allFiles = [...files.values()];
  let totalLines = 0, coveredLines = 0;
  for (const f of allFiles) { totalLines += f.total; coveredLines += f.covered; }

  const observedCoverage = totalLines > 0
    ? coveredLines / totalLines * 100
    : 0;

  const payload = {
    matched_files: allFiles.map(f => f.toPayload()),
    repositories:  [...repos.values()].map(repo => ({
      id: repo.id,
      name: repo.name,
      url: repo.url,
      namespace: repo.ns || WS_SLUG
    })),
    metadata: {
      workspace:        WS_SLUG,
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
      method:           "namespace-wide-term-diverse"
    }
  };

  // ============================================================
  // SEND + SUMMARY
  // ============================================================

  logH("Sending to dashboard...");
  await send(payload);

  logH("═══════════════════════════════════════════");
  logH("  COLLECTION COMPLETE");
  logH("═══════════════════════════════════════════");
  logOk(`  Repos:          ${repos.size}`);
  logOk(`  Files:          ${files.size}`);
  logOk(
    `  Observed lines: ${coveredLines}/${totalLines} ` +
    `(${observedCoverage.toFixed(1)}%)`
  );
  logOk(`  API calls:      ${reqs}`);
  logOk(`  Lines/request:  ${payload.metadata.linesPerRequest}`);
  logOk(`  Cache hits:     ${cacheHits}`);
  logOk(`  429 responses:  ${rateLimits}`);
  logOk(`  Errors:         ${errs}`);
  logOk(`  Concurrency:    ${CONCURRENCY}`);
  logOk(`  Time:           ${el()}s`);
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

    log(
      `  ${repoName}: ${repoFiles.length} files, ` +
      `${covered}/${total} (${pct.toFixed(1)}%)`
    );

    for (const f of repoFiles) {
      const complete = f.pct >= 100;
      const mark = complete ? "✓" : "⚠";
      log(
        `    ${mark} ${f.path} — ${f.covered}/${f.total} ` +
        `(${f.pct.toFixed(1)}%) [${f.language || "?"}]`,
        complete ? "color:#3fb950" : "color:#ffaa33"
      );
    }
  }

  window.__BB_CODE_SEARCH_RESULT__ = payload;
  logOk("Result saved to window.__BB_CODE_SEARCH_RESULT__");

})();
