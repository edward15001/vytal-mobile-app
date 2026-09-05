/**
 * Colores de la app.
 *
 * Vytal tiene un solo tema: papel cálido con tinta casi negra. No hay modo
 * oscuro — la identidad no lo contempla. Los dos objetos `light` y `dark` se
 * mantienen con los MISMOS valores para no tocar `useTheme()` ni ninguna de
 * las llamadas que ya existen: si el sistema del usuario está en oscuro, la
 * app se ve igual.
 *
 * Los tokens completos (rampas 100–900, roles por dominio, geometría,
 * tipografía) están en `@/constants/nutrovia`. Este archivo solo mapea los
 * cinco nombres que ya consumía la app.
 */

import { Platform } from 'react-native';

import { Font, NV } from '@/constants/nutrovia';

const nutrovia = {
  text: NV.texto,
  background: NV.papel,
  backgroundElement: NV.papelAlt,
  backgroundSelected: NV.hueso,
  textSecondary: NV.textoSuave,
} as const;

export const Colors = {
  light: nutrovia,
  dark: nutrovia,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: Font.regular,
    serif: Font.serif,
    rounded: Font.regular,
    mono: 'ui-monospace',
  },
  default: {
    sans: Font.regular,
    serif: Font.serif,
    rounded: Font.regular,
    mono: 'monospace',
  },
  web: {
    sans: Font.regular,
    serif: Font.serif,
    rounded: Font.regular,
    mono: 'ui-monospace, Menlo, monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
