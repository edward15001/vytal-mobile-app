import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Border, Font, NV, Radius } from '@/constants/nutrovia';

interface Props {
  onActivated: () => void;
  onError: (message: string) => void;
  onClose: () => void;
}

/**
 * Fallback web: Stripe PaymentSheet es un módulo nativo, no está disponible
 * en el navegador. Aquí redirigimos al flujo web de Vytal.
 */
export default function ProPaymentWeb({ onClose }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        El pago con tarjeta está disponible en la app móvil o en la versión web.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={() => {
          WebBrowser.openBrowserAsync('https://nutrovia.vercel.app');
          onClose();
        }}>
        <Text style={styles.btnText}>Abrir la web de Vytal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three, paddingVertical: Spacing.two },
  text: {
    color: NV.textoSuave,
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: NV.savia,
    borderRadius: Radius.none,
    borderWidth: Border.structural,
    borderColor: NV.savia,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPressed: { backgroundColor: NV.savia700, borderColor: NV.savia700 },
  btnText: { color: NV.papel, fontFamily: Font.bold, fontSize: 14, fontWeight: '800' },
});
