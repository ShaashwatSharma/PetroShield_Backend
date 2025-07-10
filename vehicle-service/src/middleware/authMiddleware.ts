import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    kcId: string;
    roles: string[];
    organizationId?: string;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.sendStatus(401);
    return;
  }

  const decoded = jwt.decode(token) as any;
  if (!decoded){ 
    res.sendStatus(403);
    return;
  }

  const roles = decoded.realm_access?.roles || [];
  const kcId = decoded.sub;
  let organizationId = '';
  const groups = decoded.groups || [];

  if (groups.length > 0) {
    const parts = groups[0].split('/');
    if (parts.length >= 2) organizationId = parts[1];
  }

  req.user = { kcId, roles, organizationId };
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) { 
        res.sendStatus(403);
        return;
    }
    const hasRole = allowedRoles.some(role => req.user!.roles.includes(role));
    if (!hasRole) { 
        res.sendStatus(403);
        return;
    }
    next();
  };
}
