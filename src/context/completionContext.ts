import type { LaravelIndexKind } from "../indexer/types";

export interface StringContext {
  kind: LaravelIndexKind;
  prefix: string;
  rangeStart: number;
  rangeEnd: number;
}

export interface IdeJsonStringContext {
  target: "function" | "method" | "constructor" | "arrayKey" | "arrayValue";
  name: string;
  parameter: number;
  prefix: string;
}

const PHP_HELPER_CONTEXTS: Array<{ kind: LaravelIndexKind; regex: RegExp }> = [
  { kind: "route", regex: /\broute\(\s*['"]([^'"]*)$/ },
  { kind: "view", regex: /\bview\(\s*['"]([^'"]*)$/ },
  { kind: "config", regex: /\bconfig\(\s*['"]([^'"]*)$/ },
  { kind: "translation", regex: /\b(?:__|trans)\(\s*['"]([^'"]*)$/ },
  { kind: "env", regex: /\benv\(\s*['"]([^'"]*)$/ },
  { kind: "filesystem-disk", regex: /\bStorage::disk\(\s*['"]([^'"]*)$/ },
  { kind: "request-field", regex: /\b(?:old|request)\(\s*['"]([^'"]*)$/ },
  { kind: "request-field", regex: /\$request->(?:input|get|string|boolean|integer|float|date|validated)\(\s*['"]([^'"]*)$/ },
];

const BLADE_HELPER_CONTEXTS: Array<{ kind: LaravelIndexKind; regex: RegExp }> = [
  ...PHP_HELPER_CONTEXTS,
  { kind: "translation", regex: /@lang\(\s*['"]([^'"]*)$/ },
  { kind: "view", regex: /@(include|extends|component)\(\s*['"]([^'"]*)$/ },
];

export function resolveStringContext(linePrefix: string, languageId: string): StringContext | undefined {
  const validationContext = resolveValidationRuleContext(linePrefix);
  if (validationContext) {
    return validationContext;
  }
  const routeActionContext = resolveRouteActionContext(linePrefix);
  if (routeActionContext) {
    return routeActionContext;
  }

  const contexts = languageId === "blade" ? BLADE_HELPER_CONTEXTS : PHP_HELPER_CONTEXTS;

  for (const context of contexts) {
    const match = context.regex.exec(linePrefix);
    if (!match) {
      continue;
    }

    const prefix = match[match.length - 1] ?? "";
    return {
      kind: context.kind,
      prefix,
      rangeStart: linePrefix.length - prefix.length,
      rangeEnd: linePrefix.length,
    };
  }

  return undefined;
}

export function resolveRouteActionContext(linePrefix: string): StringContext | undefined {
  const match =
    /Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*['"]([^'"]*)$/.exec(
      linePrefix,
    );
  if (!match) {
    return undefined;
  }

  const prefix = match[1] ?? "";
  return {
    kind: "route-action",
    prefix,
    rangeStart: linePrefix.length - prefix.length,
    rangeEnd: linePrefix.length,
  };
}

export function resolveValidationRuleContext(linePrefix: string): StringContext | undefined {
  const match = /=>\s*['"]([^'"]*)$/.exec(linePrefix);
  if (!match) {
    return undefined;
  }

  const fullValue = match[1] ?? "";
  const prefix = fullValue.split("|").pop() ?? "";
  const rangeEnd = linePrefix.length;

  return {
    kind: "validation-rule",
    prefix,
    rangeStart: rangeEnd - prefix.length,
    rangeEnd,
  };
}

export function resolveBladeComponentPrefix(linePrefix: string): { prefix: string; start: number } | undefined {
  const match = /<x-([A-Za-z0-9_.:-]*)$/.exec(linePrefix);
  if (!match) {
    return undefined;
  }

  return {
    prefix: match[1].replace(/-/g, "."),
    start: linePrefix.length - match[1].length,
  };
}

export function extractQuotedStringAtOffset(line: string, offset: number): { value: string; start: number; end: number } | undefined {
  const before = line.slice(0, offset);
  const quoteStart = Math.max(before.lastIndexOf("'"), before.lastIndexOf('"'));
  if (quoteStart < 0) {
    return undefined;
  }

  const quote = line[quoteStart];
  const quoteEnd = line.indexOf(quote, quoteStart + 1);
  if (quoteEnd < offset) {
    return undefined;
  }

  return {
    value: line.slice(quoteStart + 1, quoteEnd),
    start: quoteStart + 1,
    end: quoteEnd,
  };
}

export function resolveIdeJsonStringContext(linePrefix: string): IdeJsonStringContext | undefined {
  const quoteMatch = /['"]([^'"]*)$/.exec(linePrefix);
  if (quoteMatch?.index === undefined) {
    return undefined;
  }

  const beforeQuote = linePrefix.slice(0, quoteMatch.index);
  const prefix = quoteMatch[1] ?? "";
  const arrayValue = resolveIdeJsonArrayValueContext(beforeQuote, prefix);
  if (arrayValue) {
    return arrayValue;
  }
  const arrayKey = resolveIdeJsonArrayKeyContext(beforeQuote, prefix);
  if (arrayKey) {
    return arrayKey;
  }
  const constructor = resolveIdeJsonConstructorContext(beforeQuote, prefix);
  if (constructor) {
    return constructor;
  }
  const method = resolveIdeJsonMethodContext(beforeQuote, prefix);
  if (method) {
    return method;
  }

  const callMatch = /([A-Za-z_\\][A-Za-z0-9_\\]*)\s*\(([^()]*)$/.exec(beforeQuote);
  if (!callMatch) {
    return undefined;
  }

  const argsBeforeCurrent = callMatch[2] ?? "";
  return {
    target: "function",
    name: callMatch[1] ?? "",
    parameter: countTopLevelCommas(argsBeforeCurrent),
    prefix,
  };
}

function resolveIdeJsonMethodContext(beforeQuote: string, prefix: string): IdeJsonStringContext | undefined {
  const staticMatch = /([A-Za-z_\\][A-Za-z0-9_\\]*)::([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)$/.exec(beforeQuote);
  if (staticMatch) {
    return {
      target: "method",
      name: `${staticMatch[1] ?? ""}::${staticMatch[2] ?? ""}`,
      parameter: countTopLevelCommas(staticMatch[3] ?? ""),
      prefix,
    };
  }

  const objectMatch = /->([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)$/.exec(beforeQuote);
  if (!objectMatch) {
    return undefined;
  }

  return {
    target: "method",
    name: objectMatch[1] ?? "",
    parameter: countTopLevelCommas(objectMatch[2] ?? ""),
    prefix,
  };
}

function resolveIdeJsonConstructorContext(beforeQuote: string, prefix: string): IdeJsonStringContext | undefined {
  const match = /new\s+([A-Za-z_\\][A-Za-z0-9_\\]*)\s*\(([^()]*)$/.exec(beforeQuote);
  if (!match) {
    return undefined;
  }

  return {
    target: "constructor",
    name: match[1] ?? "",
    parameter: countTopLevelCommas(match[2] ?? ""),
    prefix,
  };
}

function resolveIdeJsonArrayValueContext(beforeQuote: string, prefix: string): IdeJsonStringContext | undefined {
  const match = /['"]([^'"]+)['"]\s*=>\s*$/.exec(beforeQuote);
  if (!match) {
    return undefined;
  }

  return {
    target: "arrayValue",
    name: match[1] ?? "",
    parameter: 0,
    prefix,
  };
}

function resolveIdeJsonArrayKeyContext(beforeQuote: string, prefix: string): IdeJsonStringContext | undefined {
  if (beforeQuote.lastIndexOf("(") > beforeQuote.lastIndexOf("[")) {
    return undefined;
  }
  if (!/^\s*$|[\[,{]\s*$/.test(beforeQuote)) {
    return undefined;
  }

  return {
    target: "arrayKey",
    name: "*",
    parameter: 0,
    prefix,
  };
}

function countTopLevelCommas(value: string): number {
  let commas = 0;
  let quote: string | undefined;
  let escaped = false;

  for (const char of value) {
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
    } else if (char === ",") {
      commas += 1;
    }
  }

  return commas;
}
