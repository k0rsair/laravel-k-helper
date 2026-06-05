import path from "node:path";
import { describe, expect, it } from "vitest";
import { LaravelIndex } from "../../src/indexer";
import { MemoryLogger } from "../../src/logging/logger";
import { buildModelDiagnosticFindings } from "../../src/diagnostics/modelDiagnostics";

const fixtureRoot = path.resolve(__dirname, "../fixtures/laravel-basic");

describe("model diagnostics", () => {
  it("reports unknown fillable keys and suspicious cast mismatches", async () => {
    const logger = new MemoryLogger();
    const index = new LaravelIndex(fixtureRoot, logger);

    await index.reindex();
    const findings = await buildModelDiagnosticFindings(index, logger);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unknown-fillable",
          message: expect.stringContaining('nickname'),
        }),
        expect.objectContaining({
          code: "cast-type-mismatch",
          message: expect.stringContaining('is_active'),
        }),
        expect.objectContaining({
          code: "unknown-cast-key",
          message: expect.stringContaining('preferences'),
        }),
      ]),
    );
  });
});
