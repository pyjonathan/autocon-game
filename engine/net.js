// Small, pure networking helpers shared by the evaluator and the content validator.

const MAC_RE = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i;

export function isValidMac(value) {
  return typeof value === 'string' && MAC_RE.test(value);
}

export function normalizeMac(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/** Multicast (and therefore broadcast) frames have the low bit of the first octet set. */
export function isGroupMac(value) {
  if (!isValidMac(value)) return false;
  return (parseInt(value.slice(0, 2), 16) & 1) === 1;
}

/** Parses dotted-quad IPv4 into an unsigned 32-bit integer, or null if invalid. */
export function parseIpv4(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n >>> 0;
}

export function isValidIpv4(value) {
  return parseIpv4(value) !== null;
}

function mask(length) {
  return length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
}

/** True when the address lies inside prefix/length. Returns false on invalid input. */
export function prefixContains(prefix, length, address) {
  const p = parseIpv4(prefix);
  const a = parseIpv4(address);
  if (p === null || a === null || !Number.isInteger(length) || length < 0 || length > 32) return false;
  const m = mask(length);
  return ((p & m) >>> 0) === ((a & m) >>> 0);
}

/** True when two prefixes share any address (one contains the other's network). */
export function prefixesOverlap(prefixA, lengthA, prefixB, lengthB) {
  const a = parseIpv4(prefixA);
  const b = parseIpv4(prefixB);
  if (a === null || b === null) return false;
  const shorter = Math.min(lengthA, lengthB);
  const m = mask(shorter);
  return ((a & m) >>> 0) === ((b & m) >>> 0);
}
