import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Interface para o payload do token JWT
interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

// Estender o tipo Request para incluir o usuário autenticado
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware para autenticação via JWT
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Obter o token do cabeçalho Authorization
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token de autenticação não fornecido' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Verificar e decodificar o token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'sensory-profile-secret'
    ) as JwtPayload;
    
    // Adicionar o usuário decodificado à requisição
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido ou expirado' });
  }
};

/**
 * Middleware para verificar permissões de administrador
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Verificar se o usuário está autenticado
  if (!req.user) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }
  
  // Verificar se o usuário tem papel de administrador
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária' });
  }
  
  next();
};
