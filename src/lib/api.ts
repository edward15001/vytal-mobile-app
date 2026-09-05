import { API_URL } from './config';
import { getToken } from './token';

/**
 * Cliente HTTP de la API de Vytal.
 * Añade el header Authorization con el JWT cuando hay token.
 */
const API_TIMEOUT_MS = 15000;

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: any } = {}
): Promise<T> {
  const token = await getToken();
  const controller = new AbortController();
  const requestUrl = `${API_URL}${path}`;
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`La conexión está tardando demasiado (${path}). Comprueba tu internet e inténtalo de nuevo.`);
    }
    throw new Error(`No se pudo conectar con Vytal (${path}). Comprueba tu conexión e inténtalo de nuevo.`);
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      data?.error ||
      (data?.errors ? data.errors.map((e: any) => e.msg).join(' · ') : 'Error de conexión');
    const err: any = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}
