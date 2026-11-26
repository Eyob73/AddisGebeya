/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-empty-object-type */
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
    interface User extends RequestUser {}
  }
}
