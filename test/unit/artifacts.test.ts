import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLaravelArtifact } from "../../src/generators/artifacts";

describe("Laravel artifact generation", () => {
  const projectRoot = path.resolve(__dirname, "../fixtures/laravel-basic");

  it("builds controller previews with validated class names", () => {
    const artifact = buildLaravelArtifact(projectRoot, "controller", "Admin/ReportController");

    expect(artifact.relativePath).toBe(path.join("app", "Http", "Controllers", "Admin", "ReportController.php"));
    expect(artifact.namespace).toBe("App\\Http\\Controllers\\Admin");
    expect(artifact.content).toContain("class ReportController");
    expect(artifact.content).toContain("public function __invoke(Request $request)");
  });

  it("builds form request previews", () => {
    const artifact = buildLaravelArtifact(projectRoot, "form-request", "StorePostRequest");

    expect(artifact.relativePath).toBe(path.join("app", "Http", "Requests", "StorePostRequest.php"));
    expect(artifact.content).toContain("extends FormRequest");
    expect(artifact.content).toContain("public function rules(): array");
  });

  it("rejects unsafe artifact names", () => {
    expect(() => buildLaravelArtifact(projectRoot, "controller", "../BadController")).toThrow("Artifact names");
    expect(() => buildLaravelArtifact(projectRoot, "controller", "badController")).toThrow("Artifact names");
  });
});
