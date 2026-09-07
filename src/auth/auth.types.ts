// Shared auth contracts.

export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  SELLER: 'SELLER',
  CATALOG_EDITOR: 'CATALOG_EDITOR',
  CATALOG_REVIEWER: 'CATALOG_REVIEWER',
  SUPPORT: 'SUPPORT',
  FINANCE: 'FINANCE',
  CONTROL: 'CONTROL',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Decoded shape carried in the JWT access token. */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  role: string;
  type: 'access';
  jti: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

/** Public user projection returned to clients (no PII leaks, no password). */
export interface PublicUser {
  id: string;
  email: string;
  phone?: string | null;
  fullName?: string | null;
  role: string;
  status: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token lifetime in seconds
}
