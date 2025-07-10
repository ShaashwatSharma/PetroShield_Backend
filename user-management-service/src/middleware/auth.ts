import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

// Extend Express Request interface to include 'user'
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const bearerHeader = req.headers["authorization"];
  if (!bearerHeader) { 
    res.sendStatus(401);
    return;
  }

  const token = bearerHeader.split(" ")[1];
  if (!token) {
     res.sendStatus(401);
     return;
  }

  const publicKey = `-----BEGIN PUBLIC KEY-----\n${process.env.KEYCLOAK_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;

  try {
    const decodedToken = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    });

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
     res.sendStatus(403);
     return;
  }
};

export default authenticateToken;
