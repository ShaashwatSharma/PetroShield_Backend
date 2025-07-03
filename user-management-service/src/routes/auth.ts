import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export default (req: Request, res: Response, next: NextFunction) => {
  const bearerHeader = req.headers["authorization"];
  if (!bearerHeader) return res.sendStatus(401);

  const token = bearerHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  const publicKey = `-----BEGIN PUBLIC KEY-----\n${process.env.KEYCLOAK_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;

  try {
    const decodedToken = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    });

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.sendStatus(403);
  }
};
