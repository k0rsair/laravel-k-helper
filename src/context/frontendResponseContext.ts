import {
  collectFrontendUrlAliases,
  extractFrontendHttpRequestsFromLine,
  type FrontendHttpRequestReference,
} from "./frontendHttpContext";

export type FrontendResponseCompletionContext =
  | {
      kind: "response";
      request: FrontendHttpRequestReference;
      receiver: string;
      path: string[];
      prefix: string;
      rangeStart: number;
      rangeEnd: number;
    }
  | {
      kind: "none";
      reason: "no-response-receiver" | "unmatched-request" | "unsupported-chain";
    };

export type FrontendResponseFieldContext =
  | {
      kind: "response-field";
      request: FrontendHttpRequestReference;
      receiver: string;
      path: string[];
      field: string;
      fieldPath: string[];
      rangeStart: number;
      rangeEnd: number;
    }
  | {
      kind: "none";
      reason: "no-response-receiver" | "unmatched-request" | "unsupported-chain";
    };

export function resolveFrontendResponseCompletionContext(text: string, offset: number): FrontendResponseCompletionContext {
  const boundedOffset = Math.max(0, Math.min(offset, text.length));
  const prefixText = text.slice(0, boundedOffset);
  const chain = responsePropertyChainAtPrefix(prefixText, boundedOffset);
  if (!chain) {
    return { kind: "none", reason: "no-response-receiver" };
  }

  const lines = prefixText.split(/\r?\n/);
  const aliases = collectFrontendUrlAliases(lines);
  const bindings = collectResponseBindings(lines, aliases);

  const responseRequest = bindings.responseVariables.get(chain.receiver);
  if (responseRequest && chain.parts[1] === "data") {
    return {
      kind: "response",
      request: responseRequest,
      receiver: chain.receiver,
      path: chain.parts.slice(2),
      prefix: chain.prefix,
      rangeStart: chain.rangeStart,
      rangeEnd: chain.rangeEnd,
    };
  }

  const dataRequest = bindings.dataVariables.get(chain.receiver);
  if (dataRequest) {
    return {
      kind: "response",
      request: dataRequest,
      receiver: chain.receiver,
      path: chain.parts.slice(1),
      prefix: chain.prefix,
      rangeStart: chain.rangeStart,
      rangeEnd: chain.rangeEnd,
    };
  }

  return { kind: "none", reason: responseRequest ? "unsupported-chain" : "unmatched-request" };
}

export function resolveFrontendResponseFieldContext(text: string, offset: number): FrontendResponseFieldContext {
  const boundedOffset = Math.max(0, Math.min(offset, text.length));
  const chain = responsePropertyChainAtOffset(text, boundedOffset);
  if (!chain) {
    return { kind: "none", reason: "no-response-receiver" };
  }

  const lines = text.slice(0, boundedOffset).split(/\r?\n/);
  const aliases = collectFrontendUrlAliases(lines);
  const bindings = collectResponseBindings(text.split(/\r?\n/), aliases);

  const responseRequest = bindings.responseVariables.get(chain.receiver);
  if (responseRequest && chain.parts[1] === "data" && chain.activeIndex >= 2) {
    const fieldPath = chain.parts.slice(2, chain.activeIndex + 1);
    return {
      kind: "response-field",
      request: responseRequest,
      receiver: chain.receiver,
      path: fieldPath.slice(0, -1),
      field: fieldPath[fieldPath.length - 1] ?? "",
      fieldPath,
      rangeStart: chain.rangeStart,
      rangeEnd: chain.rangeEnd,
    };
  }

  const dataRequest = bindings.dataVariables.get(chain.receiver);
  if (dataRequest && chain.activeIndex >= 1) {
    const fieldPath = chain.parts.slice(1, chain.activeIndex + 1);
    return {
      kind: "response-field",
      request: dataRequest,
      receiver: chain.receiver,
      path: fieldPath.slice(0, -1),
      field: fieldPath[fieldPath.length - 1] ?? "",
      fieldPath,
      rangeStart: chain.rangeStart,
      rangeEnd: chain.rangeEnd,
    };
  }

  return { kind: "none", reason: responseRequest ? "unsupported-chain" : "unmatched-request" };
}

function collectResponseBindings(
  lines: readonly string[],
  aliases: ReturnType<typeof collectFrontendUrlAliases>,
): {
  responseVariables: Map<string, FrontendHttpRequestReference>;
  dataVariables: Map<string, FrontendHttpRequestReference>;
} {
  const responseVariables = new Map<string, FrontendHttpRequestReference>();
  const dataVariables = new Map<string, FrontendHttpRequestReference>();

  for (const line of lines) {
    const request = extractFrontendHttpRequestsFromLine(line, aliases)[0];
    const responseVariable = request ? responseVariableFromRequestLine(line) : undefined;
    if (request && responseVariable) {
      responseVariables.set(responseVariable, request);
    }

    const thenBinding = request ? thenResponseVariableFromLine(line) : undefined;
    if (request && thenBinding) {
      responseVariables.set(thenBinding, request);
    }

    const destructuredData = request ? destructuredDataVariableFromRequestLine(line) : undefined;
    if (request && destructuredData) {
      dataVariables.set(destructuredData, request);
    }

    const directData = request ? dataVariableFromAxiosDataLine(line) : undefined;
    if (request && directData) {
      dataVariables.set(directData, request);
    }

    const jsonData = dataVariableFromJsonLine(line);
    const jsonRequest = jsonData ? responseVariables.get(jsonData.responseVariable) : undefined;
    if (jsonData && jsonRequest) {
      dataVariables.set(jsonData.dataVariable, jsonRequest);
    }
  }

  return { responseVariables, dataVariables };
}

function responsePropertyChainAtPrefix(
  prefixText: string,
  offset: number,
): { receiver: string; parts: string[]; prefix: string; rangeStart: number; rangeEnd: number } | undefined {
  const match = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.([A-Za-z_$][\w$]*)?$/.exec(prefixText);
  if (!match?.[1]) {
    return undefined;
  }

  const currentPrefix = match[2] ?? "";
  const parts = match[1].split(".");
  return {
    receiver: parts[0] ?? "",
    parts,
    prefix: currentPrefix,
    rangeStart: offset - currentPrefix.length,
    rangeEnd: offset,
  };
}

function responsePropertyChainAtOffset(
  text: string,
  offset: number,
): { receiver: string; parts: string[]; activeIndex: number; rangeStart: number; rangeEnd: number } | undefined {
  if (!/[A-Za-z0-9_$]/.test(text[offset] ?? "") && !/[A-Za-z0-9_$]/.test(text[offset - 1] ?? "")) {
    return undefined;
  }

  let start = offset;
  let end = offset;

  while (start > 0 && /[A-Za-z0-9_$.]/.test(text[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < text.length && /[A-Za-z0-9_$.]/.test(text[end] ?? "")) {
    end += 1;
  }

  const chainText = text.slice(start, end);
  if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(chainText)) {
    return undefined;
  }

  const relativeOffset = Math.max(0, Math.min(offset - start, chainText.length - 1));
  const parts = chainText.split(".");
  let cursor = 0;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    const partStart = cursor;
    const partEnd = partStart + part.length;
    if (relativeOffset <= partEnd) {
      return {
        receiver: parts[0] ?? "",
        parts,
        activeIndex: index,
        rangeStart: start + partStart,
        rangeEnd: start + partEnd,
      };
    }
    cursor = partEnd + 1;
  }

  return undefined;
}

function responseVariableFromRequestLine(line: string): string | undefined {
  return /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.(?:get|post|put|patch|delete|options|head)\(|fetch\()/i.exec(line)?.[1];
}

function thenResponseVariableFromLine(line: string): string | undefined {
  return /\.then\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>/.exec(line)?.[1];
}

function destructuredDataVariableFromRequestLine(line: string): string | undefined {
  const match = /\b(?:const|let|var)\s*\{\s*data(?:\s*:\s*([A-Za-z_$][\w$]*))?\s*\}\s*=\s*await\s+/.exec(line);
  if (!match) {
    return undefined;
  }
  return match[1] ?? "data";
}

function dataVariableFromAxiosDataLine(line: string): string | undefined {
  return /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(?\s*await\s+[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.(?:get|post|put|patch|delete|options|head)\([^)]*\)\s*\)?\.data\b/i.exec(line)?.[1];
}

function dataVariableFromJsonLine(line: string): { dataVariable: string; responseVariable: string } | undefined {
  const match = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+([A-Za-z_$][\w$]*)\.json\(\s*\)/.exec(line);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return {
    dataVariable: match[1],
    responseVariable: match[2],
  };
}
