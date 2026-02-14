import { ThemeTokens } from "../theme";

export function makeHeaderOpts(theme: ThemeTokens): Record<string, unknown> {
  return {
    fill: theme.colors.primary,
    color: "FFFFFF",
    bold: true,
    fontFace: theme.fonts.body,
    fontSize: 8,
    valign: "mid"
  };
}

export function makeCellOpts(theme: ThemeTokens): Record<string, unknown> {
  return {
    fill: "FFFFFF",
    color: theme.colors.text,
    fontFace: theme.fonts.body,
    fontSize: 7,
    valign: "mid"
  };
}

export function makeAltCellOpts(theme: ThemeTokens): Record<string, unknown> {
  return {
    fill: theme.colors.alt_row,
    color: theme.colors.text,
    fontFace: theme.fonts.body,
    fontSize: 7,
    valign: "mid"
  };
}
