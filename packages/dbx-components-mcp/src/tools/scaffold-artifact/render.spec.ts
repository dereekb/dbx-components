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

describe('scaffoldArtifact — storagefile-purpose body', () => {
  it('emits component-side constants + helpers with the right tokens', () => {
    const result = scaffoldArtifact(input('storagefile-purpose', 'userPhoto'));
    const componentFile = result.files.find((f) => f.path.endsWith('storagefile.ts'));
    expect(componentFile?.status).toBe('append');
    const text = componentFile?.content ?? '';
    expect(text).toContain('USER_PHOTO_UPLOADED_FILE_TYPE_IDENTIFIER');
    expect(text).toContain('USER_PHOTO_PURPOSE');
    expect(text).toContain('userPhotoUploadsFolderPath');
    expect(text).toContain('userPhotoStoragePath');
    expect(text).toContain('userPhotoFileGroupIds');
  });

  it('emits a handler file with the bindingName matching the call-site convention', () => {
    const result = scaffoldArtifact(input('storagefile-purpose', 'userPhoto'));
    const handler = result.files.find((f) => f.path.includes('handlers/upload.user-photo.ts'));
    expect(handler?.status).toBe('new');
    const text = handler?.content ?? '';
    // The strict-reachability trace matches by inner var name; this is the convention.
    expect(text).toContain('const userPhotoFileInitializer: StorageFileInitializeFromUploadServiceInitializer');
    expect(text).toContain('return userPhotoFileInitializer;');
    expect(text).toContain('makeUserPhotoFileUploadInitializer(context: DemoFirebaseServerActionsContext)');
    // Imports from the inferred component package name.
    expect(text).toContain("from 'demo-firebase'");
  });

  it('renders wiring instructions naming the call-site binding', () => {
    const result = scaffoldArtifact(input('storagefile-purpose', 'userPhoto'));
    expect(result.wiring).toHaveLength(1);
    const step = result.wiring[0];
    expect(step.file).toBe('apps/demo-api/src/app/common/model/storagefile/storagefile.upload.service.ts');
    expect(step.snippet ?? '').toContain('makeUserPhotoFileUploadInitializer');
    expect(step.snippet ?? '').toContain('userPhotoFileInitializer');
  });
});

describe('scaffoldArtifact — notification-template body', () => {
  it('emits component-side type + info + factory with the right tokens', () => {
    const result = scaffoldArtifact(input('notification-template', 'guestbookLiked'));
    const componentFile = result.files.find((f) => f.path.endsWith('notification.ts'));
    expect(componentFile?.status).toBe('append');
    const text = componentFile?.content ?? '';
    expect(text).toContain('GUESTBOOK_LIKED_NOTIFICATION_TEMPLATE_TYPE');
    expect(text).toContain('GUESTBOOK_LIKED_NOTIFICATION_TEMPLATE_TYPE_INFO');
    expect(text).toContain('GuestbookLikedNotificationData');
    expect(text).toContain('guestbookLikedNotificationTemplate');
  });

  it('emits an API-side factory that names the type-config function with the AppPascal prefix', () => {
    const result = scaffoldArtifact(input('notification-template', 'guestbookLiked'));
    const factory = result.files.find((f) => f.path.endsWith('notification.factory.ts'));
    expect(factory?.status).toBe('append');
    const text = factory?.content ?? '';
    expect(text).toContain('demoGuestbookLikedNotificationFactory(_context: DemoFirebaseServerActionsContext)');
    expect(text).toContain('GUESTBOOK_LIKED_NOTIFICATION_TEMPLATE_TYPE');
  });

  it('renders wiring instructions covering both the configs-array factory and the info-record aggregator', () => {
    const result = scaffoldArtifact(input('notification-template', 'guestbookLiked'));
    expect(result.wiring).toHaveLength(1);
    const snippet = result.wiring[0].snippet ?? '';
    expect(snippet).toContain('demoGuestbookLikedNotificationFactory(context)');
    expect(snippet).toContain('GUESTBOOK_LIKED_NOTIFICATION_TEMPLATE_TYPE_INFO');
    expect(snippet).toContain('notificationTemplateTypeInfoRecord');
  });
});

describe('scaffoldArtifact — notification-task body', () => {
  it('emits component-side type + checkpoint + data + template with the right tokens', () => {
    const result = scaffoldArtifact(input('notification-task', 'userPing'));
    const componentFile = result.files.find((f) => f.path.endsWith('notification.task.ts'));
    expect(componentFile?.status).toBe('append');
    const text = componentFile?.content ?? '';
    expect(text).toContain('USER_PING_NOTIFICATION_TASK_TYPE');
    expect(text).toContain('UserPingNotificationTaskCheckpoint');
    expect(text).toContain('UserPingNotificationTaskData');
    expect(text).toContain('userPingNotificationTaskTemplate');
    expect(text).not.toContain('unique: true');
  });

  it('emits a handler file with the inner var matching the strict-reachability convention', () => {
    const result = scaffoldArtifact(input('notification-task', 'userPing'));
    const handler = result.files.find((f) => f.path.includes('handlers/task.handler.user-ping.ts'));
    expect(handler?.status).toBe('new');
    const text = handler?.content ?? '';
    expect(text).toContain('const userPingHandler: NotificationTaskServiceTaskHandlerConfig');
    expect(text).toContain('return userPingHandler;');
    expect(text).toContain('demoUserPingNotificationTaskHandler(_context: DemoFirebaseServerActionsContext)');
  });

  it('emits `unique: true` when the option is set', () => {
    const result = scaffoldArtifact(input('notification-task', 'userPing', { unique: true }));
    const componentFile = result.files.find((f) => f.path.endsWith('notification.task.ts'));
    expect(componentFile?.content).toContain('unique: true');
  });

  it('renders wiring instructions covering both the handlers array and ALL_NOTIFICATION_TASK_TYPES', () => {
    const result = scaffoldArtifact(input('notification-task', 'userPing'));
    const snippet = result.wiring[0].snippet ?? '';
    expect(snippet).toContain('demoUserPingNotificationTaskHandler');
    expect(snippet).toContain('userPingHandler');
    expect(snippet).toContain('ALL_NOTIFICATION_TASK_TYPES');
  });
});
