import path from "node:path";
import { describe, expect, it } from "vitest";
import { LaravelIndex } from "../../src/indexer";
import { MemoryLogger } from "../../src/logging/logger";
import { resolveBoundImplementationLinks } from "../../src/providers/boundDefinitionLinks";

const fixtureRoot = path.resolve(__dirname, "../fixtures/laravel-basic");

describe("bound implementation document links", () => {
  it("adds concrete links for direct app calls and injected contract properties", async () => {
    const logger = new MemoryLogger();
    const index = new LaravelIndex(fixtureRoot, logger);
    await index.reindex();

    const text = `<?php

namespace App\\Services;

use App\\Contracts\\PublisherInterface as MsOrderSenderContruct;

class OrderWorkflow
{
    public function __construct(private readonly MsOrderSenderContruct $msOrderSenderContruct)
    {
    }

    public function run(): bool
    {
        $direct = app(MsOrderSenderContruct::class)->publish('direct');
        $property = $this->msOrderSenderContruct->publish('property');

        return $direct && $property;
    }
}
`;

    const links = resolveBoundImplementationLinks(index, logger, text);
    const linkedWords = links.map((link) => text.slice(link.start, link.end));

    expect(linkedWords).toEqual(expect.arrayContaining(["MsOrderSenderContruct", "publish"]));
    expect(links.filter((link) => text.slice(link.start, link.end) === "publish").map((link) => link.source.file)).toEqual([
      path.join(fixtureRoot, "app/Services/DatabasePublisher.php"),
      path.join(fixtureRoot, "app/Services/DatabasePublisher.php"),
    ]);
  });
});
