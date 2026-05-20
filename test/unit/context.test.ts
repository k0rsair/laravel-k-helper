import { describe, expect, it } from "vitest";
import {
  extractQuotedStringAtOffset,
  resolveBladeComponentPrefix,
  resolveEloquentCastTypeContext,
  resolveEloquentModelAttributeContext,
  resolveEloquentRelationConstraintContext,
  resolveIdeJsonStringContext,
  resolveLivewireComponentPrefix,
  resolveStringContext,
} from "../../src/context/completionContext";

describe("completion context", () => {
  it("resolves Laravel helper contexts", () => {
    expect(resolveStringContext("return route('users.", "php")).toMatchObject({
      kind: "route",
      prefix: "users.",
    });
    expect(resolveStringContext("{{ __('messages.", "blade")).toMatchObject({
      kind: "translation",
      prefix: "messages.",
    });
    expect(resolveStringContext("@include('users.", "blade")).toMatchObject({
      kind: "view",
      prefix: "users.",
    });
    expect(resolveStringContext("return config('services.mailgun.endpoint.", "php")).toMatchObject({
      kind: "config",
      prefix: "services.mailgun.endpoint.",
      rangeStart: 15,
    });
    expect(resolveStringContext("$request->input('em", "php")).toMatchObject({
      kind: "request-field",
      prefix: "em",
    });
    expect(resolveStringContext("Storage::disk('s", "php")).toMatchObject({
      kind: "filesystem-disk",
      prefix: "s",
    });
    expect(resolveStringContext("Storage::fake('pub", "php")).toMatchObject({
      kind: "filesystem-disk",
      prefix: "pub",
    });
    expect(resolveStringContext("Schema::table('us", "php")).toMatchObject({
      kind: "database-table",
      prefix: "us",
    });
    expect(resolveStringContext("DB::table('us", "php")).toMatchObject({
      kind: "database-table",
      prefix: "us",
    });
    expect(resolveStringContext("Livewire::mount('user", "php")).toMatchObject({
      kind: "livewire-component",
      prefix: "user",
    });
    expect(resolveStringContext("Inertia::render('Users/", "php")).toMatchObject({
      kind: "inertia-page",
      prefix: "Users/",
    });
    expect(resolveStringContext("Route::inertia('/users', 'Users/", "php")).toMatchObject({
      kind: "inertia-page",
      prefix: "Users/",
    });
    expect(resolveStringContext("@livewire('user", "blade")).toMatchObject({
      kind: "livewire-component",
      prefix: "user",
    });
  });

  it("resolves additional filesystem disk contexts", () => {
    expect(resolveStringContext("$request->file('avatar')->store('avatars', 'pub", "php")).toMatchObject({
      kind: "filesystem-disk",
      prefix: "pub",
    });
    expect(resolveStringContext("$request->file('avatar')->storeAs('avatars', $name, 'project", "php")).toMatchObject({
      kind: "filesystem-disk",
      prefix: "project",
    });
    expect(resolveStringContext("$request->file('avatar')->storePublicly('avatars', 's", "php")).toMatchObject({
      kind: "filesystem-disk",
      prefix: "s",
    });
    expect(resolveStringContext("$request->file('avatar')->storePubliclyAs('avatars', $name, 'project", "php")).toMatchObject({
      kind: "filesystem-disk",
      prefix: "project",
    });
    expect(resolveStringContext("    'default' => env('FILESYSTEM_DISK', 'loc", "php")).toMatchObject({
      kind: "filesystem-disk",
      prefix: "loc",
    });
    expect(resolveStringContext("    'cloud' => 's", "php")).toMatchObject({
      kind: "filesystem-disk",
      prefix: "s",
    });
  });

  it("resolves Eloquent field contexts", () => {
    expect(resolveStringContext("User::where('em", "php")).toMatchObject({
      kind: "eloquent-field",
      prefix: "em",
      modelClass: "User",
    });
    expect(resolveStringContext("App\\Models\\User::query()->where('na", "php")).toMatchObject({
      kind: "eloquent-field",
      prefix: "na",
      modelClass: "App\\Models\\User",
    });
    expect(resolveStringContext("User::select(['em", "php")).toMatchObject({
      kind: "eloquent-field",
      prefix: "em",
      modelClass: "User",
    });
    expect(resolveStringContext("User::query()->where('name', 'Ada')->orderBy('cre", "php")).toMatchObject({
      kind: "eloquent-field",
      prefix: "cre",
      modelClass: "User",
    });
    expect(resolveStringContext("User::query()->pluck('em", "php")).toMatchObject({
      kind: "eloquent-field",
      prefix: "em",
      modelClass: "User",
    });
    expect(resolveStringContext("User::query()->whereIn('id', [1])->addSelect(['em", "php")).toMatchObject({
      kind: "eloquent-field",
      prefix: "em",
      modelClass: "User",
    });
    expect(resolveStringContext("    protected $fillable = ['em", "php")).toMatchObject({
      kind: "eloquent-field",
      prefix: "em",
    });
    expect(resolveEloquentModelAttributeContext("    protected $casts = [\n        'is_", "        'is_")).toMatchObject({
      kind: "eloquent-field",
      prefix: "is_",
    });
    expect(resolveEloquentCastTypeContext("    protected $casts = [\n        'is_active' => 'bo", "        'is_active' => 'bo")).toMatchObject({
      kind: "eloquent-field",
      prefix: "bo",
      castAttribute: "is_active",
    });
  });

  it("resolves database query column contexts", () => {
    expect(resolveStringContext("DB::table('users')->where('em", "php")).toMatchObject({
      kind: "database-column",
      prefix: "em",
      table: "users",
    });
    expect(resolveStringContext("DB::table('users')->where('name', 'Ada')->orderBy('cre", "php")).toMatchObject({
      kind: "database-column",
      prefix: "cre",
      table: "users",
    });
    expect(resolveStringContext("DB::table('users')->select(['em", "php")).toMatchObject({
      kind: "database-column",
      prefix: "em",
      table: "users",
    });
    expect(resolveStringContext("DB::table('users')->pluck('em", "php")).toMatchObject({
      kind: "database-column",
      prefix: "em",
      table: "users",
    });
  });

  it("resolves Eloquent relation contexts", () => {
    expect(resolveStringContext("User::with('po", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "po",
      modelClass: "User",
    });
    expect(resolveStringContext("User::with(['po", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "po",
      modelClass: "User",
    });
    expect(resolveStringContext("App\\Models\\User::query()->with(['po", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "po",
      modelClass: "App\\Models\\User",
    });
    expect(resolveStringContext("User::where('email', 'ada@example.test')->with('po", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "po",
      modelClass: "User",
    });
    expect(resolveStringContext("User::query()->where('email', 'ada@example.test')->with(['po", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "po",
      modelClass: "User",
    });
    expect(resolveStringContext("$query->with(['po", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "po",
    });
    expect(resolveStringContext("$query->with(['comments', 'po", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "po",
    });
    expect(resolveStringContext("User::with('posts.co", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "co",
      modelClass: "User",
      relationPath: ["posts"],
      rangeStart: 18,
    });
    expect(resolveStringContext("User::with(['posts.co", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "co",
      modelClass: "User",
      relationPath: ["posts"],
    });
    expect(resolveStringContext("Product::with('phoneModel.", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "",
      modelClass: "Product",
      relationPath: ["phoneModel"],
      rangeStart: 26,
    });
    expect(resolveStringContext("Product::whereHas('phoneModel.work", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "work",
      modelClass: "Product",
      relationPath: ["phoneModel"],
    });
    expect(resolveStringContext("Product::withCount(['phone", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "phone",
      modelClass: "Product",
    });
    expect(resolveStringContext("$product->loadMissing(['phoneModel.work", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "work",
      relationPath: ["phoneModel"],
    });
    expect(resolveStringContext("$query->whereDoesntHave('phone", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "phone",
    });
    expect(resolveStringContext("Product::withWhereHas('phoneModel.work", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "work",
      modelClass: "Product",
      relationPath: ["phoneModel"],
    });
    expect(resolveStringContext("Product::whereHasMorph('phone", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "phone",
      modelClass: "Product",
    });
    expect(resolveStringContext("Product::with(['phoneModel.workpieces' => fn ($query) => $query", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "workpieces",
      modelClass: "Product",
      relationPath: ["phoneModel"],
    });
    expect(resolveStringContext("Product::with(['phoneModel' => fn ($query) => $query->where('active', true)->with('work", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "work",
      modelClass: "Product",
      relationPath: ["phoneModel"],
    });
    expect(
      resolveStringContext("Product::with(['phoneModel' => function ($query) { $query->where('active', true)->with('work", "php"),
    ).toMatchObject({
      kind: "eloquent-relation",
      prefix: "work",
      modelClass: "Product",
      relationPath: ["phoneModel"],
    });
    expect(resolveStringContext("$query->with('work", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "work",
    });
    expect(
      resolveEloquentRelationConstraintContext(
        "Product::with(['phoneModel' => function ($query) {\n        $query->where('active', true)->with('work",
        "$query->where('active', true)->with('work",
      ),
    ).toEqual({
      modelClass: "Product",
      relationPath: ["phoneModel"],
    });
    expect(
      resolveEloquentRelationConstraintContext(
        "Product::where('id', 1)->with(['phoneModel' => function ($query) {\n        $query->with('work",
        "$query->with('work",
      ),
    ).toEqual({
      modelClass: "Product",
      relationPath: ["phoneModel"],
    });
    expect(resolveStringContext("$query->with(['phoneModel.workpieces' => fn ($query) => $query", "php")).toMatchObject({
      kind: "eloquent-relation",
      prefix: "workpieces",
      relationPath: ["phoneModel"],
    });
  });

  it("resolves Eloquent scope contexts", () => {
    expect(resolveStringContext("Product::rea", "php")).toMatchObject({
      kind: "eloquent-scope",
      prefix: "rea",
      modelClass: "Product",
    });
    expect(resolveStringContext("Product::query()->where('id', 1)->rea", "php")).toMatchObject({
      kind: "eloquent-scope",
      prefix: "rea",
      modelClass: "Product",
    });
    expect(resolveStringContext("$query->rea", "php")).toMatchObject({
      kind: "eloquent-scope",
      prefix: "rea",
    });
  });

  it("resolves Eloquent factory state contexts", () => {
    expect(resolveStringContext("User::factory()->sus", "php")).toMatchObject({
      kind: "eloquent-factory-state",
      prefix: "sus",
      modelClass: "User",
    });
    expect(resolveStringContext("User::factory()->count(3)->with", "php")).toMatchObject({
      kind: "eloquent-factory-state",
      prefix: "with",
      modelClass: "User",
    });
  });

  it("resolves validation rule pipe contexts", () => {
    expect(resolveStringContext("'email' => 'required|em", "php")).toMatchObject({
      kind: "validation-rule",
      prefix: "em",
    });
  });

  it("resolves route action contexts", () => {
    expect(resolveStringContext("Route::get('{projectDelivery}/{article}', 'get", "php")).toMatchObject({
      kind: "route-action",
      prefix: "get",
    });
    expect(resolveStringContext("Route::get('/legacy-labels/{label}', 'LabelsController@leg", "php")).toMatchObject({
      kind: "route-action",
      prefix: "leg",
      controllerClass: "LabelsController",
    });
  });

  it("resolves route middleware contexts", () => {
    expect(resolveStringContext("Route::middleware(['auth', 'ver", "php")).toMatchObject({
      kind: "route-middleware",
      prefix: "ver",
    });
    expect(resolveStringContext("Route::get('/dashboard', DashboardController::class)->middleware('project", "php")).toMatchObject({
      kind: "route-middleware",
      prefix: "project",
    });
    expect(resolveStringContext("$this->middleware('auth", "php")).toMatchObject({
      kind: "route-middleware",
      prefix: "auth",
    });
    expect(resolveStringContext("Route::middleware('throttle:", "php")).toMatchObject({
      kind: "route-middleware",
      prefix: "throttle",
    });
  });

  it("resolves Filament resource registration contexts", () => {
    expect(resolveStringContext("$panel->resources([User", "php")).toMatchObject({
      kind: "filament-resource",
      prefix: "User",
    });
    expect(resolveStringContext("$panel->resource(App\\Filament\\Resources\\User", "php")).toMatchObject({
      kind: "filament-resource",
      prefix: "App\\Filament\\Resources\\User",
    });
  });

  it("resolves Nova resource registration contexts", () => {
    expect(resolveStringContext("Nova::resources([User", "php")).toMatchObject({
      kind: "nova-resource",
      prefix: "User",
    });
    expect(resolveStringContext("Nova::resource(App\\Nova\\User", "php")).toMatchObject({
      kind: "nova-resource",
      prefix: "App\\Nova\\User",
    });
  });

  it("resolves ide.json custom function contexts", () => {
    expect(resolveIdeJsonStringContext("custom_route_target('us")).toEqual({
      target: "function",
      name: "custom_route_target",
      parameter: 0,
      prefix: "us",
    });
    expect(resolveIdeJsonStringContext("custom_disk($tenant, 's")).toEqual({
      target: "function",
      name: "custom_disk",
      parameter: 1,
      prefix: "s",
    });
    expect(resolveIdeJsonStringContext("$target->customMethod('wel")).toEqual({
      target: "method",
      name: "customMethod",
      parameter: 0,
      prefix: "wel",
    });
    expect(resolveIdeJsonStringContext("CustomFacade::target('app.")).toEqual({
      target: "method",
      name: "CustomFacade::target",
      parameter: 0,
      prefix: "app.",
    });
    expect(resolveIdeJsonStringContext("new App\\Support\\CustomTarget('messages.")).toEqual({
      target: "constructor",
      name: "App\\Support\\CustomTarget",
      parameter: 0,
      prefix: "messages.",
    });
    expect(resolveIdeJsonStringContext("    'dr")).toEqual({
      target: "arrayKey",
      name: "*",
      parameter: 0,
      prefix: "dr",
    });
    expect(resolveIdeJsonStringContext("    'driver' => 's")).toEqual({
      target: "arrayValue",
      name: "driver",
      parameter: 0,
      prefix: "s",
    });
  });

  it("resolves Blade component tag prefixes", () => {
    expect(resolveBladeComponentPrefix("<x-user-")).toMatchObject({
      prefix: "user.",
    });
  });

  it("resolves Livewire component tag prefixes", () => {
    expect(resolveLivewireComponentPrefix("<livewire:admin.")).toMatchObject({
      prefix: "admin.",
    });
  });

  it("extracts quoted string at cursor offset", () => {
    const line = "return route('users.index');";
    expect(extractQuotedStringAtOffset(line, 18)).toEqual({
      value: "users.index",
      start: 14,
      end: 25,
    });
  });
});
