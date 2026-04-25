import { describe, expect, it } from 'vitest';
import { deriveNameTokens, scaffoldArtifact } from './index.js';
import type { ScaffoldArtifactInput } from './types.js';

const COMPONENT_DIR = 'components/demo-firebase';
const API_DIR = 'apps/demo-api';

function input(artifact: ScaffoldArtifactInput['artifact'], name: string, options?: ScaffoldArtifactInput['options']): ScaffoldArtifactInput {
  return { artifact, name, componentDir: COMPONENT_DIR, apiDir: API_DIR, options };
}

describe('deriveNameTokens', () => {
  it('produces camel/Pascal/SCREAMING/kebab from camelCase input', () => {
    const tokens = deriveNameTokens('userLog');
    expect(tokens.camel).toBe('userLog');
    expect(tokens.pascal).toBe('UserLog');
    expect(tokens.screaming).toBe('USER_LOG');
    expect(tokens.kebab).toBe('user-log');
  });

  it('handles kebab-case input', () => {
    const tokens = deriveNameTokens('guestbook-liked');
    expect(tokens.camel).toBe('guestbookLiked');
    expect(tokens.pascal).toBe('GuestbookLiked');
    expect(tokens.screaming).toBe('GUESTBOOK_LIKED');
    expect(tokens.kebab).toBe('guestbook-liked');
  });

  it('handles SCREAMING_SNAKE input', () => {
    const tokens = deriveNameTokens('USER_PING');
    expect(tokens.camel).toBe('userPing');
    expect(tokens.pascal).toBe('UserPing');
    expect(tokens.screaming).toBe('USER_PING');
    expect(tokens.kebab).toBe('user-ping');
  });

  it('throws on empty input', () => {
    expect(() => deriveNameTokens('')).toThrow();
  });
});

describe('scaffoldArtifact — skeleton', () => {
  it('returns a result with the requested artifact and tokens', () => {
    const result = scaffoldArtifact(input('storagefile-purpose', 'userLog'));
    expect(result.artifact).toBe('storagefile-purpose');
    expect(result.tokens.kebab).toBe('user-log');
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('renders for notification-template', () => {
    const result = scaffoldArtifact(input('notification-template', 'guestbookLiked'));
    expect(result.artifact).toBe('notification-template');
    expect(result.tokens.pascal).toBe('GuestbookLiked');
  });

  it('renders for notification-task', () => {
    const result = scaffoldArtifact(input('notification-task', 'userPing'));
    expect(result.artifact).toBe('notification-task');
    expect(result.tokens.camel).toBe('userPing');
  });

  it('substitutes <<componentDir>> / <<apiDir>> in emitted file paths', () => {
    const result = scaffoldArtifact(input('storagefile-purpose', 'userLog'));
    const componentFile = result.files.find((f) => f.path.startsWith(COMPONENT_DIR));
    expect(componentFile?.path).toContain('components/demo-firebase/src/lib/model/storagefile/');
    const apiFile = result.files.find((f) => f.path.startsWith(API_DIR));
    expect(apiFile?.path).toContain('apps/demo-api/src/app/common/model/storagefile/');
  });
});
