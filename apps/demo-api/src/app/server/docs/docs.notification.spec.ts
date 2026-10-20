import { extractDocsMarkdownSections, slugifyDocsHeading, splitDocsMarkdownSections } from '@dereekb/firebase-server';
import { CALENDAR_EVENT_INVITE_NOTIFICATION_TEMPLATE_TYPE_INFO, DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD, DEMO_NOTIFICATION_GUESTBOOK_SETTINGS_GROUP, DEMO_NOTIFICATION_PROFILE_SETTINGS_GROUP, TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO } from 'demo-firebase';
import { DEMO_NOTIFICATION_TYPES_DOC_ID, demoNotificationTypesDocsEntry, demoNotificationTypesDocsSource } from './docs.notification';

describe('demoNotificationTypesDocsEntry()', () => {
  const doc = demoNotificationTypesDocsEntry(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD);
  const sections = extractDocsMarkdownSections(doc.content);

  function sectionContent(id: string): string {
    const section = splitDocsMarkdownSections(doc.content, sections).sections.find((x) => x.section.id === id);
    expect(section).toBeDefined();
    return section?.content ?? '';
  }

  it('should give every notification type exactly one section', () => {
    const typeSections = sections.filter((x) => x.depth === 3);

    for (const info of Object.values(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)) {
      expect(typeSections.filter((x) => x.title.includes(`\`${info.type}\``))).toHaveLength(1);
    }

    expect(typeSections).toHaveLength(Object.keys(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD).length);
  });

  it('should order the settings groups by sortOrder', () => {
    expect(sections.filter((x) => x.depth === 2).map((x) => x.title)).toEqual([DEMO_NOTIFICATION_PROFILE_SETTINGS_GROUP.name, DEMO_NOTIFICATION_GUESTBOOK_SETTINGS_GROUP.name]);
  });

  it('should list the forced delivery methods of a type', () => {
    const content = sectionContent(slugifyDocsHeading(`${CALENDAR_EVENT_INVITE_NOTIFICATION_TEMPLATE_TYPE_INFO.name} (${CALENDAR_EVENT_INVITE_NOTIFICATION_TEMPLATE_TYPE_INFO.type})`));

    expect(content).toContain('- Always delivered by: email');
    expect(content).toContain('- A user can turn on or off: none');
    expect(content).toContain('- About: `calendar`');
  });

  it('should note a type that is hidden from notification settings', () => {
    const content = sectionContent(slugifyDocsHeading(`${TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO.name} (${TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO.type})`));
    expect(content).toContain('- Not shown in notification settings.');
  });
});

describe('demoNotificationTypesDocsSource()', () => {
  it('should load the notification types doc', () => {
    expect(
      demoNotificationTypesDocsSource()
        .loadDocs()
        .map((x) => x.id)
    ).toEqual([DEMO_NOTIFICATION_TYPES_DOC_ID]);
  });
});
