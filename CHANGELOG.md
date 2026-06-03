# Changelog

## 0.10.6

- Added Artisan command-name completions for `Artisan::call(...)`, `Artisan::queue(...)`, `artisan(...)`, scheduler `command(...)`, and console command `call(...)` contexts.
- Added go-to-definition from indexed command strings to the command class for static `$signature` and `$name` command declarations.
- Added frontend response property completions for statically indexed Laravel JSON and array responses matched from `axios`, `fetch`, and route-helper request calls.
- Added response-field indexing for route closures and controller methods returning literal arrays or `response()->json([...])`.
- Added frontend response-field indexing for literal `collect([...])` response payloads.
- Added nested frontend response suggestions for explicitly type-hinted Eloquent model variables returned inside literal response arrays or collections.

## 0.10.5

- Fixed bound-interface navigation for constructor-promoted properties, nullable typed assignments, multiline method chains, and grouped PHP imports.
- Added service-provider binding navigation from bound interfaces to concrete implementation methods for simple Laravel container bindings.
- Added bound-implementation document links so Cmd/Ctrl-click on container-resolved contract calls can open the concrete class or method directly instead of falling through to PHP language-server interface navigation.
- Added support for provider bindings that resolve concretes through arrow factories and closure factories returning `new Concrete(...)`.
- Added Laravel core container presets for common framework contracts so standard services can resolve without parsing all of `vendor`.
- Added resolver-level tests that assert bound contract method calls land on the concrete implementation method.

## 0.10.4

- Added `Route::resource(...)` and `Route::apiResource(...)` expansion for frontend HTTP route matching and controller CodeLens targets.

## 0.10.3

- Added frontend HTTP route navigation for common `axios`, `fetch`, and Ziggy-style `route(...)` calls.
- Added clickable frontend route CodeLens hints with support for common concatenated and template literal URLs.
- Added a second frontend route CodeLens that opens the resolved controller method when available.
- Added support for simple frontend URL variables passed into `axios` and `fetch` calls.
- Included route file prefixes from `RouteServiceProvider` and Laravel 11-style routing configuration when matching frontend HTTP targets.

## 0.10.2

- Added automatic Laravel completion triggering while typing inside recognized PHP and Blade string contexts.

## 0.10.1

- Renamed the extension to Laravel K Helper.
- Updated the Marketplace description and icon for release packaging.

## 0.10.0

- Added Laravel project detection and workspace indexing.
- Added completions and definitions for routes, views, config keys, translations, environment keys, Blade components, validation rules, request fields, filesystem disks, and `ide.json` rules.
- Added route action navigation, reverse route references, route CodeLens counts, and multi-route picker support.
- Added first-pass database and Eloquent intelligence: migration table/column indexing, model field completions from columns and casts, relation completions and navigation, nested relation paths, local scope completions/navigation, factory state completions/navigation, and table-scoped `DB::table(...)` column completions.
- Added Laravel Assist branding and extension icon.
- Added `laravelAssist.*` settings with fallback support for legacy `laravelAware.*` settings.

## Notes

- This is a preview build. Indexing is intentionally lightweight and regex-based, so unsupported Laravel syntax may require additional focused coverage.
