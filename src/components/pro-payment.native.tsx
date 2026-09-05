import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { Font, NV } from '@/constants/nutrovia';

interface Props {
  onActivated: () => void;
  onError: (message: string) => void;
  onClose: () => void;
}

/**
 * Flujo de activación de Pro con Stripe PaymentSheet (cobro inmediato, sin trial).
 * 1. POST /api/subscription/intent → crea la suscripción y devuelve el
 *    client_secret del PaymentIntent de la primera factura (14 €) + subscription_id.
 * 2. PaymentSheet confirma ese PaymentIntent (cobra la tarjeta, con su 3DS).
 * 3. POST /api/subscription/start con subscription_id → Pro queda activo.
 */
export default function ProPayment({ onActivated, onError, onClose }: Props) {
  const [clientSecret, setClientSecret] = useState('');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{
          client_secret: string | null;
          publishable_key: string;
          subscription_id: string;
          already_active?: boolean;
        }>('/api/subscription/intent', { method: 'POST' });
        if (!data.publishable_key || !data.subscription_id) {
          throw new Error('Respuesta de pago inválida');
        }
        setSubscriptionId(data.subscription_id);
        setPublishableKey(data.publishable_key);

        // Reintento tras un pago ya cobrado: activar directamente.
        if (data.already_active && !data.client_secret) {
          await api('/api/subscription/start', {
            method: 'POST',
            body: { subscription_id: data.subscription_id },
          });
          onActivated();
          return;
        }
        if (!data.client_secret) {
          throw new Error('Respuesta de pago inválida');
        }
        setClientSecret(data.client_secret);
        setReady(true);
      } catch (err: any) {
        onError(err.message || 'No se pudo preparar el pago');
        onClose();
      }
    })();
  }, [onClose, onError, onActivated]);

  if (!ready) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={NV.savia} />
        <Text style={styles.loadingText}>Preparando pago seguro…</Text>
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={publishableKey}>
      <PaymentSheetLauncher
        clientSecret={clientSecret}
        subscriptionId={subscriptionId}
        onActivated={onActivated}
        onError={onError}
        onClose={onClose}
      />
    </StripeProvider>
  );
}

function PaymentSheetLauncher({
  clientSecret,
  subscriptionId,
  onActivated,
  onError,
  onClose,
}: Props & { clientSecret: string; subscriptionId: string }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const launched = useRef(false);

  useEffect(() => {
    if (launched.current) return;
    launched.current = true;

    (async () => {
      try {
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Vytal',
          style: 'alwaysLight',
        });
        if (initError) {
          onError(initError.message || 'No se pudo iniciar el pago');
          onClose();
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === 'Canceled') {
            onClose();
            return;
          }
          onError(
            presentError.localizedMessage ||
              presentError.message ||
              'No se pudo completar el pago'
          );
          onClose();
          return;
        }

        // Éxito: el PaymentIntent de la primera factura ya se cobró. Finaliza.
        await api('/api/subscription/start', {
          method: 'POST',
          body: { subscription_id: subscriptionId },
        });
        onActivated();
      } catch (err: any) {
        onError(err.message || 'Error al activar Pro');
        onClose();
      }
    })();
  }, [clientSecret, subscriptionId, onActivated, onClose, onError]);

  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color={NV.savia} />
      <Text style={styles.loadingText}>Activando Pro…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  loadingText: { color: NV.textoSuave, fontFamily: Font.regular, fontSize: 14 },
});