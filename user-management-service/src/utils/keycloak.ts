import axios from 'axios';
import { KEYCLOAK_ADMIN_API_URL, KEYCLOAK_BASE_URL, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET, KEYCLOAK_REALM } from '../config/keycloakConfig';

async function getAdminToken(): Promise<string> {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', KEYCLOAK_CLIENT_ID);
  params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

  const response = await axios.post(
    `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data.access_token;
}

async function getUserGroups(kcId: string, adminToken: string): Promise<string[]> {
  const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${kcId}/groups`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.data.map((g: any) => g.path);
}

async function getOrCreateGroup(groupPath: string, adminToken: string): Promise<string> {
  const parts = groupPath.split('/').filter(Boolean);
  let parentId: string | undefined = undefined;
  let currentPath = '';

  for (const currentName of parts) {
    currentPath += '/' + currentName;

    let childrenGroups: any[] = [];
    if (parentId) {
      const resp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      childrenGroups = resp.data;
    } else {
      const resp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      childrenGroups = resp.data;
    }

    let existingGroup = childrenGroups.find((g: any) => g.name === currentName);

    if (!existingGroup) {
      if (parentId) {
        await axios.post(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, { name: currentName }, { headers: { Authorization: `Bearer ${adminToken}` } });
      } else {
        await axios.post(`${KEYCLOAK_ADMIN_API_URL}/groups`, { name: currentName }, { headers: { Authorization: `Bearer ${adminToken}` } });
      }

      const updatedGroups = parentId
        ? await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, { headers: { Authorization: `Bearer ${adminToken}` } })
        : await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, { headers: { Authorization: `Bearer ${adminToken}` } });

      childrenGroups = updatedGroups.data;
      existingGroup = childrenGroups.find((g: any) => g.name === currentName);

      if (!existingGroup) throw new Error(`Could not find group after creating: ${currentPath}`);
    }

    parentId = existingGroup.id;
  }

  return parentId!;
}



async function getUserById(keycloakUserId: string, adminToken: string) {
  const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${keycloakUserId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.data;
}

async function deleteUser(userId: string, adminToken: string) {
  await axios.delete(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}
async function getUserRoles(userId: string, adminToken: string): Promise<string[]> {
  const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/role-mappings/realm`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.data.map((role: any) => role.name);
}

async function createUser(username: string, password: string, adminToken: string ,firstName = "DefaultFirst",lastName = "DefaultLast"): Promise<string> {
  await axios.post(
    `${KEYCLOAK_ADMIN_API_URL}/users`,
    {
      username,
      email: username,
      emailVerified: true,
      enabled: true,
      firstName,
      lastName,
      credentials: [{ type: 'password', value: password, temporary: false }],
      requiredActions: [],
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const users = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users?username=${username}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  return users.data[0].id;
}

async function getRoleByName(roleName: string, adminToken: string) {
  const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/roles/${roleName}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.data;
}

async function assignRoleToUser(userId: string, role: any, adminToken: string) {
  await axios.post(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/role-mappings/realm`, [role], {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

async function getUserIdByUsername(username: string, adminToken: string): Promise<string | null> {
  const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users?username=${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (res.data && res.data.length > 0) {
    return res.data[0].id;
  }
  return null;
}
export {
  getAdminToken,
  getUserById,
  getUserGroups,
  getOrCreateGroup,
  createUser,
  getRoleByName,
  assignRoleToUser,
  getUserIdByUsername,
  getUserRoles,
  deleteUser
};
