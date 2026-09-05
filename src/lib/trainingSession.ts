import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Progreso guardado de una sesión de entreno para un día concreto del plan.
 * Se persiste en el dispositivo (no en el backend): es un cronómetro y una
 * lista de series marcadas, no un dato que otro dispositivo necesite ver.
 */
export interface TrainingSessionState {
  day: string;
  /** `training_plan` no tiene id propio: usamos `generated_at` del plan para
   *  invalidar el progreso guardado si el usuario regenera su plan. */
  planGeneratedAt: string;
  elapsed: number;
  exerciseIndex: number;
  setIndex: number;
  phase: 'set' | 'rest';
  restRemaining: number;
}

export interface ParsedExercise {
  raw: string;
  nombre: string;
  series: number;
  reps: number | null;
}

/** "Sentadilla con barra 4x8" → { nombre: "Sentadilla con barra", series: 4, reps: 8 }. */
export function parseExercise(raw: string): ParsedExercise {
  const match = raw.match(/^(.*?)[\s,·-]*(\d+)\s*[x×]\s*(\d+)\s*$/i);
  if (match) {
    return {
      raw,
      nombre: match[1].trim(),
      series: parseInt(match[2], 10),
      reps: parseInt(match[3], 10),
    };
  }
  return { raw, nombre: raw.trim(), series: 1, reps: null };
}

/**
 * Descanso recomendado entre series según el rango de repeticiones: fuerza
 * (pocas reps, más descanso), hipertrofia o resistencia (más reps, menos).
 * Es una pauta estándar de entrenamiento, no un dato inventado del plan.
 */
export function restSecondsFor(reps: number | null): number {
  if (!reps) return 60;
  if (reps <= 6) return 150;
  if (reps <= 12) return 90;
  return 45;
}

const KEY_PREFIX = 'vytal_training_session_';

// SecureStore solo admite claves alfanuméricas + ".", "-", "_": los días
// llevan tilde ("Miércoles", "Sábado"), así que hay que quitarles los
// acentos antes de usarlos como clave.
function dayKey(day: string): string {
  return day
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_.-]/g, '_');
}

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
};

export async function loadTrainingSession(day: string): Promise<TrainingSessionState | null> {
  try {
    const raw = await storage.get(KEY_PREFIX + dayKey(day));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveTrainingSession(state: TrainingSessionState): Promise<void> {
  try {
    await storage.set(KEY_PREFIX + dayKey(state.day), JSON.stringify(state));
  } catch {
    // guardado best-effort: si falla, la sesión sigue funcionando en memoria
  }
}
