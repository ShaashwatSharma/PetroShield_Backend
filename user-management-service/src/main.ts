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
  console.log('user-management-service running on port 3000 or 3001 on Host');
});



// import express from 'express';
// import axios from 'axios';
// import * as dotenv from 'dotenv';
// dotenv.config();

// const app = express();
// app.use(express.json());

// const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
// const KEYCLOAK_ADMIN_API_URL = process.env.KEYCLOAK_ADMIN_API_URL!;
// const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
// const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;

// async function getAdminToken() {
//   const params = new URLSearchParams();
//   params.append('grant_type', 'client_credentials');
//   params.append('client_id', KEYCLOAK_CLIENT_ID);
//   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

//   const response = await axios.post(`${KEYCLOAK_BASE_URL}/protocol/openid-connect/token`, params);
//   return response.data.access_token;
// }

// // Fetch all users
// app.get('/users', async (_, res) => {
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

// // Fetch single user
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
//   console.log('user-management-service running on port 3000');
// });








// import express, { Request, Response } from "express";
// import authMiddleware from "./routes/auth";
// import { PrismaClient } from "@prisma/client";
// import { getAdminToken } from "./utils/keycloak";
// import dotenv from "dotenv";
// import axios from "axios";

// dotenv.config();
// const app = express();
// const prisma = new PrismaClient();

// app.use(express.json());

// // ✅ Keycloak config
// const KEYCLOAK_ADMIN_API_URL = `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}`;

// // ✅ Routes that require Keycloak token
// app.get("/users", authMiddleware, async (_req: Request, res: Response) => {
//   try {
//     const token = await getAdminToken();

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error("Error fetching users from Keycloak:", error);
//     res.status(500).json({ error: "Failed to fetch users" });
//   }
// });

// app.get("/users/:id", authMiddleware, async (req: Request, res: Response) => {
//   try {
//     const token = await getAdminToken();
//     const userId = req.params.id;

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error("Error fetching user:", error);
//     res.status(500).json({ error: "Failed to fetch user" });
//   }
// });

// // ✅ Example of creating driver assignment in DB
// app.post("/assign-driver", authMiddleware, async (req: Request, res: Response) => {
//   try {
//     const { userId, vehicleId, organizationId } = req.body;

//     const assignment = await prisma.driverVehicleAssignment.create({
//       data: {
//         userId,
//         vehicleId,
//         organizationId,
//       },
//     });

//     res.json(assignment);
//   } catch (error) {
//     console.error("Error creating assignment:", error);
//     res.status(500).json({ error: "Failed to create assignment" });
//   }
// });

// const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`user-management-service running on port ${PORT}`);
// });
