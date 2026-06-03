import { resolveBoundImplementationDefinition } from "./boundDefinitionResolver";
import type { LaravelIndex } from "../indexer";
import type { SourceLocation } from "../indexer/types";
import type { Logger } from "../logging/logger";

export interface BoundDefinitionLink {
  start: number;
  end: number;
  source: SourceLocation;
}

export function resolveBoundImplementationLinks(
  index: LaravelIndex,
  logger: Logger,
  text: string,
): BoundDefinitionLink[] {
  const links: BoundDefinitionLink[] = [];
  const seen = new Set<string>();

  for (const range of boundNavigationCandidateRanges(text)) {
    const source = resolveBoundImplementationDefinition(index, logger, text, range.start + Math.floor((range.end - range.start) / 2));
    if (!source) {
      continue;
    }

    const key = `${range.start}:${range.end}:${source.file}:${source.line}:${source.character}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    links.push({ ...range, source });
  }

  return links;
}

function boundNavigationCandidateRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];

  collectRanges(text, /\bapp\s*\(\s*\\?[A-Za-z_][A-Za-z0-9_\\]*::class\s*\)\s*\??->\s*([A-Za-z_][A-Za-z0-9_]*)/g, ranges);
  collectRanges(
    text,
    /\bapp\s*\(\s*\)\s*\??->\s*make\s*\(\s*\\?[A-Za-z_][A-Za-z0-9_\\]*::class\s*\)\s*\??->\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    ranges,
  );
  collectRanges(text, /\bApp::make\s*\(\s*\\?[A-Za-z_][A-Za-z0-9_\\]*::class\s*\)\s*\??->\s*([A-Za-z_][A-Za-z0-9_]*)/g, ranges);
  collectRanges(
    text,
    /\$this\s*->\s*app\s*\??->\s*make\s*\(\s*\\?[A-Za-z_][A-Za-z0-9_\\]*::class\s*\)\s*\??->\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    ranges,
  );
  collectRanges(text, /\$this\s*->\s*[A-Za-z_][A-Za-z0-9_]*\s*\??->\s*([A-Za-z_][A-Za-z0-9_]*)/g, ranges);
  collectRanges(text, /(?<!>)\$[A-Za-z_][A-Za-z0-9_]*\s*\??->\s*([A-Za-z_][A-Za-z0-9_]*)/g, ranges);
  collectRanges(text, /\\?([A-Za-z_][A-Za-z0-9_\\]*)::class/g, ranges);

  return ranges;
}

function collectRanges(text: string, regex: RegExp, ranges: Array<{ start: number; end: number }>): void {
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined || !match[1]) {
      continue;
    }

    const start = match.index + match[0].lastIndexOf(match[1]);
    ranges.push({ start, end: start + match[1].length });
  }
}
