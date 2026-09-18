// src/utils/totp.ts
/**
 * TOTP enrolment helpers (RFC 6238 / RFC 4648).
 *
 * Verification lives in `auth.service.ts`; this module covers the *other*
 * half — handing an authenticator app something it can actually scan.
 *
 * The split in encodings is the whole reason this file exists. We store the
 * shared secret as hex, because that is what `verifyTotp` reads back with
 * `Buffer.from(secret, "hex")`. Authenticator apps, however, only accept the
 * secret base32-encoded inside an `otpauth://` URI — so the two encodings
 * are not interchangeable, and handing a client the raw hex secret produces
 * a QR code that scans fine and then generates codes that never match.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * RFC 4648 base32, without `=` padding.
 *
 * Padding is legal in the spec but not in practice here: several
 * authenticator apps (Google Authenticator among them) reject a `secret`
 * parameter containing `=`, so the unpadded form is the interoperable one.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    // Emit every complete 5-bit group. `bits` never exceeds 12 here, so
    // `value` stays well inside the 32-bit range the shifts assume.
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  // Left-align whatever is left over into a final group.
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Builds the `otpauth://totp/...` URI an authenticator app enrols from.
 *
 * `algorithm`, `digits`, and `period` are sent explicitly even though they
 * match the spec defaults. Not every app defaults the same way, and a
 * mismatch is invisible at enrolment: the QR scans, the account appears, and
 * only the first code the user types is wrong — which reads as "my
 * authenticator is broken", not "the server sent the wrong period".
 *
 * @param secretHex the stored secret, hex-encoded (as `generateMfaSecret`
 *                  produces it). Converted to base32 here.
 */
export function buildOtpauthUrl(input: {
  secretHex: string;
  /** Shown under the issuer in the app — the user's email. */
  accountName: string;
  /** Shown as the account's provider. Keep stable: changing it orphans entries. */
  issuer: string;
  digits?: number;
  periodSeconds?: number;
}): string {
  const { secretHex, accountName, issuer, digits = 6, periodSeconds = 30 } = input;

  const secret = base32Encode(Buffer.from(secretHex, "hex"));

  // `issuer:account` is the conventional label. Both halves are encoded
  // because an organisation name may contain a space or an ampersand, and an
  // unencoded one truncates the label at the query string.
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;

  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(digits),
    period: String(periodSeconds),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}
