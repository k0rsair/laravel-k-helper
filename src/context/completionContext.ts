import type { LaravelIndexKind } from "../indexer/types";

export interface StringContext {
  kind: LaravelIndexKind;
  prefix: string;
  rangeStart: number;
  rangeEnd: number;
  modelClass?: string;
  controllerClass?: string;
  table?: string;
  relationPath?: string[];
  castAttribute?: string;
}

export interface IdeJsonStringContext {
  target: "function" | "method" | "constructor" | "arrayKey" | "arrayValue";
  name: string;
  parameter: number;
  prefix: string;
}

export interface EloquentRelationConstraintContext {
  modelClass: string;
  relationPath: string[];
}

const PHP_HELPER_CONTEXTS: Array<{ kind: LaravelIndexKind; regex: RegExp }> = [
  { kind: "route", regex: /\broute\(\s*['"]([^'"]*)$/ },
  { kind: "view", regex: /\bview\(\s*['"]([^'"]*)$/ },
  { kind: "config", regex: /\bconfig\(\s*['"]([^'"]*)$/ },
  { kind: "translation", regex: /\b(?:__|trans)\(\s*['"]([^'"]*)$/ },
  { kind: "env", regex: /\benv\(\s*['"]([^'"]*)$/ },
  { kind: "filesystem-disk", regex: /\bStorage::disk\(\s*['"]([^'"]*)$/ },
  { kind: "database-table", regex: /\b(?:Schema::(?:create|table)|DB::table)\(\s*['"]([^'"]*)$/ },
  { kind: "request-field", regex: /\b(?:old|request)\(\s*['"]([^'"]*)$/ },
  { kind: "request-field", regex: /\$request->(?:input|get|string|boolean|integer|float|date|validated)\(\s*['"]([^'"]*)$/ },
  { kind: "livewire-component", regex: /\bLivewire::mount\(\s*['"]([^'"]*)$/ },
  { kind: "inertia-page", regex: /\b(?:Inertia::render|inertia)\(\s*['"]([^'"]*)$/ },
  { kind: "inertia-page", regex: /\bRoute::inertia\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]*)$/ },
];

const BLADE_HELPER_CONTEXTS: Array<{ kind: LaravelIndexKind; regex: RegExp }> = [
  ...PHP_HELPER_CONTEXTS,
  { kind: "livewire-component", regex: /@livewire\(\s*['"]([^'"]*)$/ },
  { kind: "translation", regex: /@lang\(\s*['"]([^'"]*)$/ },
  { kind: "view", regex: /@(include|extends|component)\(\s*['"]([^'"]*)$/ },
];

const STATIC_RELATION_METHODS =
  "with|withWhereHas|withCount|withExists|withAvg|withMax|withMin|withSum|has|orHas|doesntHave|orDoesntHave|whereHas|orWhereHas|whereDoesntHave|orWhereDoesntHave|whereRelation|orWhereRelation|whereMorphRelation|orWhereMorphRelation|whereHasMorph|orWhereHasMorph|whereDoesntHaveMorph|orWhereDoesntHaveMorph|hasMorph|orHasMorph|doesntHaveMorph|orDoesntHaveMorph";
const OBJECT_RELATION_METHODS =
  "with|withWhereHas|withCount|withExists|withAvg|withMax|withMin|withSum|has|orHas|doesntHave|orDoesntHave|whereHas|orWhereHas|whereDoesntHave|orWhereDoesntHave|whereRelation|orWhereRelation|whereMorphRelation|orWhereMorphRelation|whereHasMorph|orWhereHasMorph|whereDoesntHaveMorph|orWhereDoesntHaveMorph|hasMorph|orHasMorph|doesntHaveMorph|orDoesntHaveMorph|load|loadMissing|loadCount|loadExists|loadAvg|loadMax|loadMin|loadSum";
const DATABASE_COLUMN_METHODS =
  "where|orWhere|whereDate|whereTime|whereNull|whereNotNull|whereIn|whereNotIn|orderBy|latest|oldest|select|addSelect|pluck|value|groupBy|having|orHaving";
const ELOQUENT_FIELD_METHODS =
  "where|orWhere|whereDate|whereTime|whereNull|whereNotNull|whereIn|whereNotIn|orderBy|latest|oldest|select|addSelect|pluck|value|groupBy|having|orHaving";
const STATIC_BUILDER_PREFIX =
  "\\b([A-Za-z_\\\\][A-Za-z0-9_\\\\]*)::(?:[A-Za-z_][A-Za-z0-9_]*\\([^)]*\\)(?:->[A-Za-z_][A-Za-z0-9_]*\\([^)]*\\))*->)?";

export function resolveStringContext(linePrefix: string, languageId: string): StringContext | undefined {
  const filesystemDiskContext = resolveFilesystemDiskContext(linePrefix);
  if (filesystemDiskContext) {
    return filesystemDiskContext;
  }
  const validationContext = resolveValidationRuleContext(linePrefix);
  if (validationContext) {
    return validationContext;
  }
  const routeMiddlewareContext = resolveRouteMiddlewareContext(linePrefix);
  if (routeMiddlewareContext) {
    return routeMiddlewareContext;
  }
  const databaseColumnContext = resolveDatabaseColumnContext(linePrefix);
  if (databaseColumnContext) {
    return databaseColumnContext;
  }
  const eloquentCastTypeContext = resolveEloquentCastTypeContext(linePrefix, linePrefix);
  if (eloquentCastTypeContext) {
    return eloquentCastTypeContext;
  }
  const eloquentFieldContext = resolveEloquentFieldContext(linePrefix);
  if (eloquentFieldContext) {
    return eloquentFieldContext;
  }
  const eloquentRelationContext = resolveEloquentRelationContext(linePrefix);
  if (eloquentRelationContext) {
    return eloquentRelationContext;
  }
  const eloquentFactoryStateContext = resolveEloquentFactoryStateContext(linePrefix);
  if (eloquentFactoryStateContext) {
    return eloquentFactoryStateContext;
  }
  const eloquentScopeContext = resolveEloquentScopeContext(linePrefix);
  if (eloquentScopeContext) {
    return eloquentScopeContext;
  }
  const routeActionContext = resolveRouteActionContext(linePrefix);
  if (routeActionContext) {
    return routeActionContext;
  }
  const filamentResourceContext = resolveFilamentResourceContext(linePrefix);
  if (filamentResourceContext) {
    return filamentResourceContext;
  }
  const novaResourceContext = resolveNovaResourceContext(linePrefix);
  if (novaResourceContext) {
    return novaResourceContext;
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

export function resolveEloquentModelAttributeContext(textPrefix: string, linePrefix: string = textPrefix): StringContext | undefined {
  const valueMatch = /['"]([^'"]*)$/.exec(textPrefix);
  if (!valueMatch || valueMatch.index === undefined) {
    return undefined;
  }

  const prefix = valueMatch[1] ?? "";
  const quoteIndex = textPrefix.length - prefix.length - 1;
  const beforeString = textPrefix.slice(0, quoteIndex);
  if (/=>\s*$/.test(beforeString)) {
    return undefined;
  }

  const block = findNearestModelAttributeBlock(beforeString);
  if (!block) {
    return undefined;
  }

  return {
    kind: "eloquent-field",
    prefix,
    rangeStart: linePrefix.length - prefix.length,
    rangeEnd: linePrefix.length,
  };
}

export function resolveEloquentCastTypeContext(textPrefix: string, linePrefix: string = textPrefix): StringContext | undefined {
  const castValueMatch = /['"]([A-Za-z0-9_.-]+)['"]\s*=>\s*['"]([^'"]*)$/.exec(textPrefix);
  if (!castValueMatch || castValueMatch.index === undefined) {
    return undefined;
  }

  const block = findNearestModelAttributeBlock(textPrefix.slice(0, castValueMatch.index));
  if (block !== "$casts" && block !== "casts()") {
    return undefined;
  }

  const prefix = castValueMatch[2] ?? "";
  return {
    kind: "eloquent-field",
    prefix,
    rangeStart: linePrefix.length - prefix.length,
    rangeEnd: linePrefix.length,
    castAttribute: castValueMatch[1],
  };
}

function findNearestModelAttributeBlock(textPrefix: string): "$fillable" | "$guarded" | "$casts" | "casts()" | undefined {
  const candidates = [
    { type: "$fillable" as const, index: textPrefix.lastIndexOf("$fillable") },
    { type: "$guarded" as const, index: textPrefix.lastIndexOf("$guarded") },
    { type: "$casts" as const, index: textPrefix.lastIndexOf("$casts") },
    { type: "casts()" as const, index: textPrefix.lastIndexOf("function casts") },
  ].filter((candidate) => candidate.index >= 0);
  if (candidates.length === 0) {
    return undefined;
  }

  const nearest = candidates.sort((a, b) => b.index - a.index)[0];
  const blockText = textPrefix.slice(nearest.index);
  if (blockText.lastIndexOf("[") <= blockText.lastIndexOf("]")) {
    return undefined;
  }

  return nearest.type;
}

export function resolveEloquentFactoryStateContext(linePrefix: string): StringContext | undefined {
  const match =
    /\b([A-Za-z_\\][A-Za-z0-9_\\]*)::factory\([^)]*\)(?:->[A-Za-z_][A-Za-z0-9_]*\([^)]*\))*->([A-Za-z_][A-Za-z0-9_]*)$/.exec(
      linePrefix,
    );
  if (!match) {
    return undefined;
  }

  const prefix = match[2] ?? "";
  return {
    kind: "eloquent-factory-state",
    prefix,
    rangeStart: linePrefix.length - prefix.length,
    rangeEnd: linePrefix.length,
    modelClass: match[1],
  };
}

export function resolveRouteMiddlewareContext(linePrefix: string): StringContext | undefined {
  const match = /(?:Route::|->|\$this->)middleware\(\s*(?:\[[^\]]*)?['"]([^'"]*)$/.exec(linePrefix);
  if (!match) {
    return undefined;
  }

  const value = match[1] ?? "";
  const prefix = value.split(":")[0] ?? value;
  return {
    kind: "route-middleware",
    prefix,
    rangeStart: linePrefix.length - value.length,
    rangeEnd: linePrefix.length,
  };
}

export function resolveFilesystemDiskContext(linePrefix: string): StringContext | undefined {
  const storageMatch = /\bStorage::(?:disk|fake|persistentFake)\(\s*['"]([^'"]*)$/.exec(linePrefix);
  if (storageMatch) {
    return createFilesystemDiskContext(linePrefix, storageMatch[1] ?? "");
  }

  const twoArgUploadMatch = /->(?:store|storePublicly)\(\s*[^,]+,\s*['"]([^'"]*)$/.exec(linePrefix);
  if (twoArgUploadMatch) {
    return createFilesystemDiskContext(linePrefix, twoArgUploadMatch[1] ?? "");
  }

  const threeArgUploadMatch = /->(?:storeAs|storePubliclyAs)\(\s*[^,]+,\s*[^,]+,\s*['"]([^'"]*)$/.exec(linePrefix);
  if (threeArgUploadMatch) {
    return createFilesystemDiskContext(linePrefix, threeArgUploadMatch[1] ?? "");
  }

  const filesystemsConfigMatch = /['"](?:default|cloud)['"]\s*=>\s*(?:env\([^,]+,\s*)?['"]([^'"]*)$/.exec(linePrefix);
  if (filesystemsConfigMatch) {
    return createFilesystemDiskContext(linePrefix, filesystemsConfigMatch[1] ?? "");
  }

  return undefined;
}

function createFilesystemDiskContext(linePrefix: string, prefix: string): StringContext {
  return {
    kind: "filesystem-disk",
    prefix,
    rangeStart: linePrefix.length - prefix.length,
    rangeEnd: linePrefix.length,
  };
}

export function resolveEloquentScopeContext(linePrefix: string): StringContext | undefined {
  const staticScopeMatch =
    /\b([A-Za-z_\\][A-Za-z0-9_\\]*)::(?:query\(\)(?:->[A-Za-z_][A-Za-z0-9_]*\([^)]*\))*->)?([A-Za-z_][A-Za-z0-9_]*)$/.exec(
      linePrefix,
    );
  if (staticScopeMatch) {
    const prefix = staticScopeMatch[2] ?? "";
    return {
      kind: "eloquent-scope",
      prefix,
      rangeStart: linePrefix.length - prefix.length,
      rangeEnd: linePrefix.length,
      modelClass: staticScopeMatch[1],
    };
  }

  const objectScopeMatch = /->([A-Za-z_][A-Za-z0-9_]*)$/.exec(linePrefix);
  if (objectScopeMatch) {
    const prefix = objectScopeMatch[1] ?? "";
    return {
      kind: "eloquent-scope",
      prefix,
      rangeStart: linePrefix.length - prefix.length,
      rangeEnd: linePrefix.length,
    };
  }

  return undefined;
}

export function resolveDatabaseColumnContext(linePrefix: string): StringContext | undefined {
  const match = new RegExp(
    `\\bDB::table\\(\\s*['"]([A-Za-z0-9_]+)['"]\\s*\\)(?:->[A-Za-z_][A-Za-z0-9_]*\\([^)]*\\))*->(?:${DATABASE_COLUMN_METHODS})\\(\\s*(?:\\[[^\\]]*)?['"]([^'"]*)$`,
  ).exec(linePrefix);
  if (!match) {
    return undefined;
  }

  const prefix = match[2] ?? "";
  return {
    kind: "database-column",
    prefix,
    rangeStart: linePrefix.length - prefix.length,
    rangeEnd: linePrefix.length,
    table: match[1],
  };
}

export function resolveEloquentRelationContext(linePrefix: string): StringContext | undefined {
  const constrainedStaticRelationMatch = new RegExp(
    `${STATIC_BUILDER_PREFIX}(?:${STATIC_RELATION_METHODS})\\(\\s*\\[[\\s\\S]*['"]([^'"]+)['"]\\s*=>\\s*(?:fn\\s*\\([^)]*\\)\\s*=>|function\\s*\\([^)]*\\)\\s*(?:use\\s*\\([^)]*\\)\\s*)?\\{)[\\s\\S]*->(?:${OBJECT_RELATION_METHODS})\\(\\s*(?:\\[[^\\]]*)?['"]([^'"]*)$`,
  ).exec(linePrefix);
  if (constrainedStaticRelationMatch) {
    const parentRelation = constrainedStaticRelationMatch[2] ?? "";
    const childPrefix = constrainedStaticRelationMatch[3] ?? "";
    return createRelationContext(linePrefix, `${parentRelation}.${childPrefix}`, constrainedStaticRelationMatch[1]);
  }

  const staticKeyedRelationMatch = new RegExp(
    `${STATIC_BUILDER_PREFIX}(?:${STATIC_RELATION_METHODS})\\(\\s*\\[[^\\]]*['"]([^'"]*)['"]\\s*=>\\s*[^\\]]*$`,
  ).exec(linePrefix);
  if (staticKeyedRelationMatch) {
    return createRelationContext(linePrefix, staticKeyedRelationMatch[2] ?? "", staticKeyedRelationMatch[1]);
  }

  const staticRelationMatch = new RegExp(
    `${STATIC_BUILDER_PREFIX}(?:${STATIC_RELATION_METHODS})\\(\\s*(?:\\[[^\\]]*)?['"]([^'"]*)$`,
  ).exec(linePrefix);
  if (staticRelationMatch) {
    return createRelationContext(linePrefix, staticRelationMatch[2] ?? "", staticRelationMatch[1]);
  }

  const objectKeyedRelationMatch = new RegExp(`->(?:${OBJECT_RELATION_METHODS})\\(\\s*\\[[^\\]]*['"]([^'"]*)['"]\\s*=>\\s*[^\\]]*$`).exec(
    linePrefix,
  );
  if (objectKeyedRelationMatch) {
    return createRelationContext(linePrefix, objectKeyedRelationMatch[1] ?? "");
  }

  const objectRelationMatch = new RegExp(`->(?:${OBJECT_RELATION_METHODS})\\(\\s*(?:\\[[^\\]]*)?['"]([^'"]*)$`).exec(linePrefix);
  if (objectRelationMatch) {
    return createRelationContext(linePrefix, objectRelationMatch[1] ?? "");
  }

  return undefined;
}

export function resolveEloquentRelationConstraintContext(
  documentPrefix: string,
  linePrefix: string,
): EloquentRelationConstraintContext | undefined {
  const variable = relationQueryVariable(linePrefix);
  if (!variable) {
    return undefined;
  }

  const functionPattern = `function\\s*\\(\\s*\\$${variable}\\b[^)]*\\)\\s*(?:use\\s*\\([^)]*\\)\\s*)?\\{`;
  const arrowPattern = `fn\\s*\\(\\s*\\$${variable}\\b[^)]*\\)\\s*=>`;
  const constraintRegex = new RegExp(
    `${STATIC_BUILDER_PREFIX}(?:${STATIC_RELATION_METHODS})\\(\\s*\\[[\\s\\S]*?['"]([^'"]+)['"]\\s*=>\\s*(?:${arrowPattern}|${functionPattern})`,
    "g",
  );

  let selected: RegExpExecArray | undefined;
  for (const match of documentPrefix.matchAll(constraintRegex)) {
    selected = match;
  }

  if (!selected?.[1] || !selected[2]) {
    return undefined;
  }

  return {
    modelClass: selected[1],
    relationPath: splitRelationPrefix(selected[2]).path.concat(splitRelationPrefix(selected[2]).prefix).filter(Boolean),
  };
}

function relationQueryVariable(linePrefix: string): string | undefined {
  return new RegExp(
    `\\$([A-Za-z_][A-Za-z0-9_]*)(?:->[A-Za-z_][A-Za-z0-9_]*\\([^)]*\\))*->(?:${OBJECT_RELATION_METHODS})\\(\\s*(?:\\[[^\\]]*)?['"][^'"]*$`,
  ).exec(linePrefix)?.[1];
}

function createRelationContext(linePrefix: string, fullPrefix: string, modelClass?: string): StringContext {
  const relationParts = splitRelationPrefix(fullPrefix);
  return {
    kind: "eloquent-relation",
    prefix: relationParts.prefix,
    rangeStart: linePrefix.length - relationParts.prefix.length,
    rangeEnd: linePrefix.length,
    modelClass,
    relationPath: relationParts.path,
  };
}

function splitRelationPrefix(value: string): { path: string[]; prefix: string } {
  const parts = value.split(".");
  return {
    path: parts.slice(0, -1).filter((part) => part.length > 0),
    prefix: parts[parts.length - 1] ?? "",
  };
}

export function resolveEloquentFieldContext(linePrefix: string): StringContext | undefined {
  const staticCallMatch = new RegExp(
    `\\b([A-Za-z_\\\\][A-Za-z0-9_\\\\]*)::(?:query\\(\\)(?:->[A-Za-z_][A-Za-z0-9_]*\\([^)]*\\))*->|)(?:${ELOQUENT_FIELD_METHODS})\\(\\s*(?:\\[[^\\]]*)?['"]([^'"]*)$`,
  ).exec(linePrefix);
  if (staticCallMatch) {
    const prefix = staticCallMatch[2] ?? "";
    return {
      kind: "eloquent-field",
      prefix,
      rangeStart: linePrefix.length - prefix.length,
      rangeEnd: linePrefix.length,
      modelClass: staticCallMatch[1],
    };
  }

  const fillableMatch = /\b(?:fillable|guarded)\s*=\s*\[[^\]]*['"]([^'"]*)$/.exec(linePrefix);
  if (fillableMatch) {
    const prefix = fillableMatch[1] ?? "";
    return {
      kind: "eloquent-field",
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

  const value = match[1] ?? "";
  const actionReference = splitRouteActionReference(value);
  if (actionReference.controllerClass !== undefined) {
    return {
      kind: "route-action",
      prefix: actionReference.methodPrefix,
      rangeStart: linePrefix.length - actionReference.methodPrefix.length,
      rangeEnd: linePrefix.length,
      controllerClass: actionReference.controllerClass,
    };
  }

  const prefix = value;
  return {
    kind: "route-action",
    prefix,
    rangeStart: linePrefix.length - prefix.length,
    rangeEnd: linePrefix.length,
  };
}

export function resolveFilamentResourceContext(linePrefix: string): StringContext | undefined {
  const call = /->(?:resources|resource)\(\s*(.*)$/.exec(linePrefix);
  const prefix = call ? /\\?([A-Za-z_\\][A-Za-z0-9_\\]*)$/.exec(call[1] ?? "")?.[1] : undefined;
  if (!prefix) {
    return undefined;
  }

  return {
    kind: "filament-resource",
    prefix,
    rangeStart: linePrefix.length - prefix.length,
    rangeEnd: linePrefix.length,
  };
}

export function resolveNovaResourceContext(linePrefix: string): StringContext | undefined {
  const call = /\bNova::resources?\(\s*(.*)$/.exec(linePrefix);
  const prefix = call ? /\\?([A-Za-z_\\][A-Za-z0-9_\\]*)$/.exec(call[1] ?? "")?.[1] : undefined;
  if (!prefix) {
    return undefined;
  }

  return {
    kind: "nova-resource",
    prefix,
    rangeStart: linePrefix.length - prefix.length,
    rangeEnd: linePrefix.length,
  };
}

function splitRouteActionReference(value: string): { controllerClass?: string; methodPrefix: string } {
  const separator = value.lastIndexOf("@");
  if (separator < 0) {
    return { methodPrefix: value };
  }

  return {
    controllerClass: value.slice(0, separator),
    methodPrefix: value.slice(separator + 1),
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

export function resolveLivewireComponentPrefix(linePrefix: string): { prefix: string; start: number } | undefined {
  const match = /<livewire:([A-Za-z0-9_.:-]*)$/.exec(linePrefix);
  if (!match) {
    return undefined;
  }

  return {
    prefix: match[1],
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
