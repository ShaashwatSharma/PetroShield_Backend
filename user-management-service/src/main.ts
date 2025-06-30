import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

app.post('/users', async (req, res) => {
  const { name, keycloakId } = req.body;
  const user = await prisma.user.create({
    data: { name, keycloakId }
  });
  res.json(user);
});

app.get('/users', async (_, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.listen(3003, () => {
  console.log('user-management-service running on port 3003');
});
