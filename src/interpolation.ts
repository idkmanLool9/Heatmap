// De wiskunde achter de heatmap.
//
// Je hebt maar een paar meetpunten, maar je wilt het hele vlak inkleuren.
// Daarvoor gebruiken we IDW: Inverse Distance Weighting ("omgekeerd-afstand-wegen").
// Het idee: de waarde op een leeg punt is een gewogen gemiddelde van alle metingen,
// waarbij metingen die DICHTERBIJ liggen ZWAARDER meetellen.

export interface SamplePoint {
  x: number; // 0..1
  y: number; // 0..1
  value: number;
}

// Bereken de geïnterpoleerde waarde op positie (px, py) op basis van alle metingen.
// `power` bepaalt hoe sterk dichtbije punten domineren (2 is een gangbare keuze).
export function idw(px: number, py: number, samples: SamplePoint[], power = 2): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const s of samples) {
    const dx = px - s.x;
    const dy = py - s.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 === 0) return s.value; // staan we exact op een meetpunt? geef die waarde.
    const w = 1 / Math.pow(dist2, power / 2);
    weightedSum += w * s.value;
    weightTotal += w;
  }
  if (weightTotal === 0) return 0;
  return weightedSum / weightTotal;
}

// Zet een waarde om naar een "kwaliteit" t tussen 0 (slecht) en 1 (goed),
// rekening houdend met of hoger of lager beter is.
export function normalizeQuality(
  value: number,
  min: number,
  max: number,
  higherIsBetter: boolean,
): number {
  if (max === min) return 0.5; // alle metingen gelijk -> neutrale kleur
  let t = (value - min) / (max - min); // 0..1 waar 1 = hoogste waarde
  if (!higherIsBetter) t = 1 - t;      // bij latency is laag juist goed
  return Math.max(0, Math.min(1, t));
}

// Zet kwaliteit t (0..1) om naar een kleur: 0 = rood, 0.5 = geel, 1 = groen.
// We lopen over de tint (hue) van 0° (rood) naar 120° (groen).
export function qualityToColor(t: number): string {
  const hue = t * 120; // 0=rood ... 120=groen
  return hslToHex(hue, 0.9, 0.5);
}

// react-native-svg snapt geen hsl(), dus we rekenen om naar een hex-kleur.
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
