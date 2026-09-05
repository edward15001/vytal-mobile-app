import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Border, Font, NV, Radius } from '@/constants/nutrovia';

/** Splash de bienvenida con animación del logo mientras se comprueba la sesión. */
export default function SplashScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.duration(700).delay(100)} style={styles.logoBadge}>
          <Icon name="nutrition" size={46} color={NV.papel} />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(700).delay(350)}>
          <Text style={styles.logo}>
            VYTAL<Text style={styles.logoDot}>.</Text>
          </Text>
        </Animated.View>

        <Animated.Text entering={FadeInDown.duration(700).delay(600)} style={styles.tagline}>
          Tu nutrición y entrenamiento personalizado
        </Animated.Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NV.papel },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  // Cuadrado, sin sombra ni halo: el símbolo en papel sobre savia.
  logoBadge: {
    width: 92,
    height: 92,
    borderRadius: Radius.none,
    backgroundColor: NV.savia,
    borderWidth: Border.structural,
    borderColor: NV.tinta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sin fontWeight: Tahoe Display es un solo peso — combinarlo con fontWeight
  // hace que Android descarte el tipo personalizado y use uno del sistema.
  logo: {
    color: NV.tinta,
    fontFamily: Font.brand,
    fontSize: 34,
    letterSpacing: 6,
  },
  logoDot: {
    color: NV.savia,
  },
  tagline: {
    color: NV.textoSuave,
    fontFamily: Font.regular,
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
