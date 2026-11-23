import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeLlmFileAtomic } from './llm.node.file';

describe('writeLlmFileAtomic()', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'llm-node-file-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should create the parent folder and write the text, leaving no temp file', () => {
    const folder = join(dir, 'a', 'b');
    const filePath = join(folder, 'out.json');
    writeLlmFileAtomic({ filePath, text: '{}\n' });
    expect(readFileSync(filePath, 'utf8')).toBe('{}\n');
    expect(readdirSync(folder)).toEqual(['out.json']);
  });

  it('should replace an existing file', () => {
    const filePath = join(dir, 'out.json');
    writeFileSync(filePath, 'old', 'utf8');
    writeLlmFileAtomic({ filePath, text: 'new' });
    expect(readFileSync(filePath, 'utf8')).toBe('new');
    expect(readdirSync(dir)).toEqual(['out.json']);
  });

  it('should rethrow a failed rename and remove the temp file', () => {
    const filePath = join(dir, 'out.json');
    mkdirSync(filePath);
    writeFileSync(join(filePath, 'occupied'), 'x', 'utf8');
    expect(() => writeLlmFileAtomic({ filePath, text: 'new' })).toThrow();
    expect(readdirSync(dir)).toEqual(['out.json']);
  });
});
