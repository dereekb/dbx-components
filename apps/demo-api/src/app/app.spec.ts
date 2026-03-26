import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { demoApiFunctionContextFactory } from '../test/fixture';

demoApiFunctionContextFactory((f) => {
  describe('environment config tests', () => {
    it('should have an appUrl defined', () => {
      const env = f.nest.get(FirebaseServerEnvService);
      expect(env.appUrl).toBeDefined();
    });

    it('should have the expected appApiUrl', () => {
      const env = f.nest.get(FirebaseServerEnvService);
      expect(env.appApiUrl).toBeDefined();
      expect(env.appApiUrl).toBe(`${env.appUrl}/api`);
    });

    it('should have the expected appWebhookUrl', () => {
      const env = f.nest.get(FirebaseServerEnvService);
      expect(env.appWebhookUrl).toBeDefined();
      expect(env.appWebhookUrl).toBe(`${env.appUrl}/api/webhook`);
    });

    it('should have isApiEnabled set to true', () => {
      const env = f.nest.get(FirebaseServerEnvService);
      expect(env.isApiEnabled).toBe(true);
    });

    it('should have isWebhooksEnabled set to true', () => {
      const env = f.nest.get(FirebaseServerEnvService);
      expect(env.isWebhooksEnabled).toBe(true);
    });

    it('should not be in production', () => {
      const env = f.nest.get(FirebaseServerEnvService);
      expect(env.isProduction).toBe(false);
    });

    it('should have developerToolsEnabled disabled (not set in test env config)', () => {
      const env = f.nest.get(FirebaseServerEnvService);
      expect(env.developerToolsEnabled).toBe(false);
    });
  });
});
