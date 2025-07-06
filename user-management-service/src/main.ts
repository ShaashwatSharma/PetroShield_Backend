import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!; // e.g., http://petroshield-keycloak:8080
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM!;       // e.g., myrealm
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!; // e.g., myclient
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!; // e.g., xyz

const KEYCLOAK_ADMIN_API_URL = `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}`;

async function getAdminToken() {
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

// ✅ Route to get all users
app.get('/users', async (_req, res) => {
  try {
    const token = await getAdminToken();

    const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching users from Keycloak:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
  }
});

// ✅ Route to get a single user
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
  } catch (error: any) {
    console.error('Error fetching user from Keycloak:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ user-management-service running on port ${PORT} or 3001 on Host`);
});













// import express from 'express';
// import axios from 'axios';
// import type { Request } from 'express';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();
// app.use(express.json());

// // Keycloak config
// const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
// const KEYCLOAK_ADMIN_API_URL = process.env.KEYCLOAK_ADMIN_API_URL!;
// const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
// const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;

// // Extract token from incoming request (if needed later)
// function extractToken(req: Request): string | null {
//   const bearer = req.headers["authorization"];
//   if (!bearer || typeof bearer !== "string" || !bearer.startsWith("Bearer ")) return null;
//   return bearer.slice(7);
// }

// // Get Keycloak admin token
// async function getAdminToken() {
//   console.log("it was here 2"); 
//   const params = new URLSearchParams();
//   params.append('grant_type', 'client_credentials');
//   params.append('client_id', KEYCLOAK_CLIENT_ID);
//   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

//   // ✅ Correct URL with realm
//       console.log(params.toString());
//       console.log(`${KEYCLOAK_BASE_URL}/realms/myrealm/protocol/openid-connect/token`);
//       console.log(KEYCLOAK_CLIENT_ID);
//       console.log(KEYCLOAK_CLIENT_SECRET);
//       console.log(KEYCLOAK_BASE_URL);
//       console.log(KEYCLOAK_ADMIN_API_URL);
//   const response = await axios.post(`${KEYCLOAK_BASE_URL}/realms/myrealm/protocol/openid-connect/token`, params);
//   return response.data.access_token;
// }

// // Fetch all users
// app.get('/users', async (req, res) => {
//   try {
//     console.log("it was here 1"); 
//     const token = await getAdminToken();
//     // const token = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ2NDdwZDhGOWt2Wm51bTJyRmZtQ2k3bmtRU3EtNENtSWtjcVAxcGRuSzlVIn0.eyJleHAiOjE3NTE2MjQ5NDUsImlhdCI6MTc1MTYyNDY0NSwianRpIjoidHJydGNjOjI2NTBmOWViLTZlN2EtNDNlNi04OWFkLWZmODhhOTNlOTkzZiIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9yZWFsbXMvbXlyZWFsbSIsImF1ZCI6WyJyZWFsbS1tYW5hZ2VtZW50IiwiYWNjb3VudCJdLCJzdWIiOiIxZDQyMjY3My00NzI1LTQ0ZDQtYjYzYy03MDFkYTg4YTI0OWEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJteWNsaWVudCIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiLyoiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbImRlZmF1bHQtcm9sZXMtbXlyZWFsbSIsIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJyZWFsbS1tYW5hZ2VtZW50Ijp7InJvbGVzIjpbImNyZWF0ZS1jbGllbnQiXX0sImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoicHJvZmlsZSBlbWFpbCIsImNsaWVudEhvc3QiOiIxOTIuMTY4LjY1LjEiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInByZWZlcnJlZF91c2VybmFtZSI6InNlcnZpY2UtYWNjb3VudC1teWNsaWVudCIsImNsaWVudEFkZHJlc3MiOiIxOTIuMTY4LjY1LjEiLCJjbGllbnRfaWQiOiJteWNsaWVudCJ9.ajfomDNG1dsdl7Qgfnn3CPgVPj2U4dZmps2ATxg0Dg9f94D9_2RukoxnGT90wu1V1X1cXHbNOCkmsWGL0YYwLYI3JB3gntf0rO__ZnMlKJCGRcq9kKAVwQZ-IOx5bF0DB138Wi4uDLfL2XlmPqYojvY3f1LzJt3dzXqs0dJwuw9DFAbnVnpYtBJdiRf452VInrYsfFH3s4d1IU_fYDkcKAFdw3iy5nhVlHv73ENn7Nb4IshcdrKubjVF8FypjpxzKwcjAplg2nvzph5fkUreQnY5SD5aWmZfSxv1_CPxaFQVXf471Z-Rp9qW6zp8CIL1GUcPfcm8sOKELyl8d6HpsA"
//     console.log("it was here 3");
//             // const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
//             //   headers: {
//             //     Authorization: `Bearer ${token}`,
//             //   },
//             // });
//     const response = await axios.get(`http://petroshield-keycloak:8080/admin/realms/myrealm/users`, {
//     headers: {
//     Authorization: `Bearer ${token}`,
//     },
//     });

//     console.log("it was here 4");
//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching users from Keycloak:', error);
//     res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
//   }
// });

// // Fetch specific user
// app.get('/users/:id', async (req, res) => {
//   try {
//     const token = await getAdminToken();
//     const userId = req.params.id;

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching user from Keycloak:', error);
//     res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
//   }
// });

// app.listen(3000, () => {
//   console.log('user-management-service running on port 3000 or 3001 on Host');
// });
























































// import express from 'express';
// import axios from 'axios';
// import type { Request } from 'express';

// const app = express();
// app.use(express.json());

// // Update these variables with your Keycloak setup
// const KEYCLOAK_BASE_URL = 'http://petroshield-keycloak:8080';
// const KEYCLOAK_ADMIN_API_URL = 'http://petroshield-keycloak:8080/admin/realms/myrealm';
// const KEYCLOAK_CLIENT_ID = 'myclient';
// const KEYCLOAK_CLIENT_SECRET = 'jWQJs4FcdBFH7qJ5gHvkv7H8oMQC4Y7i';


// function extractToken(req: express.Request): string | null {
//   const bearer = req.headers["authorization"];
//   if (!bearer || typeof bearer !== "string" || !bearer.startsWith("Bearer ")) return null;
//   return bearer.slice(7);
// }

// async function getAdminToken() {
//   const params = new URLSearchParams();
//   params.append('grant_type', 'client_credentials');
//   params.append('client_id', KEYCLOAK_CLIENT_ID);
//   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

//   const response = await axios.post(`${KEYCLOAK_BASE_URL}/protocol/openid-connect/token`, params);
//   return response.data.access_token;
// }

// // Example route to fetch all users from Keycloak
// app.get('/users', async (req, res) => {
//   try {
//     const token = await getAdminToken();

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching users from Keycloak:', error);
//     res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
//   }
// });

// // Example route to get a specific user by Keycloak ID
// app.get('/users/:id', async (req, res) => {
//   try {
//     const token = await getAdminToken();
//     const userId = req.params.id;

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching user from Keycloak:', error);
//     res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
//   }
// });

// app.listen(3000, () => {
//   console.log('user-management-service running on port 3000 or 3001 on Host');
// });



// // import express from 'express';
// // import axios from 'axios';
// // import * as dotenv from 'dotenv';
// // dotenv.config();

// // const app = express();
// // app.use(express.json());

// // const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
// // const KEYCLOAK_ADMIN_API_URL = process.env.KEYCLOAK_ADMIN_API_URL!;
// // const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
// // const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;

// // async function getAdminToken() {
// //   const params = new URLSearchParams();
// //   params.append('grant_type', 'client_credentials');
// //   params.append('client_id', KEYCLOAK_CLIENT_ID);
// //   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

// //   const response = await axios.post(`${KEYCLOAK_BASE_URL}/protocol/openid-connect/token`, params);
// //   return response.data.access_token;
// // }

// // // Fetch all users
// // app.get('/users', async (_, res) => {
// //   try {
// //     const token = await getAdminToken();
// //     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
// //       headers: {
// //         Authorization: `Bearer ${token}`,
// //       },
// //     });
// //     res.json(response.data);
// //   } catch (error) {
// //     console.error('Error fetching users from Keycloak:', error);
// //     res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
// //   }
// // });

// // // Fetch single user
// // app.get('/users/:id', async (req, res) => {
// //   try {
// //     const token = await getAdminToken();
// //     const userId = req.params.id;
// //     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
// //       headers: {
// //         Authorization: `Bearer ${token}`,
// //       },
// //     });
// //     res.json(response.data);
// //   } catch (error) {
// //     console.error('Error fetching user from Keycloak:', error);
// //     res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
// //   }
// // });

// // app.listen(3000, () => {
// //   console.log('user-management-service running on port 3000');
// // });








// // import express, { Request, Response } from "express";
// // import authMiddleware from "./routes/auth";
// // import { PrismaClient } from "@prisma/client";
// // import { getAdminToken } from "./utils/keycloak";
// // import dotenv from "dotenv";
// // import axios from "axios";

// // dotenv.config();
// // const app = express();
// // const prisma = new PrismaClient();

// // app.use(express.json());

// // // ✅ Keycloak config
// // const KEYCLOAK_ADMIN_API_URL = `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}`;

// // // ✅ Routes that require Keycloak token
// // app.get("/users", authMiddleware, async (_req: Request, res: Response) => {
// //   try {
// //     const token = await getAdminToken();

// //     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
// //       headers: { Authorization: `Bearer ${token}` },
// //     });

// //     res.json(response.data);
// //   } catch (error) {
// //     console.error("Error fetching users from Keycloak:", error);
// //     res.status(500).json({ error: "Failed to fetch users" });
// //   }
// // });

// // app.get("/users/:id", authMiddleware, async (req: Request, res: Response) => {
// //   try {
// //     const token = await getAdminToken();
// //     const userId = req.params.id;

// //     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
// //       headers: { Authorization: `Bearer ${token}` },
// //     });

// //     res.json(response.data);
// //   } catch (error) {
// //     console.error("Error fetching user:", error);
// //     res.status(500).json({ error: "Failed to fetch user" });
// //   }
// // });

// // // ✅ Example of creating driver assignment in DB
// // app.post("/assign-driver", authMiddleware, async (req: Request, res: Response) => {
// //   try {
// //     const { userId, vehicleId, organizationId } = req.body;

// //     const assignment = await prisma.driverVehicleAssignment.create({
// //       data: {
// //         userId,
// //         vehicleId,
// //         organizationId,
// //       },
// //     });

// //     res.json(assignment);
// //   } catch (error) {
// //     console.error("Error creating assignment:", error);
// //     res.status(500).json({ error: "Failed to create assignment" });
// //   }
// // });

// // const PORT = 3000;
// // app.listen(PORT, () => {
// //   console.log(`user-management-service running on port ${PORT}`);
// // });
