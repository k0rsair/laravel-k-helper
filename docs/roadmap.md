# Laravel Aware Roadmap

## MVP

- Project detection.
- Core string completions and definitions.
- Debounced file indexing.
- Output-channel diagnostics.
- Validation rules and request field completions.
- Fast navigation from grouped route string actions to controller methods, including array-style groups, imported controllers, `Route::controller(...)->group(...)`, and nested groups that inherit a controller.
- Array controller actions such as `[SomeController::class, 'method']` outside controller groups.
- Invokable controllers such as `Route::get('/labels', SomeController::class)`.
- Scope-aware autocomplete for controller-group route action strings.
- Reverse references from controller methods to matching route declarations.
- CodeLens over controller methods that have route declarations.
- Multi-route picker for controller method CodeLens when more than one route references the method.
- Filesystem disk completions for `Storage::disk('name')` from `config/filesystems.php` `disks` keys.
- `ide.json` completion rules for functions, methods, constructors, array keys/values, Composer package/version gates, built-in package presets, indexed Laravel values, and static strings.

## Later Phases

- Route middleware and controller/action intelligence.
- Additional filesystem contexts beyond `Storage::disk(...)` when they are semantically disk names.
- Discover package-provided `ide.json` preset files from installed Composer packages.
- Eloquent models, fields, relations, scopes, casts, and factories.
- Template-based Laravel artifact generation.
- Module and package-aware indexing for Livewire, Inertia, Nova, Filament, and Dusk.
