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
      expect.arrayContaining([
        "home",
        "users.index",
        "users.store",
        "api.health",
        "api.orders.cancel",
        "api.profiles.update",
        "api.users.resource-summary",
        "api.users.resource-payload",
        "api.users.resource-collection",
      ]),
    );
    expect(index.all("http-route").map((item) => `${item.httpMethod} ${item.key}`)).toEqual(
      expect.arrayContaining([
        "GET /api/health",
        "POST /api/orders/{order}/cancel",
        "POST /api/dop-product-statistic/{product}/{group}",
        "POST /api/product-statistics",
        "GET /api/product-statistics/{product_statistic}",
        "PATCH /api/product-statistics/{product_statistic}",
        "PATCH /api/v1/profiles/{profile}",
        "GET /api/users/{user}/summary",
        "GET /api/users/{user}/resource-summary",
        "GET /api/users/{user}/resource-payload",
        "GET /api/users/{user}/resource-collection",
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
      controllerClass: "App\\Http\\Controllers\\Api\\LabelsController",
      method: "getLabel",
    });
    expect(index.findHttpRouteByRequest("/labels/delivery-1/article-2", "GET")?.controllerSource?.file).toContain("LabelsController.php");
    expect(index.findHttpRouteByRequest("/labels/delivery-1/article-2", "POST")).toMatchObject({
      httpMethod: "POST",
      uri: "/labels/{projectDelivery}/{article}",
      controllerClass: "App\\Http\\Controllers\\Api\\LabelsController",
      method: "storeLabel",
    });
    expect(index.findHttpRouteByRequest("/array-labels/42", "GET")).toMatchObject({
      controllerClass: "App\\Http\\Controllers\\Api\\LabelsController",
      method: "arrayLabel",
    });
    expect(index.findHttpRouteByRequest("/legacy-labels/42", "GET")).toMatchObject({
      controllerClass: "App\\Http\\Controllers\\Api\\LabelsController",
      method: "legacyLabel",
    });
    expect(index.findHttpRouteByRequest("/invokable-labels/42", "GET")).toMatchObject({
      controllerClass: "App\\Http\\Controllers\\Api\\LabelsController",
      method: "__invoke",
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
    expect(index.findHttpRouteByRequest("/api/dop-product-statistic/{param}/{param}", "POST")).toMatchObject({
      httpMethod: "POST",
      uri: "/api/dop-product-statistic/{product}/{group}",
      routeName: "api.dop-product-statistic",
    });
    expect(index.findHttpRouteByRequest("/api/product-statistics", "POST")).toMatchObject({
      httpMethod: "POST",
      uri: "/api/product-statistics",
      routeName: "product-statistics.store",
      controllerClass: "App\\Http\\Controllers\\Api\\ProductStatisticController",
      method: "store",
    });
    expect(index.findHttpRouteByRequest("/api/product-statistics/42", "PATCH")).toMatchObject({
      httpMethod: "PATCH",
      uri: "/api/product-statistics/{product_statistic}",
      routeName: "product-statistics.update",
      controllerClass: "App\\Http\\Controllers\\Api\\ProductStatisticController",
      method: "update",
    });
    expect(index.findHttpRouteByRequest("/api/product-statistics/42", "PATCH")?.controllerSource?.file).toContain(
      "ProductStatisticController.php",
    );
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
    expect(index.bladeComponentPropCompletions("user-card", "ti").map((item) => item.key)).toEqual(["title"]);
    expect(index.bladeComponentPropCompletions("alert", "me").map((item) => item.key)).toEqual(["message"]);
    expect(index.bladeComponentSlotCompletions("user-card", "fo").map((item) => item.key)).toEqual(["footer"]);
    expect(index.findBladeComponentProp("user-card", "highlighted")?.source.file).toContain("UserCard.php");
    expect(index.all("livewire-component").map((item) => item.key)).toEqual(
      expect.arrayContaining(["user-table", "admin.dashboard-widget"]),
    );
    expect(index.livewirePropertyCompletions("user-table", "sea").map((item) => item.key)).toEqual(["search"]);
    expect(index.livewireActionCompletions("user-table", "arch").map((item) => item.key)).toEqual(["archiveSelected"]);
    expect(index.findLivewireProperty("user-table", "showArchived")?.source.file).toContain("UserTable.php");
    expect(index.all("inertia-page").map((item) => item.key)).toEqual(
      expect.arrayContaining(["Users/Index"]),
    );
    expect(index.inertiaPropCompletions("Users/Index", "us").map((item) => item.key)).toEqual(["users"]);
    expect(index.inertiaPropCompletions("Users/Index", "se", ["filters"]).map((item) => item.key)).toEqual(["search"]);
    expect(index.findInertiaProp("Users/Index", ["filters", "search"])?.source.file).toContain("routes/web.php");
    expect(index.all("filament-resource").map((item) => item.key)).toEqual(
      expect.arrayContaining(["App\\Filament\\Resources\\UserResource"]),
    );
    expect(index.filamentResourceCompletions("User").map((item) => item.key)).toEqual([
      "App\\Filament\\Resources\\UserResource",
    ]);
    expect(index.findFilamentResourceByReference("UserResource")?.source.file).toContain("UserResource.php");
    expect(index.all("filament-page").map((item) => item.key)).toEqual(
      expect.arrayContaining(["App\\Filament\\Resources\\UserResource\\Pages\\ListUsers"]),
    );
    expect(index.filamentFieldCompletions("em").map((item) => item.key)).toEqual(["email"]);
    expect(index.filamentActionCompletions("arch").map((item) => item.key)).toEqual(["archive"]);
    expect(index.findFilamentAction("restore")?.source.file).toContain("ListUsers.php");
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
    expect(index.all("container-binding").map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "App\\Contracts\\PublisherInterface",
        "App\\Contracts\\FactoryPublisherInterface",
        "App\\Contracts\\ClosurePublisherInterface",
      ]),
    );
    expect(index.find("container-binding", "App\\Contracts\\PublisherInterface")).toMatchObject({
      abstractClass: "App\\Contracts\\PublisherInterface",
      concreteClass: "App\\Services\\DatabasePublisher",
      bindingKind: "bind",
    });
    expect(index.find("container-binding", "App\\Contracts\\PublisherInterface")?.concreteSource?.file).toContain("DatabasePublisher.php");
    expect(index.find("container-binding", "App\\Contracts\\FactoryPublisherInterface")).toMatchObject({
      abstractClass: "App\\Contracts\\FactoryPublisherInterface",
      concreteClass: "App\\Services\\FactoryPublisher",
      bindingKind: "singleton",
    });
    expect(index.find("container-binding", "App\\Contracts\\ClosurePublisherInterface")).toMatchObject({
      abstractClass: "App\\Contracts\\ClosurePublisherInterface",
      concreteClass: "App\\Services\\ClosurePublisher",
      bindingKind: "scoped",
    });
    expect(index.all("container-method").filter((item) => item.concreteClass === "App\\Services\\DatabasePublisher").map((item) => item.method)).toEqual(
      expect.arrayContaining(["publish", "status"]),
    );
    expect(index.findContainerMethodByAbstract("App\\Contracts\\FactoryPublisherInterface", "publishFromFactory")?.source.file).toContain(
      "FactoryPublisher.php",
    );
    expect(index.findContainerMethodByAbstract("App\\Contracts\\ClosurePublisherInterface", "publishFromClosure")?.source.file).toContain(
      "ClosurePublisher.php",
    );
    expect(index.all("container-method").map((item) => item.method)).not.toContain("internalState");
    expect(index.findContainerMethodByAbstract("PublisherInterface", "publish")).toMatchObject({
      concreteClass: "App\\Services\\DatabasePublisher",
      method: "publish",
    });
    expect(index.findContainerBindingByAbstract("PublisherInterface")?.concreteClass).toBe("App\\Services\\DatabasePublisher");
    expect(index.find("container-binding", "Illuminate\\Contracts\\Cache\\Factory")).toMatchObject({
      abstractClass: "Illuminate\\Contracts\\Cache\\Factory",
      concreteClass: "Illuminate\\Cache\\CacheManager",
      bindingKind: "laravel-core-alias",
    });
    expect(index.findContainerMethodByAbstract("Illuminate\\Contracts\\Cache\\Factory", "store")).toMatchObject({
      concreteClass: "Illuminate\\Cache\\CacheManager",
      method: "store",
    });
    expect(index.all("response-field").map((item) => `${item.responseHttpMethod} ${item.responseRouteUri} ${item.key}`)).toEqual(
      expect.arrayContaining([
        "GET /api/health ok",
        "GET /api/health status",
        "GET /api/health status.name",
        "POST /api/orders/{order}/cancel cancelled",
        "POST /api/orders/{order}/cancel order.id",
        "POST /api/product-statistics id",
        "POST /api/product-statistics name",
        "POST /api/product-statistics meta.source",
        "PATCH /api/product-statistics/{product_statistic} updated",
        "PATCH /api/product-statistics/{product_statistic} product.name",
        "GET /api/users/{user}/summary user",
        "GET /api/users/{user}/summary user.name",
        "GET /api/users/{user}/summary user.email",
        "GET /api/users/{user}/summary statusArray",
        "GET /api/users/{user}/resource-summary id",
        "GET /api/users/{user}/resource-summary name",
        "GET /api/users/{user}/resource-summary contact",
        "GET /api/users/{user}/resource-summary contact.email",
        "GET /api/users/{user}/resource-payload user.id",
        "GET /api/users/{user}/resource-payload user.name",
        "GET /api/users/{user}/resource-payload user.contact.email",
        "GET /api/users/{user}/resource-payload relatedUsers.id",
        "GET /api/users/{user}/resource-payload relatedUsers.contact.email",
        "GET /api/users/{user}/resource-collection data",
        "GET /api/users/{user}/resource-collection data.id",
        "GET /api/users/{user}/resource-collection data.contact.email",
        "GET /api/users/{user}/resource-collection meta.count",
      ]),
    );
    expect(index.frontendResponseCompletions({ kind: "url", value: "/api/health", method: "GET" }, "st").map((item) => item.key)).toEqual([
      "status",
      "status.name",
    ]);
    expect(index.frontendResponseCompletions({ kind: "url", value: "/api/health", method: "GET" }, "na", ["status"]).map((item) => item.key)).toEqual([
      "name",
    ]);
    expect(index.frontendResponseCompletions({ kind: "url", value: "/api/product-statistics", method: "POST" }, "na").map((item) => item.key)).toEqual([
      "name",
    ]);
    expect(index.frontendResponseCompletions({ kind: "route-name", value: "api.orders.cancel" }, "cancel").map((item) => item.key)).toEqual([
      "cancelled",
    ]);
    expect(index.frontendResponseCompletions({ kind: "route-name", value: "api.users.summary" }, "status").map((item) => item.key)).toEqual([
      "statusArray",
    ]);
    expect(index.frontendResponseCompletions({ kind: "route-name", value: "api.users.resource-summary" }, "co").map((item) => item.key)).toEqual([
      "contact",
      "contact.email",
    ]);
    expect(index.frontendResponseCompletions({ kind: "route-name", value: "api.users.resource-collection" }, "co", ["data"]).map((item) => item.key)).toEqual([
      "contact",
      "contact.email",
    ]);
    expect(index.frontendResponseField({ kind: "route-name", value: "api.users.resource-summary" }, ["contact", "email"])).toMatchObject({
      responseSourceKind: "json-resource",
      responseSourceClass: "App\\Http\\Resources\\UserSummaryResource",
    });
    expect(index.frontendResponseField({ kind: "route-name", value: "api.users.resource-collection" }, ["meta", "count"])).toMatchObject({
      responseSourceKind: "resource-collection",
      responseSourceClass: "App\\Http\\Resources\\UserSummaryCollection",
    });
    expect(index.frontendResponseCompletions({ kind: "url", value: "/api/users/42/summary", method: "GET" }, "em", ["user"]).map((item) => item.key)).toEqual([
      "email",
      "email_verified_at",
    ]);
    expect(index.findContainerBindingByAbstract("Psr\\SimpleCache\\CacheInterface")?.concreteClass).toBe("Illuminate\\Cache\\Repository");
    expect(index.all("artisan-command").map((item) => item.key)).toEqual(
      expect.arrayContaining(["reports:send", "reports:cleanup"]),
    );
    expect(index.find("artisan-command", "reports:send")).toMatchObject({
      commandClass: "App\\Console\\Commands\\SendReportsCommand",
      detail: "Artisan command App\\Console\\Commands\\SendReportsCommand",
    });
    expect(index.find("artisan-command", "reports:send")?.source.file).toContain("SendReportsCommand.php");
    expect(index.find("artisan-command", "reports:cleanup")?.source.file).toContain("CleanupReportsCommand.php");
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
    expect(index.eloquentFieldCompletions(path.join(fixtureRoot, "routes", "web.php"), "em", "Route")).toEqual([]);
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
    expect(index.eloquentMemberCompletions(path.join(fixtureRoot, "routes", "web.php"), "em", "User").map((item) => item.key)).toEqual([
      "email",
      "email_verified_at",
    ]);
    expect(index.eloquentMemberCompletions(path.join(fixtureRoot, "routes", "web.php"), "po", "User").map((item) => item.key)).toEqual([
      "posts",
    ]);
    expect(index.eloquentMemberCompletions(path.join(fixtureRoot, "routes", "web.php"), "em", "Route")).toEqual([]);
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
    expect(index.findEloquentField("User", "email")?.source.file).toContain("2024_01_01_000000_create_users_table.php");
    expect(index.findEloquentRelation("User", "posts")?.source.file).toContain("User.php");
    expect(index.findEloquentField("Route", "email")).toBeUndefined();
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
      "users.spa",
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
