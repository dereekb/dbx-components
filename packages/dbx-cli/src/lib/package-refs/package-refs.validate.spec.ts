import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type EmbeddedPackageRefs } from './package-refs';
import { type PackageRefsFindingCode, validatePackageRefs } from './package-refs.validate';

const ALPHA_REF = '---\nname: alpha\ndescription: The alpha ref.\n---\n\n# Alpha\n\nSub-docs: `setup`.\n';
const SETUP_DOC = '# Setup\n';
const ROLLUP_CONFIG = "module.exports = { assets: [\n  { glob: '**/*.md', input: 'packages/acme/refs', output: 'refs' }\n] };\n";

describe('validatePackageRefs()', () => {
  let workspaceRoot: string;
  let packageRoot: string;

  function write(path: string, content: string): void {
    const file = join(packageRoot, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  function writePackageJson(dbxClaude: unknown, name = '@acme/pkg'): void {
    write('package.json', JSON.stringify({ name, ...(dbxClaude === undefined ? {} : { dbxClaude }) }));
  }

  function writeCleanPackage(): void {
    writePackageJson({ refs: [{ name: 'alpha', triggers: [{ words: ['alpha'] }] }] });
    write('refs/alpha/REF.md', ALPHA_REF);
    write('refs/alpha/references/setup.md', SETUP_DOC);
    write('rollup.config.cjs', ROLLUP_CONFIG);
  }

  function codes(embedded?: EmbeddedPackageRefs): PackageRefsFindingCode[] {
    return validatePackageRefs({ packageRoot, embedded }).map((x) => x.code);
  }

  const CLEAN_EMBEDDED: EmbeddedPackageRefs = { packageName: '@acme/pkg', refs: [{ name: 'alpha', content: ALPHA_REF, docs: { setup: SETUP_DOC } }] };

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'dbx-cli-package-refs-'));
    writeFileSync(join(workspaceRoot, 'nx.json'), '{}');
    packageRoot = join(workspaceRoot, 'packages', 'acme');
    mkdirSync(packageRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('should return no findings for a clean package', () => {
    writeCleanPackage();
    expect(validatePackageRefs({ packageRoot })).toEqual([]);
  });

  it('should return no findings for a clean package and its matching embedded refs', () => {
    writeCleanPackage();
    expect(validatePackageRefs({ packageRoot, embedded: CLEAN_EMBEDDED })).toEqual([]);
  });

  it('should return no findings for a package that declares no refs', () => {
    writePackageJson(undefined);
    expect(validatePackageRefs({ packageRoot })).toEqual([]);
  });

  it('should report an unreadable package.json', () => {
    write('package.json', '{ nope');
    expect(codes()).toEqual(['PACKAGE_JSON_UNREADABLE']);
  });

  it('should report a dbxClaude value that is not an object, or refs that is not an array', () => {
    writePackageJson('refs');
    expect(codes()).toEqual(['DECLARATION_INVALID']);
    writePackageJson({ refs: { name: 'alpha' } });
    expect(codes()).toEqual(['DECLARATION_INVALID']);
  });

  it('should report invalid entries, names, keys and triggers', () => {
    writeCleanPackage();
    writePackageJson({ refs: ['alpha', { name: 'Bad_Name' }, { name: 'alpha', id: 38, tone: 'block', extra: true, triggers: [{}] }] });
    expect(codes()).toEqual(['REF_ENTRY_INVALID', 'REF_NAME_INVALID', 'REF_KEY_REJECTED', 'REF_KEY_REJECTED', 'REF_KEY_UNKNOWN', 'REF_TRIGGERS_INVALID']);
  });

  it('should report a duplicate ref name', () => {
    writeCleanPackage();
    writePackageJson({ refs: [{ name: 'alpha' }, { name: 'alpha' }] });
    expect(codes()).toEqual(['REF_NAME_DUPLICATE']);
  });

  it('should report a declared ref with no REF.md', () => {
    writeCleanPackage();
    writePackageJson({ refs: [{ name: 'alpha' }, { name: 'beta' }] });
    expect(codes()).toEqual(['REF_DOC_MISSING']);
  });

  it('should report a frontmatter name mismatch and a missing description', () => {
    writeCleanPackage();
    write('refs/alpha/REF.md', '---\nname: beta\n---\n# Alpha\n`setup`\n');
    expect(codes()).toEqual(['REF_FRONTMATTER_NAME_MISMATCH', 'REF_DESCRIPTION_MISSING']);
  });

  it('should report an undeclared ref folder', () => {
    writeCleanPackage();
    write('refs/orphan/REF.md', '# Orphan\n');
    expect(codes()).toEqual(['REF_DIR_UNDECLARED']);
  });

  it('should report sub-docs that are not flat .md files with valid keys', () => {
    writeCleanPackage();
    write('refs/alpha/references/notes.txt', 'x');
    write('refs/alpha/references/Bad_Key.md', 'x');
    write('refs/alpha/references/nested/deep.md', 'x');
    expect(codes()).toEqual(['SUBDOC_INVALID', 'SUBDOC_INVALID', 'SUBDOC_INVALID']);
  });

  it('should report a sub-doc REF.md does not mention', () => {
    writeCleanPackage();
    write('refs/alpha/references/unlisted.md', '# Unlisted\n');
    expect(codes()).toEqual(['SUBDOC_NOT_LISTED']);
  });

  it('should report a rollup config that does not copy the refs', () => {
    writeCleanPackage();
    write('rollup.config.cjs', "module.exports = { assets: [{ glob: '**/*.md', input: 'packages/acme/refs', output: '.' }] };");
    expect(codes()).toEqual(['ROLLUP_ASSET_MISSING']);
    rmSync(join(packageRoot, 'rollup.config.cjs'));
    expect(codes()).toEqual(['ROLLUP_ASSET_MISSING']);
  });

  it('should accept a rollup asset entry in double quotes over several lines', () => {
    writeCleanPackage();
    write('rollup.config.cjs', 'module.exports = { assets: [\n  {\n    glob: "**/*.md",\n    input: "packages/acme/refs",\n    output: "refs"\n  }\n] };');
    expect(codes()).toEqual([]);
  });

  it('should report an embedded package name mismatch', () => {
    writeCleanPackage();
    expect(codes({ ...CLEAN_EMBEDDED, packageName: '@acme/other' })).toEqual(['EMBEDDED_PACKAGE_NAME_MISMATCH']);
  });

  it('should report refs missing from or extra in the embedded refs', () => {
    writeCleanPackage();
    expect(codes({ packageName: '@acme/pkg', refs: [] })).toEqual(['EMBEDDED_REF_MISMATCH']);
    expect(codes({ packageName: '@acme/pkg', refs: [...CLEAN_EMBEDDED.refs, { name: 'ghost', content: '' }] })).toEqual(['EMBEDDED_REF_MISMATCH']);
  });

  it('should report sub-docs missing from or extra in the embedded refs', () => {
    writeCleanPackage();
    expect(codes({ packageName: '@acme/pkg', refs: [{ name: 'alpha', content: ALPHA_REF }] })).toEqual(['EMBEDDED_DOC_MISMATCH']);
    expect(codes({ packageName: '@acme/pkg', refs: [{ name: 'alpha', content: ALPHA_REF, docs: { setup: SETUP_DOC, ghost: '' } }] })).toEqual(['EMBEDDED_DOC_MISMATCH']);
  });

  it('should report embedded content that differs from the files', () => {
    writeCleanPackage();
    expect(codes({ packageName: '@acme/pkg', refs: [{ name: 'alpha', content: 'stale', docs: { setup: 'stale' } }] })).toEqual(['EMBEDDED_CONTENT_MISMATCH', 'EMBEDDED_CONTENT_MISMATCH']);
  });
});
