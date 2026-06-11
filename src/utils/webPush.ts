/**
 * Converts a urlsafe-base64 VAPID public key into the Uint8Array the Push API wants.
 *
 * The result is backed by a fresh `ArrayBuffer` (not `ArrayBufferLike`) so it
 * satisfies `applicationServerKey`'s `BufferSource` type.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }
  return bytes
}
