# Implementation Plan: Laravel Assist Later Phases

Branch: none
Created: 2026-05-20

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Summary
Execute the roadmap Later Phases as five reviewable feature packages on top of the completed MVP. Keep each package independently testable, with fixture coverage and README/roadmap updates when user-facing behavior changes.

## Roadmap Linkage
Milestone: "Later Phases"
Rationale: `docs/roadmap.md` lists the remaining post-MVP capabilities. The two package-related bullets are grouped into one package-intelligence phase so the work lands as five practical implementation packages.

## Tasks

### Phase 1: Route Middleware And Controller Action Intelligence
- [x] Task 1: Index middleware names from `app/Http/Kernel.php`, route middleware declarations, and controller middleware calls.
- [x] Task 2: Add completions/definitions for route middleware strings in `Route::middleware(...)`, route groups, and chained middleware calls.
- [x] Task 3: Expand controller/action intelligence for controller class strings and action references where Laravel routes accept controller/action targets.
- [x] Task 4: Add Laravel fixtures, scanner/provider tests, and docs for route middleware and controller/action intelligence.

### Phase 2: Additional Filesystem Contexts
- [x] Task 5: Detect semantically disk-name contexts beyond `Storage::disk(...)`, including filesystem config defaults and validation/file-storage helper call sites.
- [x] Task 6: Add completions/definitions for the new filesystem disk contexts with replacement ranges.
- [x] Task 7: Add fixture coverage and README notes for the supported filesystem contexts.

### Phase 3: Package Intelligence
- [x] Task 8: Discover package-provided `ide.json` preset files from installed Composer packages without requiring a root-level `ide.json`.
- [x] Task 9: Add package-specific model intelligence hooks for common Laravel packages while keeping package gates explicit and testable.
- [x] Task 10: Add fixtures/tests for Composer package discovery, version gates, and package model intelligence.

### Phase 4: Template-Based Artifact Generation
- [x] Task 11: Add commands and templates for common Laravel artifacts, starting with low-risk generated file previews.
- [x] Task 12: Add validation, overwrite protection, and logging for artifact generation.
- [x] Task 13: Add tests/docs for generation workflows and command behavior.

### Phase 5: Ecosystem Module Indexing
- [x] Task 14: Add module/package-aware indexing foundations for Livewire, Inertia, Nova, Filament, and Dusk.
- [x] Task 15: Add first supported ecosystem completions/definitions behind explicit scanner boundaries.
- [x] Task 16: Add fixture coverage, docs, and roadmap updates for supported ecosystem modules.

## Verification Gates
- `npm run build`
- `npm test`
- `npm run check`

## Commit Plan
- **Commit 1** (after tasks 1-4): "feat: add route middleware intelligence"
- **Commit 2** (after tasks 5-7): "feat: expand filesystem disk contexts"
- **Commit 3** (after tasks 8-10): "feat: discover package intelligence"
- **Commit 4** (after tasks 11-13): "feat: add laravel artifact generation"
- **Commit 5** (after tasks 14-16): "feat: add ecosystem module indexing"
