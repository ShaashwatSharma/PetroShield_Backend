import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

// Update these variables with your Keycloak setup
const KEYCLOAK_BASE_URL = 'http://your-keycloak-url/realms/your-realm';
const KEYCLOAK_ADMIN_API_URL = 'http://your-keycloak-url/admin/realms/your-realm';
const KEYCLOAK_CLIENT_ID = 'your-client-id';
const KEYCLOAK_CLIENT_SECRET = 'your-client-secret';

async function getAdminToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', KEYCLOAK_CLIENT_ID);
  params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

  const response = await axios.post(`${KEYCLOAK_BASE_URL}/protocol/openid-connect/token`, params);
  return response.data.access_token;
}

// Example route to fetch all users from Keycloak
app.get('/users', async (_, res) => {
  try {
    const token = await getAdminToken();

    const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching users from Keycloak:', error);
    res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
  }
});

// Example route to get a specific user by Keycloak ID
app.get('/users/:id', async (req, res) => {
  try {
    const token = await getAdminToken();
    const userId = req.params.id;

    const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching user from Keycloak:', error);
    res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
  }
});

app.listen(3000, () => {
  console.log('user-management-service running on port 3000');
});
