import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlan, isPro, NutritionPlan, Supplement } from '@/lib/plan';
import { Border, Font, NV, Radius } from '@/constants/nutrovia';
import { Spacing } from '@/constants/theme';
import { Icon, IconName } from '@/components/icon';

// Icono por tipo de suplemento, a partir del nombre (heurística simple).
function iconFor(nombre: string): IconName {
  const n = nombre.toLowerCase();
  if (n.includes('vitamina d') || n.includes('sol')) return 'sunny';
  if (n.includes('creatina')) return 'flash';
  if (n.includes('proteína') || n.includes('proteina')) return 'flask';
  return 'medkit';
}

// El plan no trae prioridad ni momento de toma como campos propios, pero
// motivo/dosis ya los describen en texto libre: se derivan de ahí en vez de
// mostrar valores fijos sin relación con el suplemento real.
function priorityFor(s: Supplement): string {
  const text = `${s.motivo} ${s.dosis}`.toLowerCase();
  if (/\bsolo si\b|opcional|no es necesari|no imprescindible/.test(text)) return 'Opcional';
  return 'Prioridad alta';
}

function momentFor(s: Supplement): string {
  const text = `${s.dosis} ${s.motivo}`.toLowerCase();
  if (/post.?entreno|despu[eé]s (del|de) entren|tras entrenar/.test(text)) return 'Post-entreno';
  if (/con (la |las )?comida|con las comidas|en el desayuno|en la comida|en la cena/.test(text)) return 'Con comida';
  if (/por la mañana|en ayunas|al despertar/.test(text)) return 'Por la mañana';
  if (/antes de dormir|por la noche/.test(text)) return 'Antes de dormir';
  return 'Indiferente';
}

export default function SupplementsScreen() {
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setPlan(await getPlan());
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
        <ActivityIndicator size="large" color={NV.malva} />
      </SafeAreaView>
    );
  }

  const supps = plan?.supplements || [];
  const pro = isPro(plan);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.section, styles.header]}>
          <Text style={styles.headerLabel}>Tu plan justifica {supps.length}</Text>
          <Text style={styles.headerTitle}>Solo lo que tus números piden</Text>
        </View>

        {!pro ? (
          <View style={[styles.section, styles.lockSection]}>
            <Icon name="lock-closed" size={26} color={NV.malva} />
            <Text style={styles.lockTitle}>Suplementación solo en Pro</Text>
            <Text style={styles.lockText}>
              Descubre qué suplementos encajan con tu plan actualizando a Pro.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.lockBtn, pressed && styles.lockBtnPressed]}
              onPress={() => router.push('/subscription')}>
              <Text style={styles.lockBtnText}>Subir a Pro →</Text>
            </Pressable>
          </View>
        ) : supps.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay suplementos en tu plan.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {supps.map((s, i) => (
              <View key={i}>
                {i > 0 && <View style={styles.itemSeparator} />}
                <View style={styles.item}>
                  <View style={styles.itemLabelRow}>
                    <Icon name={iconFor(s.nombre)} size={18} color={NV.malva} />
                    <Text style={styles.itemPriority}>{priorityFor(s)}</Text>
                  </View>
                  <Text style={styles.itemName}>{s.nombre}</Text>
                  <Text style={styles.itemMotivo}>{s.motivo}</Text>

                  <View style={styles.itemStatsRow}>
                    <View style={styles.itemStat}>
                      <Text style={styles.itemStatLabel}>Dosis</Text>
                      <Text style={styles.itemStatValue}>{s.dosis}</Text>
                    </View>
                    <View style={[styles.itemStat, styles.itemStatEnd]}>
                      <Text style={styles.itemStatLabel}>Momento</Text>
                      <Text style={styles.itemStatValue}>{momentFor(s)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {supps.length > 0 && pro && (
          <View style={[styles.section, styles.disclaimer]}>
            <Icon name="warning" size={18} color={NV.ambar700} />
            <Text style={styles.disclaimerText}>
              No sustituye el consejo de un médico. Si tomas medicación, consúltalo antes de empezar.
            </Text>
          </View>
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

  // Todas las secciones son de ancho completo: sin cajas, solo un filete
  // horizontal de 2px en tinta que cierra cada una por abajo.
  section: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: Border.structural,
    borderBottomColor: NV.tinta,
  },

  header: { backgroundColor: NV.malva100, paddingTop: Spacing.four, gap: 4 },
  headerLabel: { color: NV.malva700, fontFamily: Font.medium, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { color: NV.tinta, fontFamily: Font.serif, fontSize: 24 },

  list: { borderBottomWidth: Border.structural, borderBottomColor: NV.tinta },
  item: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.five, gap: Spacing.two },
  itemSeparator: { height: Border.structural, backgroundColor: NV.fileteSuave, marginHorizontal: Spacing.four },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  itemPriority: { color: NV.malva700, fontFamily: Font.medium, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  // Todo el bloque de texto se indenta para alinear con el texto de
  // PRIORIDAD, no con el icono de arriba.
  itemName: { color: NV.tinta, fontFamily: Font.bold, fontSize: 20, fontWeight: '800', marginLeft: 22 },
  itemMotivo: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, lineHeight: 19, marginLeft: 22 },
  itemStatsRow: { flexDirection: 'row', marginTop: Spacing.two, marginLeft: 22 },
  itemStat: { flex: 1 },
  itemStatEnd: { alignItems: 'flex-end' },
  itemStatLabel: { color: NV.textoSuave, fontFamily: Font.medium, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemStatValue: { color: NV.tinta, fontFamily: Font.bold, fontSize: 15, fontWeight: '800', marginTop: 2 },

  disclaimer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: NV.ambar100 },
  disclaimerText: { flex: 1, color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, lineHeight: 19 },

  empty: { padding: Spacing.four, alignItems: 'center' },
  emptyText: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 14 },
  lockSection: { backgroundColor: NV.malva100, alignItems: 'center', gap: Spacing.two },
  lockTitle: { color: NV.tinta, fontFamily: Font.bold, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  lockText: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  lockBtn: { backgroundColor: NV.savia, borderRadius: Radius.none, paddingHorizontal: Spacing.four, paddingVertical: 12, marginTop: Spacing.two },
  lockBtnPressed: { backgroundColor: NV.savia700 },
  lockBtnText: { color: NV.papel, fontFamily: Font.bold, fontSize: 14, fontWeight: '800' },
});
