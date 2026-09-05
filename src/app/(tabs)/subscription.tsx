import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { getUser, logout } from '@/lib/auth';
import { Spacing } from '@/constants/theme';
import { Border, Font, NV, Radius } from '@/constants/nutrovia';
import ProPayment from '@/components/pro-payment';
import { Icon, IconName } from '@/components/icon';

// Interruptor cuadrado, a juego con la identidad (nada de píldoras redondas).
function SquareToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[toggleStyles.track, { backgroundColor: value ? NV.savia : NV.neutro300, justifyContent: value ? 'flex-end' : 'flex-start' }]}>
      <View style={toggleStyles.thumb} />
    </Pressable>
  );
}

const toggleStyles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: Radius.none,
    borderWidth: Border.structural,
    borderColor: NV.tinta,
    padding: 2,
    flexDirection: 'row',
  },
  thumb: { width: 18, height: 18, borderRadius: Radius.none, backgroundColor: NV.papel },
});

interface SubscriptionStatus {
  status: string;
  next_billing_date?: string;
}

interface Payment {
  amount_eur: string;
  status: string;
  paid_at?: string;
  stripe_invoice_id?: string;
}

const ACTIVE_STATUSES = ['active', 'trial', 'past_due'];

const PAYMENT_LABELS: Record<string, string> = {
  paid: 'Pagado',
  failed: 'Fallido',
  pending: 'Pendiente',
  refunded: 'Reembolsado',
};

function fmt(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function SubscriptionScreen() {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [payError, setPayError] = useState('');
  const [showInvoices, setShowInvoices] = useState(false);
  // Sin ajuste real de notificaciones todavía: preferencia solo local.
  const [reminders, setReminders] = useState(true);

  const load = useCallback(async () => {
    try {
      const [user, s, p] = await Promise.all([
        getUser(),
        api<SubscriptionStatus>('/api/subscription/status'),
        api<{ payments: Payment[] }>('/api/subscription/history'),
      ]);
      setUserName(user?.name || '');
      setUserEmail(user?.email || '');
      setSub(s);
      setPayments(p.payments || []);
    } catch {
      // sin sesión o error
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleLogout() {
    await logout();
    // No navegar manualmente: el Stack.Protected de _layout.tsx muestra la
    // pantalla login automáticamente cuando loggedIn pasa a false.
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={NV.ambar} />
      </SafeAreaView>
    );
  }

  const pro = ACTIVE_STATUSES.includes(sub?.status || 'none');

  const rows: { icon: IconName; label: string; onPress?: () => void; right?: React.ReactNode }[] = [
    { icon: 'clipboard', label: 'Actualizar mis valores', onPress: () => router.push('/questionnaire?edit=1') },
    { icon: 'trending-up', label: 'Mi progreso' },
  ];
  if (payments.length > 0) {
    rows.push({ icon: 'receipt', label: 'Facturas', onPress: () => setShowInvoices(v => !v) });
  }
  rows.push({
    icon: 'notifications',
    label: 'Recordatorios',
    right: <SquareToggle value={reminders} onChange={setReminders} />,
  });
  rows.push({ icon: 'log-out', label: 'Cerrar sesión', onPress: handleLogout });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Cabecera de cuenta */}
        <View style={[styles.section, styles.header]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(userName) || '·'}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{userName || 'Tu cuenta'}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>
        </View>

        {/* Plan actual */}
        <View style={[styles.section, styles.planSection]}>
          <View style={styles.planHeadRow}>
            <Text style={styles.planLabel}>Plan actual</Text>
            {pro && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Activo</Text>
              </View>
            )}
          </View>
          <Text style={styles.planName}>{pro ? 'Pro' : 'Free'}</Text>
          <Text style={styles.planPrice}>{pro ? '14 € / mes · sin permanencia' : '0 € / siempre'}</Text>

          {pro && sub?.next_billing_date ? (
            <>
              <View style={styles.planDivider} />
              <View style={styles.planRow}>
                <Text style={styles.planRowLabel}>Próximo cobro</Text>
                <Text style={styles.planRowValue}>{fmt(sub.next_billing_date)}</Text>
              </View>
            </>
          ) : !pro ? (
            <Pressable
              style={({ pressed }) => [styles.upgradeBtn, pressed && styles.upgradeBtnPressed]}
              onPress={() => { setPayError(''); setShowPayment(true); }}>
              <Text style={styles.upgradeBtnText}>Actualizar a Pro · 14 €/mes</Text>
            </Pressable>
          ) : null}
        </View>

        {showPayment && (
          <View style={styles.section}>
            <ProPayment
              onActivated={() => { setShowPayment(false); setPayError(''); load(); }}
              onError={setPayError}
              onClose={() => setShowPayment(false)}
            />
            {payError ? <Text style={styles.payError}>{payError}</Text> : null}
          </View>
        )}

        {/* Acciones de cuenta */}
        <View style={styles.rowList}>
          {rows.map((r, i) => {
            const content = (
              <>
                <Icon name={r.icon} size={19} color={NV.ambar700} />
                <Text style={styles.rowLabel}>{r.label}</Text>
                {r.right}
                {r.onPress && !r.right && <Icon name="chevron-forward" size={16} color={NV.textoSuave} />}
              </>
            );
            return r.onPress ? (
              <Pressable
                key={r.label}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.pressed]}
                onPress={r.onPress}>
                {content}
              </Pressable>
            ) : (
              <View key={r.label} style={[styles.row, i > 0 && styles.rowDivider]}>
                {content}
              </View>
            );
          })}
        </View>

        {/* Historial de facturas */}
        {showInvoices && payments.length > 0 && (
          <View style={styles.invoiceList}>
            {payments.map((p, i) => (
              <View key={i} style={[styles.invoiceRow, i > 0 && styles.rowDivider]}>
                <Text style={styles.invoiceAmount}>{p.amount_eur} €</Text>
                <Text style={styles.invoiceDate}>{p.paid_at ? fmt(p.paid_at) : '—'}</Text>
                <Text style={styles.invoiceStatus}>{PAYMENT_LABELS[p.status] || p.status}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Cancelar plan */}
        {pro && (
          <View style={[styles.section, styles.cancelSection]}>
            <View style={styles.cancelBox}>
              <Text style={styles.cancelBoxText}>Cancelar plan</Text>
            </View>
            <Text style={styles.cancelHint}>
              Mantienes el acceso hasta el {sub?.next_billing_date ? fmt(sub.next_billing_date) : 'final del periodo'}.
              Después pasas a Free y conservas tu historial.
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
  pressed: { opacity: 0.85 },

  // Todas las secciones son de ancho completo: sin cajas, solo un filete
  // horizontal de 2px en tinta que cierra cada una por abajo.
  section: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: Border.structural,
    borderBottomColor: NV.tinta,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.four },
  avatar: { width: 44, height: 44, borderRadius: Radius.none, backgroundColor: NV.tinta, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: NV.papel, fontFamily: Font.bold, fontSize: 15, fontWeight: '800' },
  userName: { color: NV.tinta, fontFamily: Font.bold, fontSize: 17, fontWeight: '800' },
  userEmail: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, marginTop: 1 },

  planSection: { backgroundColor: NV.ambar100 },
  planHeadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  planLabel: { color: NV.ambar700, fontFamily: Font.medium, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  activeBadge: { backgroundColor: NV.savia, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  activeBadgeText: { color: NV.papel, fontFamily: Font.bold, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  planName: { color: NV.tinta, fontFamily: Font.bold, fontSize: 30, fontWeight: '900', marginTop: 4 },
  planPrice: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 14, marginTop: 2 },
  planDivider: { height: Border.structural, backgroundColor: NV.tinta, marginVertical: Spacing.three },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planRowLabel: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13 },
  planRowValue: { color: NV.tinta, fontFamily: Font.bold, fontSize: 14, fontWeight: '800' },
  upgradeBtn: { backgroundColor: NV.savia, borderRadius: Radius.none, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.three },
  upgradeBtnPressed: { backgroundColor: NV.savia700 },
  upgradeBtnText: { color: NV.papel, fontFamily: Font.bold, fontSize: 15, fontWeight: '800' },
  payError: { color: NV.arcilla700, fontFamily: Font.regular, fontSize: 13, marginTop: Spacing.two, textAlign: 'center' },

  rowList: { borderBottomWidth: Border.structural, borderBottomColor: NV.tinta },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  rowDivider: { borderTopWidth: Border.inner, borderTopColor: NV.fileteSuave },
  rowLabel: { flex: 1, color: NV.tinta, fontFamily: Font.medium, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 13, fontVariant: ['tabular-nums'] },

  invoiceList: { borderBottomWidth: Border.structural, borderBottomColor: NV.tinta },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  invoiceAmount: { color: NV.tinta, fontFamily: Font.bold, fontSize: 14, fontWeight: '700', flex: 1, fontVariant: ['tabular-nums'] },
  invoiceDate: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12 },
  invoiceStatus: { color: NV.tinta, fontFamily: Font.medium, fontSize: 12, fontWeight: '600', marginLeft: Spacing.two },

  cancelSection: { gap: Spacing.two },
  cancelBox: { borderWidth: Border.structural, borderColor: NV.ambar700, borderRadius: Radius.none, paddingVertical: 13, alignItems: 'center' },
  cancelBoxText: { color: NV.ambar700, fontFamily: Font.bold, fontSize: 14, fontWeight: '800' },
  cancelHint: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 12, lineHeight: 18 },
});
