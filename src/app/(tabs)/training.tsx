import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlan, NutritionPlan } from '@/lib/plan';
import {
  ParsedExercise,
  TrainingSessionState,
  loadTrainingSession,
  parseExercise,
  restSecondsFor,
  saveTrainingSession,
  submitTrainingDuration,
} from '@/lib/trainingSession';
import { Spacing } from '@/constants/theme';
import { Border, Font, NV, Radius } from '@/constants/nutrovia';
import { Icon } from '@/components/icon';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function todayDayLabel(): string {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1];
}

// Semana ISO del año, para la cabecera "SEMANA 04".
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Tras un descanso: si quedan series del mismo ejercicio, pasa a la
// siguiente; si no, pasa al primer set del ejercicio siguiente.
function advanceAfterRest(s: TrainingSessionState, exercises: ParsedExercise[]): TrainingSessionState {
  const current = exercises[s.exerciseIndex];
  if (!current) return { ...s, phase: 'set', restRemaining: 0 };
  if (s.setIndex < current.series) {
    return { ...s, phase: 'set', setIndex: s.setIndex + 1, restRemaining: 0 };
  }
  return { ...s, phase: 'set', exerciseIndex: s.exerciseIndex + 1, setIndex: 1, restRemaining: 0 };
}

export default function TrainingScreen() {
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(todayDayLabel());

  // Progreso de la sesión activa: se guarda en el dispositivo y se recupera
  // al volver a esta pantalla o reabrir la app.
  const [session, setSession] = useState<TrainingSessionState | null>(null);
  const [running, setRunning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const p = await getPlan();
          setPlan(p);
          const sesiones = p?.training_plan?.sesiones || [];
          const today = todayDayLabel();
          const hasToday = sesiones.some(s => s.dia?.trim().toLowerCase() === today.toLowerCase());
          if (!hasToday) {
            const firstWithSession = DAYS.find(d =>
              sesiones.some(s => s.dia?.trim().toLowerCase() === d.toLowerCase())
            );
            setSelectedDay(firstWithSession || today);
          }
        } catch {
          // sin plan
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const tp = plan?.training_plan;
  const sessionOf = (d: string) => tp?.sesiones.find(s => s.dia?.trim().toLowerCase() === d.toLowerCase());
  const daySession = sessionOf(selectedDay);
  const exercises = (daySession?.ejercicios || []).map(parseExercise);
  const totalSeries = exercises.reduce((acc, e) => acc + e.series, 0);

  // Referencia siempre al día con sus ejercicios ya parseados: el intervalo
  // del cronómetro la lee para no quedarse con datos de un día anterior.
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;

  // Evita subir la duración más de una vez por sesión completada.
  const syncedRef = useRef(false);

  // Al cambiar de día (o de plan), recupera el progreso guardado de ese día
  // si sigue siendo válido, o arranca en blanco. Siempre en pausa: reabrir
  // la app o volver a la pestaña no reanuda el cronómetro solo.
  useEffect(() => {
    if (!plan?.generated_at) return;
    let cancelled = false;
    setRunning(false);
    (async () => {
      const saved = await loadTrainingSession(selectedDay);
      if (cancelled) return;
      syncedRef.current = false;
      setSession(saved && saved.planGeneratedAt === plan.generated_at ? saved : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDay, plan?.generated_at]);

  // Al completar todos los ejercicios de la sesión de HOY, sube la duración
  // real al backend para que el dashboard web la muestre en "Sesión de hoy".
  useEffect(() => {
    if (!session || !exercises.length) return;
    if (session.exerciseIndex < exercises.length) return;
    if (syncedRef.current) return;
    if (selectedDay !== todayDayLabel()) return;
    syncedRef.current = true;
    submitTrainingDuration(Math.max(1, Math.round(session.elapsed / 60))).catch(() => {});
  }, [session, exercises.length, selectedDay]);

  // Cronómetro + cuenta atrás del descanso: un único intervalo mientras corre.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSession(prev => {
        if (!prev) return prev;
        let next: TrainingSessionState = { ...prev, elapsed: prev.elapsed + 1 };
        if (next.phase === 'rest') {
          if (next.restRemaining <= 1) {
            next = advanceAfterRest(next, exercisesRef.current);
            if (next.exerciseIndex >= exercisesRef.current.length) setRunning(false);
          } else {
            next.restRemaining -= 1;
          }
        }
        const structural = next.phase !== prev.phase || next.exerciseIndex !== prev.exerciseIndex || next.setIndex !== prev.setIndex;
        if (structural || next.elapsed % 5 === 0) saveTrainingSession(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  function onSessionButton() {
    if (!session) {
      const fresh: TrainingSessionState = {
        day: selectedDay,
        planGeneratedAt: plan?.generated_at || '',
        elapsed: 0,
        exerciseIndex: 0,
        setIndex: 1,
        phase: 'set',
        restRemaining: 0,
      };
      setSession(fresh);
      saveTrainingSession(fresh);
      setRunning(true);
      return;
    }
    setRunning(r => !r);
  }

  function completeSet() {
    if (!session) return;
    const current = exercises[session.exerciseIndex];
    if (!current) return;
    const isLastSetOfLastExercise = session.setIndex >= current.series && session.exerciseIndex >= exercises.length - 1;
    const next: TrainingSessionState = isLastSetOfLastExercise
      ? { ...session, phase: 'set', exerciseIndex: exercises.length, restRemaining: 0 }
      : { ...session, phase: 'rest', restRemaining: restSecondsFor(current.reps) };
    setSession(next);
    saveTrainingSession(next);
    if (isLastSetOfLastExercise) setRunning(false);
  }

  function skipRest() {
    if (!session || session.phase !== 'rest') return;
    const next = advanceAfterRest(session, exercises);
    setSession(next);
    saveTrainingSession(next);
    if (next.exerciseIndex >= exercises.length) setRunning(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={NV.arcilla} />
      </SafeAreaView>
    );
  }

  if (!tp) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>Genera tu plan para ver tu entrenamiento</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Cabecera de la sesión seleccionada */}
        <View style={[styles.section, styles.headSection]}>
          <View style={styles.headLeft}>
            <Text style={styles.weekLabel}>Semana {String(isoWeek(new Date())).padStart(2, '0')}</Text>
            <Text style={styles.sessionTitle}>{daySession ? daySession.tipo : 'Descanso'}</Text>
          </View>
          {session && daySession && (
            <View style={styles.headRight}>
              <Text style={styles.headDuration}>{Math.floor(session.elapsed / 60)} min</Text>
              <Text style={styles.headSets}>{totalSeries} series</Text>
            </View>
          )}
        </View>

        {/* Selector de la semana */}
        <View style={[styles.section, styles.weekRow]}>
          {DAYS.map((d, i) => {
            const active = selectedDay === d;
            const has = !!sessionOf(d);
            return (
              <Pressable
                key={d}
                onPress={() => setSelectedDay(d)}
                style={[styles.weekCell, active && styles.weekCellActive]}>
                <Text style={[styles.weekLetter, active && styles.weekLetterActive]}>{DAY_LETTERS[i]}</Text>
                {has ? (
                  <Icon name="barbell" size={14} color={active ? NV.papel : NV.tinta} />
                ) : (
                  <Text style={[styles.weekRest, active && styles.weekLetterActive]}>—</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {!daySession ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Día de descanso. Aprovecha para recuperar.</Text>
          </View>
        ) : (
          <>
            {/* Ejercicios de la sesión, en orden: hechos, el actual, los pendientes */}
            <View style={styles.exerciseList}>
              {exercises.map((ex, i) => {
                const isDone = !!session && i < session.exerciseIndex;
                const isActive = !!session && i === session.exerciseIndex;

                if (isActive && session!.phase === 'rest') {
                  const nextLabel =
                    session!.setIndex < ex.series
                      ? `Antes de la serie ${session!.setIndex + 1} de ${ex.nombre}`
                      : exercises[i + 1]
                        ? `Antes de ${exercises[i + 1].nombre}`
                        : 'Última serie de la sesión';
                  return (
                    <View key={i} style={[styles.exerciseRow, styles.restRow, i > 0 && styles.exerciseRowDivider]}>
                      <Icon name="notifications" size={22} color={NV.ambar700} />
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.restTitle}>Descansa {session!.restRemaining}s</Text>
                        <Text style={styles.restHint}>{nextLabel}</Text>
                      </View>
                      <Pressable onPress={skipRest} hitSlop={8}>
                        <Text style={styles.skipText}>Saltar</Text>
                      </Pressable>
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={i}
                    disabled={!isActive}
                    style={({ pressed }) => [
                      styles.exerciseRow,
                      i > 0 && styles.exerciseRowDivider,
                      isActive && styles.exerciseRowActive,
                      isActive && pressed && styles.pressed,
                    ]}
                    onPress={isActive ? completeSet : undefined}>
                    {isDone ? (
                      <Icon name="checkmark-circle" size={22} color={NV.savia} />
                    ) : isActive ? (
                      <View style={styles.activeSquare} />
                    ) : (
                      <Icon name="circle-outline" size={22} color={NV.neutro500} />
                    )}
                    <View style={styles.exerciseInfo}>
                      <Text style={[styles.exerciseText, isDone && styles.exerciseTextDone]}>{ex.nombre}</Text>
                      <Text style={styles.exerciseMeta}>
                        {isActive
                          ? `Serie ${session!.setIndex} de ${ex.series}`
                          : ex.reps
                            ? `${ex.series} × ${ex.reps}`
                            : ex.raw}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {tp.progresion?.length > 0 && (
              <View style={[styles.section, styles.notesSection]}>
                <View style={styles.notesLabelRow}><Icon name="trending-up" size={14} /><Text style={styles.notesLabel}>Progresión</Text></View>
                {tp.progresion.map((p, i) => (
                  <Text key={i} style={styles.note}>{p}</Text>
                ))}
              </View>
            )}

            {tp.notas?.length > 0 && (
              <View style={[styles.section, styles.notesSection]}>
                <View style={styles.notesLabelRow}><Icon name="document-text-outline" size={14} /><Text style={styles.notesLabel}>Notas</Text></View>
                {tp.notas.map((n, i) => (
                  <Text key={i} style={styles.note}>{n}</Text>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Fijo bajo el scroll (no dentro de él): iniciar / pausar / continuar
          la sesión, con el cronómetro siempre visible en la cabecera. */}
      {daySession && (
        <View style={styles.startBarWrap}>
          <Pressable
            style={({ pressed }) => [styles.startBar, pressed && styles.startBarPressed]}
            onPress={onSessionButton}>
            <Text style={styles.startBarText}>
              {!session ? 'Comenzar sesión' : running ? 'Pausar sesión' : 'Continuar sesión'}
            </Text>
            <Icon name={running ? 'pause' : 'play'} size={18} color={NV.papel} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NV.papel },
  center: { flex: 1, backgroundColor: NV.papel, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: { flex: 1 },
  content: { paddingBottom: Spacing.four },
  pressed: { opacity: 0.85 },

  // Todas las secciones son de ancho completo: sin cajas, solo un filete
  // horizontal de 2px en tinta que cierra cada una por abajo.
  section: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: Border.structural,
    borderBottomColor: NV.tinta,
  },

  headSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: NV.arcilla100,
    paddingTop: Spacing.four,
  },
  headLeft: { gap: 4 },
  weekLabel: { color: NV.arcilla700, fontFamily: Font.medium, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sessionTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 22, fontWeight: '900', textTransform: 'capitalize' },
  headRight: { alignItems: 'flex-end', gap: 2 },
  headDuration: { color: NV.tinta, fontFamily: Font.bold, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  headSets: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12, fontVariant: ['tabular-nums'] },

  weekRow: { flexDirection: 'row', paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  weekCell: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.one, borderRadius: Radius.none },
  weekCellActive: { backgroundColor: NV.arcilla },
  weekLetter: { color: NV.textoSuave, fontFamily: Font.medium, fontSize: 11, fontWeight: '700' },
  weekLetterActive: { color: NV.papel },
  weekRest: { color: NV.neutro500, fontFamily: Font.regular, fontSize: 14 },

  empty: { padding: Spacing.four, alignItems: 'center' },
  emptyText: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 14, textAlign: 'center' },

  exerciseList: { borderBottomWidth: Border.structural, borderBottomColor: NV.tinta },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  exerciseRowDivider: { borderTopWidth: Border.inner, borderTopColor: NV.fileteSuave },
  exerciseRowActive: { backgroundColor: NV.arcilla100 },
  exerciseInfo: { flex: 1, gap: 2 },
  exerciseText: { color: NV.tinta, fontFamily: Font.bold, fontSize: 15, fontWeight: '700' },
  exerciseTextDone: { color: NV.textoSuave, textDecorationLine: 'line-through' },
  exerciseMeta: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12 },
  activeSquare: { width: 20, height: 20, backgroundColor: NV.arcilla },

  restRow: { backgroundColor: NV.ambar100 },
  restTitle: { color: NV.ambar700, fontFamily: Font.bold, fontSize: 15, fontWeight: '800' },
  restHint: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12, marginTop: 2 },
  skipText: { color: NV.ambar700, fontFamily: Font.medium, fontSize: 13, fontWeight: '700' },

  notesSection: { gap: Spacing.one },
  notesLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginBottom: 2 },
  notesLabel: { color: NV.arcilla700, fontFamily: Font.medium, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  note: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, lineHeight: 19 },

  startBarWrap: {
    backgroundColor: NV.papel,
    borderTopWidth: Border.structural,
    borderTopColor: NV.tinta,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  startBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NV.arcilla,
    borderRadius: Radius.none,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  startBarPressed: { backgroundColor: NV.arcilla700 },
  startBarText: { color: NV.papel, fontFamily: Font.bold, fontSize: 15, fontWeight: '800' },
});
