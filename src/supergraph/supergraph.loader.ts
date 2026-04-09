import { readFileSync } from 'fs';
import { resolve } from 'path';

export function loadSupergraphSdl(filePath: string): string {
  const resolvedPath = resolve(filePath);

  let content: string;

  try {
    content = readFileSync(resolvedPath, 'utf-8');
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Failed to load supergraph SDL from "${resolvedPath}": ${reason}`,
    );
  }

  if (content.trim().length === 0) {
    throw new Error(`Supergraph SDL file at "${resolvedPath}" is empty`);
  }

  return content;
}
