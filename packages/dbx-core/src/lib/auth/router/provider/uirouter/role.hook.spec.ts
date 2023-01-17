import { first, firstValueFrom, of } from 'rxjs';
import { hasAuthRoleDecisionPipe, HasAuthRoleStateData } from './role.hook';

describe('hasAuthRoleDecisionPipe()', () => {
  const authRoleA = 'a';
  const authRoleB = 'b';

  describe('single all configuration', () => {
    const singleAllStateData: HasAuthRoleStateData = {
      authRoles: [authRoleA]
    };

    it('should return true if roleA is provided.', (done) => {
      of(new Set([authRoleA]))
        .pipe(hasAuthRoleDecisionPipe(singleAllStateData), first())
        .subscribe((x) => {
          expect(x).toBe(true);
          done();
        });
    });

    it('should return false if roleA is not provided.', (done) => {
      of(new Set([]))
        .pipe(hasAuthRoleDecisionPipe(singleAllStateData), first())
        .subscribe((x) => {
          expect(x).toBe(false);
          done();
        });
    });
  });

  describe('multi all configuration', () => {
    const multiAllStateData: HasAuthRoleStateData = {
      authRoles: [authRoleA, authRoleB]
    };

    it('should return true if roleA and roleB is provided.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA, authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });

    it('should return false if only roleB is provided and not roleA.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(false);
    });
  });

  describe('multi any configuration', () => {
    const multiAllStateData: HasAuthRoleStateData = {
      authRoles: [authRoleA, authRoleB],
      authRolesMode: 'any'
    };

    it('should return true if roleA and roleB is provided.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA, authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });

    it('should return true if only roleA is provided and not roleB.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });

    it('should return true if only roleB is provided and not roleA.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });
  });

  describe('single config with multi all configuration', () => {
    const multiAllStateData: HasAuthRoleStateData = {
      authRoles: {
        authRoles: [authRoleA, authRoleB],
        authRolesMode: 'all'
      }
    };

    it('should return true if roleA and roleB is provided.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA, authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });

    it('should return false if only roleB is provided and not roleA.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(false);
    });
  });

  describe('single config with multi any configuration', () => {
    const multiAllStateData: HasAuthRoleStateData = {
      authRoles: {
        authRoles: [authRoleA, authRoleB],
        authRolesMode: 'any'
      }
    };

    it('should return true if roleA and roleB is provided.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA, authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });

    it('should return true if only roleA is provided and not roleB.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });

    it('should return true if only roleB is provided and not roleA.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });
  });

  describe('multi configs with multi any and all configuration with any', () => {
    const multiAllStateData: HasAuthRoleStateData = {
      authRoles: [
        {
          authRoles: [authRoleA, authRoleB],
          authRolesMode: 'all'
        },
        {
          authRoles: [authRoleA, authRoleB],
          authRolesMode: 'any'
        }
      ],
      authRolesMode: 'any'
    };

    it('should return true if roleA and roleB is provided.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA, authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });

    it('should return true if only roleA is provided and not roleB.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });

    it('should return true if only roleB is provided and not roleA.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });
  });

  describe('multi configs with multi any and all configuration with all', () => {
    const multiAllStateData: HasAuthRoleStateData = {
      authRoles: [
        {
          authRoles: [authRoleA, authRoleB],
          authRolesMode: 'all'
        },
        {
          authRoles: [authRoleA, authRoleB],
          authRolesMode: 'any'
        }
      ],
      authRolesMode: 'all'
    };

    it('should return true if roleA and roleB is provided.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA, authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(true);
    });

    it('should return false if only roleA is provided and not roleB.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleA])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(false);
    });

    it('should return false if only roleB is provided and not roleA.', async () => {
      const x = await firstValueFrom(of(new Set([authRoleB])).pipe(hasAuthRoleDecisionPipe(multiAllStateData), first()));
      expect(x).toBe(false);
    });
  });
});
