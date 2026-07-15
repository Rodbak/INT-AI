import type { ProviderName } from '../types.js';

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  redirectUri: (baseUrl: string) => string;
  extraAuthParams?: Record<string, string>;
}

export const oauthProviders: Record<string, OAuthProviderConfig> = {
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid profile email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly',
    redirectUri: (baseUrl: string) => `${baseUrl}/api/connections/oauth/callback/google`,
    extraAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  microsoft: {
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid profile email User.Read Mail.Read Calendars.Read',
    redirectUri: (baseUrl: string) => `${baseUrl}/api/connections/oauth/callback/microsoft`,
    extraAuthParams: {
      response_type: 'code',
    },
  },
  slack: {
    clientId: process.env.SLACK_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.SLACK_OAUTH_CLIENT_SECRET || '',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scope: 'channels:read channels:history users:read',
    redirectUri: (baseUrl: string) => `${baseUrl}/api/connections/oauth/callback/slack`,
  },
  github: {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'repo read:user user:email',
    redirectUri: (baseUrl: string) => `${baseUrl}/api/connections/oauth/callback/github`,
  },
};

export function getOAuthConfig(provider: string): OAuthProviderConfig | undefined {
  return oauthProviders[provider];
}
