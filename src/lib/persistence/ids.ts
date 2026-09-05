/** Time-sortable identifiers (ULID-like): 10 chars of time + 16 chars of randomness, Crockford base32. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(time: number, length: number): string {
  let out = '';
  for (let i = length - 1; i >= 0; i--) {
    out = ALPHABET[time % 32] + out;
    time = Math.floor(time / 32);
  }
  return out;
}

function randomChars(length: number): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

let lastTime = 0;
let counter = 0;

export function newId(prefix = ''): string {
  const now = Date.now();
  if (now === lastTime) counter++;
  else {
    lastTime = now;
    counter = 0;
  }
  const id = encodeTime(now, 10) + randomChars(13) + encodeTime(counter, 3);
  return prefix ? `${prefix}.${id}` : id;
}
