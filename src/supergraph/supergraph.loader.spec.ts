import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadSupergraphSdl } from './supergraph.loader';

describe('loadSupergraphSdl', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'supergraph-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns the SDL string when the file exists', () => {
    const sdlContent =
      'schema @link(url: "https://specs.apollo.dev/federation/v2.0") { query: Query }';
    const filePath = join(tempDir, 'supergraph.graphql');
    writeFileSync(filePath, sdlContent, 'utf-8');

    const result = loadSupergraphSdl(filePath);

    expect(result).toBe(sdlContent);
  });

  it('throws a descriptive error when the file does not exist', () => {
    const missingPath = join(tempDir, 'missing.graphql');

    expect(() => loadSupergraphSdl(missingPath)).toThrow(
      /Failed to load supergraph SDL from ".*missing\.graphql"/,
    );
  });

  it('throws when the file is empty', () => {
    const filePath = join(tempDir, 'empty.graphql');
    writeFileSync(filePath, '', 'utf-8');

    expect(() => loadSupergraphSdl(filePath)).toThrow(/empty/i);
  });

  it('throws when the file contains only whitespace', () => {
    const filePath = join(tempDir, 'whitespace.graphql');
    writeFileSync(filePath, '   \n  \n  ', 'utf-8');

    expect(() => loadSupergraphSdl(filePath)).toThrow(/empty/i);
  });

  it('includes the resolved absolute path in the error message', () => {
    const relativePath = './nonexistent/supergraph.graphql';

    expect(() => loadSupergraphSdl(relativePath)).toThrow(
      /Failed to load supergraph SDL from "\/.*nonexistent\/supergraph\.graphql"/,
    );
  });
});
