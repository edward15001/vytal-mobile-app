/**
 * Configuración de Vytal Mobile
 *
 * API_URL: backend Express desplegado en Vercel.
 * - Usa siempre el dominio propio de producción.
 * - Pendiente de migrar a getvytal.es cuando el backend se despliegue ahí;
 *   de momento sigue en el dominio nutrovia.es original.
 */
// Usamos www.nutrovia.es: el dominio desnudo (sin www) responde con un
// redirect 308 a www que React Native en iOS no sigue bien (se queda
// colgado hasta el timeout). www responde 200 directamente.
export const API_URL = 'https://www.nutrovia.es';
