// Alle datavormen ("types") van de app op één plek.
// Door dit centraal te zetten gebruikt elk bestand dezelfde definities.

// Welke meetwaarde tonen we als kleur op de heatmap?
//  - 'download' = downloadsnelheid in Mbit/s (hoger = beter = groen)
//  - 'latency'  = ping/reactietijd in ms      (lager = beter = groen)
export type Metric = 'download' | 'latency';

// Eén meting op één plek in de ruimte.
export interface Measurement {
  id: string;
  // Positie op de plattegrond, genormaliseerd 0..1 (0 = links/boven, 1 = rechts/onder).
  // Door te normaliseren blijft de stip op de juiste plek, ongeacht schermgrootte.
  x: number;
  y: number;
  latencyMs: number | null;   // gemeten ping (null = mislukt)
  downloadMbps: number | null; // gemeten snelheid (null = mislukt)
  ok: boolean;                 // is de meting geslaagd?
  ts: number;                  // tijdstip (ms sinds 1970)
}

// Een opgeslagen survey = een plattegrond + alle metingen daarop.
export interface Survey {
  id: string;
  name: string;
  createdAt: number;
  // Verhouding breedte/hoogte van de plattegrond, zodat we 'm correct kunnen tonen.
  aspect: number;
  floorPlanUri: string | null; // pad naar de gekozen afbeelding (null = leeg vlak)
  points: Measurement[];
}

// Helper om de juiste waarde uit een meting te halen voor de gekozen metric.
export function metricValue(m: Measurement, metric: Metric): number | null {
  return metric === 'download' ? m.downloadMbps : m.latencyMs;
}

// Voor 'download' is hoger beter, voor 'latency' is lager beter.
export function higherIsBetter(metric: Metric): boolean {
  return metric === 'download';
}

export function metricLabel(metric: Metric): string {
  return metric === 'download' ? 'Download (Mbit/s)' : 'Ping (ms)';
}
