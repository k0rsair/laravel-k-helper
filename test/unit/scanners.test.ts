import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MemoryLogger, safeSerialize } from "../../src/logging/logger";
import { detectLaravelProject } from "../../src/indexer/detector";
import { LaravelIndex } from "../../src/indexer";

const fixtureRoot = path.resolve(__dirname, "../fixtures/laravel-basic");

describe("Laravel indexing", () => {
  it("detects Laravel projects from composer packages", async () => {
    const logger = new MemoryLogger();
    const project = await detectLaravelProject(fixtureRoot, undefined, logger);

    expect(project?.root).toBe(fixtureRoot);
    expect(project?.composerPackages).toContain("laravel/framework");
  });

  it("indexes MVP Laravel records", async () => {
    const logger = new MemoryLogger();
    const index = new LaravelIndex(fixtureRoot, logger);

    await index.reindex();

    expect(index.all("route").map((item) => item.key)).toEqual(
      expect.arrayContaining(["home", "users.index", "users.store", "api.health", "api.orders.cancel", "api.profiles.update"]),
    );
    expect(index.all("http-route").map((item) => `${item.httpMethod} ${item.key}`)).toEqual(
      expect.arrayContaining([
        "GET /api/health",
        "POST /api/orders/{order}/cancel",
        "PATCH /api/v1/profiles/{profile}",
        "GET /users",
        "POST /users",
        "GET /labels/{projectDelivery}/{article}",
        "GET /nested-labels/archive/{label}",
        "GET /array-labels/{label}",
      ]),
    );
    expect(index.all("http-route").map((item) => `${item.httpMethod} ${item.key}`)).not.toContain("GET /{projectDelivery}/{article}");
    expect(index.findHttpRouteByRequest("/users", "POST")).toMatchObject({
      httpMethod: "POST",
      uri: "/users",
    });
    expect(index.findHttpRouteByRequest("/array-labels/42", "GET")).toMatchObject({
      httpMethod: "GET",
      uri: "/array-labels/{label}",
    });
    expect(index.findHttpRouteByRequest("/labels/delivery-1/article-2", "GET")).toMatchObject({
      httpMethod: "GET",
      uri: "/labels/{projectDelivery}/{article}",
    });
    expect(index.findHttpRouteByRequest("/labels/{param}/{param}", "POST")).toMatchObject({
      httpMethod: "POST",
      uri: "/labels/{projectDelivery}/{article}",
    });
    expect(index.findHttpRouteByRequest("/nested-labels/archive/42", "GET")).toMatchObject({
      httpMethod: "GET",
      uri: "/nested-labels/archive/{label}",
    });
    expect(index.findHttpRouteByRequest("/api/orders/99/cancel", "POST")).toMatchObject({
      httpMethod: "POST",
      uri: "/api/orders/{order}/cancel",
      routeName: "api.orders.cancel",
    });
    expect(index.findHttpRouteByRequest("/api/v1/profiles/42", "PATCH")).toMatchObject({
      httpMethod: "PATCH",
      uri: "/api/v1/profiles/{profile}",
      routeName: "api.profiles.update",
    });
    expect(index.findHttpRouteByName("api.health")).toMatchObject({
      httpMethod: "GET",
      uri: "/api/health",
    });
    expect(index.findHttpRouteByRequest("/wrong/route", "GET")).toBeUndefined();
    expect(index.all("view").map((item) => item.key)).toEqual(
      expect.arrayContaining(["welcome", "users.index", "components.alert"]),
    );
    expect(index.all("config").map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "app.name",
        "app.timezone",
        "services.mailgun",
        "services.mailgun.domain",
        "services.mailgun.endpoint",
        "services.mailgun.endpoint.region",
        "services.mailgun.endpoint.region.name",
        "services.marketplaces.ozon.36",
        "services.marketplaces.ozon.36.warehouse",
        "services.marketplaces.ozon.36.warehouse.name",
        "filesystems.disks.s3.key",
      ]),
    );
    expect(index.all("config").map((item) => item.key)).not.toContain("services.marketplaces.ozon.warehouse");
    expect(index.all("translation").map((item) => item.key)).toEqual(
      expect.arrayContaining(["messages.welcome", "messages.nested", "messages.nested.title", "Dashboard"]),
    );
    expect(index.all("env").map((item) => item.key)).toEqual(
      expect.arrayContaining(["APP_NAME", "APP_ENV", "APP_KEY", "DB_PASSWORD"]),
    );
    expect(index.all("blade-component").map((item) => item.key)).toEqual(
      expect.arrayContaining(["alert", "user-card"]),
    );
    expect(index.all("livewire-component").map((item) => item.key)).toEqual(
      expect.arrayContaining(["user-table", "admin.dashboard-widget"]),
    );
    expect(index.all("inertia-page").map((item) => item.key)).toEqual(
      expect.arrayContaining(["Users/Index"]),
    );
    expect(index.all("filament-resource").map((item) => item.key)).toEqual(
      expect.arrayContaining(["App\\Filament\\Resources\\UserResource"]),
    );
    expect(index.filamentResourceCompletions("User").map((item) => item.key)).toEqual([
      "App\\Filament\\Resources\\UserResource",
    ]);
    expect(index.findFilamentResourceByReference("UserResource")?.source.file).toContain("UserResource.php");
    expect(index.all("nova-resource").map((item) => item.key)).toEqual(
      expect.arrayContaining(["App\\Nova\\User"]),
    );
    expect(index.novaResourceCompletions("User").map((item) => item.key)).toEqual(["App\\Nova\\User"]);
    expect(index.findNovaResourceByReference("User")?.source.file).toContain("app/Nova/User.php");
    expect(index.all("validation-rule").map((item) => item.key)).toEqual(
      expect.arrayContaining(["required", "email", "unique", "timezone", "uppercase"]),
    );
    expect(index.all("request-field").map((item) => item.key)).toEqual(
      expect.arrayContaining(["name", "email", "profile.timezone"]),
    );
    expect(index.all("route-middleware").map((item) => item.key)).toEqual(
      expect.arrayContaining(["auth", "verified", "project.active"]),
    );
    expect(index.find("route-middleware", "project.active")?.source.file).toContain("Kernel.php");
    expect(index.all("filesystem-disk").map((item) => item.key)).toEqual(
      expect.arrayContaining(["local", "public", "s3", "project_uploads"]),
    );
    expect(index.all("database-table").map((item) => item.key)).toEqual(
      expect.arrayContaining(["users"]),
    );
    expect(index.all("database-column").filter((item) => item.table === "users").map((item) => item.key)).toEqual(
      expect.arrayContaining(["id", "name", "email", "email_verified_at", "is_active", "settings", "remember_token", "created_at", "updated_at"]),
    );
    expect(index.all("database-column").find((item) => item.table === "users" && item.key === "is_active")?.columnType).toBe("boolean");
    expect(index.all("eloquent-model").map((item) => item.key)).toEqual(
      expect.arrayContaining(["App\\Models\\User", "App\\Domain\\CustomerProfile"]),
    );
    expect(
      index.all("eloquent-field").filter((item) => item.modelClass === "App\\Domain\\CustomerProfile").map((item) => item.key),
    ).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "email",
        "email_verified_at",
        "is_active",
        "settings",
        "remember_token",
        "created_at",
        "updated_at",
      ]),
    );
    expect(index.all("eloquent-field").filter((item) => item.modelClass === "App\\Models\\User").map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "email",
        "email_verified_at",
        "is_active",
        "remember_token",
        "created_at",
        "updated_at",
        "settings",
        "preferences",
      ]),
    );
    expect(index.all("eloquent-relation").filter((item) => item.modelClass === "App\\Models\\User").map((item) => item.key)).toEqual(
      expect.arrayContaining(["posts", "tokens"]),
    );
    expect(index.find("eloquent-relation", "posts")?.relatedModelClass).toBe("App\\Models\\Post");
    expect(index.find("eloquent-relation", "tokens")?.relatedModelClass).toBe("Laravel\\Sanctum\\PersonalAccessToken");
    expect(index.all("eloquent-relation").filter((item) => item.modelClass === "App\\Models\\Post").map((item) => item.key)).toEqual(
      expect.arrayContaining(["comments"]),
    );
    expect(index.all("eloquent-model").map((item) => item.key)).toEqual(
      expect.arrayContaining(["App\\Models\\Product", "App\\Models\\PhoneModel"]),
    );
    expect(index.all("eloquent-relation").filter((item) => item.modelClass === "App\\Models\\Product").map((item) => item.key)).toEqual(
      expect.arrayContaining(["phoneModel"]),
    );
    expect(index.find("eloquent-relation", "phoneModel")?.relatedModelClass).toBe("App\\Models\\PhoneModel");
    expect(index.all("eloquent-relation").filter((item) => item.modelClass === "App\\Models\\PhoneModel").map((item) => item.key)).toEqual(
      expect.arrayContaining(["workpieces"]),
    );
    expect(index.all("eloquent-scope").filter((item) => item.modelClass === "App\\Models\\Product").map((item) => item.key)).toEqual(
      expect.arrayContaining(["ready"]),
    );
    expect(index.all("eloquent-scope").filter((item) => item.modelClass === "App\\Models\\PhoneModel").map((item) => item.key)).toEqual(
      expect.arrayContaining(["active"]),
    );
    expect(index.all("eloquent-factory-state").filter((item) => item.modelClass === "App\\Models\\User").map((item) => item.key)).toEqual(
      expect.arrayContaining(["suspended", "withPreferences"]),
    );
    expect(index.all("eloquent-factory-state").map((item) => item.key)).not.toEqual(
      expect.arrayContaining(["definition", "configure"]),
    );
    expect(index.find("eloquent-relation", "posts")?.source.file).toContain("User.php");
    expect(index.eloquentFieldCompletions(path.join(fixtureRoot, "app", "Models", "User.php"), "em").map((item) => item.key)).toEqual([
      "email",
      "email_verified_at",
    ]);
    expect(index.eloquentFieldCompletions(path.join(fixtureRoot, "routes", "web.php"), "em", "User").map((item) => item.key)).toEqual([
      "email",
      "email_verified_at",
    ]);
    expect(index.eloquentFieldCompletions(path.join(fixtureRoot, "routes", "web.php"), "pre", "User").map((item) => item.key)).toEqual([
      "preferences",
    ]);
    expect(index.eloquentFieldCompletions(path.join(fixtureRoot, "routes", "web.php"), "set", "User").map((item) => item.key)).toEqual([
      "settings",
    ]);
    expect(index.eloquentCastTypeCompletions(path.join(fixtureRoot, "app", "Models", "User.php"), "bo", "is_active").map((item) => item.key)).toEqual([
      "boolean",
    ]);
    expect(index.eloquentCastTypeCompletions(path.join(fixtureRoot, "app", "Models", "User.php"), "arr", "settings").map((item) => item.key)).toEqual([
      "array",
    ]);
    expect(index.databaseColumnCompletions("em", "users").map((item) => item.key)).toEqual(["email", "email_verified_at"]);
    expect(index.databaseColumnCompletions("cre", "users").map((item) => item.key)).toEqual(["created_at"]);
    expect(index.eloquentRelationCompletions(path.join(fixtureRoot, "routes", "web.php"), "po", "User").map((item) => item.key)).toEqual([
      "posts",
    ]);
    expect(index.eloquentRelationCompletions(path.join(fixtureRoot, "app", "Models", "User.php"), "").map((item) => item.key)).toEqual([
      "posts",
      "tokens",
    ]);
    expect(index.eloquentRelationCompletions(path.join(fixtureRoot, "app", "Models", "User.php"), "phone").map((item) => item.key)).toEqual([]);
    expect(index.eloquentRelationCompletions(path.join(fixtureRoot, "routes", "web.php"), "po")).toEqual([]);
    expect(
      index.eloquentRelationCompletions(path.join(fixtureRoot, "routes", "web.php"), "co", "User", ["posts"]).map((item) => item.key),
    ).toEqual(["comments"]);
    expect(
      index.eloquentRelationCompletions(path.join(fixtureRoot, "routes", "web.php"), "work", "Product", ["phoneModel"]).map((item) => item.key),
    ).toEqual(["workpieces"]);
    expect(index.eloquentRelationCompletions(path.join(fixtureRoot, "routes", "web.php"), "phone", "Product", ["phoneModel"])).toEqual([]);
    expect(index.eloquentRelationCompletions(path.join(fixtureRoot, "routes", "web.php"), "phone", "Product").map((item) => item.key)).toEqual([
      "phoneModel",
    ]);
    expect(index.eloquentScopeCompletions(path.join(fixtureRoot, "routes", "web.php"), "rea", "Product").map((item) => item.key)).toEqual([
      "ready",
    ]);
    expect(index.eloquentScopeCompletions(path.join(fixtureRoot, "routes", "web.php"), "act", "PhoneModel").map((item) => item.key)).toEqual([
      "active",
    ]);
    expect(index.eloquentScopeCompletions(path.join(fixtureRoot, "routes", "web.php"), "rea", "Route")).toEqual([]);
    expect(
      index.eloquentFactoryStateCompletions(path.join(fixtureRoot, "routes", "web.php"), "sus", "User").map((item) => item.key),
    ).toEqual(["suspended"]);
    expect(index.eloquentFactoryStateCompletions(path.join(fixtureRoot, "routes", "web.php"), "sus", "Route")).toEqual([]);
    expect(index.all("route-middleware").filter((item) => item.key === "auth").map((item) => item.detail)).toEqual(
      expect.arrayContaining(["Route middleware reference"]),
    );
    expect(
      index.eloquentRelationCompletions(path.join(fixtureRoot, "routes", "web.php"), "", "Product", ["phoneModel"]).map((item) => item.key),
    ).toEqual(["workpieces"]);
    expect(index.ideJsonRuleFor("function", "custom_route_target", 0)).toMatchObject({
      kind: "routeName",
    });
    expect(index.ideJsonCompletions(index.ideJsonRuleFor("function", "custom_disk", 1)!, "s").map((item) => item.key)).toEqual(["s3"]);
    expect(index.ideJsonCompletions(index.ideJsonRuleFor("function", "custom_mode", 0)!, "p").map((item) => item.key)).toEqual([
      "published",
    ]);
    expect(index.ideJsonCompletions(index.ideJsonRuleFor("method", "customMethod", 0)!, "wel").map((item) => item.key)).toEqual([
      "welcome",
    ]);
    expect(index.ideJsonCompletions(index.ideJsonRuleFor("method", "CustomFacade::target", 0)!, "app.").map((item) => item.key)).toContain(
      "app.name",
    );
    expect(
      index.ideJsonCompletions(index.ideJsonRuleFor("constructor", "App\\Support\\CustomTarget", 0)!, "messages.").map((item) => item.key),
    ).toContain("messages.welcome");
    expect(index.ideJsonCompletions(index.ideJsonRuleFor("arrayKey", "*", 0)!, "dr").map((item) => item.key)).toEqual(["driver"]);
    expect(index.ideJsonCompletions(index.ideJsonRuleFor("arrayValue", "driver", 0)!, "s").map((item) => item.key)).toEqual(["s3"]);
    expect(index.ideJsonRuleFor("function", "laravel_only", 0)).toBeDefined();
    expect(index.ideJsonRuleFor("function", "future_laravel_only", 0)).toBeUndefined();
    expect(index.ideJsonRuleFor("function", "missing_package", 0)).toBeUndefined();
    expect(index.ideJsonRuleFor("function", "storage_disk", 0)).toMatchObject({
      package: "laravel/framework",
      kind: "filesystemDisk",
    });
    expect(index.ideJsonCompletions(index.ideJsonRuleFor("function", "pint_preset", 0)!, "la").map((item) => item.key)).toEqual([
      "laravel",
    ]);
    expect(index.ideJsonCompletions(index.ideJsonRuleFor("function", "package_route_target", 0)!, "us").map((item) => item.key)).toEqual([
      "users.index",
      "users.store",
    ]);
    expect(index.ideJsonCompletions(index.ideJsonRuleFor("function", "package_mode", 0)!, "a").map((item) => item.key)).toEqual([
      "async",
    ]);
    expect(index.all("controller-method").map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "App\\Http\\Controllers\\Api\\LabelsController::getLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::storeLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::importedLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::chainedLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::nestedLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::arrayLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::legacyLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::__invoke",
      ]),
    );
    expect(index.all("route-action").map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "getLabel",
        "storeLabel",
        "importedLabel",
        "chainedLabel",
        "nestedLabel",
        "arrayLabel",
        "legacyLabel",
        "__invoke",
      ]),
    );
    expect(index.find("route-action", "getLabel")?.source.file).toContain("LabelsController.php");
    expect(index.find("route-action", "chainedLabel")?.detail).toBe(
      "App\\Http\\Controllers\\Api\\LabelsController::chainedLabel",
    );
    expect(index.find("route-action", "nestedLabel")?.detail).toBe(
      "App\\Http\\Controllers\\Api\\LabelsController::nestedLabel",
    );
    expect(index.find("route-action", "arrayLabel")?.detail).toBe(
      "App\\Http\\Controllers\\Api\\LabelsController::arrayLabel",
    );
    expect(index.find("route-action", "legacyLabel")?.detail).toBe(
      "App\\Http\\Controllers\\Api\\LabelsController::legacyLabel",
    );
    expect(index.find("route-action", "__invoke")?.detail).toBe(
      "App\\Http\\Controllers\\Api\\LabelsController::__invoke",
    );
  });

  it("returns scope-aware route action completions and reverse route references", async () => {
    const logger = new MemoryLogger();
    const index = new LaravelIndex(fixtureRoot, logger);
    const routeFile = path.join(fixtureRoot, "routes", "web.php");
    const routeText = readFileSync(routeFile, "utf8");

    await index.reindex();

    const groupedOffset = routeText.indexOf("Route::get('{projectDelivery}/{article}', 'get");
    const completions = index.routeActionCompletions(routeFile, groupedOffset, "sto").map((item) => item.key);
    expect(completions).toContain("storeLabel");
    expect(completions).not.toContain("home");

    expect(index.routeActionCompletions(routeFile, routeText.indexOf("LabelsController@leg"), "leg", "LabelsController").map((item) => item.key)).toEqual([
      "legacyLabel",
    ]);

    const method = index.find("controller-method", "App\\Http\\Controllers\\Api\\LabelsController::getLabel");
    expect(method).toBeDefined();
    const references = index.routeReferencesForControllerMethod(method!.key);
    expect(references.map((item) => item.routeSource?.file)).toContain(routeFile);
    expect(references.map((item) => item.key)).toContain("getLabel");
  });

  it("provides controller methods for CodeLens route counts", async () => {
    const logger = new MemoryLogger();
    const index = new LaravelIndex(fixtureRoot, logger);
    const controllerFile = path.join(fixtureRoot, "app", "Http", "Controllers", "Api", "LabelsController.php");

    await index.reindex();

    const methods = index.controllerMethodsInFile(controllerFile);
    const getLabel = methods.find((item) => item.method === "getLabel");

    expect(getLabel).toBeDefined();
    expect(index.routeReferencesForControllerMethod(getLabel!.key)).toHaveLength(1);
  });

  it("does not serialize env values through logger sanitization", () => {
    const serialized = safeSerialize({ keyName: "DB_PASSWORD", value: "secret", token: "abc" });

    expect(serialized).toContain("DB_PASSWORD");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("abc");
  });
});
