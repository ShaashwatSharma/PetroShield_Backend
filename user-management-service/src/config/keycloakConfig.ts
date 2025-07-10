export const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
export const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM!;
export const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
export const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;

export const KEYCLOAK_ADMIN_API_URL = `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}`;
