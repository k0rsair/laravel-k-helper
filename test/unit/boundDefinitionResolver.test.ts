import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LaravelIndex } from "../../src/indexer";
import type { SourceLocation } from "../../src/indexer/types";
import { MemoryLogger } from "../../src/logging/logger";
import { resolveBoundImplementationDefinition } from "../../src/providers/boundDefinitionResolver";

const fixtureRoot = path.resolve(__dirname, "../fixtures/laravel-basic");

describe("bound implementation definition resolver", () => {
  it("resolves app(Contract::class)->method() to the bound concrete method", async () => {
    const { index, logger } = await indexedFixture();
    const workflowFile = path.join(fixtureRoot, "app/Services/PublishingWorkflow.php");
    const text = readFileSync(workflowFile, "utf8");

    const source = resolveBoundImplementationDefinition(index, logger, text, offsetAt(text, "app(PublisherInterface::class)->publish", "publish"));

    expect(source?.file).toBe(path.join(fixtureRoot, "app/Services/DatabasePublisher.php"));
    expectSourceWord(source, "publish");
  });

  it("resolves constructor-promoted contract properties to the bound concrete method", async () => {
    const { index, logger } = await indexedFixture();
    const workflowFile = path.join(fixtureRoot, "app/Services/PublishingWorkflow.php");
    const text = readFileSync(workflowFile, "utf8");

    const source = resolveBoundImplementationDefinition(index, logger, text, offsetAt(text, "$this->publisher->publish", "publish"));

    expect(source?.file).toBe(path.join(fixtureRoot, "app/Services/DatabasePublisher.php"));
    expectSourceWord(source, "publish");
  });

  it("does not depend on the receiver property name matching the contract name", async () => {
    const { index, logger } = await indexedFixture();
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

    const directSource = resolveBoundImplementationDefinition(
      index,
      logger,
      text,
      offsetAt(text, "app(MsOrderSenderContruct::class)->publish", "publish"),
    );
    const propertySource = resolveBoundImplementationDefinition(
      index,
      logger,
      text,
      offsetAt(text, "$this->msOrderSenderContruct->publish", "publish"),
    );

    expect(directSource?.file).toBe(path.join(fixtureRoot, "app/Services/DatabasePublisher.php"));
    expect(propertySource?.file).toBe(path.join(fixtureRoot, "app/Services/DatabasePublisher.php"));
  });

  it("resolves factory-style provider bindings to concrete methods", async () => {
    const { index, logger } = await indexedFixture();
    const text = `<?php

namespace App\\Services;

use App\\Contracts\\FactoryPublisherInterface;
use App\\Contracts\\ClosurePublisherInterface;

class FactoryWorkflow
{
    public function run(
        FactoryPublisherInterface $factoryPublisher,
        ClosurePublisherInterface $closurePublisher,
    ): bool {
        $first = $factoryPublisher->publishFromFactory('factory');
        $second = $closurePublisher->publishFromClosure('closure');

        return $first && $second;
    }
}
`;

    const factorySource = resolveBoundImplementationDefinition(
      index,
      logger,
      text,
      offsetAt(text, "$factoryPublisher->publishFromFactory", "publishFromFactory"),
    );
    const closureSource = resolveBoundImplementationDefinition(
      index,
      logger,
      text,
      offsetAt(text, "$closurePublisher->publishFromClosure", "publishFromClosure"),
    );

    expect(factorySource?.file).toBe(path.join(fixtureRoot, "app/Services/FactoryPublisher.php"));
    expect(closureSource?.file).toBe(path.join(fixtureRoot, "app/Services/ClosurePublisher.php"));
  });
});

async function indexedFixture() {
  const logger = new MemoryLogger();
  const index = new LaravelIndex(fixtureRoot, logger);
  await index.reindex();
  return { index, logger };
}

function offsetAt(text: string, fragment: string, word: string): number {
  const fragmentStart = text.indexOf(fragment);
  if (fragmentStart < 0) {
    throw new Error(`Missing test fragment: ${fragment}`);
  }
  const wordStart = fragmentStart + fragment.lastIndexOf(word);
  return wordStart + Math.floor(word.length / 2);
}

function expectSourceWord(source: SourceLocation | undefined, word: string): void {
  expect(source).toBeDefined();
  expect(readFileSync(source?.file ?? "", "utf8").slice(source?.offset ?? 0)).toMatch(new RegExp(`^${word}\\b`));
}
