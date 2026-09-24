declare global {
  namespace Express {
    interface Request {
      /** Set by the auth middleware when a valid token is present. */
      user?: { id: string };
    }
  }
}

export {};
