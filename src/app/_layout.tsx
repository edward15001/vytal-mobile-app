import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Archivo_400Regular,
  Archivo_600SemiBold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import { Newsreader_300Light_Italic } from '@expo-google-fonts/newsreader';
import { useEffect, useState } from 'react';

import { isLoggedIn, onAuthChange } from '@/lib/auth';
import SplashScreenView from '@/app/splash';
import { NV } from '@/constants/nutrovia';

SplashScreen.preventAutoHideAsync();

/**
 * Vytal tiene un solo tema: papel cálido. Se fija el tema de navegación a
 * mano en lugar de seguir al sistema, para que el fondo entre pantallas no
 * parpadee en negro cuando el dispositivo está en modo oscuro.
 */
const VytalNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: NV.papel,
    card: NV.papelAlt,
    text: NV.texto,
    border: NV.tinta,
    primary: NV.savia,
  },
};

export default function RootLayout() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_800ExtraBold,
    Newsreader_300Light_Italic,
    TahoeDisplay: require('@/assets/fonts/tahoe-display.ttf'),
  });

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const ok = await isLoggedIn();
      if (mounted) setLoggedIn(ok);
    };

    // Estado inicial + re-comprobación cuando cambia la sesión
    // (login, registro o logout) para que los guards se actualicen.
    check().finally(() => SplashScreen.hideAsync());
    const unsubscribe = onAuthChange(check);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (loggedIn === null || !fontsLoaded) return <SplashScreenView />;

  return (
    <ThemeProvider value={VytalNavTheme}>
      <StatusBar style="dark" backgroundColor={NV.papel} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: NV.papel } }}>
        <Stack.Protected guard={loggedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="questionnaire" />
        </Stack.Protected>
        <Stack.Protected guard={!loggedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
