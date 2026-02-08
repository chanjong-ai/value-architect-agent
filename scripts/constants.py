#!/usr/bin/env python3
"""
constants.py - 전역 상수 및 정책 정의

모든 스크립트에서 공유하는 단일 진실 소스 (Single Source of Truth)
불릿 길이, 밀도 규칙 등 일관된 정책을 제공합니다.
"""

# =============================================================================
# 불릿 정책 (Single Source of Truth)
# =============================================================================

# 불릿 길이 제한 (문자 수)
# 컨설팅 톤의 서술형 문장을 허용하기 위해 상향
BULLET_MAX_CHARS = 180  # 기본 최대 길이
BULLET_RECOMMENDED_CHARS = 130  # 권장 길이
BULLET_CHARS_PER_LINE = 38  # 줄 수 추정용 기준 문자수 (휴리스틱)
BULLET_MAX_LINES = 4  # 불릿 최대 줄 수

# 불릿 개수 제한
BULLET_MIN_COUNT = 3  # 컨텐츠 슬라이드 최소 개수
BULLET_MAX_COUNT = 9  # 기본 최대 개수 (global_constraints로 오버라이드 가능)
VISUAL_BULLET_MAX_COUNT = 8  # chart_focus/image_focus 기본 최대 개수
COLUMN_BULLET_MAX_COUNT = 8  # 컬럼당 최대 불릿 수 (밀도형 덱 허용)

# =============================================================================
# 폰트 정책
# =============================================================================

# 제목 폰트
TITLE_FONT_SIZE_PT = 24
TITLE_MAX_CHARS = 100

# 거버닝 메시지 폰트
GOVERNING_FONT_SIZE_PT = 16
GOVERNING_MAX_CHARS = 200

# 본문 폰트
BODY_FONT_SIZE_PT = 12

# 각주 폰트
FOOTNOTE_FONT_SIZE_PT = 10

# 폰트 크기 허용 오차
FONT_SIZE_TOLERANCE_PT = 2

# 허용 폰트 목록
ALLOWED_FONTS = [
    "Noto Sans KR",
    "Noto Sans KR Bold",
    "Noto Sans KR Regular",
    "NotoSansKR",
    "NotoSansKR-Bold",
    "NotoSansKR-Regular",
]

# =============================================================================
# 콘텐츠 밀도 정책
# =============================================================================

# 슬라이드당 총 문자 수 제한
# 본문 밀도를 높이되 과밀 판정을 완화
DENSITY_MAX_CHARS = 1200  # 과밀 기준
DENSITY_MIN_CHARS = 50   # 부족 기준
DENSITY_MIN_PARAGRAPHS = 3  # 최소 단락 수

# =============================================================================
# 레이아웃별 기본 설정
# =============================================================================

# 불릿이 없어야 하는 레이아웃
NO_BULLET_LAYOUTS = ["cover", "section_divider", "thank_you", "quote"]

# 컬럼 레이아웃
COLUMN_LAYOUTS = ["two_column", "three_column", "comparison"]

# 시각 자료 중심 레이아웃
VISUAL_LAYOUTS = ["chart_focus", "image_focus"]

# =============================================================================
# Evidence 정책
# =============================================================================

# sources.md 앵커 패턴
EVIDENCE_ANCHOR_PATTERN = r"^sources\.md#[\w-]+$"

# 신뢰도 레벨
CONFIDENCE_LEVELS = ["high", "medium", "low"]

# 출처 유형
SOURCE_TYPES = ["primary", "secondary", "assumption", "calculation", "expert_opinion"]

# =============================================================================
# 유틸리티 함수
# =============================================================================

def get_max_bullets(global_constraints: dict = None, slide_constraints: dict = None) -> int:
    """
    global_constraints와 slide_constraints를 고려하여 최대 불릿 수 반환
    slide_constraints가 우선순위를 가짐
    """
    max_bullets = BULLET_MAX_COUNT

    if global_constraints and "default_max_bullets" in global_constraints:
        max_bullets = global_constraints["default_max_bullets"]

    if slide_constraints and "max_bullets" in slide_constraints:
        max_bullets = slide_constraints["max_bullets"]

    return max_bullets


def get_max_chars_per_bullet(global_constraints: dict = None, slide_constraints: dict = None) -> int:
    """
    global_constraints와 slide_constraints를 고려하여 불릿당 최대 문자 수 반환
    slide_constraints가 우선순위를 가짐
    """
    max_chars = BULLET_MAX_CHARS

    if global_constraints and "default_max_chars_per_bullet" in global_constraints:
        max_chars = global_constraints["default_max_chars_per_bullet"]

    if slide_constraints and "max_chars_per_bullet" in slide_constraints:
        max_chars = slide_constraints["max_chars_per_bullet"]

    return max_chars


def get_forbidden_words(global_constraints: dict = None, slide_constraints: dict = None) -> list:
    """
    global_constraints와 slide_constraints를 병합하여 금지 단어 목록 반환
    """
    forbidden = []

    if global_constraints and "forbidden_words" in global_constraints:
        forbidden.extend(global_constraints["forbidden_words"])

    if slide_constraints and "forbidden_words" in slide_constraints:
        forbidden.extend(slide_constraints["forbidden_words"])

    return list(set(forbidden))  # 중복 제거


def get_bullet_bounds(
    layout: str,
    global_constraints: dict = None,
    slide_constraints: dict = None
) -> tuple:
    """
    레이아웃 + global_constraints + slide_constraints를 반영한 불릿 범위 반환.
    반환값: (min_bullets, max_bullets)
    """
    normalized_layout = (layout or "").strip().lower()
    max_bullets = get_max_bullets(global_constraints, slide_constraints)
    min_bullets = BULLET_MIN_COUNT

    if normalized_layout in NO_BULLET_LAYOUTS:
        return 0, 0

    if normalized_layout in VISUAL_LAYOUTS:
        # visual 중심 레이아웃은 0~8 허용 (권장 4~5)
        min_bullets = 0
        max_bullets = min(max_bullets, VISUAL_BULLET_MAX_COUNT)

    return min_bullets, max_bullets


def get_column_bullet_limit(max_bullets: int) -> int:
    """
    컬럼 레이아웃에서 컬럼별 최대 불릿 수 계산.
    슬라이드 전역 상한을 넘지 않으면서 밀도형 덱 작성을 허용한다.
    """
    if max_bullets <= 0:
        return 0
    return max(3, min(COLUMN_BULLET_MAX_COUNT, max_bullets))
