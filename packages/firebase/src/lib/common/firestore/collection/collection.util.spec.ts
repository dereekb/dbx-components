import { firestoreModelIdFromEmail } from './collection.util';
import { isFirestoreModelId } from './collection';

describe('firestoreModelIdFromEmail()', () => {
  const testCases = [
    { email: 'simple@example.com', description: 'simple email' },
    { email: 'user.name@example.com', description: 'email with dot in local part' },
    { email: 'user+tag@example.com', description: 'email with plus sign' },
    { email: 'user_name@example.com', description: 'email with underscore' },
    { email: 'user-name@example.com', description: 'email with hyphen' },
    { email: 'first.last+tag@subdomain.example.com', description: 'complex email with subdomain' },
    { email: 'user123@example456.com', description: 'email with numbers' },
    { email: 'a@b.co', description: 'minimal email' },
    { email: 'very.long.email.address.with.many.dots@very.long.domain.name.example.com', description: 'very long email' },
    { email: 'user+multiple+tags@example.com', description: 'email with multiple plus signs' },
    { email: 'user..double@example.com', description: 'email with consecutive dots' },
    { email: 'user@sub-domain.example.com', description: 'email with hyphenated subdomain' }
  ];

  testCases.forEach(({ email, description }) => {
    it(`should return a valid firestore model id for ${description}: ${email}`, () => {
      const result = firestoreModelIdFromEmail(email);
      expect(isFirestoreModelId(result)).toBe(true);
    });
  });
});
