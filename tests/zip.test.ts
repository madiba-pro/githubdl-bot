import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { extractZip } from '../src/zip.js';

describe('Zip Extraction Service', () => {
  it('extracts files correctly and ignores __MACOSX & .DS_Store', () => {
    const zipped = zipSync({
      'index.js': new TextEncoder().encode('console.log("hello world");'),
      'src/utils.ts': new TextEncoder().encode('export const add = (a, b) => a + b;'),
      '__MACOSX/._index.js': new TextEncoder().encode('junk'),
      '.DS_Store': new TextEncoder().encode('junk'),
      'nested/.DS_Store': new TextEncoder().encode('junk'),
    });

    const result = extractZip(zipped);

    expect(result.length).toBe(2);

    const paths = result.map((f) => f.path);
    expect(paths).toContain('index.js');
    expect(paths).toContain('src/utils.ts');
    expect(paths).not.toContain('__MACOSX/._index.js');
    expect(paths).not.toContain('.DS_Store');

    const indexFile = result.find((f) => f.path === 'index.js');
    expect(new TextDecoder().decode(indexFile?.content)).toBe('console.log("hello world");');
  });

  it('handles empty zip archives', () => {
    const zipped = zipSync({});
    const result = extractZip(zipped);
    expect(result).toEqual([]);
  });
});
