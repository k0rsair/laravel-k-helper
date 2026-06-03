# Implementation Plan: Frontend Response Property Completions

Branch: main
Created: 2026-05-27

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Roadmap Linkage
Milestone: "none"
Rationale: `.ai-factory/ROADMAP.md` is not present. This extends the existing frontend HTTP route intelligence track already documented in `docs/roadmap.md`.

## Goal
Add frontend completions for backend response properties, so JavaScript/TypeScript/Vue/Svelte code can suggest fields returned by matched Laravel endpoints.

Primary scenarios:
- `const response = await axios.get('/api/profile'); response.data.<completion>`
- `axios.post('/api/orders', payload).then((response) => response.data.<completion>)`
- `const { data } = await axios.get('/api/products/1'); data.<completion>`
- `const response = await fetch('/api/health'); const data = await response.json(); data.<completion>`
- Existing frontend route matching should be reused for `axios`, `fetch`, and Ziggy-style `route(...)` calls.

Initial backend response sources:
- Route closures returning literal PHP arrays, for example `fn () => ['ok' => true]`.
- Controller methods returning `response()->json([...])`.
- Controller methods returning literal arrays.
- Simple nested literal arrays should expose dotted paths and top-level properties, for example `user.name` and `user`.

Deferred for a later pass:
- Fully dynamic resources, conditional response fields, Fractal/transformer packages, and arbitrary service-layer DTO construction.
- Precise TypeScript type generation.
- Runtime API calls or reading live API responses.
- Deep inference from Eloquent models beyond simple literal keys, unless a method directly returns model attributes as literal arrays.

## Commit Plan
- **Commit 1** (after tasks 1-3): `feat: index laravel response shapes`
- **Commit 2** (after tasks 4-6): `feat: complete frontend response fields`

## Tasks

### Phase 1: Backend Response Shape Index
- [x] Task 1: Add response-shape types to the index model.

  Deliverable: Extend `IndexedItem`, `LaravelIndexKind`, `LaravelIndexSnapshot`, and `IndexStats` with response-field/response-shape metadata tied to route/controller sources. Include route method, route URI/name, controller class/method, field key, nested path, and source location.

  Files: `src/indexer/types.ts`, `src/indexer/index.ts`.

  Logging requirements: log response field counts in index stats, and DEBUG lookup misses with route key, method, and requested prefix.

- [x] Task 2: Implement PHP response-shape scanning for routes and controllers.

  Deliverable: Add scanner helpers that extract keys from literal PHP array responses in route closures and controller methods, including `return [...]`, `return response()->json([...])`, and compact nested arrays. Reuse existing controller/route matching so response fields attach to `http-route` records when possible.

  Files: `src/indexer/scanners.ts`, fixtures under `test/fixtures/laravel-basic/routes/` and `test/fixtures/laravel-basic/app/Http/Controllers/`.

  Logging requirements: log scanned response files, extracted response fields, skipped dynamic responses, and route/controller attachment misses at DEBUG level without dumping response bodies.

- [x] Task 3: Add response-field lookup APIs.

  Deliverable: Add methods such as `responseFieldCompletionsForHttpRoute(...)` and/or `frontendResponseCompletions(...)` that resolve a route URL/name/method to available response fields. Preserve existing HTTP route lookup behavior and keep frontend route matching as the source of request identity.

  Files: `src/indexer/index.ts`, `src/indexer/types.ts`.

  Logging requirements: log when a frontend request resolves to a route but no response fields are indexed, and when multiple route candidates exist.

### Phase 2: Frontend Response Context
- [x] Task 4: Add frontend response-variable context extraction.

  Deliverable: Create a context helper that scans the document prefix and identifies response variables bound to matched requests:
  - `const response = await axios.get(...)`
  - `axios.get(...).then((response) => ...)`
  - `const { data } = await axios.get(...)`
  - `const data = (await axios.get(...)).data`
  - `const data = await response.json()` after a matched `fetch(...)`

  It should detect completion contexts like `response.data.<prefix>` and `data.<prefix>`.

  Files: `src/context/frontendResponseContext.ts`, `test/unit/frontendResponseContext.test.ts`.

  Logging requirements: return structured miss reasons such as `no-response-receiver`, `unmatched-request`, `unsupported-chain`, and let the provider log them at DEBUG.

- [x] Task 5: Wire response-field completions into `LaravelCompletionProvider`.

  Deliverable: For frontend languages (`javascript`, `javascriptreact`, `typescript`, `typescriptreact`, `vue`, `svelte`), check response-field context before existing string contexts. Return completion items for indexed response properties with stable ranges, useful details like `Laravel response: GET /api/health`, and sort keys that keep top-level fields above nested paths.

  Files: `src/providers/completionProvider.ts`, `src/extension.ts` if provider triggers need adjustment.

  Logging requirements: log successful response completion decisions with file, route, method, prefix, and count; log misses at DEBUG only.

### Phase 3: Tests, Docs, And Release Prep
- [x] Task 6: Add regression tests and documentation.

  Deliverable: Cover scanner output, route-to-response lookup, frontend response context extraction, and provider-level completion mapping. Update README and roadmap with supported response completion patterns and known limits.

  Files: `test/unit/scanners.test.ts`, `test/unit/frontendResponseContext.test.ts`, optional provider helper tests, `README.md`, `CHANGELOG.md`, `docs/roadmap.md`.

  Logging requirements: tests should assert indexed metadata and completion labels without depending on log ordering; docs should mention DEBUG logs for response-shape troubleshooting.

## Verification
- Run `source ~/.nvm/nvm.sh && nvm use 20`.
- Run `npm run check`.
- Package a fresh VSIX after implementation with `npx @vscode/vsce package`.
- Manual smoke in Cursor/VS Code:
  - In a frontend file, type after `response.data.` for an axios call to a fixture-backed route and confirm backend keys are suggested.
  - Try destructured `data.` after `const { data } = await axios.get(...)`.
  - Confirm existing frontend route CodeLens and Laravel string completions still work.

## Risks
- Laravel responses are often dynamic. Keep the first pass conservative and only suggest fields when there is high-confidence static evidence.
- Frontend variable tracking can get broad quickly. Limit it to local document-prefix patterns and avoid cross-file dataflow in the first implementation.
- `fetch` support needs a two-step alias from `fetch(...)` response to `.json()` data; implement only simple local variable flows first.
- Completion noise is worse than missing suggestions. If route or response shape resolution is ambiguous, return no completions and log DEBUG details.
