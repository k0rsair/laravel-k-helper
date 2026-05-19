# Implementation Plan: Laravel-Aware VS Code Extension MVP

Branch: none
Created: 2026-05-18

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Summary
Build a VS Code extension inspired by Laravel Idea workflows, with a TypeScript in-process Laravel indexer and MVP completions/navigation for Laravel 10-13 projects.

## Tasks

### Phase 1: Bootstrap
- [x] Task 1: Create extension scaffold and project documentation.

### Phase 2: Core Indexing
- [x] Task 2: Implement Laravel project detection from Composer metadata and settings.
- [x] Task 3: Implement route, view, config, translation, env-key, and Blade component scanners.
- [x] Task 4: Implement cache lifecycle and debounced file watchers.

### Phase 3: Providers
- [x] Task 5: Implement context-aware completions for Laravel helper strings and Blade components.
- [x] Task 6: Implement go-to-definition for exact indexed records.
- [x] Task 7: Add reindex/status/output commands.

### Phase 4: Quality
- [x] Task 8: Add fixture Laravel project and unit tests.
- [x] Task 9: Add README/docs and run build/test verification.

### Phase 5: Validation Intelligence
- [x] Task 10: Index built-in/custom validation rules and request fields from Laravel validation arrays.
- [x] Task 11: Add validation rule completions and request field completions/definitions.

### Phase 6: Route Controller Navigation
- [x] Task 12: Index route groups with `controller` and `prefix` attributes.
- [x] Task 13: Resolve string route actions like `Route::get('{id}', 'show')` inside controller groups to the configured controller class method.
- [x] Task 14: Add go-to-definition from route action strings to controller methods and completion for indexed route action methods.
- [x] Task 15: Add fixture coverage for grouped controller routes such as `Route::group(['prefix' => 'labels', 'controller' => LabelsController::class], function () { Route::get(..., 'getLabel'); });`.
- [x] Task 16: Support imported controller classes, `Route::controller(...)->group(...)`, and nested groups that inherit a controller.

### Phase 7: Additional Route Action Forms
- [x] Task 17: Support array controller actions such as `Route::get('/labels', [LabelsController::class, 'index'])` outside controller groups.
- [x] Task 18: Support invokable controllers such as `Route::get('/labels', LabelsController::class)`.
- [x] Task 19: Make autocomplete for route action strings scope-aware: inside controller groups, suggest only methods from the active controller, including imported controllers, chained `Route::controller(...)->group(...)`, and nested inherited controller groups.
- [x] Task 20: Add reverse navigation from controller methods back to matching route declarations via references, covering grouped controller route strings, array route actions, and invokable route actions.

### Phase 8: Route UX Polish
- [x] Task 21: Add CodeLens over controller methods with matching route declarations.

### Phase 9: Route UX Follow-Up
- [x] Task 22: Add a multi-route picker for controller method CodeLens when more than one route references the same method.

### Phase 10: Filesystem Intelligence
- [x] Task 23: Index Laravel filesystem disk names from `config/filesystems.php` under the `disks` key.
- [x] Task 24: Add autocomplete for `Storage::disk('...')` using indexed disk names.
- [x] Task 25: Add fixture coverage for filesystem disk completion with local, public, s3, and custom disk names.

### Phase 11: Next Feature Slice
- [x] Task 26: Add `ide.json` v1 support for custom completion rules.

### Phase 12: ide.json Follow-Up
- [x] Task 27: Add `ide.json` condition matching for methods, constructors, array keys/values, and richer package metadata.

### Phase 13: ide.json Package Presets
- [x] Task 28: Add richer `ide.json` package metadata with Composer version constraints and package-provided presets.

## Commit Plan
- **Commit 1** (after tasks 1-4): "feat: scaffold extension and laravel indexer"
- **Commit 2** (after tasks 5-7): "feat: add laravel completions and navigation"
- **Commit 3** (after tasks 8-9): "test: add fixtures and extension verification"
