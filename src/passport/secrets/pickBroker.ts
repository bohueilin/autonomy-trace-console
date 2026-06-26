// Broker selection — the documented fallback path made real: prefer a configured 1Password
// Connect broker, fall back to the mock when it is unavailable (which it always is locally).

import type { SecretBroker } from '../types'
import { MockSecretBroker } from './mockSecretBroker'
import { OnePasswordSecretBroker } from './onePasswordSecretBroker'
import type { OnePasswordConfig } from './onePasswordSecretBroker'

export async function pickBroker(now: () => number = Date.now, opConfig: OnePasswordConfig = {}): Promise<SecretBroker> {
  const op = new OnePasswordSecretBroker(opConfig)
  if (await op.isAvailable()) return op
  return new MockSecretBroker(now)
}
