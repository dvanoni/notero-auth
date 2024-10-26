import { Buffer } from 'node:buffer';

export function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

export function base64Decode(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}
