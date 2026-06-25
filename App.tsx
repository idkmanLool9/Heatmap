// ============================================================================
//  WiFi Heatmap — hoofdscherm
//  Een gratis, zelfgebouwd alternatief voor NetSpot/Ekahau.
//
//  Werking: kies een plattegrond -> tik op je huidige plek -> de app meet
//  automatisch je netwerkprestatie (ping + downloadsnelheid) -> herhaal op
//  meerdere plekken -> de app kleurt het hele vlak in (groen = goed, rood = slecht).
// ============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';

import HeatmapOverlay from './components/HeatmapOverlay';
import { runMeasurement } from './src/measure';
import { listSurveys, saveSurvey, deleteSurvey } from './src/storage';
import {
  Measurement,
  Metric,
  Survey,
  metricLabel,
  metricValue,
} from './src/types';
import { qualityToColor } from './src/interpolation';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const genId = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

export default function App() {
  // --- Toestand van de app -------------------------------------------------
  const [floorPlanUri, setFloorPlanUri] = useState<string | null>(null);
  const [aspect, setAspect] = useState(4 / 3); // breedte / hoogte van het vlak
  const [points, setPoints] = useState<Measurement[]>([]);
  const [metric, setMetric] = useState<Metric>('download');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [measuring, setMeasuring] = useState(false);
  const [planSize, setPlanSize] = useState({ w: 0, h: 0 });
  const [surveysOpen, setSurveysOpen] = useState(false);
  const [surveyList, setSurveyList] = useState<Survey[]>([]);
  const [surveyName, setSurveyName] = useState('');
  const started = floorPlanUri !== null || points.length > 0;

  // --- Plattegrond kiezen of leeg starten ----------------------------------
  const pickFloorPlan = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Geen toegang', 'Geef toegang tot je foto’s om een plattegrond te kiezen.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    setFloorPlanUri(a.uri);
    if (a.width && a.height) setAspect(a.width / a.height);
    setPoints([]);
  }, []);

  const useBlankCanvas = useCallback(() => {
    setFloorPlanUri(null);
    setAspect(4 / 3);
    setPoints([]);
  }, []);

  // --- Het vlak opmeten zodat we taps naar 0..1 coördinaten kunnen vertalen --
  const onPlanLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    const w = e.nativeEvent.layout.width;
    setPlanSize({ w, h: w / aspect });
  }, [aspect]);

  // --- Tik op de plattegrond -> meet hier ----------------------------------
  const onTapPlan = useCallback(
    async (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      if (measuring || planSize.w === 0) return;
      const x = clamp(e.nativeEvent.locationX / planSize.w, 0, 1);
      const y = clamp(e.nativeEvent.locationY / planSize.h, 0, 1);

      setMeasuring(true);
      const res = await runMeasurement();
      const ok = res.downloadMbps !== null || res.latencyMs !== null;
      const m: Measurement = {
        id: genId(),
        x,
        y,
        latencyMs: res.latencyMs,
        downloadMbps: res.downloadMbps,
        ok,
        ts: Date.now(),
      };
      setPoints((prev) => [...prev, m]);
      setMeasuring(false);
      if (!ok) {
        Alert.alert('Meting mislukt', 'Geen netwerk bereikbaar. Staat WiFi aan?');
      }
    },
    [measuring, planSize],
  );

  const undoLast = useCallback(() => setPoints((p) => p.slice(0, -1)), []);
  const clearAll = useCallback(() => {
    Alert.alert('Alles wissen?', 'Verwijder alle metingen op deze plattegrond.', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Wissen', style: 'destructive', onPress: () => setPoints([]) },
    ]);
  }, []);

  // --- Opslaan / laden -----------------------------------------------------
  const openSurveys = useCallback(async () => {
    setSurveyList(await listSurveys());
    setSurveysOpen(true);
  }, []);

  const doSave = useCallback(async () => {
    const name = surveyName.trim() || `Survey ${new Date().toLocaleDateString()}`;
    const survey: Survey = {
      id: genId(),
      name,
      createdAt: Date.now(),
      aspect,
      floorPlanUri,
      points,
    };
    await saveSurvey(survey);
    setSurveyName('');
    setSurveyList(await listSurveys());
    Alert.alert('Opgeslagen', `“${name}” is bewaard op dit toestel.`);
  }, [surveyName, aspect, floorPlanUri, points]);

  const loadSurvey = useCallback((s: Survey) => {
    setFloorPlanUri(s.floorPlanUri);
    setAspect(s.aspect);
    setPoints(s.points);
    setSurveysOpen(false);
  }, []);

  const removeSurvey = useCallback(async (id: string) => {
    await deleteSurvey(id);
    setSurveyList(await listSurveys());
  }, []);

  // --- Statistiek voor de footer ------------------------------------------
  const stats = useMemo(() => {
    const vals = points
      .map((p) => metricValue(p, metric))
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, avg };
  }, [points, metric]);

  // ==========================================================================
  //  Beeld
  // ==========================================================================

  // Startscherm: nog geen plattegrond gekozen.
  if (!started) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <Text style={styles.title}>WiFi Heatmap</Text>
        <Text style={styles.subtitle}>
          Meet de echte netwerkprestatie in je huis en zie waar je dekking goed of slecht is.
        </Text>
        <TouchableOpacity style={styles.bigBtn} onPress={pickFloorPlan}>
          <Text style={styles.bigBtnText}>📐  Kies een plattegrond</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bigBtn, styles.bigBtnAlt]} onPress={useBlankCanvas}>
          <Text style={styles.bigBtnText}>⬜  Begin met een leeg vlak</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openSurveys}>
          <Text style={styles.link}>Opgeslagen surveys openen</Text>
        </TouchableOpacity>
        {renderSurveysModal()}
      </View>
    );
  }

  // Hoofdscherm.
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Bovenbalk */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WiFi Heatmap</Text>
        <View style={styles.row}>
          <Toggle
            label="Download"
            active={metric === 'download'}
            onPress={() => setMetric('download')}
          />
          <Toggle
            label="Ping"
            active={metric === 'latency'}
            onPress={() => setMetric('latency')}
          />
        </View>
      </View>

      {/* De plattegrond met heatmap */}
      <View style={styles.planWrap}>
        <View style={[styles.plan, { aspectRatio: aspect }]} onLayout={onPlanLayout}>
          {floorPlanUri ? (
            <Image source={{ uri: floorPlanUri }} style={styles.planImage} resizeMode="stretch" />
          ) : (
            <View style={[styles.planImage, styles.blank]} />
          )}

          {planSize.w > 0 && (
            <HeatmapOverlay
              width={planSize.w}
              height={planSize.h}
              points={points}
              metric={metric}
              showPoints
              showCells={showHeatmap}
            />
          )}

          {/* Transparante laag bovenop die de taps opvangt */}
          <Pressable style={StyleSheet.absoluteFill} onPress={onTapPlan} disabled={measuring} />

          {measuring && (
            <View style={styles.measuring}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.measuringText}>Meten…</Text>
            </View>
          )}
        </View>

        <Text style={styles.hint}>
          {measuring ? 'Even stil blijven staan…' : 'Tik op je huidige plek om te meten'}
        </Text>

        <Legend metric={metric} stats={stats} />
      </View>

      {/* Onderbalk met knoppen */}
      <View style={styles.toolbar}>
        <ToolBtn label="Meetpunten" icon={showHeatmap ? '🎨' : '📍'} onPress={() => setShowHeatmap((s) => !s)} />
        <ToolBtn label="Ongedaan" icon="↩️" onPress={undoLast} disabled={points.length === 0} />
        <ToolBtn label="Opslaan" icon="💾" onPress={openSurveys} />
        <ToolBtn label="Wissen" icon="🗑️" onPress={clearAll} disabled={points.length === 0} />
        <ToolBtn label="Nieuw" icon="➕" onPress={useBlankCanvas} />
      </View>

      {renderSurveysModal()}
    </View>
  );

  // --- Surveys-modal (opslaan + lijst) -------------------------------------
  function renderSurveysModal() {
    return (
      <Modal visible={surveysOpen} animationType="slide" onRequestClose={() => setSurveysOpen(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Surveys</Text>

          <View style={styles.saveRow}>
            <TextInput
              style={styles.input}
              placeholder="Naam voor huidige survey"
              value={surveyName}
              onChangeText={setSurveyName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={doSave}>
              <Text style={styles.saveBtnText}>Opslaan</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={surveyList}
            keyExtractor={(s) => s.id}
            ListEmptyComponent={<Text style={styles.empty}>Nog niets opgeslagen.</Text>}
            renderItem={({ item }) => (
              <View style={styles.surveyRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => loadSurvey(item)}>
                  <Text style={styles.surveyName}>{item.name}</Text>
                  <Text style={styles.surveyMeta}>
                    {item.points.length} metingen · {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeSurvey(item.id)}>
                  <Text style={styles.delete}>Verwijder</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <TouchableOpacity style={styles.closeBtn} onPress={() => setSurveysOpen(false)}>
            <Text style={styles.closeBtnText}>Sluiten</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }
}

// --- Kleine herbruikbare componentjes --------------------------------------
function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.toggle, active && styles.toggleActive]} onPress={onPress}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToolBtn({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.toolBtn, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.toolIcon}>{icon}</Text>
      <Text style={styles.toolLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Legend({
  metric,
  stats,
}: {
  metric: Metric;
  stats: { min: number; max: number; avg: number } | null;
}) {
  return (
    <View style={styles.legend}>
      <Text style={styles.legendTitle}>{metricLabel(metric)}</Text>
      <View style={styles.legendBar}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <View key={t} style={[styles.legendSwatch, { backgroundColor: qualityToColor(t) }]} />
        ))}
      </View>
      <View style={styles.legendLabels}>
        <Text style={styles.legendText}>slecht</Text>
        <Text style={styles.legendText}>goed</Text>
      </View>
      {stats && (
        <Text style={styles.statsText}>
          min {Math.round(stats.min)} · gem {Math.round(stats.avg)} · max {Math.round(stats.max)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f5f7', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#f4f5f7', alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontSize: 32, fontWeight: '800', color: '#1a1a2e', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 32, lineHeight: 21 },
  bigBtn: { backgroundColor: '#2d6cdf', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 14, width: '100%', alignItems: 'center', marginBottom: 12 },
  bigBtnAlt: { backgroundColor: '#5b6472' },
  bigBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  link: { color: '#2d6cdf', fontSize: 15, marginTop: 18, textDecorationLine: 'underline' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a2e' },
  row: { flexDirection: 'row' },
  toggle: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#e3e6eb', marginLeft: 6 },
  toggleActive: { backgroundColor: '#2d6cdf' },
  toggleText: { color: '#555', fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: '#fff' },

  planWrap: { flex: 1, paddingHorizontal: 12 },
  plan: { width: '100%', backgroundColor: '#ddd', borderRadius: 12, overflow: 'hidden' },
  planImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  blank: { backgroundColor: '#e8eaed' },
  measuring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  measuringText: { color: '#fff', fontWeight: '700', marginTop: 8, fontSize: 16 },
  hint: { textAlign: 'center', color: '#666', marginTop: 10, fontSize: 13 },

  legend: { marginTop: 12, alignItems: 'center' },
  legendTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 4 },
  legendBar: { flexDirection: 'row', width: 200, height: 14, borderRadius: 7, overflow: 'hidden' },
  legendSwatch: { flex: 1, height: '100%' },
  legendLabels: { flexDirection: 'row', justifyContent: 'space-between', width: 200, marginTop: 2 },
  legendText: { fontSize: 11, color: '#777' },
  statsText: { fontSize: 12, color: '#444', marginTop: 6 },

  toolbar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingBottom: 26, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e3e6eb' },
  toolBtn: { alignItems: 'center', paddingHorizontal: 6 },
  toolIcon: { fontSize: 22 },
  toolLabel: { fontSize: 11, color: '#555', marginTop: 2 },
  disabled: { opacity: 0.35 },

  modal: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  modalTitle: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  saveRow: { flexDirection: 'row', marginBottom: 20 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, paddingHorizontal: 12, height: 44 },
  saveBtn: { backgroundColor: '#2d6cdf', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', marginLeft: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  surveyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  surveyName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  surveyMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  delete: { color: '#d23', fontWeight: '600', paddingLeft: 12 },
  empty: { color: '#999', textAlign: 'center', marginTop: 30 },
  closeBtn: { backgroundColor: '#e3e6eb', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  closeBtnText: { fontWeight: '700', color: '#333' },
});
