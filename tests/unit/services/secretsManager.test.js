/**
 * Unit tests for SecretsManager (Req 15: fail-fast on missing secrets at boot).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import secretsManager from '../../../robert-agent-service/src/services/secretsManager.js';

describe('SecretsManager', () => {
  let savedEnv;
  let savedSecret;

  beforeEach(() => {
    savedEnv = { ...process.env };
    savedSecret = secretsManager.secrets.get('OPENAI_API_KEY');
  });

  afterEach(() => {
    process.env = savedEnv;
    if (savedSecret !== undefined) secretsManager.secrets.set('OPENAI_API_KEY', savedSecret);
  });

  it('validateSecrets throws when a required secret is missing', async () => {
    const required = 'OPENAI_API_KEY';
    delete process.env[required];
    secretsManager.secrets.delete(required);

    await expect(secretsManager.validateSecrets()).rejects.toThrow(/Missing required secrets/);
    await expect(secretsManager.validateSecrets()).rejects.toThrow(required);
  });
});
