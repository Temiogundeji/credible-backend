export class IdentityApplicationError extends Error {
  constructor(
    readonly code:
    | 'invalid_credentials'
    | 'account_disabled'
    | 'email_not_verified'
    | 'mfa_required'
    | 'invalid_mfa'
    | 'session_limit_reached'
    | 'invalid_refresh_token'
    | 'refresh_token_reuse_detected'
    | 'invalid_one_time_token'
    | 'password_rejected'
    | 'session_not_found'
    | 'rate_limited'
    | 'identity_already_exists',
    message: string,
  ) {
    super(message);
    this.name = 'IdentityApplicationError';
  }
}
