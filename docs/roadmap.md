# Laravel K Helper Roadmap

## MVP

- Project detection.
- Core string completions and definitions.
- Debounced file indexing.
- Output-channel diagnostics.
- Validation rules and request field completions.
- Fast navigation from grouped route string actions to controller methods, including array-style groups, imported controllers, `Route::controller(...)->group(...)`, and nested groups that inherit a controller.
- Legacy `Controller@method` route action indexing, completion, and navigation.
- Array controller actions such as `[SomeController::class, 'method']` outside controller groups.
- Invokable controllers such as `Route::get('/labels', SomeController::class)`.
- Scope-aware autocomplete for controller-group route action strings.
- Reverse references from controller methods to matching route declarations.
- CodeLens over controller methods that have route declarations.
- Multi-route picker for controller method CodeLens when more than one route references the method.
- Frontend response property completions for matched Laravel routes with statically indexed literal array / JSON response shapes, conservative Laravel API resources, and response-field hover/definition back to backend source when confidence is high.
- Blade component prop/slot metadata, Livewire `wire:model` / `wire:click` member navigation, Inertia page-prop indexing, Filament field/action surfaces, and quiet Eloquent model diagnostics for migration-backed schema mismatches.
- Route middleware alias indexing, completion, and definition support for `Route::middleware(...)`, route declarations, and controller middleware calls.
- Artisan command name indexing, completion, and definition support for static command classes declared with `$signature` or `$name`.
- Filesystem disk completions for `Storage::disk/fake/persistentFake(...)`, upload `store*` disk arguments, and `filesystems.php` default/cloud values from `config/filesystems.php` `disks` keys.
- Database table/column indexing from migrations, Eloquent model field completions from columns and casts for query methods, `$fillable`/`$guarded`/`$casts` attribute completions, migration-type-based `$casts` value suggestions, relation completions/definitions for eager-load and relation query helpers, nested relation paths, local Eloquent scope completions/definitions, factory state completions/definitions, and table-scoped `DB::table(...)` column completions.
- Service-provider binding indexing and navigation from interface-typed method calls to concrete implementation methods for simple Laravel container bindings and simple factory bindings, with Laravel core container presets as fallback, PHP definition-provider precedence, and document-link navigation for bound contract calls.
- `ide.json` completion rules for functions, methods, constructors, array keys/values, Composer package/version gates, built-in package presets, indexed Laravel values, and static strings.
- Package-provided `ide.json` discovery plus explicit package-aware model intelligence hooks such as Laravel Sanctum `HasApiTokens` relations.
- Preview generation for common Laravel artifacts such as controllers and form requests with validation and overwrite protection.
- First ecosystem module indexing for Livewire class/view components, Inertia pages, Filament resources, and Nova resources, including completions/definitions for `@livewire(...)`, `<livewire:...>`, `Livewire::mount(...)`, `Inertia::render(...)`, `Route::inertia(...)`, Filament resource registration calls, and Nova resource registration calls.

## Later Phases

- Deeper Nova, Filament, Dusk, Livewire, and Inertia workflows beyond the first indexed surfaces.
