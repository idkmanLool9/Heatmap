// Het hart van de app: de netwerkmeting.
//
// Belangrijk inzicht: iOS geeft je GEEN toegang tot de ruwe WiFi-signaalsterkte (dBm).
// Daarom meten we de ECHTE prestatie van het netwerk op elke plek:
//   1. Latency (ping)  -> hoe snel reageert het netwerk
//   2. Throughput      -> hoeveel data je per seconde kunt downloaden
// Dit werkt identiek op iOS én Android.
//
// Let op: in een React Native app geldt er GEEN browser-CORS-beperking,
// dus we mogen vrij naar externe test-endpoints fetchen.

// Endpoint dat een leeg "204 No Content" antwoord geeft -> perfect om reactietijd te meten.
const PING_URL = 'https://www.gstatic.com/generate_204';

// Cloudflare's speedtest-endpoint: geeft precies N bytes terug. CORS-vriendelijk en snel.
const DOWNLOAD_URL = (bytes: number) => `https://speed.cloudflare.com/__down?bytes=${bytes}`;

export interface MeasureResult {
  latencyMs: number | null;
  downloadMbps: number | null;
}

// Doe één enkele ping en geef de rondreistijd in ms terug (of null bij fout).
async function singlePing(timeoutMs = 4000): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    await fetch(`${PING_URL}?t=${start}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return Date.now() - start;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Meet de latency door meerdere pings te doen en de MEDIAAN te nemen.
// De mediaan negeert uitschieters (bijv. één trage ping) beter dan een gemiddelde.
export async function measureLatency(samples = 5): Promise<number | null> {
  const results: number[] = [];
  for (let i = 0; i < samples; i++) {
    const ms = await singlePing();
    if (ms !== null) results.push(ms);
  }
  if (results.length === 0) return null;
  results.sort((a, b) => a - b);
  return Math.round(results[Math.floor(results.length / 2)]);
}

// Meet de downloadsnelheid: download een blok van `bytes` en kijk hoe lang het duurt.
// Standaard ~3 MB -> snel genoeg om vaak te meten, groot genoeg voor een betrouwbare waarde.
export async function measureDownload(bytes = 3_000_000, timeoutMs = 15000): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(DOWNLOAD_URL(bytes), {
      cache: 'no-store',
      signal: controller.signal,
    });
    // We moeten de body daadwerkelijk inlezen, anders meten we niet de hele download.
    const blob = await res.blob();
    const seconds = (Date.now() - start) / 1000;
    if (seconds <= 0) return null;
    const actualBytes = blob.size || bytes;
    // Mbit/s = (bytes * 8 bits) / (seconden) / 1.000.000
    return (actualBytes * 8) / seconds / 1_000_000;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Voer een volledige meting uit: eerst latency, dan download.
export async function runMeasurement(): Promise<MeasureResult> {
  const latencyMs = await measureLatency();
  const downloadMbps = await measureDownload();
  return {
    latencyMs,
    downloadMbps: downloadMbps !== null ? Math.round(downloadMbps * 10) / 10 : null,
  };
}
