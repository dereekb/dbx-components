import { GrantedReadRole, GrantedRoleMap, grantedRoleMapReader } from './role';

const FIRST_ROLE = 'first';
const SECOND_ROLE = 'second';

type TestRoles = GrantedReadRole | typeof FIRST_ROLE | typeof SECOND_ROLE;

describe('grantedRoleMapReader()', () => {
  const roleMap: GrantedRoleMap<TestRoles> = {
    read: true,
    first: true
  };

  it('should create a reader for the input.', () => {
    const result = grantedRoleMapReader(roleMap);
    expect(result).toBeDefined();
  });

  describe('reader', () => {
    const reader = grantedRoleMapReader(roleMap);

    describe('truthMap()', () => {
      it('should construct the truth map.', () => {
        const result = reader.truthMap({
          first: 'a',
          second: undefined
        });

        expect(result.first).toBe('a');
        expect(result.second).toBeUndefined();
      });
    });

    describe('hasRole', () => {
      it('should return true if the role is granted.', () => {
        expect(reader.hasRole('first')).toBe(true);
      });

      it('should return false if the role not is granted.', () => {
        expect(reader.hasRole('second')).toBe(false);
      });
    });

    describe('containsRoles', () => {
      describe('any', () => {
        it('should return true if the role is granted.', () => {
          expect(reader.containsRoles('any', 'first')).toBe(true);
        });

        it('should return true if the roles are granted.', () => {
          expect(reader.containsRoles('any', ['read', 'first'])).toBe(true);
        });

        it('should return true if any role is granted.', () => {
          expect(reader.containsRoles('any', ['read', 'second'])).toBe(true);
        });

        it('should return false if none of the input roles are granted.', () => {
          expect(reader.containsRoles('any', 'second')).toBe(false);
        });
      });
      describe('all', () => {
        it('should return true if all roles are granted.', () => {
          expect(reader.containsRoles('all', ['read', 'first'])).toBe(true);
        });

        it('should return false if only some of the input roles are granted.', () => {
          expect(reader.containsRoles('all', ['read', 'second'])).toBe(false);
        });
      });
    });
  });
});
