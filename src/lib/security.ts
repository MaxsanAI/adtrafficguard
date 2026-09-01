const encoder = new TextEncoder();
const SESSION_COOKIE = 'atg_session';

export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();

export async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function token() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function passwordHash(password: string, salt = token()) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 310_000, hash: 'SHA-256' }, key, 256);
  return `${salt}:${btoa(String.fromCharCode(...new Uint8Array(bits)))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = (await passwordHash(password, salt)).split(':')[1];
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export function cookie(name: string, value: string, maxAge?: number) {
  const secure = import.meta.env.PROD ? ' Secure;' : '';
  const lifetime = maxAge === undefined ? '' : ` Max-Age=${maxAge};`;
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax;${secure}${lifetime}`;
}

export const sessionCookie = (value: string, maxAge?: number) => cookie(SESSION_COOKIE, value, maxAge);
export const clearCookie = (name: string) => cookie(name, '', 0);

function keyMaterial(encodedKey: string) {
  const raw = Uint8Array.from(atob(encodedKey), (character) => character.charCodeAt(0));
  if (raw.byteLength !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  return raw;
}

export async function encrypt(plaintext: string, encodedKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', keyMaterial(encodedKey), 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(ciphertext)))}`;
}

export async function decrypt(value: string, encodedKey: string) {
  const [encodedIv, encodedCiphertext] = value.split('.');
  if (!encodedIv || !encodedCiphertext) throw new Error('Malformed encrypted value.');
  const key = await crypto.subtle.importKey('raw', keyMaterial(encodedKey), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Uint8Array.from(atob(encodedIv), (character) => character.charCodeAt(0)) }, key, Uint8Array.from(atob(encodedCiphertext), (character) => character.charCodeAt(0)));
  return new TextDecoder().decode(plaintext);
}
