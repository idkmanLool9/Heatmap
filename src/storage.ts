// Opslaan en laden van surveys op het toestel zelf (geen internet/account nodig).
// We gebruiken AsyncStorage: een simpele key-value opslag, ideaal hiervoor.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Survey } from './types';

const KEY = 'heatmap.surveys.v1';

export async function listSurveys(): Promise<Survey[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as Survey[];
    // Nieuwste eerst.
    return data.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function saveSurvey(survey: Survey): Promise<void> {
  const all = await listSurveys();
  const idx = all.findIndex((s) => s.id === survey.id);
  if (idx >= 0) all[idx] = survey;
  else all.push(survey);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function deleteSurvey(id: string): Promise<void> {
  const all = await listSurveys();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((s) => s.id !== id)));
}
