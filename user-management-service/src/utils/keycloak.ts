import axios from 'axios';

export async function getAdminToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', process.env.KEYCLOAK_CLIENT_ID || '');
  params.append('client_secret', process.env.KEYCLOAK_CLIENT_SECRET || '');

  const url = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
  const response = await axios.post(url, params);
  return response.data.access_token;
}
