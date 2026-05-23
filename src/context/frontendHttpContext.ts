import { extractQuotedStringAtOffset } from "./completionContext";

export interface FrontendHttpRequestReference {
  kind: "route-name" | "url";
  value: string;
  method?: string;
  rangeStart: number;
  rangeEnd: number;
}

export type FrontendUrlAliases = ReadonlyMap<string, string>;

const HTTP_METHODS = "get|post|put|patch|delete|options|head";

export function extractFrontendHttpRequestAtOffset(line: string, offset: number): FrontendHttpRequestReference | undefined {
  const expressionReference = extractFrontendHttpRequestsFromLine(line).find(
    (reference) => offset >= reference.rangeStart && offset <= reference.rangeEnd,
  );
  if (expressionReference) {
    return expressionReference;
  }

  const quoted = extractQuotedStringAtOffset(line, offset);
  if (!quoted) {
    return undefined;
  }

  const before = line.slice(0, quoted.start - 1);
  const after = line.slice(quoted.end);
  const range = { rangeStart: quoted.start, rangeEnd: quoted.end };

  if (/\broute\(\s*$/.test(before)) {
    return {
      kind: "route-name",
      value: quoted.value,
      ...range,
    };
  }

  const methodCall = new RegExp(`\\b[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*\\.(${HTTP_METHODS})\\(\\s*$`, "i").exec(before);
  if (methodCall?.[1]) {
    return {
      kind: "url",
      value: quoted.value,
      method: methodCall[1].toUpperCase(),
      ...range,
    };
  }

  if (/\bfetch\(\s*$/.test(before)) {
    return {
      kind: "url",
      value: quoted.value,
      method: methodFromObjectOptions(after) ?? "GET",
      ...range,
    };
  }

  if (/\burl\s*:\s*$/.test(before) && /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(\s*\{/.test(before)) {
    return {
      kind: "url",
      value: quoted.value,
      method: methodFromObjectOptions(line),
      ...range,
    };
  }

  return undefined;
}

export function extractFrontendHttpRequestsFromLine(line: string, aliases: FrontendUrlAliases = new Map()): FrontendHttpRequestReference[] {
  return [
    ...extractFrontendRouteHelperReferences(line),
    ...extractFrontendMethodCallReferences(line, aliases),
    ...extractFrontendFetchReferences(line, aliases),
    ...extractFrontendObjectCallReferences(line, aliases),
  ];
}

export function collectFrontendUrlAliases(lines: readonly string[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (let index = 0; index < lines.length; index += 1) {
    const declaration = frontendUrlAliasDeclaration(lines, index);
    if (declaration) {
      aliases.set(declaration.name, declaration.pattern);
      index = declaration.endLine;
    }
  }
  return aliases;
}

function frontendUrlAliasDeclaration(lines: readonly string[], startLine: number): { name: string; pattern: string; endLine: number } | undefined {
  const line = lines[startLine] ?? "";
  const declaration = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(line);
  if (!declaration?.[1] || declaration.index === undefined) {
    return undefined;
  }

  const { text, endLine } = joinDeclarationLines(lines, startLine);
  const expression = expressionUntil(text, declaration.index + declaration[0].length, [";"]);
  const pattern = expression ? routePatternFromExpression(expression.expression) : undefined;
  if (!pattern) {
    return undefined;
  }

  return {
    name: declaration[1],
    pattern,
    endLine,
  };
}

function joinDeclarationLines(lines: readonly string[], startLine: number): { text: string; endLine: number } {
  const parts: string[] = [];
  for (let index = startLine; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    parts.push(line);
    if (line.includes(";")) {
      return { text: parts.join(" "), endLine: index };
    }
  }
  return { text: parts.join(" "), endLine: lines.length - 1 };
}

function extractFrontendRouteHelperReferences(line: string): FrontendHttpRequestReference[] {
  const references: FrontendHttpRequestReference[] = [];
  const routeRegex = /\broute\(\s*(['"])([^'"]+)\1/g;
  for (const match of line.matchAll(routeRegex)) {
    if (match.index === undefined || !match[2]) {
      continue;
    }
    const valueStart = match.index + match[0].lastIndexOf(match[2]);
    references.push({
      kind: "route-name",
      value: match[2],
      rangeStart: valueStart,
      rangeEnd: valueStart + match[2].length,
    });
  }
  return references;
}

function extractFrontendMethodCallReferences(line: string, aliases: FrontendUrlAliases): FrontendHttpRequestReference[] {
  const references: FrontendHttpRequestReference[] = [];
  const callRegex = new RegExp(`\\b[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*\\.(${HTTP_METHODS})\\(`, "gi");
  for (const match of line.matchAll(callRegex)) {
    if (match.index === undefined || !match[1]) {
      continue;
    }
    const openParen = match.index + match[0].length - 1;
    const firstArg = firstCallArgument(line, openParen);
    const pattern = firstArg ? routePatternFromExpression(firstArg.expression, aliases) : undefined;
    if (!firstArg || !pattern) {
      continue;
    }
    references.push({
      kind: "url",
      value: pattern,
      method: match[1].toUpperCase(),
      rangeStart: firstArg.start,
      rangeEnd: firstArg.end,
    });
  }
  return references;
}

function extractFrontendFetchReferences(line: string, aliases: FrontendUrlAliases): FrontendHttpRequestReference[] {
  const references: FrontendHttpRequestReference[] = [];
  const fetchRegex = /\bfetch\(/g;
  for (const match of line.matchAll(fetchRegex)) {
    if (match.index === undefined) {
      continue;
    }
    const openParen = match.index + match[0].length - 1;
    const firstArg = firstCallArgument(line, openParen);
    const pattern = firstArg ? routePatternFromExpression(firstArg.expression, aliases) : undefined;
    if (!firstArg || !pattern) {
      continue;
    }
    references.push({
      kind: "url",
      value: pattern,
      method: methodFromObjectOptions(line.slice(firstArg.end)) ?? "GET",
      rangeStart: firstArg.start,
      rangeEnd: firstArg.end,
    });
  }
  return references;
}

function extractFrontendObjectCallReferences(line: string, aliases: FrontendUrlAliases): FrontendHttpRequestReference[] {
  const references: FrontendHttpRequestReference[] = [];
  const urlRegex = /\burl\s*:/g;
  for (const match of line.matchAll(urlRegex)) {
    if (match.index === undefined) {
      continue;
    }
    const before = line.slice(0, match.index);
    if (!/\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(\s*\{/.test(before)) {
      continue;
    }

    const expression = expressionAfterColon(line, match.index + match[0].length);
    const pattern = expression ? routePatternFromExpression(expression.expression, aliases) : undefined;
    if (!expression || !pattern) {
      continue;
    }
    references.push({
      kind: "url",
      value: pattern,
      method: methodFromObjectOptions(line),
      rangeStart: expression.start,
      rangeEnd: expression.end,
    });
  }
  return references;
}

function methodFromObjectOptions(text: string): string | undefined {
  return /\bmethod\s*:\s*['"]([A-Za-z]+)['"]/i.exec(text)?.[1]?.toUpperCase();
}

function firstCallArgument(line: string, openParen: number): { expression: string; start: number; end: number } | undefined {
  return expressionUntil(line, openParen + 1, [",", ")"]);
}

function expressionAfterColon(line: string, start: number): { expression: string; start: number; end: number } | undefined {
  return expressionUntil(line, start, [",", "}"]);
}

function expressionUntil(
  line: string,
  rawStart: number,
  terminators: string[],
): { expression: string; start: number; end: number } | undefined {
  let start = rawStart;
  while (line[start] === " ") {
    start += 1;
  }

  let quote: string | undefined;
  let escaped = false;
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let index = start; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote && !(quote === "`" && braceDepth > 0)) {
        quote = undefined;
      } else if (quote === "`" && char === "$" && line[index + 1] === "{") {
        braceDepth += 1;
        index += 1;
      } else if (quote === "`" && char === "}" && braceDepth > 0) {
        braceDepth -= 1;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      if (parenDepth === 0 && terminators.includes(char)) {
        return cleanExpression(line, start, index);
      }
      parenDepth -= 1;
      continue;
    }
    if (char === "[") {
      bracketDepth += 1;
      continue;
    }
    if (char === "]") {
      bracketDepth -= 1;
      continue;
    }
    if (char === "{") {
      braceDepth += 1;
      continue;
    }
    if (char === "}") {
      if (braceDepth === 0 && terminators.includes(char)) {
        return cleanExpression(line, start, index);
      }
      braceDepth -= 1;
      continue;
    }
    if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && terminators.includes(char)) {
      return cleanExpression(line, start, index);
    }
  }

  return cleanExpression(line, start, line.length);
}

function cleanExpression(line: string, start: number, rawEnd: number): { expression: string; start: number; end: number } | undefined {
  let end = rawEnd;
  while (end > start && /\s/.test(line[end - 1] ?? "")) {
    end -= 1;
  }
  if (end <= start) {
    return undefined;
  }
  return { expression: line.slice(start, end), start, end };
}

export function routePatternFromExpression(expression: string, aliases: FrontendUrlAliases = new Map()): string | undefined {
  const trimmed = expression.trim();
  if (!trimmed) {
    return undefined;
  }

  const alias = aliases.get(trimmed);
  if (alias) {
    return alias;
  }

  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return normalizeRoutePattern(trimmed.slice(1, -1).replace(/\$\{[^}]+\}/g, "{param}"));
  }

  const parts = splitTopLevel(trimmed, "+");
  if (parts.length > 1) {
    const pattern = parts
      .map((part) => {
        const value = stringLiteralValue(part.trim());
        return value ?? "{param}";
      })
      .join("");

    return normalizeRoutePattern(pattern);
  }

  const literal = stringLiteralValue(trimmed);
  if (literal !== undefined) {
    return normalizeRoutePattern(literal);
  }

  return undefined;
}

function stringLiteralValue(value: string): string | undefined {
  if (value.length < 2) {
    return undefined;
  }
  const quote = value[0];
  if ((quote !== "'" && quote !== '"') || value[value.length - 1] !== quote) {
    return undefined;
  }
  return value.slice(1, -1);
}

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: string | undefined;
  let escaped = false;
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
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

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") {
      braceDepth += 1;
      continue;
    }
    if (char === "}") {
      braceDepth -= 1;
      continue;
    }
    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth -= 1;
      continue;
    }
    if (char === "[") {
      bracketDepth += 1;
      continue;
    }
    if (char === "]") {
      bracketDepth -= 1;
      continue;
    }
    if (char === separator && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

function normalizeRoutePattern(value: string): string {
  const normalized = value.trim().split(/[?#]/)[0]?.replace(/^\/+|\/+$/g, "") ?? "";
  return normalized ? `/${normalized.replace(/\{[^}]+\}/g, "{param}")}` : "/";
}
