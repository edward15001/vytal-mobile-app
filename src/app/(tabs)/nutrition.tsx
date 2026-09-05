import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlan, isPro, NutritionPlan, DayMenu, Meal, swapMeal } from '@/lib/plan';
import { Spacing } from '@/constants/theme';
import { Border, Font, NV, Radius } from '@/constants/nutrovia';
import { Icon, IconName } from '@/components/icon';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const MEALS: { key: keyof DayMenu; label: string; icon: IconName }[] = [
  { key: 'desayuno', label: 'Desayuno', icon: 'leaf' },
  { key: 'almuerzo', label: 'Media mañana', icon: 'cafe' },
  { key: 'comida', label: 'Comida', icon: 'restaurant' },
  { key: 'merienda', label: 'Merienda', icon: 'nutrition' },
  { key: 'cena', label: 'Cena', icon: 'moon' },
];

type MealKey = (typeof MEALS)[number]['key'];

// Copia profunda simple (el menú es JSON puro)
function cloneMenu(menu: Record<string, DayMenu>): Record<string, DayMenu> {
  return JSON.parse(JSON.stringify(menu));
}

// Fechas reales (lunes a domingo) de la semana en curso, alineadas con DAYS.
function currentWeekDates(): Date[] {
  const now = new Date();
  const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateLabel(d: Date): string {
  return `${WEEKDAY_FULL[d.getDay()]} ${d.getDate()} de ${MONTH_FULL[d.getMonth()]}`;
}

const WEEK_DATES = currentWeekDates();
const TODAY_LABEL = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || 'Lunes';

export default function NutritionScreen() {
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(TODAY_LABEL);
  const [menu, setMenu] = useState<Record<string, DayMenu> | null>(null);
  const [original, setOriginal] = useState<Record<string, DayMenu> | null>(null);
  const [openMeal, setOpenMeal] = useState<MealKey | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const p = await getPlan();
          setPlan(p);
          if (p?.weekly_menu) {
            setMenu(cloneMenu(p.weekly_menu));
            setOriginal(cloneMenu(p.weekly_menu));
          }
        } catch {
          // sin plan
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={NV.savia} />
      </SafeAreaView>
    );
  }

  const pro = isPro(plan);
  const dayMenu = menu?.[day] as any;
  const dayIndex = DAYS.indexOf(day);

  // En modo free el backend envía solo { _kcal } por día (sin las comidas)
  const dimmed = dayMenu && typeof dayMenu._kcal === 'number';

  // Comidas del día con kcal (para el header)
  const dayKcal = dayMenu
    ? MEALS.reduce((acc, m) => acc + (Number(dayMenu[m.key]?.calorias) || 0), 0)
    : 0;
  const mealCount = dayMenu ? MEALS.filter(m => dayMenu[m.key]).length : 0;
  const origKcal = original?.[day]
    ? MEALS.reduce((acc, m) => acc + (Number((original[day] as any)[m.key]?.calorias) || 0), 0)
    : 0;
  const kcalDiff = dayKcal - origKcal;
  const daySwapped = MEALS.some(m => isMealSwapped(day, m.key));

  // Reparte los macros diarios reales del plan según el peso calórico de
  // cada comida/día: no hay desglose de macros por comida en el backend,
  // así que se deriva de datos reales en vez de mostrar cifras inventadas.
  function macrosFor(kcal: number): { p: number; c: number; g: number } {
    const totalKcal = plan?.daily_calories || 0;
    if (!totalKcal || !kcal) return { p: 0, c: 0, g: 0 };
    const ratio = kcal / totalKcal;
    return {
      p: Math.round((plan?.protein_g || 0) * ratio),
      c: Math.round((plan?.carbs_g || 0) * ratio),
      g: Math.round((plan?.fat_g || 0) * ratio),
    };
  }

  function isMealSwapped(d: string, key: MealKey): boolean {
    if (!menu || !original) return false;
    const cur = (menu[d] as any)?.[key];
    const orig = (original[d] as any)?.[key];
    if (!cur || !orig) return false;
    return cur.nombre !== orig.nombre || Number(cur.calorias) !== Number(orig.calorias);
  }

  async function applySwap(key: MealKey, sourceDay: string | null) {
    if (!menu || !original || !dayMenu) return;
    const replacement = sourceDay
      ? (menu[sourceDay] as any)?.[key]
      : (original[day] as any)?.[key];
    if (!replacement) return;

    // Optimista: aplica el cambio en local al momento
    const next = cloneMenu(menu);
    next[day][key] = JSON.parse(JSON.stringify(replacement));
    setMenu(next);
    setOpenMeal(null);

    try {
      const updated = await swapMeal(day, key, {
        nombre: replacement.nombre,
        calorias: Number(replacement.calorias),
        ingredientes: Array.isArray(replacement.ingredientes) ? replacement.ingredientes : [],
      });
      setMenu(updated);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar el cambio.');
      // Revertir a lo persistido
      setMenu(cloneMenu(menu));
    }
  }

  async function restoreDay() {
    if (!menu || !original || !dayMenu) return;
    const changed = MEALS.filter(m => isMealSwapped(day, m.key));
    for (const { key } of changed) {
      await applySwap(key, null);
    }
    setOpenMeal(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Cabecera */}
        <View style={[styles.section, styles.header]}>
          <Text style={styles.title}>Mi Nutrición</Text>
          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={() => setDay(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || 'Lunes')}
            hitSlop={8}>
            <Icon name="calendar" size={20} />
          </Pressable>
        </View>

        {/* Selector de la semana en curso */}
        <View style={[styles.section, styles.weekRow]}>
          {DAYS.map((d, i) => {
            const active = day === d;
            return (
              <Pressable
                key={d}
                onPress={() => { setDay(d); setOpenMeal(null); }}
                style={[styles.weekCell, active && styles.weekCellActive]}>
                <Text style={[styles.weekLetter, active && styles.weekLetterActive]}>{DAY_LETTERS[i]}</Text>
                <Text style={[styles.weekNum, active && styles.weekNumActive]}>{WEEK_DATES[i].getDate()}</Text>
              </Pressable>
            );
          })}
        </View>

        {plan?.notas_dieta?.length ? (
          <View style={[styles.section, styles.notesSection]}>
            {plan.notas_dieta.map((n, i) => (
              <Text key={i} style={styles.note}>
                {n}
              </Text>
            ))}
          </View>
        ) : null}

        {!dayMenu ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay menú disponible para este día.</Text>
          </View>
        ) : dimmed ? (
          // Plan FREE ("a oscuras"): solo kcal del día, comidas bloqueadas
          <View style={[styles.section, styles.lockSection]}>
            <Icon name="lock-closed" size={26} />
            <Text style={styles.lockTitle}>Nutrición detallada solo en Pro</Text>
            <Text style={styles.lockText}>
              El día {day} suma {dayMenu._kcal} kcal. El detalle de comidas está en el plan Pro.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.lockBtn, pressed && styles.lockBtnPressed]}
              onPress={() => router.push('/subscription')}>
              <Text style={styles.lockBtnText}>Subir a Pro →</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Cabecera del día: fecha, kcal y macros */}
            <View style={[styles.section, styles.dayHead]}>
              <View style={styles.dayHeadRow}>
                <Text style={styles.dayDate}>{formatDateLabel(WEEK_DATES[dayIndex] || new Date())}</Text>
                {daySwapped && (
                  <Pressable
                    style={({ pressed }) => pressed && styles.pressed}
                    onPress={restoreDay}>
                    <Text style={styles.restoreText}>
                      <Icon name="rotate-left" size={12} color={NV.savia700} /> Restaurar día
                    </Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.dayKcal}>
                {dayKcal.toLocaleString('es-ES')} kcal
                {kcalDiff !== 0 ? (
                  <Text style={kcalDiff > 0 ? styles.diffUp : styles.diffDown}>
                    {' '}
                    {kcalDiff > 0 ? '+' : ''}
                    {kcalDiff} kcal
                  </Text>
                ) : null}
              </Text>
              <Text style={styles.daySub}>
                {macrosFor(dayKcal).p} P / {macrosFor(dayKcal).c} C / {macrosFor(dayKcal).g} G · {mealCount} comida{mealCount === 1 ? '' : 's'}
              </Text>
            </View>

            {/* Comidas del día */}
            <View style={styles.mealList}>
              {MEALS.map((m, i) => {
                const meal = (dayMenu as any)[m.key] as Meal | undefined;
                if (!meal) return null;
                const open = openMeal === m.key;
                const mealSwapped = isMealSwapped(day, m.key);
                const opts = DAYS
                  .filter(o => o !== day && (menu as any)?.[o]?.[m.key])
                  .map(o => ({ day: o, meal: (menu as any)[o][m.key] as Meal }));

                return (
                  <View key={m.key} style={i > 0 && styles.mealRowDivider}>
                    <View style={styles.mealRow}>
                      <Icon name={m.icon} size={20} />
                      <View style={styles.mealInfo}>
                        <View style={styles.mealLabelRow}>
                          <Text style={styles.mealLabel}>{m.label.toUpperCase()}</Text>
                          {mealSwapped && <Text style={styles.changedBadge}>Modificado</Text>}
                        </View>
                        <Text style={styles.mealName} numberOfLines={2}>{meal.nombre}</Text>
                        <Text style={styles.mealMacros}>
                          {macrosFor(Number(meal.calorias) || 0).p} P / {macrosFor(Number(meal.calorias) || 0).c} C / {macrosFor(Number(meal.calorias) || 0).g} G
                        </Text>
                      </View>
                      <View style={styles.mealEnd}>
                        <Text style={styles.mealKcal}>{meal.calorias}</Text>
                        <Pressable
                          style={({ pressed }) => pressed && styles.pressed}
                          onPress={() => setOpenMeal(open ? null : m.key)}>
                          <Text style={styles.swapText}>Cambiar</Text>
                        </Pressable>
                      </View>
                    </View>

                    {open && (
                      <View style={styles.optionsBox}>
                        <Text style={styles.optionsTitle}>
                          Elige otra opción para {m.label.toLowerCase()}:
                        </Text>
                        {opts.map((o, oi) => (
                          <Pressable
                            key={o.day}
                            style={({ pressed }) => [styles.optRow, oi > 0 && styles.optRowDivider, pressed && styles.pressed]}
                            onPress={() => applySwap(m.key, o.day)}>
                            <Text style={styles.optName} numberOfLines={1}>{o.meal.nombre}</Text>
                            <Text style={styles.optMeta}>
                              {o.day.slice(0, 3)} · {o.meal.calorias} kcal
                            </Text>
                          </Pressable>
                        ))}
                        {mealSwapped && (
                          <Pressable
                            style={({ pressed }) => [styles.optRow, opts.length > 0 && styles.optRowDivider, pressed && styles.pressed]}
                            onPress={() => applySwap(m.key, null)}>
                            <Text style={[styles.optName, styles.optOriginalText]}>
                              <Icon name="rotate-left" size={12} color={NV.savia700} /> Volver a la original
                            </Text>
                            <Text style={styles.optMeta}>
                              {(original as any)?.[day]?.[m.key]?.nombre || ''}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NV.papel },
  center: { flex: 1, backgroundColor: NV.papel, alignItems: 'center', justifyContent: 'center' },
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

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.four },
  title: { color: NV.tinta, fontFamily: Font.bold, fontSize: 20, fontWeight: '800' },

  weekRow: { flexDirection: 'row', paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.one, borderRadius: Radius.none },
  weekCellActive: { backgroundColor: NV.savia },
  weekLetter: { color: NV.textoSuave, fontFamily: Font.medium, fontSize: 11, fontWeight: '700' },
  weekLetterActive: { color: NV.papel },
  weekNum: { color: NV.tinta, fontFamily: Font.bold, fontSize: 16, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  weekNumActive: { color: NV.papel },

  notesSection: { backgroundColor: NV.savia100, gap: Spacing.one },
  note: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, lineHeight: 19 },

  dayHead: { gap: Spacing.one },
  dayHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayDate: { color: NV.savia700, fontFamily: Font.medium, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  restoreText: { color: NV.savia700, fontFamily: Font.medium, fontSize: 12, fontWeight: '700' },
  dayKcal: { color: NV.tinta, fontFamily: Font.bold, fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  diffUp: { color: NV.ambar700, fontFamily: Font.medium, fontSize: 14 },
  diffDown: { color: NV.savia700, fontFamily: Font.medium, fontSize: 14 },
  daySub: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, fontVariant: ['tabular-nums'] },

  mealList: { borderBottomWidth: Border.structural, borderBottomColor: NV.tinta },
  mealRowDivider: { borderTopWidth: Border.inner, borderTopColor: NV.fileteSuave },
  mealRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  mealInfo: { flex: 1, gap: 2 },
  mealLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  mealLabel: { color: NV.textoSuave, fontFamily: Font.medium, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  changedBadge: { color: NV.savia700, fontFamily: Font.medium, fontSize: 11, fontWeight: '700' },
  mealName: { color: NV.tinta, fontFamily: Font.bold, fontSize: 15, fontWeight: '700' },
  mealMacros: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12, fontVariant: ['tabular-nums'] },
  mealEnd: { alignItems: 'flex-end', gap: 4 },
  mealKcal: { color: NV.tinta, fontFamily: Font.bold, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  swapText: { color: NV.savia700, fontFamily: Font.medium, fontSize: 12, fontWeight: '700' },

  optionsBox: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    borderTopWidth: Border.inner,
    borderTopColor: NV.fileteSuave,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  optionsTitle: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12, marginBottom: Spacing.one },
  optRow: { paddingVertical: Spacing.two, gap: 2 },
  optRowDivider: { borderTopWidth: Border.inner, borderTopColor: NV.fileteSuave },
  optName: { color: NV.tinta, fontFamily: Font.medium, fontSize: 13, fontWeight: '600' },
  optOriginalText: { color: NV.savia700 },
  optMeta: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 11 },

  empty: { padding: Spacing.four, alignItems: 'center' },
  emptyText: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 14 },
  lockSection: { backgroundColor: NV.savia100, alignItems: 'center', gap: Spacing.two },
  lockTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  lockText: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  lockBtn: { backgroundColor: NV.savia, borderRadius: Radius.none, paddingHorizontal: Spacing.four, paddingVertical: 12, marginTop: Spacing.two },
  lockBtnPressed: { backgroundColor: NV.savia700 },
  lockBtnText: { color: NV.papel, fontFamily: Font.bold, fontSize: 14, fontWeight: '800' },
});
