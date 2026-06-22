import { UserAuthProvider, UserRole, UserStatus } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  email: string;
  emailVerifiedAt?: Date | null;
  authProvider?: UserAuthProvider;
  role: UserRole;
  status: UserStatus;
};
