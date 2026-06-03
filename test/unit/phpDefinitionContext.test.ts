import { describe, expect, it } from "vitest";
import { resolveBoundImplementationDefinitionContext } from "../../src/context/phpDefinitionContext";

const phpText = `<?php

namespace App\\Services;

use App\\Contracts\\PublisherInterface;
use App\\Contracts\\{PublisherInterface as GroupedPublisherInterface};

class PublishingWorkflow
{
    private ?PublisherInterface $nullablePublisher = null;

    public function __construct(private readonly PublisherInterface $publisher, ?PublisherInterface $nullablePublisher = null)
    {
        $this->nullablePublisher = $nullablePublisher;
    }

    public function run(PublisherInterface $publisher): bool
    {
        $local = $publisher->publish('local');
        $property = $this->publisher->publish('property');
        $container = app(PublisherInterface::class)->publish('container');
        $made = app()->make(PublisherInterface::class)->status();
        $nullable = $this->nullablePublisher->publish('nullable');
        $spaced = $this->publisher
            ->status();
        $unknown->publish('miss');

        return $local && $property && $container && $made && $nullable && $spaced;
    }

    public function grouped(GroupedPublisherInterface $groupedPublisher): bool
    {
        return $groupedPublisher->publish('grouped');
    }

}
`;

describe("PHP bound implementation definition context", () => {
  it("resolves method calls on typed parameters", () => {
    expect(resolveAt("$publisher->publish")).toMatchObject({
      kind: "method",
      abstractClass: "App\\Contracts\\PublisherInterface",
      method: "publish",
      receiver: "$publisher",
    });
  });

  it("resolves method calls on constructor-promoted properties", () => {
    expect(resolveAt("$this->publisher->publish")).toMatchObject({
      kind: "method",
      abstractClass: "App\\Contracts\\PublisherInterface",
      method: "publish",
      receiver: "$this->publisher",
    });
  });

  it("resolves method calls on multiline constructor-promoted property chains", () => {
    expect(resolveAt("$this->publisher\n            ->status", "status")).toMatchObject({
      kind: "method",
      abstractClass: "App\\Contracts\\PublisherInterface",
      method: "status",
      receiver: "$this->publisher",
    });
  });

  it("resolves method calls on properties assigned from nullable typed variables", () => {
    expect(resolveAt("$this->nullablePublisher->publish")).toMatchObject({
      kind: "method",
      abstractClass: "App\\Contracts\\PublisherInterface",
      method: "publish",
      receiver: "$this->nullablePublisher",
    });
  });

  it("resolves grouped use aliases for typed parameters", () => {
    expect(resolveAt("$groupedPublisher->publish")).toMatchObject({
      kind: "method",
      abstractClass: "App\\Contracts\\PublisherInterface",
      method: "publish",
      receiver: "$groupedPublisher",
    });
  });

  it("resolves direct container make/app method calls", () => {
    expect(resolveAt("app(PublisherInterface::class)->publish", "publish")).toMatchObject({
      kind: "method",
      abstractClass: "App\\Contracts\\PublisherInterface",
      method: "publish",
      receiver: "container",
    });
    expect(resolveAt("app()->make(PublisherInterface::class)->status", "status")).toMatchObject({
      kind: "method",
      abstractClass: "App\\Contracts\\PublisherInterface",
      method: "status",
      receiver: "container",
    });
  });

  it("resolves class references under the cursor", () => {
    expect(resolveAt("PublisherInterface::class", "PublisherInterface")).toMatchObject({
      kind: "class",
      abstractClass: "App\\Contracts\\PublisherInterface",
    });
  });

  it("returns a structured miss reason for untyped receivers", () => {
    expect(resolveAt("$unknown->publish")).toMatchObject({
      kind: "none",
      reason: "no-typed-receiver",
    });
  });
});

function resolveAt(fragment: string, word?: string) {
  const fragmentStart = phpText.indexOf(fragment);
  if (fragmentStart < 0) {
    throw new Error(`Missing test fragment: ${fragment}`);
  }
  const target = word ?? fragment.split("->").pop() ?? fragment;
  const wordStart = fragmentStart + fragment.lastIndexOf(target);
  return resolveBoundImplementationDefinitionContext(phpText, wordStart + Math.floor(target.length / 2));
}
