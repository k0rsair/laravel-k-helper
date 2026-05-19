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
      expect.arrayContaining(["home", "users.index", "users.store"]),
    );
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
    expect(index.all("validation-rule").map((item) => item.key)).toEqual(
      expect.arrayContaining(["required", "email", "unique", "timezone", "uppercase"]),
    );
    expect(index.all("request-field").map((item) => item.key)).toEqual(
      expect.arrayContaining(["name", "email", "profile.timezone"]),
    );
    expect(index.all("filesystem-disk").map((item) => item.key)).toEqual(
      expect.arrayContaining(["local", "public", "s3", "project_uploads"]),
    );
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
    expect(index.all("controller-method").map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "App\\Http\\Controllers\\Api\\LabelsController::getLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::storeLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::importedLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::chainedLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::nestedLabel",
        "App\\Http\\Controllers\\Api\\LabelsController::arrayLabel",
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
