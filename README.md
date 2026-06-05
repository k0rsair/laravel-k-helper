# Laravel K Helper

Laravel K Helper adds practical Laravel completions and navigation for Cursor and VS Code.

It is inspired by common Laravel IDE workflows, but it is not affiliated with Laravel Idea, JetBrains, PhpStorm, or the Laravel project, and it does not copy proprietary implementation details.

## Features

- Detects Laravel workspaces from Composer packages.
- Indexes route names, route middleware aliases, Blade views, config keys, translations, environment variable keys, Blade components, validation rules, request fields, filesystem disks, database tables and columns, Eloquent models, model fields, Eloquent relations, and local Eloquent scopes.
- Completes common Laravel string contexts: `route()`, `view()`, `config()`, `__()`, `trans()`, `@lang()`, `env()`, filesystem disk contexts, `DB::table()`, `Route::middleware()`, validation rule strings, request helpers, and Blade component tags.
- Completes nested config keys across the full dotted path, including numeric PHP array keys.
- Navigates exact string references back to indexed source files when possible.
- Navigates route actions to controller methods, including grouped string actions, legacy `Controller@method` strings, array actions, invokable controllers, controller groups, nested groups, reverse references, CodeLens route counts, and multi-route picker support.
- Completes and navigates route middleware aliases from `app/Http/Kernel.php`, route middleware declarations, and controller `$this->middleware(...)` calls.
- Completes Artisan command names in `Artisan::call(...)`, `Artisan::queue(...)`, `artisan(...)`, `$schedule->command(...)`, and console command `$this->call(...)` contexts, and navigates command strings to their command classes.
- Completes Eloquent model fields from migrations and cast attributes in static and chained query contexts such as `Model::where(...)`, `Model::query()->orderBy(...)`, `select`, `addSelect`, `pluck`, `value`, `groupBy`, and `having`.
- Completes model attribute names in `$fillable`, `$guarded`, and `$casts`, including models that inherit from a shared application base model, and suggests likely `$casts` values from migration column types.
- Completes and navigates Eloquent relations in `with`, `load`, `loadMissing`, `whereHas`, `doesntHave`, `withCount`, aggregate eager-load helpers, and nested relation paths such as `phoneModel.workpieces`.
- Completes and navigates local Eloquent scopes such as `Product::ready()`, `Product::query()->ready()`, and `$query->ready()`.
- Completes and navigates factory state methods in contexts such as `User::factory()->suspended()` and `User::factory()->count(3)->withPreferences()`.
- Navigates Laravel service-container interface calls to concrete implementations when providers bind `Interface::class` to `Concrete::class` through simple `bind`, `singleton`, `scoped`, `bindIf`, or `singletonIf` calls, with built-in presets for common Laravel core contracts such as cache, config, cookies, database, encryption, events, filesystem, logging, mail, queue, routing, session, translation, validation, and views.
- Completes table-scoped query builder columns in contexts such as `DB::table('users')->where(...)`, `select`, `orderBy`, and `pluck`.
- Completes and navigates filesystem disk names in `Storage::disk/fake/persistentFake(...)`, upload `store*` disk arguments, and `filesystems.php` `default`/`cloud` values.
- Adds explicit package-aware model intelligence hooks, including Laravel Sanctum `HasApiTokens` `tokens` relations when `laravel/sanctum` is installed.
- Supports project-level `ide.json` completion rules for functions, methods, constructors, array keys, array values, Composer package/version gates, built-in package presets, indexed Laravel values, and static strings.
- Provides preview generation for common Laravel artifacts such as controllers and form requests without overwriting existing files.
- Indexes Blade component props/slots from class and view sources, and completes or navigates `<x-...>` prop names and common slot references.
- Indexes Livewire component public properties, action methods, and simple dispatched events, with completions/definitions for `wire:model` and `wire:click` inside component views.
- Indexes Inertia page props from static `Inertia::render(...)` payloads and completes or navigates `$page.props.*` references inside page components.
- Indexes Filament resources, resource pages, form/table field names, and simple action names for conservative completions/definitions in common Filament string contexts.
- Adds Eloquent model diagnostics for unknown `$fillable` / `$guarded` / `$casts` keys and suspicious cast-type mismatches when the migration schema is known.
- Indexes first ecosystem module surfaces for Livewire components, Inertia pages, Filament resources, and Nova resources, with completions/definitions for `@livewire(...)`, `<livewire:...>`, `Livewire::mount(...)`, `Inertia::render(...)`, `Route::inertia(...)`, Filament resource registration calls, and Nova resource registration calls.
- Shows clickable CodeLens route hints above frontend `axios`, `fetch`, and Ziggy-style `route(...)` request targets in JavaScript, TypeScript, Vue, React, and Svelte files, including common string concatenation, template literal URL patterns, and simple URL variables. When a controller action can be resolved, a second CodeLens opens the controller method directly.
- Resolves frontend route targets against PHP route files under `routes/**/*.php`, including route group prefixes, `Route::resource(...)` / `Route::apiResource(...)`, and file-level prefixes from `RouteServiceProvider` or Laravel 11-style `bootstrap/app.php` routing configuration.
- Completes frontend response properties such as `response.data.<field>` and destructured `data.<field>` when a matched Laravel route returns a statically indexed literal array, `collect([...])`, `response()->json([...])`, `JsonResource`, or conservative resource-collection payload. When the backend source is known, hover and go-to-definition on frontend response fields jump back to the originating PHP response shape.

## Preview Limits

Laravel K Helper is intentionally lightweight today. It uses source indexing and focused PHP pattern matching rather than a full PHP language server or runtime Laravel boot.

Known limits:

- Complex dynamic expressions may not be understood.
- Relation target resolution works best when relations call Laravel relation helpers directly, for example `$this->hasMany(Post::class)`.
- Eloquent models are treated as models when they are under `app/Models/**` or when their inheritance chain resolves to Laravel's `Model` / `Authenticatable` classes through local application base classes.
- Database columns are inferred from migrations, not from a live database connection.
- Cast attributes are indexed from literal `$casts = [...]` arrays and literal `casts(): array { return [...]; }` methods. Cast value suggestions are migration-type hints, not PHP type diagnostics.
- Factory state methods are indexed from `database/factories` classes that either declare `protected $model = Model::class` or follow the `ModelFactory` naming convention.
- Service-container navigation supports literal provider bindings such as `$this->app->bind(Contract::class, Service::class)`, simple factories such as `fn () => new Service()` and `function () { return new Service(); }`, Laravel core container presets, and direct usages like typed `$service->method()`, `$this->service->method()`, `app(Contract::class)->method()`, and `app()->make(Contract::class)->method()`. Project bindings take priority over Laravel presets. Contextual bindings, decorators, runtime aliases, and package-specific vendor provider bindings are not fully covered yet. Verbose DEBUG logs include binding scanner decisions for troubleshooting.
- Route middleware aliases are indexed from literal `$middlewareAliases`/`$routeMiddleware` arrays and literal `->alias([...])` calls.
- Artisan commands are indexed from application command classes with literal `protected $signature = 'name ...'` or `protected $name = 'name'` declarations. Dynamic signatures and commands registered only through runtime expressions are not inferred yet.
- Ecosystem coverage starts with Livewire class/view components, Inertia pages, Filament resources, and Nova resources; deeper Nova, Filament, and Dusk support is not fully covered yet.
- Blade prop and slot support is intentionally static-first: constructor props, public properties, anonymous-component `@props`, and simple slot variables are covered; dynamic attribute bags and heavy inline PHP heuristics are not exhaustively resolved yet.
- Livewire member support focuses on public properties, public action methods, and simple dispatched event names. Nested property-path inference, listener attributes, and highly dynamic expressions still need deeper coverage.
- Inertia prop support focuses on statically readable `Inertia::render(...)` payload arrays and `$page.props.*` access patterns inside page files. Shared props assembled at runtime and non-literal prop builders are not fully inferred yet.
- Filament support now reaches resource pages, field names, and simple action names, but it remains conservative around complex fluent schema composition and package-specific abstractions.
- Frontend HTTP route navigation currently supports common `axios`/`fetch`/`route(...)` patterns, plus simple string concatenation, template literal URLs, and conventional resource routes. Highly dynamic URLs, customized resource route options, package-registered routes, and custom clients may need additional focused coverage.
- Frontend response property completions are intentionally conservative. Supported response-shape sources today are:
  - literal route/controller arrays;
  - literal `collect([...])` payloads;
  - `response()->json([...])`;
  - `JsonResource::make(...)` / `new SomeResource(...)` when the resource `toArray()` keys are statically readable;
  - `ResourceCollection` / nested `::collection(...)` shapes only when the resulting object keys are statically readable.

  Explicitly type-hinted Eloquent model values inside literal arrays still expose known model fields as nested suggestions. Hidden/visible serialization rules, dynamic resources, conditional `mergeWhen(...)` branches, transformers, arbitrary service-layer DTOs, and collection-only array element typing are not inferred yet. DEBUG logs include response-shape scan, route lookup, and resource-resolution decisions.
- Eloquent diagnostics only fire when the extension can confidently map a model to a migration-backed table. Runtime-only attributes, accessor-backed virtual fields, and intentionally custom cast keys may still require user judgment.

## Commands

- `Laravel K Helper: Reindex Workspace`
- `Laravel K Helper: Show Index Status`
- `Laravel K Helper: Open Output`
- `Laravel K Helper: Generate Artifact Preview`

## Configuration

Settings use the `laravelKHelper.*` namespace:

- `laravelKHelper.enabled`
- `laravelKHelper.projectRoot`
- `laravelKHelper.laravelDirectory`
- `laravelKHelper.logLevel`
- `laravelKHelper.autoTriggerSuggest`
- `laravelKHelper.index.exclude`
- `laravelKHelper.ideJson.enabled`
- `laravelKHelper.modules.mode`

Legacy `laravelAssist.*` and `laravelAware.*` settings are still read as fallbacks for existing local installs, but new configuration should use `laravelKHelper.*`.

## ide.json

```json
{
  "completions": [
    { "function": "custom_route_target", "parameter": 0, "kind": "routeName" },
    { "function": "custom_disk", "parameter": 1, "kind": "filesystemDisk" },
    { "function": "custom_mode", "parameter": 0, "kind": "staticStrings", "values": ["draft", "published"] },
    { "method": "CustomFacade::target", "parameter": 0, "kind": "configKey" },
    { "constructor": "App\\Support\\CustomTarget", "parameter": 0, "kind": "translationKey" },
    { "arrayKey": "*", "kind": "staticStrings", "values": ["driver", "queue"] },
    { "arrayValue": "driver", "kind": "filesystemDisk", "package": "laravel/framework", "version": "^10.0 || ^11.0 || ^12.0" }
  ]
}
```

Package-gated rules are enabled only when the package exists in `composer.json`. Optional `version` supports simple Composer-style major constraints such as `^11.0`, `>=10.0 <12.0`, and `^10.0 || ^11.0`.

Built-in package presets currently add Laravel filesystem disk completions for compatible `laravel/framework` projects and Pint preset-name completions when `laravel/pint` is installed. Installed Composer packages may also provide `ide.json`, `laravel-k-helper.json`, `.laravel-k-helper/ide.json`, `laravel-assist.json`, or `.laravel-assist/ide.json` at their package root.

## Installation

For a local VSIX build:

```bash
cursor --install-extension /absolute/path/to/laravel-k-helper-0.10.8.vsix
```

Reload Cursor or VS Code after reinstalling. If older local builds are installed under previous names, remove `k0rsair.laravel-k-helper`, `local-dev.laravel-assist`, `local-dev.laravel-aware-vscode`, or `local-dev.laravolve` to avoid duplicate providers.

## Privacy

Laravel K Helper indexes `.env` key names only. It must never log or store environment variable values.

## Development

```bash
source ~/.nvm/nvm.sh
nvm use 20
npm install
npm run check
npx @vscode/vsce package
```
