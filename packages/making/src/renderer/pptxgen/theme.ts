import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface ThemeTokens {
  name: string;
  font_family: string;
  fonts: {
    title: string;
    body: string;
    mono: string;
  };
  colors: {
    background: string;
    primary: string;
    secondary: string;
    text: string;
    muted: string;
    accent: string;
    gray1: string;
    gray2: string;
    gray3: string;
    gray4: string;
    red: string;
    green: string;
    orange: string;
    yellow: string;
    purple: string;
    card_bg: string;
    warn_bg: string;
    warn_border: string;
    blue_bg: string;
    green_bg: string;
    green_border: string;
    alt_row: string;
    source: string;
  };
  typography: {
    title_size: number;
    takeaway_size: number;
    section_head_size: number;
    body_size: number;
    detail_size: number;
    footer_size: number;
    kpi_size: number;
  };
  spacing: {
    page_margin_left: number;
    page_margin_right: number;
    section_gap: number;
    source_y: number;
    page_number_x: number;
    page_number_y: number;
  };
}

const DEFAULT_THEME: ThemeTokens = {
  name: "consulting_kr_blue",
  font_family: "Calibri",
  fonts: {
    title: "Calibri",
    body: "Calibri",
    mono: "Calibri"
  },
  colors: {
    background: "FFFFFF",
    primary: "1B365D",
    secondary: "00626E",
    text: "2D2D2D",
    muted: "8C8C8C",
    accent: "00626E",
    gray1: "8C8C8C",
    gray2: "B8B8B8",
    gray3: "D9D9D9",
    gray4: "F2F2F4",
    red: "C0392B",
    green: "2E7D32",
    orange: "E65100",
    yellow: "F57F17",
    purple: "7B1FA2",
    card_bg: "F8FAFC",
    warn_bg: "FFF8E1",
    warn_border: "F9A825",
    blue_bg: "E8EEF7",
    green_bg: "E8F5E9",
    green_border: "66BB6A",
    alt_row: "F8F9FA",
    source: "999999"
  },
  typography: {
    title_size: 20,
    takeaway_size: 11,
    section_head_size: 10,
    body_size: 8,
    detail_size: 7,
    footer_size: 7,
    kpi_size: 26
  },
  spacing: {
    page_margin_left: 0.35,
    page_margin_right: 9.65,
    section_gap: 0.12,
    source_y: 5.25,
    page_number_x: 9.2,
    page_number_y: 5.3
  }
};

export function loadTheme(themeName: string, cwd = process.cwd()): ThemeTokens {
  const fileName = themeName.endsWith(".json") ? themeName : `${themeName}.theme.json`;
  const themePath = path.join(cwd, "templates", "themes", fileName);

  if (!existsSync(themePath)) {
    return DEFAULT_THEME;
  }

  const parsed = JSON.parse(readFileSync(themePath, "utf8")) as Partial<ThemeTokens>;

  return {
    ...DEFAULT_THEME,
    ...parsed,
    font_family: parsed.font_family ?? DEFAULT_THEME.font_family,
    fonts: {
      ...DEFAULT_THEME.fonts,
      ...(parsed.fonts ?? {})
    },
    colors: {
      ...DEFAULT_THEME.colors,
      ...(parsed.colors ?? {})
    },
    typography: {
      ...DEFAULT_THEME.typography,
      ...(parsed.typography ?? {})
    },
    spacing: {
      ...DEFAULT_THEME.spacing,
      ...(parsed.spacing ?? {})
    }
  };
}
