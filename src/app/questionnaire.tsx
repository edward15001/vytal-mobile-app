import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlan } from '@/lib/plan';
import { Spacing } from '@/constants/theme';
import { Border, Font, NV, Radius } from '@/constants/nutrovia';
import { Icon } from '@/components/icon';
import {
  ACTIVITY_OPTIONS,
  ActivityOption,
  DIET_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  HEALTH_OPTIONS,
  HealthOption,
  RichOption,
  SEX_OPTIONS,
  estimateTDEE,
  submitQuestionnaire,
} from '@/lib/questionnaire';

const TOTAL_STEPS = 6; // 5 pantallas + el "paso 6" implícito: el plan generado
const DAY_MARKS = [1, 2, 3, 4, 5, 6];

type Tone = 'savia' | 'arcilla' | 'malva' | 'ambar';

function toneColor(tone?: Tone): string {
  switch (tone) {
    case 'arcilla': return NV.arcilla;
    case 'malva': return NV.malva;
    case 'ambar': return NV.ambar;
    default: return NV.savia;
  }
}
function toneColor700(tone?: Tone): string {
  switch (tone) {
    case 'arcilla': return NV.arcilla700;
    case 'malva': return NV.malva700;
    case 'ambar': return NV.ambar700;
    default: return NV.savia700;
  }
}
function toneTint(tone?: Tone): string {
  switch (tone) {
    case 'arcilla': return NV.arcilla100;
    case 'malva': return NV.malva100;
    case 'ambar': return NV.ambar100;
    default: return NV.savia100;
  }
}

export default function QuestionnaireScreen() {
  // ?edit=1 → viene de "Editar cuestionario" (plan ya existente)
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = edit === '1';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);

  const [sex, setSex] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [goal, setGoal] = useState('');
  const [activity, setActivity] = useState('');
  const [diet, setDiet] = useState('');
  const [experience, setExperience] = useState('');
  const [equipment, setEquipment] = useState('');
  const [days, setDays] = useState(3);
  const [health, setHealth] = useState<string[]>(['ninguna']);

  // Modo edición: rellenar con los valores actuales del plan
  useEffect(() => {
    (async () => {
      try {
        const plan = await getPlan();
        const p = plan?.profile;
        if (p) {
          setSex(p.sex || '');
          setAge(p.age ? String(p.age) : '');
          setHeight(p.height_cm ? String(p.height_cm) : '');
          setWeight(p.weight_kg ? String(p.weight_kg) : '');
          setTargetWeight(p.target_weight_kg ? String(p.target_weight_kg) : '');
          setGoal(p.goal || '');
          setActivity(p.activity_level || '');
          setDiet(p.dietary_preference || '');
          setExperience(p.training_experience || '');
          setEquipment(p.training_equipment || '');
          setDays(p.training_days_per_week || 3);
          setHealth(p.health_conditions?.length ? p.health_conditions : ['ninguna']);
        }
      } catch {
        // sin plan → formulario vacío
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleHealth = useCallback((value: string) => {
    setHealth(prev => {
      if (value === 'ninguna') return ['ninguna'];
      const withoutNone = prev.filter(c => c !== 'ninguna');
      return withoutNone.includes(value)
        ? withoutNone.filter(c => c !== value)
        : [...withoutNone, value];
    });
  }, []);

  function validateStep(s: number): string {
    if (s === 0) {
      if (!sex) return 'Selecciona tu sexo biológico.';
      const a = parseInt(age);
      if (!a || a < 15 || a > 100) return 'Introduce una edad válida (15-100).';
      const h = parseInt(height);
      if (!h || h < 100 || h > 250) return 'Introduce una altura válida (100-250 cm).';
      const w = parseFloat(weight);
      if (!w || w < 30 || w > 300) return 'Introduce un peso válido (30-300 kg).';
      if (targetWeight) {
        const tw = parseFloat(targetWeight);
        if (!tw || tw < 30 || tw > 300) return 'Peso objetivo inválido (30-300 kg).';
      }
      return '';
    }
    if (s === 1) return goal ? '' : 'Selecciona tu objetivo principal.';
    if (s === 2) return activity ? '' : 'Selecciona tu nivel de actividad.';
    if (s === 3) {
      if (!diet) return 'Selecciona tu preferencia dietética.';
      if (!experience) return 'Selecciona tu nivel de experiencia.';
      if (!equipment) return 'Selecciona dónde entrenas.';
      return '';
    }
    return '';
  }

  const isLastStep = step === 4;

  function goBack() {
    setError('');
    if (step > 0) {
      setStep(step - 1);
    } else if (router.canGoBack()) {
      router.back();
    }
  }

  async function goNext() {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    if (!isLastStep) {
      setStep(step + 1);
      return;
    }
    setSubmitting(true);
    try {
      await submitQuestionnaire({
        sex,
        age: parseInt(age),
        height_cm: parseInt(height),
        weight_kg: parseFloat(weight),
        target_weight_kg: targetWeight ? parseFloat(targetWeight) : null,
        goal,
        activity_level: activity,
        dietary_preference: diet,
        health_conditions: health,
        training_experience: experience,
        training_days_per_week: days,
        training_equipment: equipment,
      });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      setError(err.message || 'Error generando el plan. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={NV.savia} />
      </SafeAreaView>
    );
  }

  const tdee = (() => {
    const opt = ACTIVITY_OPTIONS.find(o => o.value === activity);
    if (!opt) return null;
    return estimateTDEE(sex, parseInt(age) || 0, parseInt(height) || 0, parseFloat(weight) || 0, opt.multiplier);
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.wizardHeader}>
        <View style={styles.wizardHeaderTop}>
          <Image
            source={require('@/assets/images/vytal-logo-black.png')}
            style={styles.wizardLogo}
            resizeMode="contain"
          />
          <Text style={styles.wizardStepLabel}>PASO {step + 1} DE {TOTAL_STEPS}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <Text style={styles.stepTitle}>Tus métricas</Text>
              <Text style={styles.stepSubtitle}>Con esto calculamos tu metabolismo basal</Text>

              <Text style={styles.fieldLabel}>SEXO BIOLÓGICO</Text>
              <View style={styles.segmentRow}>
                {SEX_OPTIONS.map((opt, i) => {
                  const selected = sex === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setSex(opt.value)}
                      style={[
                        styles.segmentBtn,
                        i > 0 && styles.segmentBtnDivider,
                        selected && styles.segmentBtnSelected,
                      ]}>
                      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hintText}>
                La ecuación Harris-Benedict usa coeficientes distintos según el sexo.
              </Text>

              <NumField label="EDAD" value={age} onChange={setAge} placeholder="Ej. 28" suffix="años" />
              <NumField label="ALTURA" value={height} onChange={setHeight} placeholder="Ej. 175" suffix="cm" />
              <NumField label="PESO ACTUAL" value={weight} onChange={setWeight} placeholder="Ej. 75" suffix="kg" />
              <NumField
                label="PESO OBJETIVO"
                hint="(opcional)"
                value={targetWeight}
                onChange={setTargetWeight}
                placeholder="Ej. 68"
                suffix="kg"
              />
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>¿Cuál es tu objetivo?</Text>
              <Text style={styles.stepSubtitle}>Tu plan se construirá específicamente para este fin</Text>
              <View style={styles.optionList}>
                {GOAL_OPTIONS.map((opt, i) => (
                  <OptionRow
                    key={opt.value}
                    option={opt}
                    selected={goal === opt.value}
                    onPress={() => setGoal(opt.value)}
                    first={i === 0}
                    tone={opt.tone}
                  />
                ))}
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>¿Cómo es tu día a día?</Text>
              <Text style={styles.stepSubtitle}>Esto determina tu gasto calórico total</Text>
              <View style={styles.optionList}>
                {ACTIVITY_OPTIONS.map((opt, i) => (
                  <OptionRow
                    key={opt.value}
                    option={opt}
                    selected={activity === opt.value}
                    onPress={() => setActivity(opt.value)}
                    first={i === 0}
                    rightLabel={`×${String(opt.multiplier).replace('.', ',')}`}
                  />
                ))}
              </View>
              <View style={styles.gastoStrip}>
                <Icon name="chart" size={16} color={NV.savia700} />
                <Text style={styles.gastoText}>
                  Tu gasto estimado con esta selección:{' '}
                  <Text style={styles.gastoValue}>
                    {tdee ? `${tdee.toLocaleString('es-ES')} kcal / día` : '— kcal / día'}
                  </Text>
                </Text>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Preferencias alimenticias</Text>
              <Text style={styles.stepSubtitle}>Tu menú se adaptará completamente a tu dieta</Text>
              <View style={styles.optionList}>
                {DIET_OPTIONS.map((opt, i) => (
                  <OptionRow
                    key={opt.value}
                    option={opt}
                    selected={diet === opt.value}
                    onPress={() => setDiet(opt.value)}
                    first={i === 0}
                  />
                ))}
              </View>

              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>¿CUÁNTOS DÍAS ENTRENAS POR SEMANA?</Text>
              <Text style={styles.daysValue}>
                <Text style={styles.daysNum}>{days}</Text> días
              </Text>
              <View style={styles.daysBar}>
                {DAY_MARKS.map(n => (
                  <Pressable
                    key={n}
                    onPress={() => setDays(n)}
                    style={[styles.daysSeg, n <= days && styles.daysSegFilled]}
                  />
                ))}
              </View>
              <View style={styles.daysScale}>
                <Text style={styles.daysScaleText}>1</Text>
                <Text style={styles.daysScaleText}>6</Text>
              </View>

              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>NIVEL DE EXPERIENCIA</Text>
              <View style={styles.optionList}>
                {EXPERIENCE_OPTIONS.map((opt, i) => (
                  <OptionRow
                    key={opt.value}
                    option={opt}
                    selected={experience === opt.value}
                    onPress={() => setExperience(opt.value)}
                    first={i === 0}
                  />
                ))}
              </View>

              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>¿DÓNDE ENTRENAS?</Text>
              <View style={styles.optionList}>
                {EQUIPMENT_OPTIONS.map((opt, i) => (
                  <OptionRow
                    key={opt.value}
                    option={opt}
                    selected={equipment === opt.value}
                    onPress={() => setEquipment(opt.value)}
                    first={i === 0}
                  />
                ))}
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.stepTitle}>Condiciones de salud</Text>
              <Text style={styles.stepSubtitle}>
                Tu plan excluirá alimentos contraindicados. Selecciona todo lo que aplique.
              </Text>
              <View style={styles.optionList}>
                {HEALTH_OPTIONS.map((opt, i) => (
                  <CheckRow
                    key={opt.value}
                    option={opt}
                    checked={health.includes(opt.value)}
                    onPress={() => toggleHealth(opt.value)}
                    first={i === 0}
                  />
                ))}
              </View>
              <View style={styles.warnBox}>
                <Icon name="warning" size={18} color={NV.ambar700} />
                <Text style={styles.warnText}>
                  Esta información no sustituye un diagnóstico. Si tomas medicación, consulta tu plan con tu médico
                  antes de empezar.
                </Text>
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footerNav}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={goBack}>
            <Text style={styles.backBtnText}>← Atrás</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed, submitting && styles.nextBtnDisabled]}
            onPress={goNext}
            disabled={submitting}>
            {submitting ? (
              <View style={styles.submitLoading}>
                <ActivityIndicator color={NV.papel} />
                <Text style={styles.nextBtnText}>Generando…</Text>
              </View>
            ) : (
              <Text style={styles.nextBtnText}>
                {isLastStep ? (isEdit ? 'Actualizar mi plan' : 'Generar mi plan') : 'Continuar →'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

function OptionRow({
  option,
  selected,
  onPress,
  first,
  tone,
  rightLabel,
}: {
  option: RichOption | ActivityOption;
  selected: boolean;
  onPress: () => void;
  first: boolean;
  tone?: Tone;
  rightLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.optionRow,
        !first && styles.optionRowDivider,
        selected && { backgroundColor: toneTint(tone), borderLeftWidth: 3, borderLeftColor: toneColor(tone) },
      ]}>
      <Icon name={option.icon} size={20} color={selected ? toneColor(tone) : NV.neutro500} />
      <View style={styles.optionInfo}>
        <Text style={[styles.optionTitle, selected && { color: toneColor700(tone) }]}>{option.label}</Text>
        <Text style={styles.optionDesc}>{option.description}</Text>
      </View>
      {rightLabel ? (
        <Text style={[styles.optionMult, selected && { color: toneColor700(tone), fontFamily: Font.bold }]}>
          {rightLabel}
        </Text>
      ) : null}
      {selected && <Icon name="checkmark-circle" size={18} color={toneColor(tone)} />}
    </Pressable>
  );
}

function CheckRow({
  option,
  checked,
  onPress,
  first,
}: {
  option: HealthOption;
  checked: boolean;
  onPress: () => void;
  first: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.optionRow, !first && styles.optionRowDivider, checked && styles.checkRowChecked]}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Icon name="check" size={13} color={NV.papel} />}
      </View>
      <Icon name={option.icon} size={16} color={checked ? NV.savia700 : NV.neutro500} />
      <Text style={[styles.checkLabel, checked && styles.checkLabelChecked]}>{option.label}</Text>
    </Pressable>
  );
}

function NumField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix: string;
}) {
  return (
    <View style={styles.numField}>
      <Text style={styles.fieldLabel}>
        {label}
        {hint ? <Text style={styles.fieldLabelHint}> {hint}</Text> : null}
      </Text>
      <View style={styles.numInputRow}>
        <TextInput
          style={styles.numInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={NV.textoTenue}
          keyboardType="numeric"
          inputMode="numeric"
          maxLength={6}
        />
        <Text style={styles.numSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NV.papel },
  flex: { flex: 1 },
  center: { flex: 1, backgroundColor: NV.papel, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },

  wizardHeader: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    borderBottomWidth: Border.structural,
    borderBottomColor: NV.tinta,
  },
  wizardHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wizardLogo: { width: 74, height: 74 / 4.641 },
  wizardStepLabel: { color: NV.textoSuave, fontFamily: Font.medium, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  progressTrack: {
    height: 8,
    backgroundColor: NV.hueso,
    borderWidth: Border.inner,
    borderColor: NV.tinta,
    borderRadius: Radius.none,
  },
  progressFill: { height: '100%', backgroundColor: NV.savia },

  content: { padding: Spacing.four, paddingBottom: Spacing.six },

  stepTitle: { color: NV.tinta, fontFamily: Font.serif, fontSize: 30, marginBottom: 6 },
  stepSubtitle: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 15, marginBottom: Spacing.four },

  fieldLabel: { color: NV.textoCuerpo, fontFamily: Font.bold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.two },
  fieldLabelHint: { color: NV.textoTenue, fontFamily: Font.regular, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  fieldLabelSpaced: { marginTop: Spacing.five },

  segmentRow: { flexDirection: 'row', borderWidth: Border.structural, borderColor: NV.tinta },
  segmentBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', backgroundColor: NV.papel },
  segmentBtnDivider: { borderLeftWidth: Border.structural, borderLeftColor: NV.tinta },
  segmentBtnSelected: { backgroundColor: NV.tinta },
  segmentText: { color: NV.tinta, fontFamily: Font.bold, fontSize: 15, fontWeight: '700' },
  segmentTextSelected: { color: NV.papel },
  hintText: { color: NV.textoTenue, fontFamily: Font.serif, fontSize: 13, marginTop: Spacing.two, marginBottom: Spacing.four },

  numField: { marginBottom: Spacing.three },
  numInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NV.papelAlt,
    borderWidth: Border.structural,
    borderColor: NV.tinta,
    paddingHorizontal: Spacing.three,
  },
  numInput: { flex: 1, color: NV.tinta, fontFamily: Font.regular, fontSize: 16, paddingVertical: 13, minWidth: 0 },
  numSuffix: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13 },

  optionList: { borderWidth: Border.structural, borderColor: NV.tinta, marginBottom: Spacing.four },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  optionRowDivider: { borderTopWidth: Border.inner, borderTopColor: NV.fileteSuave },
  optionInfo: { flex: 1, gap: 2 },
  optionTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 15, fontWeight: '700' },
  optionDesc: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12.5, lineHeight: 17 },
  optionMult: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, fontVariant: ['tabular-nums'] },

  gastoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NV.savia100,
    borderWidth: Border.inner,
    borderColor: NV.savia300,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  gastoText: { flex: 1, color: NV.textoCuerpo, fontFamily: Font.regular, fontSize: 13 },
  gastoValue: { color: NV.savia700, fontFamily: Font.bold, fontWeight: '800' },

  daysValue: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 15, marginBottom: Spacing.two },
  daysNum: { color: NV.tinta, fontFamily: Font.bold, fontSize: 26, fontWeight: '900' },
  daysBar: { flexDirection: 'row', gap: 4, height: 14 },
  daysSeg: { flex: 1, backgroundColor: NV.neutro300 },
  daysSegFilled: { backgroundColor: NV.savia },
  daysScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: Spacing.four },
  daysScaleText: { color: NV.textoTenue, fontFamily: Font.regular, fontSize: 12 },

  checkRowChecked: { backgroundColor: NV.savia100 },
  checkbox: { width: 22, height: 22, borderWidth: Border.structural, borderColor: NV.tinta, backgroundColor: NV.papelAlt, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: NV.savia, borderColor: NV.savia },
  checkLabel: { flex: 1, color: NV.tinta, fontFamily: Font.medium, fontSize: 14, fontWeight: '600' },
  checkLabelChecked: { color: NV.savia700, fontFamily: Font.bold, fontWeight: '700' },

  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    backgroundColor: NV.ambar100,
    borderWidth: Border.inner,
    borderColor: NV.ambar300,
    padding: Spacing.three,
  },
  warnText: { flex: 1, color: NV.textoCuerpo, fontFamily: Font.regular, fontSize: 13, lineHeight: 19 },

  error: { color: NV.arcilla700, fontFamily: Font.regular, fontSize: 13, textAlign: 'center', marginTop: Spacing.two },

  footerNav: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: NV.papel,
    borderTopWidth: Border.structural,
    borderTopColor: NV.tinta,
  },
  backBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: 15,
    borderWidth: Border.structural,
    borderColor: NV.tinta,
    backgroundColor: NV.papel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: NV.tinta, fontFamily: Font.bold, fontSize: 15, fontWeight: '700' },
  nextBtn: { flex: 1, backgroundColor: NV.savia, alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  nextBtnPressed: { backgroundColor: NV.savia700 },
  nextBtnDisabled: { opacity: 0.7 },
  submitLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nextBtnText: { color: NV.papel, fontFamily: Font.bold, fontSize: 15, fontWeight: '800' },
});
