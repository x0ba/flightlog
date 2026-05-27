export const OAUTH_AUTH_URL = 'https://auth.openai.com/oauth/authorize';
export const OAUTH_TOKEN_URL = 'https://auth.openai.com/oauth/token';
export const DEVICE_USERCODE_URL = 'https://auth.openai.com/api/accounts/deviceauth/usercode';
export const DEVICE_TOKEN_URL = 'https://auth.openai.com/api/accounts/deviceauth/token';
export const DEVICE_VERIFICATION_URL = 'https://auth.openai.com/codex/device';
export const DEVICE_TOKEN_EXCHANGE_REDIRECT_URI = 'https://auth.openai.com/deviceauth/callback';

export const DEFAULT_CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const OAUTH_SCOPE = 'openid profile email offline_access';

export const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
export const ID_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:id_token';

export const REFRESH_MARGIN_SECONDS = 60;
export const DEFAULT_EXPIRES_IN_SECONDS = 3600;
export const OAUTH_CONNECT_TTL_MS = 10 * 60 * 1000;
export const DEVICE_CODE_MAX_WAIT_MS = 15 * 60 * 1000;
export const DEVICE_CODE_DEFAULT_POLL_MS = 5000;
