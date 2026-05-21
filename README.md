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
- Completes Eloquent model fields from migrations and cast attributes in static and chained query contexts such as `Model::where(...)`, `Model::query()->orderBy(...)`, `select`, `addSelect`, `pluck`, `value`, `groupBy`, and `having`.
- Completes model attribute names in `$fillable`, `$guarded`, and `$casts`, including models that inherit from a shared application base model, and suggests likely `$casts` values from migration column types.
- Completes and navigates Eloquent relations in `with`, `load`, `loadMissing`, `whereHas`, `doesntHave`, `withCount`, aggregate eager-load helpers, and nested relation paths such as `phoneModel.workpieces`.
- Completes and navigates local Eloquent scopes such as `Product::ready()`, `Product::query()->ready()`, and `$query->ready()`.
- Completes and navigates factory state methods in contexts such as `User::factory()->suspended()` and `User::factory()->count(3)->withPreferences()`.
- Completes table-scoped query builder columns in contexts such as `DB::table('users')->where(...)`, `select`, `orderBy`, and `pluck`.
- Completes and navigates filesystem disk names in `Storage::disk/fake/persistentFake(...)`, upload `store*` disk arguments, and `filesystems.php` `default`/`cloud` values.
- Adds explicit package-aware model intelligence hooks, including Laravel Sanctum `HasApiTokens` `tokens` relations when `laravel/sanctum` is installed.
- Supports project-level `ide.json` completion rules for functions, methods, constructors, array keys, array values, Composer package/version gates, built-in package presets, indexed Laravel values, and static strings.
- Provides preview generation for common Laravel artifacts such as controllers and form requests without overwriting existing files.
- Indexes first ecosystem module surfaces for Livewire components, Inertia pages, Filament resources, and Nova resources, with completions/definitions for `@livewire(...)`, `<livewire:...>`, `Livewire::mount(...)`, `Inertia::render(...)`, `Route::inertia(...)`, Filament resource registration calls, and Nova resource registration calls.

## Preview Limits

Laravel K Helper is intentionally lightweight today. It uses source indexing and focused PHP pattern matching rather than a full PHP language server or runtime Laravel boot.

Known limits:

- Complex dynamic expressions may not be understood.
- Relation target resolution works best when relations call Laravel relation helpers directly, for example `$this->hasMany(Post::class)`.
- Eloquent models are treated as models when they are under `app/Models/**` or when their inheritance chain resolves to Laravel's `Model` / `Authenticatable` classes through local application base classes.
- Database columns are inferred from migrations, not from a live database connection.
- Cast attributes are indexed from literal `$casts = [...]` arrays and literal `casts(): array { return [...]; }` methods. Cast value suggestions are migration-type hints, not PHP type diagnostics.
- Factory state methods are indexed from `database/factories` classes that either declare `protected $model = Model::class` or follow the `ModelFactory` naming convention.
- Route middleware aliases are indexed from literal `$middlewareAliases`/`$routeMiddleware` arrays and literal `->alias([...])` calls.
- Ecosystem coverage starts with Livewire class/view components, Inertia pages, Filament resources, and Nova resources; deeper Nova, Filament, and Dusk support is not fully covered yet.

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
cursor --install-extension /absolute/path/to/laravel-k-helper-0.10.2.vsix
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
