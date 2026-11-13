/**
 * The browser side of passkeys (server/services/Passkeys.bx): the server's
 * options in, navigator.credentials out, with every binary field as base64url
 * both ways. Written out rather than with PublicKeyCredential.parse*FromJSON
 * and toJSON(), which older Safari and Firefox lack.
 */

export interface CreationOptions {
  challenge: string
  rp: { id: string; name: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: { type: 'public-key'; alg: number }[]
  timeout: number
  attestation: AttestationConveyancePreference
  authenticatorSelection: AuthenticatorSelectionCriteria
  excludeCredentials: { type: 'public-key'; id: string; transports: string[] }[]
}

export interface RequestOptions {
  challenge: string
  rpId: string
  timeout: number
  userVerification: UserVerificationRequirement
  allowCredentials: { type: 'public-key'; id: string; transports: string[] }[]
}

export interface Registration {
  id: string
  clientDataJSON: string
  attestationObject: string
  publicKey?: string
  publicKeyAlgorithm?: number
  transports: string[]
  name: string
}

export interface Assertion {
  id: string
  clientDataJSON: string
  authenticatorData: string
  signature: string
}

export function passkeysSupported() {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!navigator.credentials
}

function toBase64url(buffer: ArrayBuffer) {
  let text = ''
  for (const byte of new Uint8Array(buffer)) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(value: string) {
  const text = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4))
  return Uint8Array.from(text, (c) => c.charCodeAt(0))
}

function descriptors(list: { type: 'public-key'; id: string; transports: string[] }[]): PublicKeyCredentialDescriptor[] {
  return list.map((c) => ({ type: c.type, id: fromBase64url(c.id), transports: c.transports as AuthenticatorTransport[] }))
}

/** A name to tell this passkey from others in Settings: the kind of device it was made on. */
function deviceName() {
  const agent = navigator.userAgent
  if (/iPhone/.test(agent)) return 'iPhone'
  if (/iPad/.test(agent)) return 'iPad'
  if (/Android/.test(agent)) return 'Android'
  if (/Mac OS X/.test(agent)) return 'Mac'
  if (/Windows/.test(agent)) return 'Windows'
  if (/Linux/.test(agent)) return 'Linux'
  return 'Passkey'
}

/** Makes a passkey; null when the person cancels. */
export async function createPasskey(options: CreationOptions): Promise<Registration | null> {
  const credential = (await navigator.credentials
    .create({
      publicKey: {
        ...options,
        challenge: fromBase64url(options.challenge),
        user: { ...options.user, id: fromBase64url(options.user.id) },
        excludeCredentials: descriptors(options.excludeCredentials),
      },
    })
    .catch(cancelled)) as PublicKeyCredential | null
  if (!credential) return null
  const response = credential.response as AuthenticatorAttestationResponse
  const registration: Registration = {
    id: credential.id,
    clientDataJSON: toBase64url(response.clientDataJSON),
    attestationObject: toBase64url(response.attestationObject),
    transports: response.getTransports?.() ?? [],
    name: deviceName(),
  }
  // the server reads the key from attestationObject; this copy, where the browser has it, is checked against it
  const publicKey = response.getPublicKey?.()
  if (publicKey) {
    registration.publicKey = toBase64url(publicKey)
    registration.publicKeyAlgorithm = response.getPublicKeyAlgorithm()
  }
  return registration
}

/** Signs the server's challenge with a passkey; null when the person cancels. */
export async function signWithPasskey(options: RequestOptions): Promise<Assertion | null> {
  const credential = (await navigator.credentials
    .get({
      publicKey: { ...options, challenge: fromBase64url(options.challenge), allowCredentials: descriptors(options.allowCredentials) },
    })
    .catch(cancelled)) as PublicKeyCredential | null
  if (!credential) return null
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    clientDataJSON: toBase64url(response.clientDataJSON),
    authenticatorData: toBase64url(response.authenticatorData),
    signature: toBase64url(response.signature),
  }
}

/** Closing the browser's sheet is a choice, not an error; a device that already has one of these passkeys says so. */
function cancelled(error: unknown): null {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return null
  if (error instanceof DOMException && error.name === 'InvalidStateError') throw new Error('This device already has a passkey for your account.')
  throw error
}
