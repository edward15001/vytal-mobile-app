import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlan, isPro, NutritionPlan } from '@/lib/plan';
import { getUser, logout } from '@/lib/auth';
import { getTodaySummary, togglePlannedMeal, FoodDaySummary } from '@/lib/foodlog';
import { getCheckinStatus, respondCheckin, CheckinStatus } from '@/lib/checkin';
import { Spacing } from '@/constants/theme';
import { Border, Font, NV, Radius } from '@/constants/nutrovia';
import { Icon } from '@/components/icon';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const WEEKDAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Todas las comidas del día, en el mismo orden y con las mismas etiquetas
// que usa "Comer" — así el checklist de "Hoy" cubre el menú completo.
const TODAY_MEALS: { key: 'desayuno' | 'almuerzo' | 'comida' | 'merienda' | 'cena'; label: string }[] = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'almuerzo', label: 'Media mañana' },
  { key: 'comida', label: 'Comida' },
  { key: 'merienda', label: 'Merienda' },
  { key: 'cena', label: 'Cena' },
];

function todayDayLabel(): string {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1];
}

function formatTodayDate(): string {
  const d = new Date();
  return `${WEEKDAY_FULL[d.getDay()]} ${d.getDate()} de ${MONTH_FULL[d.getMonth()]}`;
}

function initials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function OverviewScreen() {
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [day, setDay] = useState<FoodDaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null);
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    try {
      const user = await getUser();
      setUserName(user?.name || '');
      const p = await getPlan();
      setPlan(p);
      getTodaySummary().then(setDay).catch(() => {});
      // Check-in semanal (Pro): mostrar el aviso si lleva días sin actividad.
      if (p) {
        getCheckinStatus()
          .then(s => setCheckin(s.due ? s : null))
          .catch(() => {});
      }
    } catch (err: any) {
      // Sesión caducada en el servidor: cerramos sesión para volver al login
      // en vez de dejar la pantalla de Hoy atascada con un error sin capturar.
      if (err?.status === 401) {
        await logout();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onCheckin(response: 'all_good' | 'want_change') {
    setCheckinModalVisible(false);
    setCheckin(null);
    try {
      await respondCheckin(response);
    } catch {
      // si falla el registro, seguimos igual
    }
    if (response === 'want_change') {
      router.push('/questionnaire?edit=1');
    }
  }

  async function toggleMeal(mealKey: string, meal: { nombre: string; calorias: number }) {
    try {
      const updated = await togglePlannedMeal(day?.entries || [], mealKey, meal);
      setDay(updated);
    } catch (err: any) {
      Alert.alert('No se pudo actualizar', err?.message || 'Inténtalo de nuevo.');
    }
  }

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={NV.savia} />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>Aún no tienes un plan</Text>
        <Text style={styles.emptyText}>Completa el cuestionario para recibir tu plan personalizado</Text>
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
          onPress={() => router.push('/questionnaire')}>
          <Text style={styles.ctaText}>Comenzar ahora</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const pro = isPro(plan);
  const target = day?.plan?.daily_calories ?? plan.daily_calories;
  const consumed = Math.round(day?.total.calories || 0);
  const remaining = Math.max(0, Math.round(day?.remaining?.calories ?? target - consumed));
  const progress = target > 0 ? Math.min(1, consumed / target) : 0;

  const todayKey = todayDayLabel();
  const dayMenu = (plan.weekly_menu as any)?.[todayKey];
  const loggedMeals = new Set((day?.entries || []).map(e => e.meal_type).filter(Boolean));
  const todaySession = plan.training_plan?.sesiones?.find(
    s => s.dia?.trim().toLowerCase() === todayKey.toLowerCase()
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NV.savia} />}>

        {/* Cabecera: marca + avatar de cuenta */}
        <View style={[styles.section, styles.header]}>
          <View style={styles.brandRow}>
            <Image source={require('@/assets/images/vytal-mark.png')} style={styles.logoMark} resizeMode="contain" />
            <Text style={styles.brand}>VYTAL</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => pressed && styles.pressed}
              onPress={() => router.push('/questionnaire?edit=1')}
              hitSlop={8}>
              <Icon name="clipboard" size={16} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
              onPress={() => router.push('/subscription')}
              hitSlop={8}>
              <Text style={styles.avatarText}>{initials(userName) || '·'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Tarjeta Pro / estado */}
        {!pro && (
          <Pressable
            style={({ pressed }) => [styles.section, styles.upgradeCard, pressed && styles.pressed]}
            onPress={() => router.push('/subscription')}>
            <Icon name="sparkles" size={20} />
            <View style={styles.upgradeTextWrap}>
              <Text style={styles.upgradeTitle}>Actualiza a Pro · 14 €/mes</Text>
              <Text style={styles.upgradeSub}>Desbloquea menú detallado, IA y suplementos</Text>
            </View>
            <Icon name="arrow-forward" size={16} color={NV.papel} />
          </Pressable>
        )}

        {/* Kcal de hoy + progreso */}
        <View style={[styles.section, styles.todayCard]}>
          <Text style={styles.todayDate}>{formatTodayDate()}</Text>
          <Text style={styles.todayKcal}>{consumed.toLocaleString('es-ES')}</Text>
          <Text style={styles.todaySub}>
            de {target.toLocaleString('es-ES')} kcal · quedan {remaining.toLocaleString('es-ES')}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Macros consumidos hoy */}
        <View style={[styles.section, styles.macrosCard]}>
          <View style={styles.macroCol}>
            <Text style={styles.macroLabel}>Proteína</Text>
            <Text style={styles.macroValue}>{Math.round(day?.total.protein_g || 0)} g</Text>
          </View>
          <View style={styles.macroDivider} />
          <View style={styles.macroCol}>
            <Text style={styles.macroLabel}>Carbos</Text>
            <Text style={styles.macroValue}>{Math.round(day?.total.carbs_g || 0)} g</Text>
          </View>
          <View style={styles.macroDivider} />
          <View style={styles.macroCol}>
            <Text style={styles.macroLabel}>Grasas</Text>
            <Text style={styles.macroValue}>{Math.round(day?.total.fat_g || 0)} g</Text>
          </View>
        </View>

        {/* Hoy en tu plan: comidas del día + sesión de entreno */}
        {dayMenu && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Hoy en tu plan</Text>
              <Pressable onPress={() => router.push('/nutrition')} hitSlop={8}>
                <Text style={styles.sectionLink}>Ver todo →</Text>
              </Pressable>
            </View>

            <View style={styles.planList}>
              {TODAY_MEALS.map((m, i) => {
                const meal = dayMenu[m.key];
                if (!meal) return null;
                const done = loggedMeals.has(m.key);
                return (
                  <Pressable
                    key={m.key}
                    style={({ pressed }) => [styles.planRow, i > 0 && styles.planRowDivider, pressed && styles.pressed]}
                    onPress={() => toggleMeal(m.key, meal)}>
                    <Icon name={done ? 'checkmark-circle' : 'circle-outline'} size={22} color={done ? NV.savia : NV.neutro500} />
                    <View style={styles.planRowInfo}>
                      <Text style={styles.planRowTitle}>{m.label}</Text>
                      <Text style={styles.planRowDesc} numberOfLines={1}>{meal.nombre}</Text>
                    </View>
                    <Text style={styles.planRowKcal}>{meal.calorias}</Text>
                  </Pressable>
                );
              })}

              {todaySession && (
                <Pressable
                  style={({ pressed }) => [
                    styles.trainingRow,
                    TODAY_MEALS.some(m => dayMenu[m.key]) && styles.planRowDivider,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => router.push('/training')}>
                  <Icon name="barbell" size={20} color={NV.arcilla700} />
                  <View style={styles.planRowInfo}>
                    <Text style={styles.trainingTitle}>{todaySession.tipo}</Text>
                    <Text style={styles.trainingDesc}>
                      {todaySession.ejercicios.length} ejercicio{todaySession.ejercicios.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={styles.trainingCta}>Empezar</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Check-in semanal pendiente */}
        {checkin && (
          <Pressable
            style={({ pressed }) => [styles.section, styles.checkinBanner, pressed && styles.pressed]}
            onPress={() => setCheckinModalVisible(true)}>
            <Icon name="notifications" size={20} color={NV.ambar700} />
            <View style={styles.upgradeTextWrap}>
              <Text style={styles.checkinBannerTitle}>Check-in pendiente</Text>
              <Text style={styles.checkinBannerText}>
                Llevas {checkin.days_since_last_activity ?? 7} días sin actualizar tus valores.
              </Text>
            </View>
          </Pressable>
        )}
      </ScrollView>

      {/* Check-in semanal: ¿Cómo va ese progreso? */}
      <Modal
        visible={checkinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckinModalVisible(false)}>
        <View style={styles.checkinOverlay}>
          <View style={styles.checkinModal}>
            <View style={styles.checkinIcon}>
              <Icon name="sparkles" size={40} />
            </View>
            <Text style={styles.checkinTitle}>¿Cómo va ese progreso?</Text>
            <Text style={styles.checkinText}>
              Llevas un tiempo sin actualizar tus datos. ¿Quieres contarnos cómo va todo?
              Si algo ha cambiado, podemos ajustar tu plan al momento.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.checkinGoodBtn, pressed && styles.checkinGoodBtnPressed]}
              onPress={() => onCheckin('all_good')}>
              <Text style={styles.checkinGoodText}>Todo va bien</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.checkinChangeBtn, pressed && styles.pressed]}
              onPress={() => onCheckin('want_change')}>
              <Text style={styles.checkinChangeText}>Quiero cambiar algo</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NV.papel },
  center: { flex: 1, backgroundColor: NV.papel, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: { flex: 1 },
  content: { paddingBottom: Spacing.four },

  // Todas las secciones son de ancho completo: no hay cajas, solo un filete
  // horizontal de 2px en tinta que cierra cada una por abajo.
  section: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: Border.structural,
    borderBottomColor: NV.tinta,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.four,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logoMark: { width: 26, height: 26 },
  // Sin fontWeight: es una tipografía de un solo peso (Tahoe Display) — fijar
  // un fontWeight junto al fontFamily hace que Android ignore el tipo de
  // letra personalizado y sustituya uno del sistema.
  brand: { color: NV.tinta, fontFamily: Font.brand, fontSize: 18, letterSpacing: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.none,
    backgroundColor: NV.tinta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: NV.papel, fontFamily: Font.bold, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.85 },

  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NV.savia100,
  },
  upgradeTextWrap: { flex: 1 },
  upgradeTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 14, fontWeight: '800' },
  upgradeSub: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12, marginTop: 2 },

  todayCard: {
    backgroundColor: NV.savia100,
    gap: Spacing.one,
  },
  todayDate: { color: NV.savia700, fontFamily: Font.medium, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  todayKcal: { color: NV.tinta, fontFamily: Font.bold, fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] },
  todaySub: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, fontVariant: ['tabular-nums'], marginBottom: Spacing.one },
  progressTrack: { height: 8, backgroundColor: NV.savia300, borderRadius: Radius.none, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: NV.savia700, borderRadius: Radius.none },

  macrosCard: {
    flexDirection: 'row',
  },
  macroCol: { flex: 1, alignItems: 'flex-start', gap: 4 },
  macroDivider: { width: Border.inner, backgroundColor: NV.fileteSuave, marginHorizontal: Spacing.two },
  macroLabel: { color: NV.textoSuave, fontFamily: Font.medium, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  macroValue: { color: NV.tinta, fontFamily: Font.bold, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sectionLabel: { color: NV.savia700, fontFamily: Font.medium, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionLink: { color: NV.savia700, fontFamily: Font.medium, fontSize: 13, fontWeight: '700' },

  planList: {
    borderBottomWidth: Border.structural,
    borderBottomColor: NV.tinta,
  },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  planRowDivider: { borderTopWidth: Border.inner, borderTopColor: NV.fileteSuave },
  planRowInfo: { flex: 1 },
  planRowTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 15, fontWeight: '700' },
  planRowDesc: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12, marginTop: 1 },
  planRowKcal: { color: NV.tinta, fontFamily: Font.bold, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  trainingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, backgroundColor: NV.arcilla100 },
  trainingTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 15, fontWeight: '700' },
  trainingDesc: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12, marginTop: 1 },
  trainingCta: { color: NV.arcilla700, fontFamily: Font.bold, fontSize: 13, fontWeight: '800' },

  checkinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NV.ambar100,
  },
  checkinBannerTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 14, fontWeight: '800' },
  checkinBannerText: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12, marginTop: 2 },

  checkinOverlay: {
    flex: 1,
    backgroundColor: NV.veloTinta,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  checkinModal: {
    backgroundColor: NV.papelAlt,
    borderRadius: Radius.none,
    borderWidth: Border.structural,
    borderColor: NV.savia,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkinIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.none,
    backgroundColor: NV.savia100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  checkinTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  checkinText: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: Spacing.two },
  checkinGoodBtn: {
    backgroundColor: NV.savia,
    borderRadius: Radius.none,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  checkinGoodBtnPressed: { backgroundColor: NV.savia700 },
  checkinGoodText: { color: NV.papel, fontFamily: Font.bold, fontSize: 15, fontWeight: '800' },
  checkinChangeBtn: {
    borderRadius: Radius.none,
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
    borderWidth: Border.structural,
    borderColor: NV.tinta,
  },
  checkinChangeText: { color: NV.tinta, fontFamily: Font.medium, fontSize: 14, fontWeight: '700' },
  emptyTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 14, textAlign: 'center', marginTop: Spacing.two },
  ctaBtn: { backgroundColor: NV.savia, borderRadius: Radius.none, paddingVertical: 14, paddingHorizontal: Spacing.four, marginTop: Spacing.four },
  ctaBtnPressed: { backgroundColor: NV.savia700 },
  ctaText: { color: NV.papel, fontFamily: Font.bold, fontSize: 15, fontWeight: '800' },
});
