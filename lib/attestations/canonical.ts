/**
 * Canonical JSON and digest for attestations.
 *
 * Canonical form: RFC 8785, the JSON Canonicalization Scheme (JCS).
 *   - object keys sorted by UTF-16 code units
 *   - no insignificant whitespace
 *   - strings and numbers serialised as ECMAScript's JSON.stringify does
 *   - output encoded as UTF-8
 * Digest: SHA-256 over those UTF-8 bytes, lowercase hexadecimal.
 *
 * Uses Web Crypto so the same code runs on the server and in a browser.
 */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalizationError";
  }
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function serializeString(value: string, path: string): string {
  // A lone surrogate cannot be encoded as UTF-8; JCS treats it as an error.
  if (!value.isWellFormed()) {
    throw new CanonicalizationError(`Invalid Unicode in string at ${path}`);
  }
  return JSON.stringify(value);
}

function serialize(value: unknown, path: string): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return serializeString(value, path);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new CanonicalizationError(`Non-finite number at ${path}`);
      }
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        const items: string[] = [];
        // An index loop, so holes in sparse arrays are seen and rejected.
        for (let index = 0; index < value.length; index += 1) {
          items.push(serialize(value[index], `${path}[${index}]`));
        }
        return `[${items.join(",")}]`;
      }
      if (!isPlainObject(value)) {
        throw new CanonicalizationError(`Unsupported object type at ${path}`);
      }
      const record = value as Record<string, unknown>;
      // Array.prototype.sort without a comparator orders by UTF-16 code units,
      // which is exactly the ordering RFC 8785 requires.
      const members = Object.keys(record)
        .sort()
        .map((key) => {
          const keyPath = `${path}.${key}`;
          return `${serializeString(key, keyPath)}:${serialize(record[key], keyPath)}`;
        });
      return `{${members.join(",")}}`;
    }
    default:
      throw new CanonicalizationError(`Unsupported value of type ${typeof value} at ${path}`);
  }
}

/** Returns the RFC 8785 canonical JSON text for a value. */
export function canonicalize(value: JsonValue): string {
  return serialize(value, "$");
}

/** SHA-256 of the UTF-8 encoding of `text`, as 64 lowercase hex characters. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
