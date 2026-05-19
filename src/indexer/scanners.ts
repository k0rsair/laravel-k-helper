import path from "node:path";
import { readTextFile, toPosixPath, walkFiles } from "../utils/files";
import type { IndexedItem, LaravelIndexKind, RouteControllerScope, SourceLocation } from "./types";
import type { Logger } from "../logging/logger";

const BUILT_IN_VALIDATION_RULES = [
  "accepted",
  "accepted_if",
  "active_url",
  "after",
  "after_or_equal",
  "alpha",
  "alpha_dash",
  "alpha_num",
  "array",
  "bail",
  "before",
  "before_or_equal",
  "between",
  "boolean",
  "confirmed",
  "current_password",
  "date",
  "date_equals",
  "date_format",
  "decimal",
  "declined",
  "declined_if",
  "different",
  "digits",
  "digits_between",
  "dimensions",
  "distinct",
  "doesnt_start_with",
  "doesnt_end_with",
  "email",
  "ends_with",
  "enum",
  "exclude",
  "exclude_if",
  "exclude_unless",
  "exclude_with",
  "exclude_without",
  "exists",
  "file",
  "filled",
  "gt",
  "gte",
  "image",
  "in",
  "in_array",
  "integer",
  "ip",
  "ipv4",
  "ipv6",
  "json",
  "lt",
  "lte",
  "lowercase",
  "mac_address",
  "max",
  "max_digits",
  "mimes",
  "mimetypes",
  "min",
  "min_digits",
  "missing",
  "missing_if",
  "missing_unless",
  "missing_with",
  "missing_with_all",
  "multiple_of",
  "not_in",
  "not_regex",
  "nullable",
  "numeric",
  "password",
  "present",
  "prohibited",
  "prohibited_if",
  "prohibited_unless",
  "prohibits",
  "regex",
  "required",
  "required_array_keys",
  "required_if",
  "required_if_accepted",
  "required_if_declined",
  "required_unless",
  "required_with",
  "required_with_all",
  "required_without",
  "required_without_all",
  "same",
  "size",
  "sometimes",
  "starts_with",
  "string",
  "timezone",
  "unique",
  "uppercase",
  "url",
  "ulid",
  "uuid",
];

export async function scanRoutes(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const routesRoot = path.join(projectRoot, "routes");
  const routeFiles = await walkFiles(routesRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of routeFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const routeNames = scanRegex(text, /\.name\(\s*['"]([^'"]+)['"]\s*\)/g);
    const namedRoutes = scanRegex(text, /Route::(?:get|post|put|patch|delete|options|any|match|resource|apiResource)\([^;]+?->name\(\s*['"]([^'"]+)['"]\s*\)/gs);
    for (const match of [...routeNames, ...namedRoutes]) {
      items.push(createItem("route", match.value, file, text, match.index));
    }
  }

  logger.debug("[LaravelIndex.scanRoutes] completed", { files: routeFiles.length, items: items.length });
  return uniqueItems(items);
}

export async function scanViews(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const viewsRoot = path.join(projectRoot, "resources", "views");
  const viewFiles = await walkFiles(viewsRoot, (file) => file.endsWith(".blade.php"));
  const items = viewFiles.map((file) => {
    const relative = toPosixPath(path.relative(viewsRoot, file));
    const key = relative.replace(/\.blade\.php$/, "").replace(/\//g, ".");
    return createItemFromLine("view", key, file, 0, 0);
  });

  logger.debug("[LaravelIndex.scanViews] completed", { files: viewFiles.length, items: items.length });
  return items;
}

export async function scanConfig(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const configRoot = path.join(projectRoot, "config");
  const configFiles = await walkFiles(configRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of configFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const configName = path.basename(file, ".php");
    const keys = scanPhpArrayKeyPaths(text);
    for (const key of keys) {
      items.push(createItem("config", `${configName}.${key.value}`, file, text, key.index));
    }
  }

  logger.debug("[LaravelIndex.scanConfig] completed", { files: configFiles.length, items: items.length });
  return uniqueItems(items);
}

export async function scanFilesystemDisks(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const file = path.join(projectRoot, "config", "filesystems.php");
  const text = await readTextFile(file);
  if (!text) {
    logger.debug("[LaravelIndex.scanFilesystemDisks] config file not found", { file });
    return [];
  }

  const items = scanFilesystemDiskKeys(text).map((match) =>
    createItem("filesystem-disk", match.value, file, text, match.index),
  );

  logger.debug("[LaravelIndex.scanFilesystemDisks] completed", {
    file,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanTranslations(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const langRoot = path.join(projectRoot, "lang");
  const translationFiles = await walkFiles(langRoot, (file) => file.endsWith(".php") || file.endsWith(".json"));
  const items: IndexedItem[] = [];

  for (const file of translationFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const relative = toPosixPath(path.relative(langRoot, file));
    if (file.endsWith(".json")) {
      for (const match of scanJsonKeys(text)) {
        items.push(createItem("translation", match.value, file, text, match.index));
      }
      continue;
    }

    const parts = relative.replace(/\.php$/, "").split("/");
    const group = parts.slice(1).join(".");
    for (const key of scanPhpArrayKeyPaths(text)) {
      items.push(createItem("translation", group ? `${group}.${key.value}` : key.value, file, text, key.index));
    }
  }

  logger.debug("[LaravelIndex.scanTranslations] completed", {
    files: translationFiles.length,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanEnvKeys(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const files = [path.join(projectRoot, ".env.example"), path.join(projectRoot, ".env")];
  const items: IndexedItem[] = [];

  for (const file of files) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const matches = scanRegex(text, /^([A-Z0-9_]+)=.*$/gm);
    for (const match of matches) {
      items.push(createItem("env", match.value, file, text, match.index));
    }
  }

  logger.debug("[LaravelIndex.scanEnvKeys] completed", { files: files.length, items: items.length });
  return uniqueItems(items);
}

export async function scanBladeComponents(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const viewComponentsRoot = path.join(projectRoot, "resources", "views", "components");
  const classComponentsRoot = path.join(projectRoot, "app", "View", "Components");
  const viewFiles = await walkFiles(viewComponentsRoot, (file) => file.endsWith(".blade.php"));
  const classFiles = await walkFiles(classComponentsRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of viewFiles) {
    const relative = toPosixPath(path.relative(viewComponentsRoot, file));
    const key = relative.replace(/\.blade\.php$/, "").replace(/\//g, ".");
    items.push(createItemFromLine("blade-component", key, file, 0, 0, `<x-${key.replace(/\./g, "-")}>`));
  }

  for (const file of classFiles) {
    const relative = toPosixPath(path.relative(classComponentsRoot, file));
    const key = relative
      .replace(/\.php$/, "")
      .replace(/\//g, ".")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase();
    items.push(createItemFromLine("blade-component", key, file, 0, 0, `<x-${key.replace(/\./g, "-")}>`));
  }

  logger.debug("[LaravelIndex.scanBladeComponents] completed", {
    viewFiles: viewFiles.length,
    classFiles: classFiles.length,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanValidationRules(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const composerFile = path.join(projectRoot, "composer.json");
  const items = BUILT_IN_VALIDATION_RULES.map((rule) =>
    createItemFromLine("validation-rule", rule, composerFile, 0, 0, "Laravel validation rule"),
  );

  const rulesRoot = path.join(projectRoot, "app", "Rules");
  const ruleFiles = await walkFiles(rulesRoot, (file) => file.endsWith(".php"));
  for (const file of ruleFiles) {
    const className = path.basename(file, ".php");
    const ruleKey = className.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
    items.push(createItemFromLine("validation-rule", ruleKey, file, 0, 0, `Custom rule ${className}`));
  }

  logger.debug("[LaravelIndex.scanValidationRules] completed", {
    builtIn: BUILT_IN_VALIDATION_RULES.length,
    customFiles: ruleFiles.length,
    items: items.length,
  });

  return uniqueItems(items);
}

export async function scanRequestFields(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const files = [
    ...(await walkFiles(path.join(projectRoot, "app"), (file) => file.endsWith(".php"))),
    ...(await walkFiles(path.join(projectRoot, "routes"), (file) => file.endsWith(".php"))),
  ];
  const items: IndexedItem[] = [];

  for (const file of files) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    for (const match of scanValidationFieldKeys(text)) {
      items.push(createItem("request-field", match.value, file, text, match.index));
    }
  }

  logger.debug("[LaravelIndex.scanRequestFields] completed", { files: files.length, items: items.length });
  return uniqueItems(items);
}

export async function scanControllerMethods(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const controllersRoot = path.join(projectRoot, "app", "Http", "Controllers");
  const controllerFiles = await walkFiles(controllersRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of controllerFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const namespace = /namespace\s+([^;]+);/.exec(text)?.[1];
    const className = /class\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(text)?.[1];
    if (!namespace || !className) {
      continue;
    }

    const controllerClass = `${namespace}\\${className}`;
    for (const match of text.matchAll(/\bpublic\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      const method = match[1];
      if (!method || (method.startsWith("__") && method !== "__invoke") || match.index === undefined) {
        continue;
      }
      items.push({
        ...createItem("controller-method", `${controllerClass}::${method}`, file, text, match.index),
        controllerClass,
        method,
      });
    }
  }

  logger.debug("[LaravelIndex.scanControllerMethods] completed", {
    files: controllerFiles.length,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanRouteActions(
  projectRoot: string,
  logger: Logger,
  controllerMethods: IndexedItem[],
  routeControllerScopes: RouteControllerScope[],
): Promise<IndexedItem[]> {
  const routesRoot = path.join(projectRoot, "routes");
  const routeFiles = await walkFiles(routesRoot, (file) => file.endsWith(".php"));
  const methodsByKey = new Map(controllerMethods.map((item) => [item.key, item]));
  const items: IndexedItem[] = [];

  for (const file of routeFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const uses = scanUseStatements(text);
    for (const action of scanStringRouteActions(text)) {
      const group = findNearestControllerGroup(routeControllerScopes, file, action.index);
      if (!group) {
        continue;
      }

      items.push(createRouteActionItem(action.method, group.controllerClass, file, text, action.index, methodsByKey));
    }

    for (const action of scanArrayRouteActions(text, uses)) {
      items.push(createRouteActionItem(action.method, action.controllerClass, file, text, action.index, methodsByKey));
    }

    for (const action of scanInvokableRouteActions(text, uses)) {
      items.push(createRouteActionItem("__invoke", action.controllerClass, file, text, action.index, methodsByKey));
    }
  }

  logger.debug("[LaravelIndex.scanRouteActions] completed", {
    files: routeFiles.length,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanRouteControllerScopes(projectRoot: string, logger: Logger): Promise<RouteControllerScope[]> {
  const routesRoot = path.join(projectRoot, "routes");
  const routeFiles = await walkFiles(routesRoot, (file) => file.endsWith(".php"));
  const scopes: RouteControllerScope[] = [];

  for (const file of routeFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }
    scopes.push(...scanRouteControllerGroups(text, scanUseStatements(text), file));
  }

  logger.debug("[LaravelIndex.scanRouteControllerScopes] completed", {
    files: routeFiles.length,
    items: scopes.length,
  });
  return scopes;
}

function scanPhpArrayKeyPaths(text: string): Array<{ value: string; index: number }> {
  const keys: Array<{ value: string; index: number }> = [];
  const stack: Array<{ indent: number; key: string }> = [];
  const keyRegex = /^(\s*)(?:['"]([A-Za-z0-9_.-]+)['"]|(-?\d+))\s*=>\s*(\[|array\s*\()?/;
  let offset = 0;

  for (const line of text.split(/\r?\n/)) {
    const match = keyRegex.exec(line);
    if (match) {
      const indent = match[1]?.length ?? 0;
      const key = match[2] ?? match[3] ?? "";

      while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
        stack.pop();
      }

      const value = [...stack.map((entry) => entry.key), key].join(".");
      keys.push({ value, index: offset + line.indexOf(key) });

      const opensArray = match[4] !== undefined;
      if (opensArray) {
        stack.push({ indent, key });
      }
    }

    offset += line.length + 1;
  }

  return keys;
}

function scanJsonKeys(text: string): Array<{ value: string; index: number }> {
  return scanRegex(text, /"([^"]+)"\s*:/g);
}

function scanFilesystemDiskKeys(text: string): Array<{ value: string; index: number }> {
  const disksMatch = /['"]disks['"]\s*=>\s*\[/.exec(text);
  if (disksMatch?.index === undefined) {
    return [];
  }

  const openBracket = text.indexOf("[", disksMatch.index);
  const closeBracket = findMatchingSquareBracket(text, openBracket, text.length);
  if (openBracket < 0 || closeBracket < 0) {
    return [];
  }

  const body = text.slice(openBracket + 1, closeBracket);
  const keys: Array<{ value: string; index: number }> = [];
  const diskRegex = /^(\s*)['"]([A-Za-z0-9_.-]+)['"]\s*=>\s*\[/gm;
  for (const match of body.matchAll(diskRegex)) {
    if (match[2] !== undefined && match.index !== undefined) {
      keys.push({
        value: match[2],
        index: openBracket + 1 + match.index + match[0].indexOf(match[2]),
      });
    }
  }

  return keys;
}

function findMatchingSquareBracket(text: string, openBracket: number, end: number): number {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;

  for (let index = openBracket; index < end; index += 1) {
    const char = text[index];
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
      continue;
    }
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function scanUseStatements(text: string): Map<string, string> {
  const uses = new Map<string, string>();
  for (const match of text.matchAll(/^use\s+([^;]+);/gm)) {
    const fqcn = match[1]?.trim();
    if (!fqcn) {
      continue;
    }
    const aliasMatch = /\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(fqcn);
    const className = aliasMatch?.[1] ?? fqcn.split("\\").pop();
    if (className) {
      uses.set(className, fqcn.replace(/\s+as\s+[A-Za-z_][A-Za-z0-9_]*$/i, ""));
    }
  }
  return uses;
}

function scanRouteControllerGroups(
  text: string,
  uses: Map<string, string>,
  file: string,
): RouteControllerScope[] {
  const groups: RouteControllerScope[] = [];
  collectRouteControllerGroups(text, uses, file, 0, text.length, undefined, groups);
  return groups;
}

function collectRouteControllerGroups(
  text: string,
  uses: Map<string, string>,
  file: string,
  start: number,
  end: number,
  inheritedController: string | undefined,
  groups: RouteControllerScope[],
): void {
  let cursor = start;

  while (cursor < end) {
    const group = findNextRouteGroup(text, cursor, end);
    if (!group) {
      return;
    }

    const controller = extractControllerClass(text.slice(group.callStart, group.bodyStart), uses) ?? inheritedController;
    if (controller) {
      groups.push({
        file,
        controllerClass: controller,
        bodyStart: group.bodyStart,
        bodyEnd: group.bodyEnd,
      });
    }

    collectRouteControllerGroups(text, uses, file, group.bodyStart, group.bodyEnd, controller, groups);
    cursor = group.bodyEnd + 1;
  }
}

function findNextRouteGroup(
  text: string,
  start: number,
  end: number,
): { callStart: number; bodyStart: number; bodyEnd: number } | undefined {
  const routeGroupIndex = boundedIndexOf(text, "Route::group", start, end);
  const chainedGroupIndex = boundedIndexOf(text, "->group", start, end);
  const candidates = [routeGroupIndex, chainedGroupIndex].filter((index) => index >= 0);
  if (candidates.length === 0) {
    return undefined;
  }

  const groupIndex = Math.min(...candidates);
  const callStart = groupIndex === chainedGroupIndex ? Math.max(text.lastIndexOf("Route::", groupIndex), start) : groupIndex;
  const body = findFunctionBody(text, groupIndex, end);
  if (!body || callStart < start) {
    return findNextRouteGroup(text, groupIndex + 1, end);
  }

  return {
    callStart,
    bodyStart: body.start,
    bodyEnd: body.end,
  };
}

function boundedIndexOf(text: string, search: string, start: number, end: number): number {
  const index = text.indexOf(search, start);
  return index >= 0 && index < end ? index : -1;
}

function findFunctionBody(text: string, start: number, end: number): { start: number; end: number } | undefined {
  const functionIndex = boundedIndexOf(text, "function", start, end);
  if (functionIndex < 0) {
    return undefined;
  }

  const openBrace = boundedIndexOf(text, "{", functionIndex, end);
  if (openBrace < 0) {
    return undefined;
  }

  const closeBrace = findMatchingBrace(text, openBrace, end);
  if (closeBrace < 0) {
    return undefined;
  }

  return {
    start: openBrace + 1,
    end: closeBrace,
  };
}

function findMatchingBrace(text: string, openBrace: number, end: number): number {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;

  for (let index = openBrace; index < end; index += 1) {
    const char = text[index];
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
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractControllerClass(callText: string, uses: Map<string, string>): string | undefined {
  const arrayController = /['"]controller['"]\s*=>\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class/.exec(callText)?.[1];
  const chainedController = /->controller\(\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*\)/.exec(callText)?.[1];
  const controller = arrayController ?? chainedController;
  return controller ? resolveControllerClass(controller, uses) : undefined;
}

function resolveControllerClass(controller: string, uses: Map<string, string>): string {
  if (controller.includes("\\")) {
    return controller;
  }
  return uses.get(controller) ?? controller;
}

function scanStringRouteActions(body: string): Array<{ method: string; index: number }> {
  const actions: Array<{ method: string; index: number }> = [];
  const regex =
    /Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;

  for (const match of body.matchAll(regex)) {
    if (match[1] !== undefined && match.index !== undefined) {
      actions.push({ method: match[1], index: match.index + match[0].lastIndexOf(match[1]) });
    }
  }

  return actions;
}

function scanArrayRouteActions(
  text: string,
  uses: Map<string, string>,
): Array<{ controllerClass: string; method: string; index: number }> {
  const actions: Array<{ controllerClass: string; method: string; index: number }> = [];
  const regex =
    /Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*\[\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*,\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g;

  for (const match of text.matchAll(regex)) {
    if (match[1] !== undefined && match[2] !== undefined && match.index !== undefined) {
      actions.push({
        controllerClass: resolveControllerClass(match[1], uses),
        method: match[2],
        index: match.index + match[0].lastIndexOf(match[2]),
      });
    }
  }

  return actions;
}

function scanInvokableRouteActions(
  text: string,
  uses: Map<string, string>,
): Array<{ controllerClass: string; index: number }> {
  const actions: Array<{ controllerClass: string; index: number }> = [];
  const regex =
    /Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*\)/g;

  for (const match of text.matchAll(regex)) {
    if (match[1] !== undefined && match.index !== undefined) {
      actions.push({
        controllerClass: resolveControllerClass(match[1], uses),
        index: match.index + match[0].lastIndexOf(match[1]),
      });
    }
  }

  return actions;
}

function createRouteActionItem(
  method: string,
  controllerClass: string,
  routeFile: string,
  routeText: string,
  actionOffset: number,
  methodsByKey: Map<string, IndexedItem>,
): IndexedItem {
  const methodKey = `${controllerClass}::${method}`;
  const controllerMethod = methodsByKey.get(methodKey);
  const routeSource = offsetToSourceLocation(routeFile, routeText, actionOffset);

  if (!controllerMethod) {
    return {
      ...createItem("route-action", method, routeFile, routeText, actionOffset),
      detail: methodKey,
      routeSource,
      controllerClass,
      method,
    };
  }

  return {
    ...controllerMethod,
    key: method,
    label: method,
    kind: "route-action",
    detail: methodKey,
    routeSource,
    controllerClass,
    method,
  };
}

function findNearestControllerGroup(
  groups: RouteControllerScope[],
  file: string,
  actionOffset: number,
): RouteControllerScope | undefined {
  return groups
    .filter((group) => group.file === file && actionOffset >= group.bodyStart && actionOffset <= group.bodyEnd)
    .sort((a, b) => b.bodyStart - a.bodyStart)[0];
}

function scanValidationFieldKeys(text: string): Array<{ value: string; index: number }> {
  const matches: Array<{ value: string; index: number }> = [];
  const validationRuleStart =
    "(?:required|nullable|sometimes|string|email|integer|numeric|array|boolean|date|confirmed|unique|exists|min|max|size|in|url|uuid|ulid)";
  const stringRuleRegex = new RegExp(`['"]([A-Za-z0-9_.-]+)['"]\\s*=>\\s*['"][^'"]*${validationRuleStart}`, "g");
  const arrayRuleRegex = new RegExp(`['"]([A-Za-z0-9_.-]+)['"]\\s*=>\\s*\\[\\s*['"]${validationRuleStart}`, "g");

  for (const regex of [stringRuleRegex, arrayRuleRegex]) {
    for (const match of text.matchAll(regex)) {
      if (match[1] !== undefined && match.index !== undefined) {
        matches.push({ value: match[1], index: match.index });
      }
    }
  }

  return matches;
}

function scanRegex(text: string, regex: RegExp): Array<{ value: string; index: number }> {
  const matches: Array<{ value: string; index: number }> = [];
  for (const match of text.matchAll(regex)) {
    if (match[1] !== undefined && match.index !== undefined) {
      matches.push({ value: match[1], index: match.index });
    }
  }
  return matches;
}

function createItem(kind: LaravelIndexKind, key: string, file: string, text: string, index: number): IndexedItem {
  const location = offsetToSourceLocation(file, text, index);
  return createItemFromLine(kind, key, file, location.line, location.character, undefined, location.offset);
}

function createItemFromLine(
  kind: LaravelIndexKind,
  key: string,
  file: string,
  line: number,
  character: number,
  detail?: string,
  offset?: number,
): IndexedItem {
  return {
    key,
    label: key,
    kind,
    source: { file, line, character, offset },
    detail,
  };
}

function offsetToSourceLocation(file: string, text: string, offset: number): SourceLocation {
  const before = text.slice(0, offset);
  const lines = before.split(/\r?\n/);
  return {
    file,
    line: lines.length - 1,
    character: lines[lines.length - 1]?.length ?? 0,
    offset,
  };
}

function uniqueItems(items: IndexedItem[]): IndexedItem[] {
  const seen = new Set<string>();
  const unique: IndexedItem[] = [];

  for (const item of items) {
    const key = `${item.kind}:${item.key}:${item.source.file}:${item.routeSource?.file ?? ""}:${item.routeSource?.offset ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  unique.sort((a, b) => a.key.localeCompare(b.key));
  return unique;
}
