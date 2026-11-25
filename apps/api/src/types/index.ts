/* eslint-disable @typescript-eslint/no-namespace */
export interface RequestUser {
  id: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
}

export interface RequestContext {
  requestId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
