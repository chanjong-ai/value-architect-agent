import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FaArrowUp,
  FaBalanceScale,
  FaChartLine,
  FaCoins,
  FaExclamationTriangle,
  FaMicrochip,
  FaRegCircle,
  FaTasks
} from "react-icons/fa";
import sharp from "sharp";
import { ThemeTokens } from "./theme";

export type IconCategory =
  | "risk"
  | "growth"
  | "finance"
  | "technology"
  | "regulation"
  | "execution"
  | "market"
  | "default";

export type IconAssetMap = Map<string, string>;

export interface SemanticIcon {
  shape: "ellipse" | "rect" | "diamond" | "triangle";
  marker: string;
  color: string;
  assetKey: string;
}

const ORDERED_FALLBACK: IconCategory[] = ["market", "finance", "growth", "execution", "risk", "technology", "regulation"];

const RULES: Array<{ category: IconCategory; patterns: RegExp[] }> = [
  {
    category: "risk",
    patterns: [/리스크|위험|변동|불확실|risk|volatil|downside|exposure/i]
  },
  {
    category: "growth",
    patterns: [/성장|확대|증가|기회|scale|growth|expand|upside|cagr/i]
  },
  {
    category: "finance",
    patterns: [/매출|수익|마진|현금|원가|비용|투자|재무|capex|opex|profit|ebitda|cash/i]
  },
  {
    category: "technology",
    patterns: [/기술|특허|공정|혁신|r&d|기술력|technology|roadmap|silicon|process/i]
  },
  {
    category: "regulation",
    patterns: [/규제|정책|법규|탄소|환경|esg|compliance|regulation|policy/i]
  },
  {
    category: "execution",
    patterns: [/실행|전환|운영|공급망|일정|phase|execution|action|milestone|implementation/i]
  },
  {
    category: "market",
    patterns: [/시장|고객|경쟁|점유율|포지셔닝|market|customer|competition|share|position/i]
  }
];

const ICON_COMPONENT_BY_CATEGORY: Record<IconCategory, React.ComponentType<{ size?: number; color?: string }>> = {
  risk: FaExclamationTriangle,
  growth: FaArrowUp,
  finance: FaCoins,
  technology: FaMicrochip,
  regulation: FaBalanceScale,
  execution: FaTasks,
  market: FaChartLine,
  default: FaRegCircle
};

function shapeByCategory(category: IconCategory): SemanticIcon["shape"] {
  switch (category) {
    case "risk":
      return "triangle";
    case "growth":
      return "diamond";
    case "finance":
      return "rect";
    case "technology":
      return "ellipse";
    case "regulation":
      return "rect";
    case "execution":
      return "diamond";
    case "market":
      return "ellipse";
    default:
      return "ellipse";
  }
}

function markerByCategory(category: IconCategory): string {
  switch (category) {
    case "risk":
      return "!";
    case "growth":
      return "+";
    case "finance":
      return "$";
    case "technology":
      return "T";
    case "regulation":
      return "R";
    case "execution":
      return "E";
    case "market":
      return "M";
    default:
      return "*";
  }
}

function colorByCategory(category: IconCategory, theme: ThemeTokens): string {
  switch (category) {
    case "risk":
    case "finance":
    case "regulation":
      return theme.colors.primary;
    case "growth":
    case "technology":
    case "execution":
    case "market":
      return theme.colors.secondary;
    default:
      return theme.colors.primary;
  }
}

function assetKey(category: IconCategory, color: string): string {
  return `${category}:${color}`;
}

function rgba(hex: string): { r: number; g: number; b: number; alpha: number } {
  const sanitized = hex.replace("#", "");
  const r = Number.parseInt(sanitized.slice(0, 2), 16);
  const g = Number.parseInt(sanitized.slice(2, 4), 16);
  const b = Number.parseInt(sanitized.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 0,
    g: Number.isFinite(g) ? g : 0,
    b: Number.isFinite(b) ? b : 0,
    alpha: 0
  };
}

async function renderIconDataUri(
  component: React.ComponentType<{ size?: number; color?: string }>,
  color: string
): Promise<string> {
  const svgMarkup = renderToStaticMarkup(React.createElement(component, { size: 60, color: `#${color}` }));
  const png = await sharp(Buffer.from(svgMarkup), { density: 288 })
    .resize(72, 72, {
      fit: "contain",
      background: rgba("000000")
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function buildSemanticIconAssetMap(theme: ThemeTokens): Promise<IconAssetMap> {
  const map: IconAssetMap = new Map();
  const categories: IconCategory[] = ["risk", "growth", "finance", "technology", "regulation", "execution", "market", "default"];

  for (const category of categories) {
    const color = colorByCategory(category, theme);
    const key = assetKey(category, color);
    if (map.has(key)) {
      continue;
    }

    const component = ICON_COMPONENT_BY_CATEGORY[category];
    const data = await renderIconDataUri(component, color);
    map.set(key, data);
  }

  return map;
}

export function classifySemanticIconCategory(text: string): Exclude<IconCategory, "default"> | "default" {
  const compact = text.trim();
  if (!compact) {
    return "default";
  }

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(compact))) {
      return rule.category;
    }
  }

  return "default";
}

export function resolveSemanticIcon(text: string, index: number, theme: ThemeTokens): SemanticIcon {
  const detected = classifySemanticIconCategory(text);
  const category = detected === "default" ? ORDERED_FALLBACK[index % ORDERED_FALLBACK.length] : detected;
  const color = colorByCategory(category, theme);

  return {
    shape: shapeByCategory(category),
    marker: markerByCategory(category),
    color,
    assetKey: assetKey(category, color)
  };
}
