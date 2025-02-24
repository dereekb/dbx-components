import { addMinutes, isBefore } from 'date-fns';
import { NotificationItem, unreadNotificationItems } from './notification.item';

describe('unreadNotificationItems()', () => {
  it('should separate out the read items and the unread items', () => {
    const t = 'TEST_TEMPLATE_TYPE';
    const cat = new Date();

    const items: NotificationItem[] = [
      { id: '1', cat, t, v: true },
      { id: '2', cat, t, v: true },
      { id: '3', cat, t, v: true },
      { id: '4', cat, t, v: true },
      { id: '5', cat, t, v: false },
      { id: '6', cat, t, v: false },
      { id: '7', cat, t, v: false }
    ];

    const result = unreadNotificationItems(items);

    expect(result.read.length).toBe(4);
    expect(result.unread.length).toBe(3);

    const unreadIds = result.unread.map((x) => x.id);
    expect(unreadIds).toContain(items[4].id);
    expect(unreadIds).toContain(items[5].id);
    expect(unreadIds).toContain(items[6].id);
  });

  it('should separate out the read items and the unread items and those that are in a different category', () => {
    const t = 'TEST_TEMPLATE_TYPE';
    const oldCat = addMinutes(new Date(), -20);
    const newCat = new Date();

    const items: NotificationItem[] = [
      { id: '1', cat: newCat, t, v: true },
      { id: '2', cat: newCat, t, v: true },
      { id: '3', cat: oldCat, t, v: true },
      { id: '4', cat: oldCat, t, v: true },
      { id: '5', cat: newCat, t, v: false }, // unread and created recently
      { id: '6', cat: oldCat, t, v: false },
      { id: '7', cat: newCat, t, v: false } // unread and created recently
    ];

    const result = unreadNotificationItems(items, oldCat);
    const unreadIds = result.unread.map((x) => x.id);

    expect(result.read.length).toBe(5);
    expect(result.unread.length).toBe(2);

    expect(unreadIds).toContain(items[4].id);
    expect(unreadIds).toContain(items[6].id);
  });
});
