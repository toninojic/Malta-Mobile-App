import { UserRole, UserStatus } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};
