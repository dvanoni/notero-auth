/**
 * Encrypt data using a symmetric key with AES-GCM.
 * @param symmetricKey The symmetric key to use for encryption
 * @param data The data to encrypt, provided as an ArrayBuffer
 * @returns A promise that resolves to an object containing the encrypted data
 * and the initialization vector (iv)
 */
export async function encrypt(
  symmetricKey: CryptoKey,
  data: ArrayBuffer,
): Promise<{ encryptedData: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    symmetricKey,
    data,
  );
  return { encryptedData, iv };
}

/**
 * Generate a new AES-GCM symmetric key to use for encryption and decryption.
 * @returns A promise that resolves to the generated key
 */
export async function generateSymmetricKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]) as Promise<CryptoKey>;
}

/**
 * Import an RSA public key from the provided key data.
 * @param keyData The key data to import
 * @returns A promise that resolves to the imported key
 */
export function importRSAPublicKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['wrapKey'],
  );
}

/**
 * Wrap a key using the provided RSA public key.
 * @param wrappingKey The wrapping key to use (which must be an RSA public key)
 * @returns A promise that resolves to the wrapped key (exported as raw)
 */
export function wrapKey(
  key: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.wrapKey('raw', key, wrappingKey, { name: 'RSA-OAEP' });
}
