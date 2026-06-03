# Implementation Plan: Laravel Autocomplete And Navigation Next Phases

Branch: main
Created: 2026-06-03

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Roadmap Linkage
Milestone: "Later Phases"
Rationale: `docs/roadmap.md` shows the MVP is largely complete, so the best next slice is deeper semantic intelligence for Laravel-heavy workflows rather than more broad surface-area indexing.

## Current State

Implemented and already shipping in `0.10.6`:

- Laravel project detection, debounced indexing, output logging, and reindex/status commands.
- String completions and definitions for routes, views, config, translations, env keys, validation rules, request fields, Blade components, middleware aliases, filesystem disks, and Artisan commands.
- Route-action navigation across grouped controllers, legacy `Controller@method`, array actions, invokable controllers, reverse references, and controller CodeLens.
- Eloquent indexing for migrations, model fields, casts, relations, scopes, factory states, and `DB::table(...)` column contexts.
- Frontend HTTP route resolution for `axios`, `fetch`, Ziggy `route(...)`, CodeLens route hints, controller CodeLens, template literals, concatenation, and simple URL aliases.
- Conservative frontend response property completions for statically known literal arrays / `response()->json(...)` / `collect([...])` payloads.
- Service-container binding navigation for simple provider bindings and Laravel core presets.
- First ecosystem surfaces for Livewire, Inertia, Filament, and Nova, plus `ide.json` project/package completions and artifact preview generation.

Main capability gaps that still stand out:

- Frontend response intelligence stops at literal arrays and does not yet understand `JsonResource`, `ResourceCollection`, or richer backend response shapes.
- Blade support is strong on names, but still shallow on component props, slots, `@props`, and cross-navigation between class/view usage.
- Livewire, Inertia, and Filament are indexed only at first-pass entry points; deeper autocomplete/navigation inside their normal authoring flows is still missing.
- Eloquent metadata is useful, but not yet diagnostic or type-rich enough for nullable/default/enum/json edge cases and suspicious model metadata.
- Container navigation does not yet cover contextual bindings and more advanced provider patterns.

## Candidate Feature Buckets

Highest-value feature buckets for the next rounds:

1. Frontend response intelligence v2: `JsonResource`, API resources, resource collections, hover/definition from frontend response fields back to backend source.
2. Blade semantic intelligence: component props, `@props`, slot names, bound attributes, and class/view navigation.
3. Livewire deep workflows: component public props, events, actions, and template-to-class navigation.
4. Inertia deep workflows: page props, shared props, and route/controller render targets with prop-aware completions.
5. Filament deep workflows: resources, pages, relation managers, form/table surfaces, and action references.
6. Eloquent metadata diagnostics: richer inferred field types and warnings for bad `$casts` / `$fillable` / `$guarded` metadata.

## Plan Strategy

Prioritize the next work in this order:

1. Extend the existing frontend route/response pipeline, because it already has the best foundation and unlocks obvious day-to-day wins.
2. Deepen Blade + Livewire authoring, because Laravel developers spend a lot of time there and current support is still mostly name-level.
3. Add one more strong SPA/admin slice with Inertia + Filament before widening further into Nova/Dusk.
4. Finish the batch with Eloquent diagnostics and release hardening so the extension becomes smarter without becoming noisy.

## Commit Plan
- **Commit 1** (after tasks 1-3): `feat: extend frontend response intelligence`
- **Commit 2** (after tasks 4-6): `feat: deepen blade and livewire intelligence`
- **Commit 3** (after tasks 7-8): `feat: expand inertia and filament workflows`
- **Commit 4** (after tasks 9-10): `feat: add eloquent diagnostics and release hardening`

## Tasks

### Phase 1: Frontend Response Intelligence V2
- [ ] Task 1: Extend backend response indexing to understand Laravel API resources and conservative typed payloads.

  Deliverable: index response fields from `JsonResource::make(...)`, `ResourceCollection`, `AnonymousResourceCollection`, `new UserResource($user)`, `UserResource::collection(...)`, and `toArray()` methods when the resulting keys are statically recoverable. Preserve the current "no guess over bad guess" rule.

  Files: `src/indexer/scanners.ts`, `src/indexer/index.ts`, `src/indexer/types.ts`, Laravel fixtures under `test/fixtures/laravel-basic/app/Http/Resources/`.

  Logging requirements: log resource scan coverage, extracted field counts, and DEBUG-only skip reasons such as `dynamic-resource`, `conditional-merge`, and `unsupported-collection-shape`.

- [ ] Task 2: Add richer frontend response UX on top of the expanded index.

  Deliverable: keep completions conservative, add response-field hover details where the backend source is known, and add go-to-definition from `response.data.foo` / `data.user.name` to the originating controller/resource field when confidence is high.

  Files: `src/context/frontendResponseContext.ts`, `src/providers/completionProvider.ts`, `src/providers/definitionProvider.ts`, optionally a small `src/providers/hoverProvider.ts`, `src/extension.ts`.

  Logging requirements: log successful frontend response resolution with route, backend source kind, and field path; log DEBUG miss reasons such as `ambiguous-route`, `missing-field-source`, and `unsupported-response-chain`.

- [ ] Task 3: Add fixtures, regression tests, and docs for response intelligence v2.

  Deliverable: cover literal arrays, `response()->json(...)`, `collect([...])`, `JsonResource`, resource collections, ambiguous routes, and negative cases that must return no completions. Update README, CHANGELOG, and `docs/roadmap.md` with the supported response-shape matrix.

  Files: `test/unit/scanners.test.ts`, `test/unit/frontendResponseContext.test.ts`, provider tests as needed, `README.md`, `CHANGELOG.md`, `docs/roadmap.md`.

  Logging requirements: tests should assert behavior without depending on log order; docs should name the DEBUG troubleshooting categories added in Tasks 1-2.

### Phase 2: Blade And Livewire Semantic Intelligence
- [ ] Task 4: Index Blade component prop and slot metadata from class and view sources.

  Deliverable: detect component constructor/public props, `@props([...])`, named slots, anonymous component props, and class/view pairings so the index can answer prop-aware Blade queries instead of only component-name lookups.

  Files: `src/indexer/scanners.ts`, `src/indexer/types.ts`, `src/indexer/index.ts`, Blade fixtures under `test/fixtures/laravel-basic/resources/views/components/`, component fixtures under `test/fixtures/laravel-basic/app/View/Components/`.

  Logging requirements: log indexed component metadata counts and DEBUG skip reasons for dynamic `@props`, spread attributes, or unresolved anonymous component roots.

- [ ] Task 5: Surface Blade prop/slot completions and navigation.

  Deliverable: add completions and definitions for `<x-... />` props, `:bound` attributes when the prop name is static, `@props`, named slots, and component references that should jump between Blade usage, component class, and backing view.

  Files: `src/context/completionContext.ts`, `src/providers/completionProvider.ts`, `src/providers/definitionProvider.ts`, `src/providers/documentLinkProvider.ts`.

  Logging requirements: log component metadata hits with component name, prop/slot kind, and source target; log DEBUG-only reasons for unsupported inline PHP expressions.

- [ ] Task 6: Deepen Livewire workflows beyond component names.

  Deliverable: index Livewire public properties, action methods, and simple event names; add completions/definitions between `@livewire(...)`, `<livewire:...>`, `wire:model`, `wire:click`, and component class members where the mapping is static and trustworthy.

  Files: `src/indexer/scanners.ts`, `src/context/completionContext.ts`, `src/providers/completionProvider.ts`, `src/providers/definitionProvider.ts`, Livewire fixtures under `test/fixtures/laravel-basic/app/Livewire/` and `resources/views/livewire/`.

  Logging requirements: log per-component member counts and DEBUG miss reasons such as `dynamic-wire-expression`, `trait-only-member`, and `non-public-livewire-member`.

### Phase 3: Inertia And Filament Deep Workflows
- [ ] Task 7: Add prop-aware Inertia navigation and completion.

  Deliverable: index `Inertia::render(...)` payload keys, shared props where they are statically visible, and page component names from common Laravel + Vue/React layouts. Surface completions and definitions for page names and known prop keys in the most reliable contexts first.

  Files: `src/indexer/scanners.ts`, `src/context/completionContext.ts`, `src/providers/completionProvider.ts`, `src/providers/definitionProvider.ts`, `test/fixtures/laravel-basic/resources/js/Pages/`.

  Logging requirements: log matched render targets, prop-key counts, and DEBUG skip reasons such as `spread-props`, `dynamic-page-name`, and `unknown-shared-props`.

- [ ] Task 8: Deepen Filament resource intelligence.

  Deliverable: move beyond resource registration to index resource pages, relation managers, form fields, table columns, and simple action names, then expose conservative completions/definitions for common Filament references in providers and resource classes.

  Files: `src/indexer/scanners.ts`, `src/indexer/index.ts`, `src/providers/completionProvider.ts`, `src/providers/definitionProvider.ts`, Filament fixtures under `test/fixtures/laravel-basic/app/Filament/`.

  Logging requirements: log indexed resource sub-surface counts and DEBUG skip reasons for fluent/dynamic schemas that cannot be statically mapped.

### Phase 4: Eloquent Diagnostics And Release Hardening
- [ ] Task 9: Add richer Eloquent metadata diagnostics.

  Deliverable: extend migration/cast metadata with nullable/default/enum/json signals, then add diagnostics for suspicious `$casts`, unknown `$fillable` / `$guarded` / `$casts` keys, and obvious mismatches between known columns and model metadata when the table resolution is confident.

  Files: `src/indexer/scanners.ts`, `src/indexer/types.ts`, `src/indexer/index.ts`, provider/diagnostic wiring in `src/extension.ts` or new diagnostic helpers, model and migration fixtures under `test/fixtures/laravel-basic/app/Models/` and `database/migrations/`.

  Logging requirements: log diagnostic counts by type at INFO and individual mismatch reasons at DEBUG; avoid WARN unless the index itself becomes inconsistent.

- [ ] Task 10: Run verification, update release docs, and package a fresh VSIX.

  Deliverable: run Node 20 verification, keep README/CHANGELOG/roadmap aligned with shipped behavior, and build a fresh VSIX after the feature batch lands.

  Files: `README.md`, `CHANGELOG.md`, `docs/roadmap.md`, packaged artifact in the repo root.

  Logging requirements: capture verification command outcomes in the normal release notes flow and keep runtime logs focused on feature behavior rather than packaging noise.

## Verification Gates
- `source ~/.nvm/nvm.sh && nvm use 20 && npm run check`
- `source ~/.nvm/nvm.sh && nvm use 20 && npm run build`
- `source ~/.nvm/nvm.sh && nvm use 20 && npx @vscode/vsce package`
- Manual smoke in Cursor/VS Code for:
  - frontend `response.data.*` completions/definitions on `JsonResource`-backed routes;
  - Blade component props and slot navigation;
  - Livewire `wire:model` / `wire:click` member resolution;
  - Inertia page and prop recognition;
  - Filament resource sub-surface navigation;
  - Eloquent diagnostics remaining quiet on unsupported/dynamic cases.

## Risks
- Response/resource inference can become noisy quickly; every new source must stay behind a strict confidence gate.
- Blade and Livewire syntax have many dynamic escape hatches; support should begin with literal and near-literal patterns only.
- Filament and Inertia are fluent-heavy APIs; indexing should favor high-signal surfaces over broad partial parsing.
- Diagnostics are valuable only if they are quiet by default; ambiguous model/table resolution should emit DEBUG logs, not user-facing warnings.
