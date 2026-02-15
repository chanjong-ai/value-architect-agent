import { Box } from "./layout-engine";

export interface FitTextResult {
  text: string;
  truncated: boolean;
  capacity: number;
}

interface CapacityEstimateOptions {
  lineHeight?: number;
  charWidth?: number;
  fillRatio?: number;
  minCapacity?: number;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function protectDecimalPoints(value: string): string {
  return value.replace(/(\d)\.(\d)/g, "$1__DOT__$2");
}

function restoreDecimalPoints(value: string): string {
  return value.replace(/__DOT__/g, ".");
}

function splitSentences(value: string): string[] {
  const compact = normalizeWhitespace(value);
  if (!compact) {
    return [];
  }
  const protectedText = protectDecimalPoints(compact);
  const raw = protectedText.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/g) ?? [protectedText];
  return raw.map((item) => restoreDecimalPoints(item).trim()).filter((item) => item.length > 0);
}

function withEllipsis(value: string, capacity: number): string {
  const trimmed = restoreDecimalPoints(value.replace(/[ ,;:]+$/g, "").trim());
  if (!trimmed) {
    return "...".slice(0, Math.max(1, capacity));
  }
  if (trimmed.endsWith("...")) {
    return trimmed.length > capacity ? `${trimmed.slice(0, Math.max(1, capacity - 3)).trim()}...` : trimmed;
  }
  if (trimmed.length + 3 <= capacity) {
    return `${trimmed}...`;
  }
  return `${trimmed.slice(0, Math.max(1, capacity - 3)).trim()}...`;
}

function normalizeSoWhatSpacing(value: string): string {
  return value.replace(/\(\s*So What:/gi, "(So What:").replace(/\s+\)/g, ")");
}

export function estimateCharCapacity(area: Box, fontSize: number, options: CapacityEstimateOptions = {}): number {
  const widthPt = Math.max(7.2, area.w * 72);
  const heightPt = Math.max(7.2, area.h * 72);
  const safeFontSize = Math.max(5, fontSize);
  const charWidth = Math.max(0.35, options.charWidth ?? 0.53);
  const lineHeight = Math.max(1.0, options.lineHeight ?? 1.2);
  const fillRatio = Math.max(0.5, Math.min(1, options.fillRatio ?? 0.9));
  const minCapacity = Math.max(8, Math.floor(options.minCapacity ?? 24));

  const charsPerLine = Math.max(8, Math.floor(widthPt / (safeFontSize * charWidth)));
  const lineCount = Math.max(1, Math.floor(heightPt / (safeFontSize * lineHeight)));
  return Math.max(minCapacity, Math.floor(charsPerLine * lineCount * fillRatio));
}

export function fitTextToCapacity(value: string, capacityInput: number): FitTextResult {
  const normalized = restoreDecimalPoints(normalizeWhitespace(value));
  const capacity = Math.max(8, Math.floor(capacityInput));

  if (normalized.length <= capacity) {
    return {
      text: normalized,
      truncated: false,
      capacity
    };
  }

  const sentences = splitSentences(normalized);
  if (sentences.length > 1) {
    let sentenceBuilt = "";
    for (const sentence of sentences) {
      const candidate = sentenceBuilt ? `${sentenceBuilt} ${sentence}` : sentence;
      if (candidate.length <= capacity) {
        sentenceBuilt = candidate;
      } else {
        break;
      }
    }

    if (sentenceBuilt.length >= Math.min(capacity - 3, 20)) {
      return {
        text: withEllipsis(sentenceBuilt, capacity),
        truncated: true,
        capacity
      };
    }
  }

  const words = normalized.split(" ");
  let wordBuilt = "";
  for (const word of words) {
    const candidate = wordBuilt ? `${wordBuilt} ${word}` : word;
    if (candidate.length <= capacity - 3) {
      wordBuilt = candidate;
    } else {
      break;
    }
  }

  if (wordBuilt.trim().length > 0) {
    return {
      text: withEllipsis(wordBuilt, capacity),
      truncated: true,
      capacity
    };
  }

  return {
    text: withEllipsis(normalized.slice(0, Math.max(1, capacity - 3)), capacity),
    truncated: true,
    capacity
  };
}

export function fitClaimPreserveSoWhat(value: string, capacityInput: number): FitTextResult {
  const capacity = Math.max(8, Math.floor(capacityInput));
  const marker = "So What:";
  const markerIndex = value.toLowerCase().indexOf(marker.toLowerCase());
  if (markerIndex < 0) {
    return fitTextToCapacity(value, capacity);
  }

  const head = normalizeWhitespace(value.slice(0, markerIndex));
  const tail = normalizeWhitespace(value.slice(markerIndex));
  if (!tail) {
    return fitTextToCapacity(value, capacity);
  }

  if (tail.length >= capacity - 6) {
    return fitTextToCapacity(value, capacity);
  }

  const headBudget = capacity - tail.length - 1;
  const fittedHead = fitTextToCapacity(head, headBudget);
  const merged = normalizeSoWhatSpacing(normalizeWhitespace(`${fittedHead.text.replace(/\.\.\.$/, "")} ${tail}`));

  if (merged.length <= capacity) {
    return {
      text: merged,
      truncated: fittedHead.truncated,
      capacity
    };
  }

  return fitTextToCapacity(value, capacity);
}

const GOVERNING_DECISION_PATTERN = /(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/;

export function fitGoverningMessagePreserveDecision(value: string, capacityInput: number): FitTextResult {
  const normalized = restoreDecimalPoints(normalizeWhitespace(value));
  const capacity = Math.max(8, Math.floor(capacityInput));

  if (normalized.length <= capacity) {
    return {
      text: normalized,
      truncated: false,
      capacity
    };
  }

  if (GOVERNING_DECISION_PATTERN.test(normalized.slice(0, Math.min(normalized.length, capacity)))) {
    return fitTextToCapacity(normalized, capacity);
  }

  const sentences = splitSentences(normalized);
  const keySentence = sentences.find((sentence) => GOVERNING_DECISION_PATTERN.test(sentence));
  if (keySentence) {
    const compactKey = normalizeWhitespace(keySentence);
    if (compactKey.length <= capacity) {
      return {
        text: compactKey,
        truncated: true,
        capacity
      };
    }
    return fitTextToCapacity(compactKey, capacity);
  }

  return fitTextToCapacity(normalized, capacity);
}

export function fitTextByArea(
  value: string,
  area: Box,
  fontSize: number,
  options: CapacityEstimateOptions = {}
): FitTextResult {
  const capacity = estimateCharCapacity(area, fontSize, options);
  return fitTextToCapacity(value, capacity);
}
