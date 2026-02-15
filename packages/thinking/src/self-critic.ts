import { BriefNormalized, ResearchPack, SlideSpec } from "@consulting-ppt/shared";

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars - 3)}...`;
}

function truncateClaimKeepSoWhat(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const marker = "So What:";
  const markerIndex = text.toLowerCase().indexOf(marker.toLowerCase());
  if (markerIndex < 0) {
    return truncate(text, maxChars);
  }

  const head = text.slice(0, markerIndex).trim();
  const tail = text.slice(markerIndex).trim();
  const budget = maxChars - tail.length - 1;
  if (budget <= 20) {
    return truncate(text, maxChars);
  }

  const compactHead = truncate(head, budget).replace(/\\.\\.\\.$/, "").trim();
  const merged = `${compactHead} ${tail}`.replace(/\\s+/g, " ").trim();
  if (merged.length <= maxChars) {
    return merged;
  }
  return truncate(text, maxChars);
}

function sanitizeWithAvoidRules(text: string, avoidTerms: string[]): string {
  let sanitized = text;
  for (const term of avoidTerms) {
    if (!term.trim()) {
      continue;
    }
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitized = sanitized.replace(new RegExp(escaped, "gi"), "검증 데이터");
  }
  return sanitized;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanupSentenceEnd(value: string): string {
  return compact(value).replace(/[.。]+$/g, "");
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\(?\s*so what:\s*([^)]+)\)?/gi, "")
    .replace(/[^a-z0-9가-힣\s]/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function tokenJaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let inter = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      inter += 1;
    }
  }

  const union = setA.size + setB.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function extractSoWhat(text: string): string | null {
  const matched = text.match(/\(?\s*So What:\s*([^)]+)\)?/i);
  if (!matched) {
    return null;
  }
  return cleanupSentenceEnd(matched[1] ?? "");
}

function normalizeClaimSoWhat(text: string, fallbackSoWhat = "의사결정과 실행 우선순위가 명확해진다"): string {
  const normalized = compact(text);
  if (!normalized) {
    return `(So What: ${fallbackSoWhat})`;
  }

  const soWhat = extractSoWhat(normalized) ?? fallbackSoWhat;
  const body = cleanupSentenceEnd(normalized.replace(/\(?\s*So What:\s*([^)]+)\)?/gi, ""));
  return `${body} (So What: ${soWhat})`;
}

function dedupeClaimWithSlideContext(claimText: string, slideTitle: string, claimIndex: number): string {
  const soWhat = extractSoWhat(claimText) ?? "의사결정과 실행 우선순위가 명확해진다";
  const body = cleanupSentenceEnd(claimText.replace(/\(?\s*So What:\s*([^)]+)\)?/gi, ""));
  const differentiated = `${body}. ${slideTitle} 관점의 차별화 포인트를 ${claimIndex + 1}순위로 명확화한다`;
  return normalizeClaimSoWhat(differentiated, soWhat);
}

function hasKoreanBatchim(word: string): boolean {
  const trimmed = word.trim();
  if (!trimmed) {
    return false;
  }
  const lastChar = trimmed.charCodeAt(trimmed.length - 1);
  if (lastChar < 0xac00 || lastChar > 0xd7a3) {
    return false;
  }
  return (lastChar - 0xac00) % 28 !== 0;
}

function topicParticle(word: string): "은" | "는" {
  return hasKoreanBatchim(word) ? "은" : "는";
}

function andParticle(word: string): "과" | "와" {
  return hasKoreanBatchim(word) ? "과" : "와";
}

function claimSimilarity(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  const setLeft = new Set(leftTokens);
  const setRight = new Set(rightTokens);
  if (setLeft.size === 0 || setRight.size === 0) {
    return 0;
  }

  let inter = 0;
  for (const token of setLeft) {
    if (setRight.has(token)) {
      inter += 1;
    }
  }
  const union = setLeft.size + setRight.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function compressClaimsForDiversity(
  claims: SlideSpec["slides"][number]["claims"],
  maxCount: number
): SlideSpec["slides"][number]["claims"] {
  const kept: SlideSpec["slides"][number]["claims"] = [];
  for (const claim of claims) {
    if (kept.length >= maxCount) {
      break;
    }
    const duplicated = kept.some((item) => claimSimilarity(item.text, claim.text) >= 0.86);
    if (duplicated && kept.length >= 3) {
      continue;
    }
    kept.push(claim);
  }

  if (kept.length >= Math.min(3, claims.length)) {
    return kept.slice(0, maxCount);
  }
  return claims.slice(0, maxCount);
}

function conciseMetric(value: number | undefined, unit?: string): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return `${Number(value.toFixed(2))}${unit ?? ""}`.trim() || null;
}

function resolveSlideMetricHint(
  slide: SlideSpec["slides"][number],
  evidenceById: Map<string, ResearchPack["evidences"][number]>
): string {
  const values: string[] = [];
  for (const claim of slide.claims) {
    for (const evidenceId of claim.evidence_ids) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        continue;
      }
      const metric = conciseMetric(evidence.numeric_values[0], evidence.unit);
      if (!metric) {
        continue;
      }
      if (!values.includes(metric)) {
        values.push(metric);
      }
      if (values.length >= 2) {
        break;
      }
    }
    if (values.length >= 2) {
      break;
    }
  }
  return values.length > 0 ? values.join("·") : "핵심 지표";
}

function rewriteTitleForConsultingTone(
  title: string,
  slide: SlideSpec["slides"][number],
  brief: BriefNormalized
): string {
  const normalized = compact(title);
  if (slide.type === "cover") {
    return normalized;
  }

  const generic = /^(executive summary|시장 개요|경쟁 환경|재무 성과 비교|리스크 분석|전략적 시사점|트렌드 ?& ?기회)$/i.test(normalized);
  if (!generic && normalized.length >= 10) {
    return normalized;
  }

  switch (slide.type) {
    case "exec-summary":
      return `핵심 결론: ${brief.target_company} 전략 우선순위`;
    case "market-landscape":
      return "시장 진단: 수요·성장·지역 재편";
    case "benchmark":
      return normalized.includes(brief.target_company)
        ? `${brief.target_company} 경쟁력 진단: 우위·열위`
        : "경쟁 비교: 포지셔닝·수익성 격차";
    case "risks-issues":
      return "핵심 리스크: 영향도·대응 우선순위";
    case "roadmap":
      return "실행 로드맵: 단계별 KPI·오너십";
    case "appendix":
      return normalized.startsWith("부록") ? normalized : `부록: ${normalized}`;
    default:
      return normalized;
  }
}

function polishGoverningMessageTone(
  message: string,
  slideTitle: string,
  brief: BriefNormalized,
  metricHint: string
): string {
  const normalized = compact(message.replace(/\s*\+\s*/g, " 및 ").replace(/\s*=\s*/g, ", "));
  const body = cleanupSentenceEnd(normalized.replace(/\s*\|\s*전장\([^)]+\)\s*인사이트를 실행 축으로 연결/gi, ""));
  const anchor = body.match(/\[[^\]]+\]/)?.[0] ?? "";
  const titleWithAnchor = anchor && !slideTitle.includes(anchor) ? `${slideTitle} ${anchor}` : slideTitle;
  const prefixed = body.includes(slideTitle) ? body : `${titleWithAnchor}: ${body}`;

  const hasDecisionVerb = /(재정렬|재설계|전환|구체화|고도화|강화|필요|해야)/.test(prefixed);
  const hasCompany = prefixed.includes(brief.target_company);
  if (hasDecisionVerb && hasCompany) {
    return prefixed.replace(/\s+/g, " ");
  }

  return `${titleWithAnchor}: ${metricHint} 기준 ${brief.target_company}${topicParticle(brief.target_company)} 핵심 투자·고객 우선순위를 재정렬해야 한다`;
}

function hasNumericSignal(value: string): boolean {
  return /\d/.test(value);
}

function hasEntitySignal(value: string, brief: BriefNormalized): boolean {
  const corpus = normalizeForEntityCheck(value);
  if (!corpus) {
    return false;
  }

  const terms = [brief.target_company, ...brief.competitors]
    .map((term) => normalizeForEntityCheck(term))
    .filter((term) => term.length >= 2)
    .slice(0, 8);
  return terms.some((term) => corpus.includes(term));
}

function normalizeForEntityCheck(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function needsClaimUpgrade(text: string, brief: BriefNormalized): boolean {
  const normalized = normalizeForEntityCheck(text);
  if (!normalized) {
    return true;
  }

  const genericSignals = [
    "경영진 의사결정에 직접 연결",
    "정량 근거 기반",
    "핵심 과제 축",
    "스토리라인 전개상",
    "우선 검증해야 한다"
  ];
  if (genericSignals.some((signal) => normalized.includes(normalizeForEntityCheck(signal)))) {
    return true;
  }

  if (!hasNumericSignal(text) && !/kpi/i.test(text)) {
    return true;
  }

  if (!hasEntitySignal(text, brief) && !/경쟁사|시장|고객/.test(text)) {
    return true;
  }

  return text.length < 68;
}

function shortEvidenceHint(evidence: ResearchPack["evidences"][number] | undefined): string {
  if (!evidence?.claim_text) {
    return "핵심 근거";
  }
  const normalized = cleanupSentenceEnd(evidence.claim_text).replace(/\s+/g, " ");
  if (normalized.length <= 34) {
    return normalized;
  }
  return `${normalized.slice(0, 31).trim()}...`;
}

function rewriteClaimForConsultingQuality(
  slide: SlideSpec["slides"][number],
  claimIndex: number,
  brief: BriefNormalized,
  evidenceById: Map<string, ResearchPack["evidences"][number]>
): string {
  const claim = slide.claims[claimIndex];
  const evidenceA = evidenceById.get(claim.evidence_ids[0] ?? "");
  const evidenceB = evidenceById.get(claim.evidence_ids[1] ?? "");
  const metricA = conciseMetric(evidenceA?.numeric_values[0], evidenceA?.unit) ?? "핵심 지표";
  const metricB = conciseMetric(evidenceB?.numeric_values[0], evidenceB?.unit) ?? metricA;
  const competitor = brief.competitors[claimIndex % Math.max(1, brief.competitors.length)] ?? "주요 경쟁사";
  const hintA = shortEvidenceHint(evidenceA);
  const hintB = shortEvidenceHint(evidenceB);
  const targetTopic = `${brief.target_company}${topicParticle(brief.target_company)}`;
  const targetAnd = `${brief.target_company}${andParticle(brief.target_company)}`;

  if (claimIndex === 0) {
    return normalizeClaimSoWhat(
      `진단: ${metricA} 대비 ${metricB} 변동을 보면 ${slide.title}에서 ${brief.target_company}의 핵심 병목이 확인된다. ${hintA}/${hintB} 근거를 기준으로 우선순위 재정렬이 필요하다`,
      "핵심 이슈를 수치 근거와 함께 명확히 정의한다"
    );
  }

  if (claimIndex === 1) {
    return normalizeClaimSoWhat(
      `해석: ${targetAnd} ${competitor} 비교 시 ${metricA}/${metricB} 격차가 지속되고 있어 고객·제품 포트폴리오 선택 기준을 재설계해야 한다. ${slide.title}의 투자 대안은 수익성/리스크 동시 관점으로 재평가가 필요하다`,
      "대안별 트레이드오프를 계량 비교해 선택 오류를 줄인다"
    );
  }

  return normalizeClaimSoWhat(
    `실행: 0-6개월 핵심과제 착수, 6-18개월 확장, 18-36개월 체질전환 순서로 추진한다. ${targetTopic} KPI(${metricA}, ${metricB})와 오너십을 월간 리듬으로 관리해 실행 게이트를 운영해야 한다`,
    "실행 책임과 성과 가시성을 동시에 확보한다"
  );
}

function ensureMustIncludeCoverage(spec: SlideSpec, brief: BriefNormalized): void {
  const normalizedSlides = spec.slides.map((slide) => ({
    slide,
    corpus: normalizeForEntityCheck([slide.title, slide.governing_message, ...slide.claims.map((claim) => claim.text)].join(" "))
  }));

  const uncovered = brief.must_include.filter((keyword) => {
    const key = normalizeForEntityCheck(keyword);
    if (!key) {
      return false;
    }
    return !normalizedSlides.some((item) => item.corpus.includes(key));
  });
  if (uncovered.length === 0) {
    return;
  }

  const priorityTypes: Array<SlideSpec["slides"][number]["type"]> = [
    "exec-summary",
    "benchmark",
    "roadmap",
    "risks-issues",
    "market-landscape",
    "appendix"
  ];
  const sortedSlides = [
    ...spec.slides.filter((slide) => priorityTypes.includes(slide.type)),
    ...spec.slides.filter((slide) => !priorityTypes.includes(slide.type))
  ];

  const existingClaimKeys = new Set(
    spec.slides.flatMap((slide) => slide.claims.map((claim) => normalizeForEntityCheck(claim.text)))
  );

  for (const keyword of uncovered) {
    const targetSlide = sortedSlides.find((slide) => slide.claims.length > 0);
    if (!targetSlide) {
      break;
    }

    const targetClaim = targetSlide.claims[Math.min(2, targetSlide.claims.length - 1)];
    if (!targetClaim) {
      continue;
    }

    const soWhat = extractSoWhat(targetClaim.text) ?? "핵심 이슈가 실행 누락 없이 반영되도록 보장한다";
    const merged = normalizeClaimSoWhat(
      `${targetClaim.text}. ${keyword}을 KPI·오너십 기준으로 실행 항목에 반영한다`,
      soWhat
    );
    const key = normalizeForEntityCheck(merged);
    if (existingClaimKeys.has(key)) {
      continue;
    }
    targetClaim.text = merged;
    existingClaimKeys.add(key);
  }
}

export function runSelfCritic(spec: SlideSpec, brief: BriefNormalized, research: ResearchPack): SlideSpec {
  const evidenceById = new Map(research.evidences.map((item) => [item.evidence_id, item]));
  const sourceById = new Map(research.sources.map((item) => [item.source_id, item]));

  for (let pass = 0; pass < 2; pass += 1) {
    const seenGm = new Set<string>();

    for (const slide of spec.slides) {
      slide.title = truncate(rewriteTitleForConsultingTone(slide.title, slide, brief), 48);

      const metricHint = resolveSlideMetricHint(slide, evidenceById);
      slide.governing_message = sanitizeWithAvoidRules(slide.governing_message, brief.must_avoid);
      slide.governing_message = polishGoverningMessageTone(slide.governing_message, slide.title, brief, metricHint);
      slide.governing_message = truncate(slide.governing_message, brief.constraints.max_governing_message_chars);

      if (seenGm.has(slide.governing_message)) {
        slide.governing_message = truncate(
          `${slide.governing_message} | ${slide.title}`,
          brief.constraints.max_governing_message_chars
        );
      }
      seenGm.add(slide.governing_message);

      slide.claims = slide.claims.slice(0, brief.constraints.max_bullets_per_slide);

      for (const claim of slide.claims) {
        claim.text = normalizeClaimSoWhat(sanitizeWithAvoidRules(claim.text, brief.must_avoid));

        if (claim.evidence_ids.length < brief.constraints.min_evidence_per_claim) {
          const fallback = research.evidences.slice(0, brief.constraints.min_evidence_per_claim).map((item) => item.evidence_id);
          claim.evidence_ids = fallback;
        }
      }

      for (let claimIndex = 0; claimIndex < slide.claims.length; claimIndex += 1) {
        const claim = slide.claims[claimIndex];
        if (needsClaimUpgrade(claim.text, brief)) {
          claim.text = rewriteClaimForConsultingQuality(slide, claimIndex, brief, evidenceById);
        }
        claim.text = truncateClaimKeepSoWhat(claim.text, 170);
      }

      if (slide.source_footer.length === 0) {
        const fallbackSources = new Set<string>();
        for (const claim of slide.claims) {
          for (const evidenceId of claim.evidence_ids) {
            const evidence = evidenceById.get(evidenceId);
            const source = evidence ? sourceById.get(evidence.source_id) : undefined;
            if (source) {
              fallbackSources.add(`${source.publisher} (${source.date})`);
            }
          }
        }
        slide.source_footer = Array.from(fallbackSources);
      }

      slide.source_footer = Array.from(new Set(slide.source_footer)).sort();
    }

    ensureMustIncludeCoverage(spec, brief);
  }

  const seenClaimTokens: Array<{ tokens: string[] }> = [];
  for (const slide of spec.slides) {
    for (let claimIndex = 0; claimIndex < slide.claims.length; claimIndex += 1) {
      const claim = slide.claims[claimIndex];
      claim.text = normalizeClaimSoWhat(claim.text);
      const currentTokens = tokenize(claim.text);
      const duplicated = seenClaimTokens.some((item) => tokenJaccard(item.tokens, currentTokens) >= 0.88);
      if (duplicated) {
        claim.text = dedupeClaimWithSlideContext(claim.text, slide.title, claimIndex);
        claim.text = truncateClaimKeepSoWhat(claim.text, 170);
      }
      seenClaimTokens.push({ tokens: tokenize(claim.text) });
    }

    slide.claims = compressClaimsForDiversity(slide.claims, brief.constraints.max_bullets_per_slide);
  }

  return spec;
}
