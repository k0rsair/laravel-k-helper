export type BoundImplementationDefinitionContext =
  | {
      kind: "method";
      abstractClass: string;
      method: string;
      receiver: string;
    }
  | {
      kind: "class";
      abstractClass: string;
    }
  | {
      kind: "none";
      reason: "no-word" | "unsupported-expression" | "no-typed-receiver";
    };

export function resolveBoundImplementationDefinitionContext(
  text: string,
  offset: number,
): BoundImplementationDefinitionContext {
  const word = wordRangeAtOffset(text, offset);
  if (!word) {
    return { kind: "none", reason: "no-word" };
  }

  const classReference = classReferenceAtOffset(text, offset);
  if (classReference) {
    return {
      kind: "class",
      abstractClass: resolveClassReference(classReference, text),
    };
  }

  const prefix = text.slice(0, word.end);
  const directMake = directMakeCallAtPrefix(prefix);
  if (directMake) {
    return {
      kind: "method",
      abstractClass: resolveClassReference(directMake.abstractClass, text),
      method: directMake.method,
      receiver: "container",
    };
  }

  const thisPropertyCall = /\$this\s*->\s*([A-Za-z_][A-Za-z0-9_]*)\s*\??->\s*([A-Za-z_][A-Za-z0-9_]*)$/.exec(prefix);
  if (thisPropertyCall?.[1] && thisPropertyCall[2]) {
    const abstractClass = findThisPropertyType(text, thisPropertyCall[1], word.start);
    if (!abstractClass) {
      return { kind: "none", reason: "no-typed-receiver" };
    }

    return {
      kind: "method",
      abstractClass,
      method: thisPropertyCall[2],
      receiver: `$this->${thisPropertyCall[1]}`,
    };
  }

  const variableCall = /(?<!>)\$([A-Za-z_][A-Za-z0-9_]*)\s*\??->\s*([A-Za-z_][A-Za-z0-9_]*)$/.exec(prefix);
  if (variableCall?.[1] && variableCall[2]) {
    const abstractClass = findVariableType(text, variableCall[1], word.start);
    if (!abstractClass) {
      return { kind: "none", reason: "no-typed-receiver" };
    }

    return {
      kind: "method",
      abstractClass,
      method: variableCall[2],
      receiver: `$${variableCall[1]}`,
    };
  }

  return { kind: "none", reason: "unsupported-expression" };
}

function directMakeCallAtPrefix(prefix: string): { abstractClass: string; method: string } | undefined {
  const classPattern = "([A-Za-z_\\\\][A-Za-z0-9_\\\\]*)";
  const patterns = [
    new RegExp(`\\bapp\\s*\\(\\s*\\\\?${classPattern}::class\\s*\\)\\s*\\??->\\s*([A-Za-z_][A-Za-z0-9_]*)$`),
    new RegExp(`\\bapp\\s*\\(\\s*\\)\\s*\\??->\\s*make\\s*\\(\\s*\\\\?${classPattern}::class\\s*\\)\\s*\\??->\\s*([A-Za-z_][A-Za-z0-9_]*)$`),
    new RegExp(`\\bApp::make\\s*\\(\\s*\\\\?${classPattern}::class\\s*\\)\\s*\\??->\\s*([A-Za-z_][A-Za-z0-9_]*)$`),
    new RegExp(`\\$this\\s*->\\s*app\\s*\\??->\\s*make\\s*\\(\\s*\\\\?${classPattern}::class\\s*\\)\\s*\\??->\\s*([A-Za-z_][A-Za-z0-9_]*)$`),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(prefix);
    if (match?.[1] && match[2]) {
      return {
        abstractClass: match[1],
        method: match[2],
      };
    }
  }

  return undefined;
}

function classReferenceAtOffset(text: string, offset: number): string | undefined {
  const classReferenceRegex = /\\?([A-Za-z_][A-Za-z0-9_\\]*)::class/g;
  for (const match of text.matchAll(classReferenceRegex)) {
    if (match.index === undefined || !match[1]) {
      continue;
    }
    const classStart = match.index + match[0].indexOf(match[1]);
    const classEnd = classStart + match[1].length;
    if (offset >= classStart && offset <= classEnd) {
      return match[1];
    }
  }

  return undefined;
}

function findThisPropertyType(text: string, propertyName: string, offset: number): string | undefined {
  const directPropertyType = findVariableType(text, propertyName, offset);
  if (directPropertyType) {
    return directPropertyType;
  }

  const prefix = text.slice(0, offset);
  const assignmentRegex = new RegExp(`\\$this->${escapeRegex(propertyName)}\\s*=\\s*\\$([A-Za-z_][A-Za-z0-9_]*)`, "g");
  const assignments = [...prefix.matchAll(assignmentRegex)];
  const assignedVariable = assignments[assignments.length - 1]?.[1];
  return assignedVariable ? findVariableType(text, assignedVariable, offset) : undefined;
}

function findVariableType(text: string, variableName: string, offset: number): string | undefined {
  const prefix = text.slice(0, offset);
  const typeRegex = new RegExp(
    `(?:^|[\\(,]\\s*|[\\r\\n]\\s*)(?:(?:public|protected|private)\\s+)?(?:readonly\\s+)?\\??\\\\?([A-Za-z_][A-Za-z0-9_\\\\]*)\\s+\\$${escapeRegex(variableName)}\\b`,
    "g",
  );
  const matches = [...prefix.matchAll(typeRegex)];
  const type = matches.map((match) => match[1]).filter((matchType): matchType is string => {
    return matchType !== undefined && !PHP_KEYWORD_TYPES.has(matchType.toLowerCase());
  }).pop();
  return type ? resolveClassReference(type, text) : undefined;
}

const PHP_KEYWORD_TYPES = new Set([
  "and",
  "array",
  "as",
  "bool",
  "callable",
  "class",
  "clone",
  "const",
  "else",
  "elseif",
  "false",
  "float",
  "fn",
  "function",
  "if",
  "int",
  "iterable",
  "mixed",
  "new",
  "null",
  "object",
  "or",
  "parent",
  "return",
  "self",
  "static",
  "string",
  "true",
  "void",
  "while",
  "xor",
]);

function resolveClassReference(reference: string, text: string): string {
  const normalized = reference.replace(/^\\/, "");
  if (normalized.includes("\\")) {
    return normalized;
  }

  const uses = scanUseStatements(text);
  const imported = uses.get(normalized);
  if (imported) {
    return imported;
  }

  const namespace = /namespace\s+([^;]+);/.exec(text)?.[1];
  return namespace ? `${namespace}\\${normalized}` : normalized;
}

function scanUseStatements(text: string): Map<string, string> {
  const uses = new Map<string, string>();
  for (const match of text.matchAll(/^use\s+([^;{}]+)\\\{([^}]+)\};/gm)) {
    const namespace = match[1]?.trim().replace(/\\$/, "");
    const imports = match[2]?.split(",") ?? [];
    if (!namespace) {
      continue;
    }
    for (const imported of imports) {
      const fqcn = imported.trim();
      if (!fqcn) {
        continue;
      }
      const aliasMatch = /\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(fqcn);
      const className = aliasMatch?.[1] ?? fqcn.replace(/\s+as\s+[A-Za-z_][A-Za-z0-9_]*$/i, "").split("\\").pop();
      if (className) {
        uses.set(className, `${namespace}\\${fqcn.replace(/\s+as\s+[A-Za-z_][A-Za-z0-9_]*$/i, "")}`);
      }
    }
  }
  for (const match of text.matchAll(/^use\s+([^;]+);/gm)) {
    const fqcn = match[1]?.trim();
    if (!fqcn || fqcn.includes("{")) {
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

function wordRangeAtOffset(text: string, offset: number): { start: number; end: number } | undefined {
  const boundedOffset = Math.max(0, Math.min(offset, text.length));
  let start = boundedOffset;
  let end = boundedOffset;

  while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < text.length && /[A-Za-z0-9_]/.test(text[end] ?? "")) {
    end += 1;
  }

  if (start === end) {
    return undefined;
  }

  return { start, end };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
