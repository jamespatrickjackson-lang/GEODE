export interface RgbColour {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseHexRgba(hex: string, alpha: number): RgbColour {
  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
      a: alpha,
    };
  }
  return { r: 0, g: 0, b: 0, a: alpha };
}

export function compositeOver(fg: RgbColour, bg: RgbColour): RgbColour {
  const outA = fg.a + bg.a * (1 - fg.a);
  if (outA === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / outA),
    g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / outA),
    b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / outA),
    a: outA,
  };
}

export function relativeLuminance(c: RgbColour): number {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

export function contrastRatio(fg: RgbColour, bg: RgbColour): number {
  const composited = fg.a < 1 ? compositeOver(fg, bg) : fg;
  const l1 = relativeLuminance(composited);
  const l2 = relativeLuminance(bg);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}
