// OnePasswordSecretBroker — a fail-closed scaffold for a real 1Password Connect path.
//
// Locally there is no Connect host/token configured, so isAvailable() returns false and
// Passport falls back to the MockSecretBroker. requestScopedSecret() throws unless a real
// server-side resolver is wired in — it never returns a value and never logs a secret.
//
// The same shape (scoped handle + redacted metadata, value resolved only server-side inside
// a sandbox) is how the Origin credential broker integrates 1Password Connect in production.

import type { ScopedSecretRequest, ScopedSecretResult, SecretBroker } from '../types'

export interface OnePasswordConfig {
  connectHost?: string
  connectToken?: string
}

export class OnePasswordSecretBroker implements SecretBroker {
  readonly id = 'onepassword'
  private config: OnePasswordConfig

  constructor(config: OnePasswordConfig = {}) {
    this.config = config
  }

  async isAvailable(): Promise<boolean> {
    // Available only when a Connect host + token are configured server-side. In the local
    // browser demo these are intentionally absent → unavailable → mock broker is used.
    return Boolean(this.config.connectHost && this.config.connectToken)
  }

  async requestScopedSecret(request: ScopedSecretRequest): Promise<ScopedSecretResult> {
    // Fail closed: no client-side resolution exists. A real implementation resolves the
    // item server-side via Connect REST and returns redacted metadata + an opaque handle —
    // never a field value. Until that path is wired, deny.
    void request
    throw new Error('1Password Connect is not configured locally (fail closed)')
  }
}
