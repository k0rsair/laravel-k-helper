# Laravel Aware

Laravel Aware is a VS Code extension prototype for Laravel-specific completions and navigation.

It is inspired by common Laravel IDE workflows, but it is not affiliated with Laravel Idea, JetBrains, or PhpStorm and does not copy proprietary implementation details.

## MVP Features

- Detect Laravel workspaces from Composer packages.
- Index route names, Blade views, config keys, translations, environment variable keys, and Blade components.
- Provide completions in common Laravel string contexts such as `route()`, `view()`, `config()`, `__()`, `trans()`, `@lang()`, and `env()`.
- Complete nested Laravel config keys across the full key path, for example `config('filesystems.disks.s3.key')`.
- Provide validation rule completions in validation strings and request field completions for `$request->input(...)`, `old(...)`, and `request(...)`.
- Navigate from grouped route string actions to controller methods, including array-style groups, imported controllers, `Route::controller(...)->group(...)`, and nested prefix groups that inherit a controller.
- Navigate array route actions like `[LabelsController::class, 'arrayLabel']` and invokable controllers like `LabelsController::class`.
- Use Find All References on a controller method line to jump back to matching route declarations.
- Show CodeLens route counts above controller methods that are referenced by routes; selecting the lens opens the first matching route declaration.
- Show a route picker when a controller method is referenced by multiple routes.
- Complete Laravel filesystem disks in `Storage::disk('...')` from `config/filesystems.php` `disks` keys.
- Support `ide.json` custom completion rules for functions, methods, constructors, array keys, array values, Composer package/version gates, built-in package presets, indexed Laravel values, and static strings.
- Navigate from exact string references to source files when possible.

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
- Package-gated rules are enabled only when the package exists in `composer.json`; optional `version` supports simple Composer-style major constraints such as `^11.0`, `>=10.0 <12.0`, and `^10.0 || ^11.0`.
- Built-in package presets currently add Laravel filesystem disk completions for compatible `laravel/framework` projects and Pint preset-name completions when `laravel/pint` is installed.
- Reindex automatically on relevant file changes or manually with `Laravel Aware: Reindex Workspace`.

## Privacy

The extension indexes `.env` key names only. It must never log or store environment variable values.

## Development

```bash
source ~/.nvm/nvm.sh
nvm use 20
npm install
npm run build
npm test
```
