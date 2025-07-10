import { Request, Response, NextFunction } from 'express';
import { jwtDecode } from 'jwt-decode';
import { KeycloakDecodedToken } from '../types/keycloak';

export const checkRole = (requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwtDecode<KeycloakDecodedToken>(token);
      const roles = decoded.realm_access?.roles || [];

      const hasRole = requiredRoles.some(role => roles.includes(role));
      if (!hasRole) {
        res.status(403).json({ error: 'Forbidden: insufficient role' });
        return;
      }

      (req as any).user = decoded;
      next();
    } catch (err) {
      console.error('Token decode error:', err);
      res.status(401).json({ error: 'Invalid token' });
    }
  };
};
