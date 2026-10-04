// Расширение типа Request: после authMiddleware в req.auth лежит проверенный пользователь

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        accessToken: string;
      };
    }
  }
}

export {};
