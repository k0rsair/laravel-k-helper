import { describe, expect, it } from "vitest";
import { shouldAutoTriggerLaravelSuggest } from "../../src/context/autoSuggestContext";

describe("Laravel auto suggest trigger", () => {
  it("triggers when typing inside an existing Laravel helper string", () => {
    expect(
      shouldAutoTriggerLaravelSuggest({
        languageId: "php",
        insertedText: "u",
        linePrefix: "return route('u",
        documentPrefix: "<?php\nreturn route('u",
      }),
    ).toBe(true);
  });

  it("triggers for multiline Eloquent model attribute arrays", () => {
    expect(
      shouldAutoTriggerLaravelSuggest({
        languageId: "php",
        insertedText: "e",
        linePrefix: "        'e",
        documentPrefix: "<?php\nclass User extends Model {\n    protected $fillable = [\n        'e",
      }),
    ).toBe(true);
  });

  it("triggers for Blade and Livewire tag prefixes", () => {
    expect(
      shouldAutoTriggerLaravelSuggest({
        languageId: "blade",
        insertedText: "u",
        linePrefix: "<x-u",
        documentPrefix: "<x-u",
      }),
    ).toBe(true);

    expect(
      shouldAutoTriggerLaravelSuggest({
        languageId: "blade",
        insertedText: "a",
        linePrefix: "<livewire:a",
        documentPrefix: "<livewire:a",
      }),
    ).toBe(true);
  });

  it("does not trigger for plain strings or non-insert edits", () => {
    expect(
      shouldAutoTriggerLaravelSuggest({
        languageId: "php",
        insertedText: "h",
        linePrefix: "return 'h",
        documentPrefix: "<?php\nreturn 'h",
      }),
    ).toBe(false);

    expect(
      shouldAutoTriggerLaravelSuggest({
        languageId: "php",
        insertedText: "",
        linePrefix: "return route('",
        documentPrefix: "<?php\nreturn route('",
      }),
    ).toBe(false);
  });
});
