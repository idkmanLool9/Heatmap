// Tekent de heatmap als een raster van gekleurde vierkantjes bovenop de plattegrond.
// We gebruiken react-native-svg (zit standaard in Expo Go).

import React, { useMemo } from 'react';
import Svg, { Rect, Circle, Text as SvgText } from 'react-native-svg';
import { Measurement, Metric, metricValue, higherIsBetter } from '../src/types';
import { idw, normalizeQuality, qualityToColor, SamplePoint } from '../src/interpolation';

interface Props {
  width: number;          // breedte van het vlak in pixels
  height: number;         // hoogte van het vlak in pixels
  points: Measurement[];  // alle metingen
  metric: Metric;         // welke waarde tonen we?
  showPoints: boolean;    // meetstippen tonen?
  showCells?: boolean;    // de gekleurde heatmap-laag tonen?
  cell?: number;          // grootte van één rastervakje in px (kleiner = gladder maar zwaarder)
}

export default function HeatmapOverlay({
  width,
  height,
  points,
  metric,
  showPoints,
  showCells = true,
  cell = 14,
}: Props) {
  // Zet metingen om naar bruikbare samples (alleen geslaagde metingen met een waarde).
  const samples: SamplePoint[] = useMemo(() => {
    const out: SamplePoint[] = [];
    for (const p of points) {
      const v = metricValue(p, metric);
      if (p.ok && v !== null) out.push({ x: p.x, y: p.y, value: v });
    }
    return out;
  }, [points, metric]);

  // Min en max van de gemeten waarden -> nodig om naar kleur te schalen.
  const { min, max } = useMemo(() => {
    if (samples.length === 0) return { min: 0, max: 1 };
    let mn = Infinity, mx = -Infinity;
    for (const s of samples) {
      if (s.value < mn) mn = s.value;
      if (s.value > mx) mx = s.value;
    }
    return { min: mn, max: mx };
  }, [samples]);

  // Bereken het raster met geïnterpoleerde kleuren.
  const cells = useMemo(() => {
    if (!showCells || samples.length === 0 || width <= 0 || height <= 0) return [];
    const cols = Math.max(1, Math.ceil(width / cell));
    const rows = Math.max(1, Math.ceil(height / cell));
    const cw = width / cols;
    const ch = height / rows;
    const out: { x: number; y: number; w: number; h: number; color: string }[] = [];
    const better = higherIsBetter(metric);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Middelpunt van het vakje, genormaliseerd naar 0..1.
        const nx = (c + 0.5) / cols;
        const ny = (r + 0.5) / rows;
        const value = idw(nx, ny, samples);
        const t = normalizeQuality(value, min, max, better);
        out.push({ x: c * cw, y: r * ch, w: cw + 0.5, h: ch + 0.5, color: qualityToColor(t) });
      }
    }
    return out;
  }, [samples, width, height, cell, metric, min, max, showCells]);

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      {/* De gekleurde heatmap-laag, half-transparant zodat de plattegrond zichtbaar blijft */}
      {cells.map((c, i) => (
        <Rect
          key={i}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          fill={c.color}
          fillOpacity={0.55}
        />
      ))}

      {/* De daadwerkelijke meetpunten als witte stippen */}
      {showPoints &&
        points.map((p) => {
          const v = metricValue(p, metric);
          return (
            <React.Fragment key={p.id}>
              <Circle
                cx={p.x * width}
                cy={p.y * height}
                r={6}
                fill={p.ok ? '#ffffff' : '#888'}
                stroke="#000"
                strokeWidth={1.5}
              />
              {p.ok && v !== null && (
                <SvgText
                  x={p.x * width}
                  y={p.y * height - 10}
                  fontSize={11}
                  fontWeight="bold"
                  fill="#000"
                  stroke="#fff"
                  strokeWidth={0.6}
                  textAnchor="middle"
                >
                  {metric === 'download' ? `${Math.round(v)}` : `${Math.round(v)}ms`}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
    </Svg>
  );
}
