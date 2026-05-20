# Changelog

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
