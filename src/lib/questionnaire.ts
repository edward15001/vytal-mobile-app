import { api } from './api';
import { IconName } from '@/components/icon';

// ─── Tipos ───────────────────────────────────────────────────

export interface QuestionnaireAnswers {
  sex: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  target_weight_kg: number | null;
  goal: string;
  activity_level: string;
  dietary_preference: string;
  health_conditions: string[];
  training_experience: string;
  training_days_per_week: number;
  training_equipment: string;
}

export interface Option {
  value: string;
  label: string;
}

export interface RichOption extends Option {
  description: string;
  icon: IconName;
  /** Color del dominio: solo el objetivo (paso 2) tiene un tono propio por
   *  opción, a juego con el cuestionario web. El resto usa savia al marcar. */
  tone?: 'savia' | 'arcilla' | 'malva' | 'ambar';
}

export interface ActivityOption extends RichOption {
  /** Factor de actividad de Harris-Benedict: BMR × multiplier = gasto diario. */
  multiplier: number;
}

// ─── Opciones (mismas que el cuestionario web) ───────────────

export const SEX_OPTIONS: Option[] = [
  { value: 'hombre', label: 'Hombre' },
  { value: 'mujer', label: 'Mujer' },
];

export const GOAL_OPTIONS: RichOption[] = [
  { value: 'perder_peso', label: 'Perder peso', description: 'Déficit calórico inteligente + quema de grasa', icon: 'flame', tone: 'savia' },
  { value: 'ganar_masa', label: 'Ganar masa muscular', description: 'Superávit calórico + alta proteína + hipertrofia', icon: 'barbell', tone: 'arcilla' },
  { value: 'mantener', label: 'Mantener peso', description: 'Equilibrio calórico + composición corporal óptima', icon: 'scale', tone: 'malva' },
  { value: 'mejorar_salud', label: 'Mejorar salud general', description: 'Energía, bienestar, hábitos saludables duraderos', icon: 'heart', tone: 'ambar' },
];

export const ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: 'sedentario', label: 'Sedentario', description: 'Trabajo de oficina, muy poca actividad física', icon: 'desktop', multiplier: 1.2 },
  { value: 'ligero', label: 'Ligeramente activo', description: 'Ejercicio 1-2 días por semana o trabajo de pie', icon: 'walk', multiplier: 1.375 },
  { value: 'moderado', label: 'Moderadamente activo', description: 'Ejercicio 3-4 días por semana', icon: 'walk', multiplier: 1.55 },
  { value: 'activo', label: 'Activo', description: 'Ejercicio intenso 5-6 días por semana', icon: 'barbell', multiplier: 1.725 },
  { value: 'muy_activo', label: 'Muy activo / Atleta', description: 'Entrenamiento diario o trabajo físico intenso', icon: 'flame', multiplier: 1.9 },
];

export const DIET_OPTIONS: RichOption[] = [
  { value: 'omnivoro', label: 'Omnívoro', description: 'Como de todo sin restricciones', icon: 'restaurant' },
  { value: 'vegetariano', label: 'Vegetariano', description: 'Sin carne ni pescado, sí huevos y lácteos', icon: 'egg' },
  { value: 'vegano', label: 'Vegano', description: 'Sin ningún producto de origen animal', icon: 'leaf' },
  { value: 'sin_gluten', label: 'Sin gluten', description: 'Intolerancia o celiaquía al gluten', icon: 'nutrition' },
  { value: 'sin_lactosa', label: 'Sin lactosa', description: 'Intolerancia a la lactosa', icon: 'water' },
];

export const EXPERIENCE_OPTIONS: RichOption[] = [
  { value: 'principiante', label: 'Principiante', description: 'Menos de 1 año entrenando', icon: 'leaf' },
  { value: 'intermedio', label: 'Intermedio', description: '1-3 años de entrenamiento constante', icon: 'flash' },
  { value: 'avanzado', label: 'Avanzado', description: 'Más de 3 años de entrenamiento', icon: 'trophy' },
];

export const EQUIPMENT_OPTIONS: RichOption[] = [
  { value: 'casa', label: 'En casa', description: 'Solo peso corporal, gomas o mancuernas', icon: 'home' },
  { value: 'gimnasio', label: 'En el gimnasio', description: 'Tengo acceso a máquinas y barras', icon: 'barbell' },
  { value: 'mixto', label: 'Mixto', description: 'Entreno en casa y en el gimnasio', icon: 'refresh' },
];

export interface HealthOption extends Option {
  icon: IconName;
}

export const HEALTH_OPTIONS: HealthOption[] = [
  { value: 'ninguna', label: 'Ninguna condición especial', icon: 'check' },
  { value: 'diabetes', label: 'Diabetes', icon: 'water' },
  { value: 'hipertension', label: 'Hipertensión', icon: 'pulse' },
  { value: 'celiaquia', label: 'Celiaquía', icon: 'nutrition' },
  { value: 'colesterol', label: 'Colesterol alto', icon: 'heart' },
  { value: 'hipotiroidismo', label: 'Hipotiroidismo', icon: 'body' },
];

/** BMR de Harris-Benedict × factor de actividad. Misma fórmula que usa el
 *  motor de planes del backend, para que el gasto estimado del paso 3 no sea
 *  un número inventado sino el mismo cálculo real. */
export function estimateTDEE(
  sex: string,
  age: number,
  heightCm: number,
  weightKg: number,
  multiplier: number
): number | null {
  if (!age || !heightCm || !weightKg || !sex) return null;
  const bmr =
    sex === 'mujer'
      ? 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age
      : 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  return Math.round(bmr * multiplier);
}

// ─── Envío al backend ────────────────────────────────────────

/**
 * Envía las respuestas y genera/actualiza el plan en el servidor.
 * 'ninguna' en health_conditions se filtra: el backend espera la lista
 * de condiciones reales (vacía si no hay ninguna).
 */
export async function submitQuestionnaire(answers: QuestionnaireAnswers) {
  return api('/api/questionnaire', {
    method: 'POST',
    body: {
      ...answers,
      health_conditions: answers.health_conditions.filter(c => c !== 'ninguna'),
    },
  });
}
