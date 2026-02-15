import { QAIssue, SlideSpec } from "@consulting-ppt/shared";

export interface TextQaResult {
  score: number;
  issues: QAIssue[];
}

function normalizeForDupCheck(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return value
    .replace(/[^a-zA-Z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2);
}

function isConsultingToneGoverningMessage(value: string): boolean {
  const normalized = normalizeForDupCheck(value);
  if (!normalized) {
    return false;
  }
  const hasFormulaTone = /([a-z0-9가-힣][^=]{1,40}\+\s*[a-z0-9가-힣][^=]{1,40}=\s*[a-z0-9가-힣])/i.test(normalized);
  if (hasFormulaTone || normalized.includes("결론")) {
    return true;
  }
  return /(우선순위|재정렬|재설계|전환|구체화|강화|고도화|필요|해야)/.test(normalized);
}

export function runTextQa(spec: SlideSpec): TextQaResult {
  const issues: QAIssue[] = [];
  const governingMessageSet = new Set<string>();

  for (const slide of spec.slides) {
    if (slide.title.length < 3) {
      issues.push({
        rule: "title_min_length",
        severity: "medium",
        slide_id: slide.id,
        message: "슬라이드 제목이 너무 짧습니다"
      });
    }

    if (slide.title.length > 48) {
      issues.push({
        rule: "title_too_long",
        severity: "low",
        slide_id: slide.id,
        message: "슬라이드 제목이 길어 가독성이 낮아질 수 있습니다"
      });
    }

    if (slide.governing_message.length > 110) {
      issues.push({
        rule: "governing_message_length",
        severity: "medium",
        slide_id: slide.id,
        message: "거버닝 메시지가 길어 1~2줄 takeaway 원칙을 벗어납니다"
      });
    }

    const gmKey = normalizeForDupCheck(slide.governing_message);
    if (governingMessageSet.has(gmKey)) {
      issues.push({
        rule: "governing_message_duplicate",
        severity: "high",
        slide_id: slide.id,
        message: "거버닝 메시지가 중복되어 스토리라인 차별성이 부족합니다"
      });
    }
    governingMessageSet.add(gmKey);

    if (!isConsultingToneGoverningMessage(slide.governing_message)) {
      issues.push({
        rule: "governing_tone_non_consulting",
        severity: "medium",
        slide_id: slide.id,
        message: "거버닝 메시지가 컨설팅 의사결정 문체(우선순위/전환/재정렬) 기준에 미달합니다"
      });
    }

    const titleTokens = tokenize(slide.title);
    const gmTokens = new Set(tokenize(slide.governing_message));
    const overlapCount = titleTokens.filter((token) => gmTokens.has(token)).length;
    if (titleTokens.length > 0 && overlapCount === 0) {
      issues.push({
        rule: "title_body_inconsistency",
        severity: "medium",
        slide_id: slide.id,
        message: "제목과 거버닝 메시지 간 핵심 키워드 정합성이 낮습니다"
      });
    }

    for (const claim of slide.claims) {
      if (!claim.text.includes("So What:")) {
        issues.push({
          rule: "missing_so_what",
          severity: "high",
          slide_id: slide.id,
          message: "주장 문장에 So What이 없어 임원 의사결정 연결성이 약합니다"
        });
      }

      if (claim.text.length > 200) {
        issues.push({
          rule: "claim_too_long",
          severity: "medium",
          slide_id: slide.id,
          message: "claim 문장이 너무 길어 핵심 메시지가 흐려집니다"
        });
      }
    }
  }

  const deduction = issues.reduce((acc, issue) => {
    if (issue.severity === "high") {
      return acc + 6;
    }
    if (issue.severity === "medium") {
      return acc + 3;
    }
    return acc + 1;
  }, 0);

  return {
    score: Math.max(0, 20 - deduction),
    issues
  };
}
