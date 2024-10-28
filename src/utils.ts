import { Buffer } from 'node:buffer';

export function base64Encode(data: string | ArrayBuffer | Buffer): string {
  // @ts-expect-error We're using two different overloads of `Buffer.from`
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return buffer.toString('base64url');
}

export function base64Decode(base64: string): Buffer {
  return Buffer.from(base64, 'base64url');
}

export function utf8JSONEncode(data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify(data));
}
