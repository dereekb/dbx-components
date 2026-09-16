import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DOWNLOAD_CONTENT_TYPE, DEFAULT_DOWNLOAD_TOKEN_TTL_SECONDS, MAX_DOWNLOAD_TOKEN_TTL_SECONDS, downloadContentTypeForPath, downloadTokenTtlSeconds, isSafeRelativeAssetPath, resolveSecureAssetPath } from './download.api.config';

/**
 * Builds a throwaway fixture tree:
 *
 * ```
 * <root>/
 *   secure/            ◀─ the secure root
 *     demo-cli
 *     nested/tool
 *     dir/             (a directory, not a file)
 *     escape -> ../outside/secret.txt
 *     escape-dir -> ../outside
 *   secure-other/
 *     x                (sibling sharing a name PREFIX with `secure`)
 *   outside/secret.txt
 * ```
 */
function buildFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'dbx-download-'));
  const secureRoot = path.join(root, 'secure');
  const outside = path.join(root, 'outside');
  const siblingPrefix = path.join(root, 'secure-other');

  mkdirSync(path.join(secureRoot, 'nested'), { recursive: true });
  mkdirSync(path.join(secureRoot, 'dir'), { recursive: true });
  mkdirSync(outside, { recursive: true });
  mkdirSync(siblingPrefix, { recursive: true });

  writeFileSync(path.join(secureRoot, 'demo-cli'), 'binary');
  writeFileSync(path.join(secureRoot, 'nested', 'tool'), 'nested');
  writeFileSync(path.join(outside, 'secret.txt'), 'secret');
  writeFileSync(path.join(siblingPrefix, 'x'), 'sibling');

  symlinkSync(path.join(outside, 'secret.txt'), path.join(secureRoot, 'escape'));
  symlinkSync(outside, path.join(secureRoot, 'escape-dir'));
  // `<root>/secure/sibling/x` realpaths to `<root>/secure-other/x`, which DOES start with the raw
  // string `<root>/secure` — the naive-startsWith trap the containment compare guards against.
  symlinkSync(siblingPrefix, path.join(secureRoot, 'sibling'));

  return { root, secureRoot, outside, siblingPrefix };
}

describe('isSafeRelativeAssetPath()', () => {
  it('accepts a plain file name and a nested relative path', () => {
    expect(isSafeRelativeAssetPath('demo-cli')).toBe(true);
    expect(isSafeRelativeAssetPath('nested/tool')).toBe(true);
  });

  it('accepts a file name that merely CONTAINS dots', () => {
    // the check is on path SEGMENTS, not on the raw string — `v1..2.tar` is a legitimate file name
    expect(isSafeRelativeAssetPath('v1..2.tar')).toBe(true);
  });

  it('rejects a traversal segment, an absolute path, a null byte, and an empty path', () => {
    expect(isSafeRelativeAssetPath('../../../etc/passwd')).toBe(false);
    expect(isSafeRelativeAssetPath('nested/../../outside/secret.txt')).toBe(false);
    expect(isSafeRelativeAssetPath('/etc/passwd')).toBe(false);
    expect(isSafeRelativeAssetPath('demo\0cli')).toBe(false);
    expect(isSafeRelativeAssetPath('')).toBe(false);
    expect(isSafeRelativeAssetPath('   ')).toBe(false);
  });

  it('rejects a backslash-separated traversal', () => {
    // a Windows-style path reaching a POSIX host would slip through posix-only segment splitting
    expect(isSafeRelativeAssetPath(String.raw`nested\..\..\outside`)).toBe(false);
  });
});

describe('resolveSecureAssetPath()', () => {
  const { secureRoot, outside, siblingPrefix } = buildFixture();

  it('resolves a contained regular file', () => {
    expect(resolveSecureAssetPath(secureRoot, 'demo-cli')).toBe(path.join(realpathSync(secureRoot), 'demo-cli'));
  });

  it('resolves a contained nested file', () => {
    expect(resolveSecureAssetPath(secureRoot, 'nested/tool')).toContain(path.join('secure', 'nested', 'tool'));
  });

  it('refuses a `..` traversal', () => {
    expect(resolveSecureAssetPath(secureRoot, '../../../etc/passwd')).toBeUndefined();
    expect(resolveSecureAssetPath(secureRoot, '../outside/secret.txt')).toBeUndefined();
  });

  it('refuses an absolute path', () => {
    expect(resolveSecureAssetPath(secureRoot, path.join(outside, 'secret.txt'))).toBeUndefined();
    expect(resolveSecureAssetPath(secureRoot, '/etc/passwd')).toBeUndefined();
  });

  it('refuses a symlink inside the root that points OUTSIDE it', () => {
    // realpath on both sides is what catches this — a plain path.resolve would land inside the root
    expect(resolveSecureAssetPath(secureRoot, 'escape')).toBeUndefined();
    expect(resolveSecureAssetPath(secureRoot, 'escape-dir/secret.txt')).toBeUndefined();
  });

  it('refuses a null byte', () => {
    expect(resolveSecureAssetPath(secureRoot, 'demo\0cli')).toBeUndefined();
  });

  it('refuses a directory target', () => {
    expect(resolveSecureAssetPath(secureRoot, 'dir')).toBeUndefined();
    expect(resolveSecureAssetPath(secureRoot, '')).toBeUndefined();
  });

  it('refuses a sibling directory that shares a name PREFIX with the root', () => {
    // `<root>/secure-other/x` starts with `<root>/secure` under a naive startsWith — the `path.sep`
    // the containment compare appends is what rejects it
    expect(resolveSecureAssetPath(secureRoot, 'sibling/x')).toBeUndefined();
    expect(resolveSecureAssetPath(secureRoot, '../secure-other/x')).toBeUndefined();
    // ...while the same file IS reachable when that sibling is itself the configured root
    expect(resolveSecureAssetPath(siblingPrefix, 'x')).toBeDefined();
  });

  it('fails closed with no configured root, and with a root that does not exist', () => {
    expect(resolveSecureAssetPath(undefined, 'demo-cli')).toBeUndefined();
    expect(resolveSecureAssetPath(path.join(secureRoot, 'does-not-exist'), 'demo-cli')).toBeUndefined();
  });

  it('refuses a file that does not exist inside the root', () => {
    expect(resolveSecureAssetPath(secureRoot, 'not-here')).toBeUndefined();
  });
});

describe('downloadTokenTtlSeconds()', () => {
  it('defaults when nothing is requested', () => {
    expect(downloadTokenTtlSeconds(undefined)).toBe(DEFAULT_DOWNLOAD_TOKEN_TTL_SECONDS);
    expect(downloadTokenTtlSeconds(undefined, 120)).toBe(120);
  });

  it('clamps a request above the ceiling', () => {
    expect(downloadTokenTtlSeconds(MAX_DOWNLOAD_TOKEN_TTL_SECONDS * 10)).toBe(MAX_DOWNLOAD_TOKEN_TTL_SECONDS);
  });

  it('ignores a non-positive request', () => {
    expect(downloadTokenTtlSeconds(0, 300)).toBe(300);
    expect(downloadTokenTtlSeconds(-5, 300)).toBe(300);
  });
});

describe('downloadContentTypeForPath()', () => {
  it('derives a known type from the extension', () => {
    expect(downloadContentTypeForPath('/a/b/manifest.json')).toContain('application/json');
    expect(downloadContentTypeForPath('/a/b/demo-cli.sha256')).toContain('text/plain');
  });

  it('defaults an extensionless or unknown artifact to octet-stream', () => {
    expect(downloadContentTypeForPath('/a/b/demo-cli')).toBe(DEFAULT_DOWNLOAD_CONTENT_TYPE);
    expect(downloadContentTypeForPath('/a/b/thing.weird')).toBe(DEFAULT_DOWNLOAD_CONTENT_TYPE);
  });
});
