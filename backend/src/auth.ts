/**
 * BRC-100 identity key signature verification.
 *
 * Verifies that a message was signed by the holder of the given identity key.
 * Uses @bsv/sdk for cryptographic verification.
 */

import { Hash, Utils, PublicKey, Signature } from '@bsv/sdk';

/**
 * Verify that `signature` is a valid signature of sha256(message)
 * made by the private key corresponding to `identityKeyHex`.
 */
export async function verifyIdentity(
  identityKeyHex: string,
  signatureHex: string,
  message: string,
): Promise<boolean> {
  try {
    const msgBytes = Utils.toArray(message, 'utf8');
    const msgHash = Hash.sha256(msgBytes);

    const pubKey = PublicKey.fromString(identityKeyHex);
    const sig = Signature.fromDER(Utils.toArray(signatureHex, 'hex'));

    return pubKey.verify(msgHash, sig);
  } catch {
    return false;
  }
}
