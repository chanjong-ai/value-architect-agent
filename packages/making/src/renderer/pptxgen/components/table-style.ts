import { ThemeTokens } from "../theme";

export interface CellStyleOverrides {
  align?: "left" | "center" | "right";
  color?: string;
  bold?: boolean;
}

export function makeHeaderOpts(theme: ThemeTokens, overrides: CellStyleOverrides = {}): Record<string, unknown> {
  return {
    fill: theme.colors.primary,
    // McKinsey 표준: 헤더는 짙은 남색(primary) 위에 흰색(background) 텍스트
    color: theme.colors.background,
    bold: true,
    fontFace: theme.fonts.body,
    fontSize: 8.5,
    valign: "mid",
    align: overrides.align ?? "left"
  };
}

export function makeCellOpts(theme: ThemeTokens, overrides: CellStyleOverrides = {}): Record<string, unknown> {
  return {
    fill: theme.colors.background,
    color: overrides.color ?? theme.colors.text,
    fontFace: theme.fonts.body,
    fontSize: 7,
    valign: "mid",
    align: overrides.align ?? "left",
    bold: overrides.bold ?? false
  };
}

export function makeAltCellOpts(theme: ThemeTokens, overrides: CellStyleOverrides = {}): Record<string, unknown> {
  return {
    fill: theme.colors.alt_row,
    color: overrides.color ?? theme.colors.text,
    fontFace: theme.fonts.body,
    fontSize: 7,
    valign: "mid",
    align: overrides.align ?? "left",
    bold: overrides.bold ?? false
  };
}
