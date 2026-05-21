import {
  resolveBladeComponentPrefix,
  resolveEloquentCastTypeContext,
  resolveEloquentModelAttributeContext,
  resolveIdeJsonStringContext,
  resolveLivewireComponentPrefix,
  resolveStringContext,
} from "./completionContext";

const SUPPORTED_LANGUAGES = new Set(["php", "blade"]);
const COMPLETION_INSERTION = /^[A-Za-z0-9_\\\\./:-]+$/;

export interface LaravelSuggestSnapshot {
  languageId: string;
  insertedText: string;
  linePrefix: string;
  documentPrefix: string;
}

export function shouldAutoTriggerLaravelSuggest(snapshot: LaravelSuggestSnapshot): boolean {
  if (!SUPPORTED_LANGUAGES.has(snapshot.languageId) || !isCompletionInsertion(snapshot.insertedText)) {
    return false;
  }

  if (snapshot.languageId === "blade") {
    if (resolveBladeComponentPrefix(snapshot.linePrefix) || resolveLivewireComponentPrefix(snapshot.linePrefix)) {
      return true;
    }

    return Boolean(resolveStringContext(snapshot.linePrefix, snapshot.languageId));
  }

  const stringContext =
    resolveEloquentCastTypeContext(snapshot.documentPrefix, snapshot.linePrefix) ??
    resolveEloquentModelAttributeContext(snapshot.documentPrefix, snapshot.linePrefix) ??
    resolveStringContext(snapshot.linePrefix, snapshot.languageId);

  return Boolean(stringContext ?? resolveIdeJsonStringContext(snapshot.linePrefix));
}

export function isCompletionInsertion(text: string): boolean {
  return COMPLETION_INSERTION.test(text);
}
