import { unzipSync } from 'fflate';

export interface ExtractedFile {
  path: string;
  content: Uint8Array;
}

/**
 * Extracts a zip archive buffer into a list of file path and content pairs.
 * Filters out metadata/hidden files like __MACOSX and .DS_Store.
 */
export function extractZip(zipBuffer: Uint8Array): ExtractedFile[] {
  const unzipped = unzipSync(zipBuffer);
  const result: ExtractedFile[] = [];

  for (const [relativePath, content] of Object.entries(unzipped)) {
    // Ignore directories (trailing slash in fflate) and OS specific junk files
    if (relativePath.endsWith('/')) {
      continue;
    }

    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Skip Mac OS X meta folders & DS_Store files
    if (
      normalizedPath.startsWith('__MACOSX/') ||
      normalizedPath.includes('/__MACOSX/') ||
      normalizedPath.endsWith('.DS_Store') ||
      normalizedPath.includes('/.DS_Store')
    ) {
      continue;
    }

    result.push({
      path: normalizedPath,
      content,
    });
  }

  return result;
}
