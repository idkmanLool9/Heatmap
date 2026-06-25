# 📶 WiFi Heatmap

Een **gratis, zelfgebouwd** alternatief voor betaalde tools als NetSpot en Ekahau.
Gemaakt met **Expo (React Native + TypeScript)**, draait op **iOS én Android**.

In plaats van de WiFi-signaalsterkte (die iOS niet vrijgeeft) meet de app de
**echte netwerkprestatie** op elke plek: **ping (ms)** en **downloadsnelheid (Mbit/s)**.
Daarna kleurt hij je plattegrond in: 🟢 groen = goed, 🔴 rood = slecht.

---

## 🚀 Zo draai je 'm op je iPhone (geen Mac nodig!)

1. **Installeer Node.js** op je computer → https://nodejs.org (de "LTS"-versie).
2. Open een terminal in deze map en installeer de dependencies:
   ```bash
   npm install
   ```
3. Start de ontwikkelserver:
   ```bash
   npx expo start
   ```
4. Installeer de gratis app **"Expo Go"** uit de App Store op je iPhone.
5. Zorg dat je telefoon en computer op **hetzelfde WiFi-netwerk** zitten.
6. **Scan de QR-code** die in je terminal verschijnt met de **Camera-app** van je iPhone
   (op Android: scan vanuit de Expo Go-app zelf). De app opent in Expo Go.

> 💡 Elke wijziging die je in de code maakt, ververst meteen op je telefoon. Handig om mee te leren.

### ☁️ Draai je via GitHub Codespaces?

Dan staat je code in de cloud en kan je telefoon 'm **niet via je lokale WiFi** bereiken.
Gebruik daarom **tunnel-modus** (loopt via internet i.p.v. je netwerk):

```bash
npm install
npx expo start --tunnel      # of: npm run tunnel
```

- De eerste keer vraagt Expo om `@expo/ngrok` te installeren → antwoord **`y`** (ja).
- Scan daarna de QR-code met **Expo Go** (Android) of de **Camera** (iPhone).
- Je telefoon hoeft **niet** op hetzelfde netwerk te zitten als de Codespace.
- De netwerkmetingen in de app gebruiken het netwerk van je **telefoon** — dus die
  blijven gewoon kloppen, ook al draait de code in de cloud.

---

## 📖 Zo gebruik je de app

1. **Kies een plattegrond** (foto van een bouwtekening) of begin met een **leeg vlak**.
2. Loop naar een plek in je huis en **tik op die plek** op de plattegrond.
   De app doet automatisch een ping- + snelheidsmeting (een paar seconden).
3. Herhaal op **5–15 plekken**, verspreid door de ruimte.
4. De app **interpoleert** automatisch en kleurt het hele vlak in.
5. Wissel boven tussen **Download** en **Ping** als meetwaarde.
6. **Opslaan** bewaart je survey op het toestel; later weer te laden.

---

## 🧠 Hoe het technisch werkt

| Onderdeel | Bestand | Wat het doet |
|---|---|---|
| Datavormen | `src/types.ts` | De structuren (`Measurement`, `Survey`, …) |
| Meten | `src/measure.ts` | Ping via een 204-endpoint, snelheid via Cloudflare |
| Wiskunde | `src/interpolation.ts` | **IDW**-interpolatie + kleur (rood→groen) |
| Opslag | `src/storage.ts` | Lokaal opslaan met AsyncStorage |
| Tekenen | `components/HeatmapOverlay.tsx` | De heatmap als SVG-raster |
| Scherm | `App.tsx` | De hele gebruikersinterface |

**IDW (Inverse Distance Weighting):** de waarde op een leeg punt is een gewogen
gemiddelde van je metingen, waarbij dichterbije metingen zwaarder meetellen.

---

## ⚠️ Goed om te weten

- **iOS geeft geen WiFi-signaalsterkte (dBm) vrij.** Daarom meten we netwerkprestatie
  i.p.v. "streepjes" — relevanter, want het zegt of streamen/bellen écht werkt.
- Elke meting downloadt ~3 MB testdata (verbruikt dus wat internet).
- De snelheidstest meet de hele keten (WiFi + internet). Voor pure WiFi-kwaliteit
  let je vooral op de **ping** en op grote *verschillen* tussen plekken.

---

## 🛣️ Ideeën voor later

- [ ] Android-bonus: ruwe WiFi-signaalsterkte (dBm) als extra laag
- [ ] Gladdere heatmap met `react-native-skia` (blur/gradient)
- [ ] Meerdere verdiepingen per survey
- [ ] Survey exporteren als afbeelding/PDF
- [ ] Meten tegen je eigen router i.p.v. internet
