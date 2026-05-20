import { describe, expect, it } from "vitest";
import {
  extractQuotedStringAtOffset,
  resolveBladeComponentPrefix,
  resolveIdeJsonStringContext,
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
    expect(resolveStringContext("Schema::table('us", "php")).toMatchObject({
      kind: "database-table",
      prefix: "us",
    });
    expect(resolveStringContext("DB::table('us", "php")).toMatchObject({
      kind: "database-table",
      prefix: "us",
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

  it("extracts quoted string at cursor offset", () => {
    const line = "return route('users.index');";
    expect(extractQuotedStringAtOffset(line, 18)).toEqual({
      value: "users.index",
      start: 14,
      end: 25,
    });
  });
});
