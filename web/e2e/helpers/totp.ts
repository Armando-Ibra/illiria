import { createHmac } from "node:crypto"

/** RFC 4648 base32 (the authenticator key format), padding and spaces ignored. */
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const clean = input.toUpperCase().replace(/[\s=]/g, "")
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const index = alphabet.indexOf(char)
    if (index < 0) throw new Error(`Invalid base32 character "${char}"`)
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/**
 * RFC 6238 TOTP as authenticator apps compute it: HMAC-SHA1, 6 digits, 30-second steps.
 * `stepOffset` picks a neighbouring time step (the API accepts a small window around "now").
 */
export function totp(sharedKey: string, { stepOffset = 0, now = Date.now() }: { stepOffset?: number; now?: number } = {}): string {
  const counter = Math.floor(now / 1000 / 30) + stepOffset
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac("sha1", base32Decode(sharedKey)).update(message).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return binary.toString().padStart(6, "0")
}
