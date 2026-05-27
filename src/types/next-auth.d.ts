import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    photographerId: string | null;
    isAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleSubject?: string;
    photographerId?: string;
    isAdmin?: boolean;
  }
}
