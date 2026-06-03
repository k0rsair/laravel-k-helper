# Implementation Plan: Laravel Service Provider Binding Navigation

Branch: main
Created: 2026-05-23

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Roadmap Linkage
Milestone: "none"
Rationale: `.ai-factory/ROADMAP.md` is not present; this plan targets the existing navigation/intelligence track already documented in `docs/roadmap.md`.

## Goal
When Laravel code depends on an interface that is bound to a concrete implementation in a service provider, go-to-definition should prefer the concrete implementation method instead of stopping at the interface method where the editor/language server normally lands.

Primary scenarios:
- `$this->publisher->publish()` where `$publisher` is a constructor-promoted `PublisherInterface` dependency and `PublisherInterface::class` is bound to `DatabasePublisher::class`.
- `$publisher->publish()` where `$publisher` is a method or constructor parameter typed as the bound interface.
- `app(PublisherInterface::class)->publish()` / `app()->make(PublisherInterface::class)->publish()`.
- `PublisherInterface::class` should optionally navigate to the concrete class binding source or implementation class when the cursor is on the interface class reference.

Initial supported binding forms:
- `$this->app->bind(Abstract::class, Concrete::class)`
- `$this->app->singleton(Abstract::class, Concrete::class)`
- `$this->app->scoped(Abstract::class, Concrete::class)`
- `$this->app->bindIf(Abstract::class, Concrete::class)`
- `$this->app->singletonIf(Abstract::class, Concrete::class)`
- `app()->bind(...)`, `app()->singleton(...)`, `App::bind(...)`, and `App::singleton(...)` with the same `::class` arguments

Deferred for a later pass:
- closure factories where the concrete class is only discoverable from `return new Concrete(...)`
- contextual bindings with `when(...)->needs(...)->give(...)`
- runtime aliases, decorators, and bindings loaded from package providers under `vendor`

## Commit Plan
- **Commit 1** (after tasks 1-3): `feat: index laravel container bindings`
- **Commit 2** (after tasks 4-6): `feat: navigate bound interfaces to implementations`

## Tasks

### Phase 1: Index Container Bindings
- [x] Task 1: Add typed index support for service-container bindings and implementation methods.

  Deliverable: Extend the index data model so Laravel K Helper can store an abstract/interface FQCN, concrete implementation FQCN, binding kind, source location of the binding, and source locations of concrete public methods.

  Files: `src/indexer/types.ts`, `src/indexer/index.ts`.

  Logging requirements: log binding and method counts in `LaravelIndex.reindex` stats at DEBUG/INFO level, and log lookup misses with abstract class, concrete class, and requested method name.

- [x] Task 2: Implement a service-provider binding scanner.

  Deliverable: Add a scanner that walks `app/Providers/**/*.php` plus provider files listed in `config/app.php`, resolves namespace/import aliases, and extracts simple `Abstract::class -> Concrete::class` bindings from `bind`, `singleton`, `scoped`, `bindIf`, and `singletonIf` calls.

  Files: `src/indexer/scanners.ts`, `src/indexer/index.ts`, `test/fixtures/laravel-basic/app/Providers/AppServiceProvider.php`.

  Logging requirements: log scanned provider file count, extracted binding count, skipped unsupported binding count, and DEBUG details for skipped closure/string/contextual bindings without dumping full file contents.

- [x] Task 3: Index concrete implementation public methods for bound classes.

  Deliverable: Reuse/extend PHP class parsing to find public methods on concrete classes targeted by bindings, including classes outside `app/Http/Controllers`, while ignoring magic methods except `__invoke` where useful.

  Files: `src/indexer/scanners.ts`, `src/indexer/types.ts`, `src/indexer/index.ts`, fixture classes under `test/fixtures/laravel-basic/app/Contracts/` and `test/fixtures/laravel-basic/app/Services/`.

  Logging requirements: log when a binding has no indexed concrete class, when a concrete method is missing, and when multiple candidate concrete methods are found; keep messages under `[LaravelIndex.*]` prefixes.

### Phase 2: Resolve Definition Targets
- [x] Task 4: Add PHP definition-context extraction for bound-interface usages.

  Deliverable: Create a small context helper that can identify the method/class reference under the cursor and infer the receiver interface from common local code shapes: method parameters, constructor parameters, promoted properties, `$this->property` assignments, and `app(...)->method()` / `make(...)->method()` calls.

  Files: `src/context/phpDefinitionContext.ts`, `test/unit/phpDefinitionContext.test.ts`.

  Logging requirements: the helper should return structured reasons for unresolved contexts so `LaravelDefinitionProvider` can log concise DEBUG messages such as `no typed receiver`, `no binding`, or `unsupported expression`.

- [x] Task 5: Wire bound implementation lookup into `LaravelDefinitionProvider`.

  Deliverable: Before falling back to the existing quoted-string definition logic, detect bound-interface method/class references and return a `vscode.Location` for the concrete implementation method or class. Preserve all existing route/view/config/Eloquent definition behavior.

  Files: `src/providers/definitionProvider.ts`, `src/indexer/index.ts`.

  Logging requirements: log successful override decisions with abstract class, concrete class, method, and file; log misses at DEBUG only; avoid WARN unless the index is internally inconsistent.

### Phase 3: Tests And Documentation
- [x] Task 6: Add unit coverage and docs for service-provider binding navigation.

  Deliverable: Cover scanner output, context inference, and definition-provider behavior with Laravel fixture code. Update docs to list supported binding forms and known unsupported cases.

  Files: `test/unit/scanners.test.ts`, `test/unit/phpDefinitionContext.test.ts`, `README.md`, `CHANGELOG.md`, optionally `docs/roadmap.md`.

  Logging requirements: tests should assert useful index metadata without depending on exact log ordering; documentation should mention that verbose DEBUG logs expose binding scanner decisions for troubleshooting.

## Verification
- Run `source ~/.nvm/nvm.sh && nvm use 20`.
- Run `npm run check`.
- Run the focused Vitest suite for scanner/context changes if a targeted script exists; otherwise run the full test script from `package.json`.
- Manually smoke in Cursor/VS Code on a Laravel fixture:
  - `PublisherInterface $publisher; $publisher->publish()` navigates to `DatabasePublisher::publish`.
  - promoted constructor property `$this->publisher->publish()` navigates to the concrete method.
  - existing relation, route, config, and frontend route definition behavior still works.

## Risks
- PHP expression inference can get broad quickly. Keep the first pass conservative and deterministic.
- Multiple bindings for the same interface should be logged and resolved by provider scan order at first, with a later setting if users need explicit priority.
- Returning a custom definition may compete with the PHP language server. The provider should only return a location when the plugin has high-confidence binding and method evidence.
