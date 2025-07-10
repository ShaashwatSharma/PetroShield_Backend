export interface KeycloakDecodedToken {
  realm_access?: { roles: string[] };
  groups?: string[];
  preferred_username?: string;
  sub?: string;
  [key: string]: any;
}
