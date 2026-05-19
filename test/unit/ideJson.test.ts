import { describe, expect, it } from "vitest";
import { composerConstraintMatches, normalizeIdeJsonRules } from "../../src/indexer/ideJson";

describe("ide.json rules", () => {
  it("normalizes supported completion rules", () => {
    expect(
      normalizeIdeJsonRules({
        completions: [
          { function: "foo", parameter: 0, kind: "routeName" },
          { function: "bar", parameter: 1, kind: "staticStrings", values: ["one", "two"] },
          { method: "Builder::where", parameter: 1, kind: "configKey", package: "laravel/framework", version: "^11.0" },
          { constructor: "App\\DTO", parameter: 0, kind: "viewName" },
          { arrayKey: "*", kind: "staticStrings", values: ["driver"] },
          { arrayValue: "driver", kind: "filesystemDisk" },
          { function: "broken", kind: "missingKind" },
        ],
      }),
    ).toEqual([
      { target: "function", name: "foo", parameter: 0, kind: "routeName", values: undefined, package: undefined },
      { target: "function", name: "bar", parameter: 1, kind: "staticStrings", values: ["one", "two"], package: undefined },
      {
        target: "method",
        name: "Builder::where",
        parameter: 1,
        kind: "configKey",
        values: undefined,
        package: "laravel/framework",
        version: "^11.0",
      },
      { target: "constructor", name: "App\\DTO", parameter: 0, kind: "viewName", values: undefined, package: undefined, version: undefined },
      { target: "arrayKey", name: "*", parameter: 0, kind: "staticStrings", values: ["driver"], package: undefined, version: undefined },
      { target: "arrayValue", name: "driver", parameter: 0, kind: "filesystemDisk", values: undefined, package: undefined, version: undefined },
    ]);
  });

  it("matches simple Composer major version constraints", () => {
    expect(composerConstraintMatches("^11.0", "^11.0")).toBe(true);
    expect(composerConstraintMatches("^11.0", "^12.0")).toBe(false);
    expect(composerConstraintMatches("^11.0", "^10.0 || ^11.0 || ^12.0")).toBe(true);
    expect(composerConstraintMatches("11.4.2", ">=10.0")).toBe(true);
    expect(composerConstraintMatches("11.4.2", ">=10.0 <12.0")).toBe(true);
    expect(composerConstraintMatches("11.4.2", "<12.0")).toBe(true);
    expect(composerConstraintMatches("11.4.2", "<11.0")).toBe(false);
  });
});
