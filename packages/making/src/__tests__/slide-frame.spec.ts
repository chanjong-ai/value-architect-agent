import { describe, expect, it } from "vitest";
import { addSource } from "../renderer/pptxgen/components/slide-frame";
import { ThemeTokens } from "../renderer/pptxgen/theme";

function createTheme(): ThemeTokens {
  return {
    name: "test",
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
}

describe("slide-frame addSource", () => {
  it("renders a single Source prefix when footer list is empty", () => {
    let captured = "";
    const slide = {
      addText: (text: string | string[]) => {
        captured = Array.isArray(text) ? text.join(" ") : text;
      },
      addShape: () => undefined,
      addTable: () => undefined
    };

    addSource(slide, [], { x: 0, y: 0, w: 1, h: 1 }, createTheme());
    expect(captured).toBe("Source: N/A");
  });

  it("joins footer values without duplicating Source label", () => {
    let captured = "";
    const slide = {
      addText: (text: string | string[]) => {
        captured = Array.isArray(text) ? text.join(" ") : text;
      },
      addShape: () => undefined,
      addTable: () => undefined
    };

    addSource(slide, ["IEA (2026-01-01)", "BNEF (2026-01-04)"], { x: 0, y: 0, w: 1, h: 1 }, createTheme());
    expect(captured).toBe("Source: IEA (2026-01-01) | BNEF (2026-01-04)");
  });
});
