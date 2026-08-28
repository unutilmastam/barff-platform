import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_MIME_TYPES,
  DetectedKind,
  detectFileType,
  isTypeMismatch,
  sanitizeFilename,
} from './file-signature.js';

/** Minimal but genuine headers for each accepted format. */
const HEADERS = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]),
  webp: Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'ascii'),
  ]),
  avif: Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x1c]),
    Buffer.from('ftypavif', 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
  ]),
  pdf: Buffer.from('%PDF-1.7\n', 'ascii'),
  mp4: Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from('ftypisom', 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
  ]),
};

describe('detectFileType', () => {
  it('identifies every accepted format from its bytes', () => {
    expect(detectFileType(HEADERS.jpeg)?.mimeType).toBe('image/jpeg');
    expect(detectFileType(HEADERS.png)?.mimeType).toBe('image/png');
    expect(detectFileType(HEADERS.webp)?.mimeType).toBe('image/webp');
    expect(detectFileType(HEADERS.avif)?.mimeType).toBe('image/avif');
    expect(detectFileType(HEADERS.pdf)?.mimeType).toBe('application/pdf');
    expect(detectFileType(HEADERS.mp4)?.mimeType).toBe('video/mp4');
  });

  it('classifies each format into the right kind', () => {
    expect(detectFileType(HEADERS.png)?.kind).toBe(DetectedKind.IMAGE);
    expect(detectFileType(HEADERS.pdf)?.kind).toBe(DetectedKind.DOCUMENT);
    expect(detectFileType(HEADERS.mp4)?.kind).toBe(DetectedKind.VIDEO);
  });

  it('rejects a script disguised with an image extension', () => {
    // The whole point of §20. The name says .png; the bytes say otherwise.
    const shell = Buffer.from('#!/bin/sh\nrm -rf /\n', 'utf8');
    expect(detectFileType(shell)).toBeNull();
  });

  it('rejects SVG, which is a scripting vector rather than an image', () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      'utf8',
    );
    expect(detectFileType(svg)).toBeNull();
  });

  it('rejects HTML, which a browser would happily execute from our origin', () => {
    expect(detectFileType(Buffer.from('<!DOCTYPE html><html>', 'utf8'))).toBeNull();
  });

  it('rejects formats that are not on the allow-list', () => {
    const gif = Buffer.from('GIF89a', 'ascii');
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
    expect(detectFileType(gif)).toBeNull();
    expect(detectFileType(zip)).toBeNull();
    expect(detectFileType(elf)).toBeNull();
  });

  it('rejects a file whose real header sits after a decoy prefix', () => {
    // A signature must be at offset 0. Accepting it anywhere would let an
    // attacker prepend a valid header to arbitrary content.
    const smuggled = Buffer.concat([Buffer.from('JUNK', 'ascii'), HEADERS.png]);
    expect(detectFileType(smuggled)).toBeNull();
  });

  it('rejects empty and truncated input without throwing', () => {
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
    expect(detectFileType(Buffer.from([0xff]))).toBeNull();
    expect(detectFileType(Buffer.from('RIFF', 'ascii'))).toBeNull();
  });

  it('does not mistake a bare ISO container for AVIF', () => {
    const unknownBrand = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypqt  ', 'ascii'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
    ]);
    expect(detectFileType(unknownBrand)).toBeNull();
  });

  it('exposes the allow-list without SVG in it', () => {
    expect(ACCEPTED_MIME_TYPES).toContain('image/png');
    expect(ACCEPTED_MIME_TYPES).not.toContain('image/svg+xml');
  });
});

describe('isTypeMismatch', () => {
  const png = detectFileType(HEADERS.png)!;

  it('is false when the claim matches', () => {
    expect(isTypeMismatch('image/png', png)).toBe(false);
    expect(isTypeMismatch('IMAGE/PNG', png)).toBe(false);
  });

  it('ignores charset and other parameters', () => {
    expect(isTypeMismatch('image/png; charset=binary', png)).toBe(false);
  });

  it('is true when the client lies about the type', () => {
    expect(isTypeMismatch('application/pdf', png)).toBe(true);
    expect(isTypeMismatch('text/html', png)).toBe(true);
  });

  it('is false when nothing was claimed', () => {
    expect(isTypeMismatch(undefined, png)).toBe(false);
    expect(isTypeMismatch('', png)).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('keeps an ordinary name intact', () => {
    expect(sanitizeFilename('granat-350-front.png', 'png')).toBe('granat-350-front.png');
  });

  it('neutralises path traversal', () => {
    // Asserted as properties rather than exact strings: what matters is that
    // no separator and no dot-run survives, not the precise substitution.
    for (const hostile of [
      '../../etc/passwd',
      '..\\..\\windows\\system32',
      './../../secret.pdf',
      'a/b/c.png',
    ]) {
      const safe = sanitizeFilename(hostile, 'bin');
      expect(safe, hostile).not.toContain('..');
      expect(safe, hostile).not.toContain('/');
      expect(safe, hostile).not.toContain('\\');
      expect(safe.startsWith('.'), hostile).toBe(false);
    }
    expect(sanitizeFilename('a/b/c.png', 'png')).toBe('a_b_c.png');
  });

  it('strips control characters that would forge a response header', () => {
    // A newline in Content-Disposition is header injection.
    const injected = 'file.png\r\nX-Injected: yes';
    const result = sanitizeFilename(injected, 'png');
    expect(result).not.toContain('\r');
    expect(result).not.toContain('\n');
  });

  it('refuses to produce a hidden file', () => {
    expect(sanitizeFilename('.htaccess', 'bin').startsWith('.')).toBe(false);
  });

  it('falls back when nothing usable is left', () => {
    // Punctuation alone is not a filename.
    expect(sanitizeFilename('', 'png')).toBe('upload.png');
    expect(sanitizeFilename('...', 'pdf')).toBe('upload.pdf');
    expect(sanitizeFilename('///', 'jpg')).toBe('upload.jpg');
  });

  it('bounds the length', () => {
    expect(sanitizeFilename('a'.repeat(500), 'png').length).toBeLessThanOrEqual(200);
  });
});
