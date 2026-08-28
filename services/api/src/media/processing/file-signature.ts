/**
 * File type detection from magic bytes.
 *
 * `CLAUDE.md` §20: "Never trust file extensions alone." Neither the extension
 * nor the `Content-Type` header survives contact with an attacker — both are
 * chosen by the uploader. The only thing that describes a file is the file.
 *
 * Written by hand rather than pulled from a package for two reasons: the
 * allow-list is six formats, and the maintained libraries are ESM-only, which
 * this CommonJS NestJS build cannot require. Sixty auditable lines beat a
 * dependency that will not load.
 */

export const DetectedKind = {
  IMAGE: 'IMAGE',
  DOCUMENT: 'DOCUMENT',
  VIDEO: 'VIDEO',
} as const;
export type DetectedKind = (typeof DetectedKind)[keyof typeof DetectedKind];

export interface DetectedFileType {
  mimeType: string;
  extension: string;
  kind: DetectedKind;
}

type Matcher = (buffer: Buffer) => boolean;

const startsWith = (...bytes: number[]): Matcher => {
  return (buffer) =>
    buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
};

/**
 * ISO base media format (`....ftyp<brand>`), used by both AVIF and MP4.
 * The brand at offset 8 says which one.
 */
const isoBrand = (...brands: string[]): Matcher => {
  return (buffer) => {
    if (buffer.length < 12) return false;
    if (buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
    return brands.includes(buffer.toString('ascii', 8, 12));
  };
};

/**
 * The complete allow-list. Anything not matched here is rejected.
 *
 * Deliberately absent:
 *
 * - **SVG.** It is a document that can carry `<script>` and external
 *   references, so serving a user-uploaded SVG from our own origin is stored
 *   XSS. Brand vector logos are developer-committed assets (ASSETS.md §6), not
 *   uploads, so nothing legitimate needs this.
 * - **GIF, BMP, TIFF.** No use case, and every accepted format is one more
 *   decoder exposed to hostile input.
 * - **Office documents.** Certificates arrive as PDF (ASSETS.md §4).
 */
const SIGNATURES: { type: DetectedFileType; matches: Matcher }[] = [
  {
    type: { mimeType: 'image/jpeg', extension: 'jpg', kind: DetectedKind.IMAGE },
    matches: startsWith(0xff, 0xd8, 0xff),
  },
  {
    type: { mimeType: 'image/png', extension: 'png', kind: DetectedKind.IMAGE },
    matches: startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  },
  {
    // RIFF....WEBP — the container tag sits at offset 8.
    type: { mimeType: 'image/webp', extension: 'webp', kind: DetectedKind.IMAGE },
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    type: { mimeType: 'image/avif', extension: 'avif', kind: DetectedKind.IMAGE },
    matches: isoBrand('avif', 'avis'),
  },
  {
    type: { mimeType: 'application/pdf', extension: 'pdf', kind: DetectedKind.DOCUMENT },
    matches: startsWith(0x25, 0x50, 0x44, 0x46, 0x2d),
  },
  {
    type: { mimeType: 'video/mp4', extension: 'mp4', kind: DetectedKind.VIDEO },
    matches: isoBrand('isom', 'iso2', 'mp41', 'mp42', 'M4V '),
  },
];

/** Returns `null` for anything not on the allow-list. */
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  for (const signature of SIGNATURES) {
    if (signature.matches(buffer)) return signature.type;
  }
  return null;
}

export const ACCEPTED_MIME_TYPES = SIGNATURES.map((signature) => signature.type.mimeType);

/**
 * True when the client's claimed type disagrees with the bytes.
 *
 * The bytes always win — this exists so the mismatch can be logged. Someone
 * uploading a PDF named `.jpg` is usually a mistake; someone uploading a script
 * named `.png` is not, and the audit trail should be able to tell them apart.
 */
export function isTypeMismatch(claimed: string | undefined, detected: DetectedFileType): boolean {
  if (claimed === undefined || claimed === '') return false;
  return claimed.toLowerCase().split(';')[0]!.trim() !== detected.mimeType;
}

/**
 * Makes a filename safe to store and to hand back as metadata.
 *
 * The result never builds a storage path — keys are generated server-side — but
 * it does reach a `Content-Disposition` header, where a newline would let an
 * uploader inject arbitrary headers.
 */
export function sanitizeFilename(filename: string, fallbackExtension: string): string {
  const base = filename
    // Control characters, including CR and LF. The lint rule guards against
    // accidental control characters in a pattern; here they are the point.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    // Path separators, so a name can never traverse.
    .replace(/[/\\]/g, '_')
    // Any run of dots, anywhere. Stripping only leading dots left names like
    // `_.._etc_passwd`: harmless once the separators are gone, but a stored
    // filename that still reads as a traversal attempt is needless ambiguity
    // for whoever reviews the media library later.
    .replace(/\.{2,}/g, '_')
    // A leading dot would make a hidden file.
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 200);

  // A name of nothing but punctuation is not a name. Requiring one
  // alphanumeric character keeps the fallback predictable.
  return /[a-z0-9]/i.test(base) ? base : `upload.${fallbackExtension}`;
}
