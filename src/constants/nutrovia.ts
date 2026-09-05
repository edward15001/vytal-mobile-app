/**
 * Vytal — identidad visual v1.0
 *
 * Fuente única de verdad del color, la geometría y la tipografía de la app.
 * Los mismos valores que usa la web (public/css/styles.css, sección 19) y que
 * fija la guía de identidad.
 *
 * Reglas del sistema:
 *  · Dos suelos y nada más: papel por defecto, tinta en escenas sobre foto.
 *  · El color clasifica, no decora. Un rol por dominio.
 *  · Esquinas rectas en todo. Sin sombras ni degradados de marca.
 *  · La estructura la dibujan filetes de 2px en tinta.
 */

export const NV = {
  // ── Superficies ──────────────────────────────────────────
  papel: '#F2EFE8',      // fondo por defecto
  papelAlt: '#F7F5F0',   // superficie elevada (tarjetas)
  hueso: '#E8E4DA',      // superficie neutra (cabeceras, filas alternas)
  tinta: '#1B1A17',      // texto y filetes

  // ── Texto ────────────────────────────────────────────────
  texto: '#1B1A17',
  textoCuerpo: '#3E3A34',
  textoSuave: '#6B665C',
  textoTenue: '#8A857A',

  // ── Rol · Savia — nutrición, acción, logro ───────────────
  savia100: '#EAF1EC',
  savia300: '#B9CFC0',
  savia: '#3A6B4F',
  savia700: '#27503A',
  savia900: '#16301F',

  // ── Rol · Malva — descanso, sueño, suplementación ────────
  malva100: '#F0EDF7',
  malva300: '#C6BEDD',
  malva: '#5A5183',
  malva700: '#433C64',
  malva900: '#28233C',

  // ── Rol · Arcilla — entrenamiento, esfuerzo, error ───────
  arcilla100: '#F7EAE6',
  arcilla300: '#E4BCB0',
  arcilla: '#A8523F',
  arcilla700: '#813A2B',
  arcilla900: '#4E231A',

  // ── Rol · Ámbar — aviso, límite, pendiente ───────────────
  ambar100: '#FBF2E2',
  ambar300: '#EBD3A6',
  ambar: '#C98B3C',
  ambar700: '#96631F',
  ambar900: '#5B3D12',

  // ── Neutros ──────────────────────────────────────────────
  neutro100: '#F7F5F0',
  neutro300: '#DCD7CB',
  neutro500: '#A79F91',
  neutro700: '#6B665C',
  neutro900: '#332F29',

  // ── Filetes ──────────────────────────────────────────────
  filete: '#1B1A17',       // 2px, estructural
  fileteSuave: '#DCD7CB',  // 1px, interno

  // ── Capas ────────────────────────────────────────────────
  veloTinta: 'rgba(27,26,23,0.72)',  // fondo de modal
} as const;

/** Geometría: esquinas rectas, sin excepción. */
export const Radius = {
  none: 0,
  /** Única curva del sistema: elementos que giran o son físicamente redondos
   *  (el disparador de la cámara, un indicador de carga). */
  round: 999,
} as const;

/** Grosor de filete. El de 2px es el que organiza; el de 1px separa dentro. */
export const Border = {
  structural: 2,
  inner: 1,
} as const;

/**
 * Tipografía.
 *
 * Requiere que las familias estén cargadas con `expo-font` en
 * `src/app/_layout.tsx` (ver CLAUDE_CODE.md, paso 4). Hasta que se carguen,
 * `Archivo`/`Newsreader` caen a la del sistema sin romper nada.
 *
 *  · Archivo     → toda la interfaz. 400 / 600 / 800.
 *  · Newsreader  → solo titulares de marca y citas, Light 300 en itálica,
 *                  nunca por debajo de 22px ni en interfaz funcional.
 *  · Tahoe Display → solo el logotipo ("VYTAL").
 */
export const Font = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_600SemiBold',
  bold: 'Archivo_800ExtraBold',
  serif: 'Newsreader_300Light_Italic',
  brand: 'TahoeDisplay',
} as const;

/**
 * Roles por dominio. Lo que decide el color de una pantalla es de qué habla,
 * no cómo queda.
 */
export const Domain = {
  nutricion: { base: NV.savia, tint: NV.savia100, deep: NV.savia700 },
  entrenamiento: { base: NV.arcilla, tint: NV.arcilla100, deep: NV.arcilla700 },
  descanso: { base: NV.malva, tint: NV.malva100, deep: NV.malva700 },
  aviso: { base: NV.ambar, tint: NV.ambar100, deep: NV.ambar700 },
} as const;
