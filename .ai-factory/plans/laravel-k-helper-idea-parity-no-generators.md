# Implementation Plan: Laravel K Helper Idea Parity Without Generators

Branch: none
Created: 2026-05-21

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Summary
Close the highest-value Laravel Idea parity gaps for Laravel K Helper without expanding code/artifact generators. The roadmap prioritizes IDE intelligence: model/property typing, diagnostics, navigation, Blade support, `ide.json` compatibility, and ecosystem workflows. Existing generation-preview code remains in the product, but new generator work is intentionally deferred until the intelligence layers are mature.

## Roadmap Linkage
Milestone: "Post-MVP IDE Intelligence"

Rationale: the current MVP already covers project detection, route/view/config/translation/env completions, validation, controller navigation, filesystem disks, Eloquent fields/relations/scopes/factories, `ide.json` v1/v2 surfaces, package discovery, preview generation, and first ecosystem indexing. The next useful step is not more scaffolding; it is deeper correctness and type-aware assistance inside real Laravel code.

## Non-Goals
- Do not remove existing artifact preview/generation code.
- Do not add new controller/model/request/resource generators in this roadmap.
- Do not prioritize generator UX until all phases below are either completed or explicitly postponed.
- Do not write helper files into user projects by default; prefer in-memory indexes, virtual metadata, diagnostics, and completions.

## Tasks

### Phase 1: Eloquent Type Intelligence
- [ ] Task 1: Extend migration column metadata with nullable/default/enum/json/foreign-key details and preserve it through model-field indexes.
- [ ] Task 2: Infer model property types from migrations, `$casts`, `casts(): array`, date casts, enum casts, and relation methods.
- [ ] Task 3: Surface inferred model property metadata in completions, hovers, and definitions without writing project files.
- [ ] Task 4: Add diagnostics for suspicious `$casts` values when the cast conflicts with the migration column type.
- [ ] Task 5: Add diagnostics for unknown `$fillable`, `$guarded`, and `$casts` keys when the model table can be resolved.
- [ ] Task 6: Add fixture coverage for inherited models, custom base models, table overrides, nullable fields, enum casts, JSON casts, and missing migrations.

### Phase 2: Eloquent Query And Relation Precision
- [ ] Task 7: Improve query builder context tracking so `where`, `orderBy`, `select`, `pluck`, `value`, `withCount`, `load`, and aggregate helpers suggest only columns/relations from the active model/table.
- [ ] Task 8: Add relation return-type awareness for common relation helpers such as `hasOne`, `belongsTo`, `hasMany`, `belongsToMany`, `morphTo`, `morphMany`, and `morphedByMany`.
- [ ] Task 9: Support relation-derived pseudo-fields such as `*_count`, selected aliases, pivot fields, and nested eager-load paths.
- [ ] Task 10: Add go-to-definition and references from relation strings back to relation methods across builder chains, nested closures, and arrays.
- [ ] Task 11: Add performance tests for large model sets so relation and column completions stay responsive.

### Phase 3: Blade And Component Depth
- [ ] Task 12: Resolve Blade component class/view pairs, anonymous components, nested component names, and package component namespaces.
- [ ] Task 13: Add completions/definitions for component props, `@props`, attributes, slots, named slots, and bound `:attribute` expressions.
- [ ] Task 14: Improve Blade include/layout/section/stack navigation across `@extends`, `@section`, `@yield`, `@push`, and `@stack`.
- [ ] Task 15: Add Blade diagnostics for unresolved components, missing component props where statically knowable, and invalid include/view names.
- [ ] Task 16: Add Blade fixture projects with class components, anonymous components, package namespaces, and nested layouts.

### Phase 4: ide.json Compatibility Expansion
- [ ] Task 17: Expand supported `ide.json` contexts for methods, functions, constructors, arrays, chained calls, package gates, and dynamic Laravel indexed values.
- [ ] Task 18: Add condition matching for framework/package versions, class existence, trait usage, and project structure where the schema supports it.
- [ ] Task 19: Build compatibility fixtures from realistic package-provided `ide.json` files and document unsupported schema fields explicitly.
- [ ] Task 20: Add user-facing diagnostics/logging when an `ide.json` file is skipped or partially unsupported.

### Phase 5: Frontend HTTP Route Intelligence
- [x] Task 21: Add JavaScript/TypeScript/Vue/React document selectors for frontend Laravel integration contexts without enabling broad noisy completions everywhere.
- [x] Task 22: Parse common HTTP request calls such as `axios.get/post/put/patch/delete(...)`, `axios({ method, url })`, `fetch(url, { method })`, and configurable client aliases.
- [x] Task 23: Resolve frontend URL strings and Ziggy-style `route('name', ...)` calls to indexed Laravel routes with method-aware matching where the HTTP method is known.
- [x] Task 24: Add go-to-definition from frontend request URLs/route names to Laravel route declarations, including parameterized route paths such as `/users/{user}/orders`.
- [x] Task 25: Add CodeLens above frontend HTTP calls that shows the resolved Laravel route and opens the matching route declaration.
- [x] Task 26: Parse dynamic frontend URL expressions such as string concatenation and template literals into route-like patterns for matching.
- [ ] Task 27: Add first-pass response metadata inference from controller return statements, API resources, `response()->json(...)`, `JsonResource`, arrays, and simple DTO/resource shapes.
- [ ] Task 28: Surface inferred response properties in JS/TS hovers/completions only when confidence is high; otherwise log why response typing is unavailable instead of guessing.
- [ ] Task 29: Add fixture coverage for axios, fetch, Ziggy route helpers, literal API URLs, named routes, multiple HTTP methods on the same path, ambiguous/dynamic URLs, CodeLens, concatenation, and template literals.

### Phase 6: Ecosystem Workflow Deepening
- [ ] Task 30: Deepen Livewire indexing for component properties, actions, events, validation rules, Volt-style files, view bindings, and navigation between class/view usage.
- [ ] Task 31: Deepen Inertia indexing for pages, page props, route-to-page references, shared props, and common Vue/React/Svelte page locations.
- [ ] Task 32: Deepen Filament indexing for resources, pages, relation managers, form fields, table columns, actions, widgets, and navigation between resource classes.
- [ ] Task 33: Deepen Nova indexing for resources, fields, filters, lenses, actions, cards, and resource registration/usage sites.
- [ ] Task 34: Add Dusk selector intelligence last inside this phase: page objects, browser macros, component selectors, and navigation between tests and page classes.

### Phase 7: Workspace Diagnostics And Release Hardening
- [ ] Task 35: Add a diagnostic pipeline with severity levels, code actions where safe, and settings to enable/disable noisy checks.
- [ ] Task 36: Add cross-file diagnostics for routes/controllers, config keys, env keys, validation rules, views, Blade components, model fields, frontend HTTP requests, and ecosystem references.
- [ ] Task 37: Add cache invalidation tests for migration/model/view/package/frontend changes and verify partial reindex behavior.
- [ ] Task 38: Add a fixture matrix for Laravel 10, 11, 12, and 13-style project layouts where practical.
- [ ] Task 39: Update README, CHANGELOG, and marketplace notes after each user-facing phase.
- [ ] Task 40: Package a fresh VSIX after meaningful feature batches and verify install behavior in Cursor/VS Code.

## Deferred: Generators
- Keep the existing artifact preview command intact.
- Do not expand generator templates, generator commands, or generator UI during this roadmap.
- Revisit generators only after the type/intelligence/diagnostics phases are stable and tested.

## Verification Gates
- `source ~/.nvm/nvm.sh && nvm use 20 && npm run check`
- `source ~/.nvm/nvm.sh && nvm use 20 && npm run build`
- `source ~/.nvm/nvm.sh && nvm use 20 && npx @vscode/vsce package`
- Manual Cursor/VS Code smoke test for each new completion/definition/diagnostic surface.

## Commit Plan
- **Commit 1** (after tasks 1-6): "feat: add eloquent type intelligence"
- **Commit 2** (after tasks 7-11): "feat: improve eloquent query precision"
- **Commit 3** (after tasks 12-16): "feat: deepen blade component intelligence"
- **Commit 4** (after tasks 17-20): "feat: expand ide json compatibility"
- **Commit 5** (after tasks 21-29): "feat: add frontend http route intelligence"
- **Commit 6** (after tasks 30-34): "feat: deepen laravel ecosystem workflows"
- **Commit 7** (after tasks 35-40): "feat: add diagnostics and release hardening"
