import "next-auth";
import "next-auth/jwt";
import type { Role } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    photographerId: string | null;
    isAdmin: boolean;
    roles: Role[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleSubject?: string;
    photographerId?: string;
    isAdmin?: boolean;
    roles?: Role[];
  }
}
