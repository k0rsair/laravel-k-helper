# Artisan Command Completions And Navigation

## Goal

Add conservative Laravel Artisan command-name intelligence:

- complete known command names in common PHP command-call contexts;
- navigate a command string reference to the PHP command class;
- keep indexing source-based and static, consistent with the rest of Laravel K Helper.

## Scope

- Index command classes under the application source tree when they expose a literal `protected $signature` or `protected $name`.
- Support standard call sites such as `Artisan::call(...)`, `Artisan::queue(...)`, `artisan(...)`, `$schedule->command(...)`, `$this->call(...)`, and `$this->callSilent(...)`.
- Return definitions at the command class declaration, not at the property string.
- Add fixture coverage, context tests, scanner assertions, README/changelog/roadmap notes, and a fresh VSIX package.

## Tasks

- [x] Add `artisan-command` to the index model, snapshot, stats, and status output.
- [x] Implement an Artisan command scanner for static `$signature` / `$name` declarations.
- [x] Wire PHP string contexts into completions and go-to-definition.
- [x] Add Laravel fixture command classes and tests.
- [x] Update docs, bump package version, run checks, and package the extension.

## Verification

- `source ~/.nvm/nvm.sh && nvm use 20 && npm run check`
- `npx @vscode/vsce package`
