import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
/** Declare the roles permitted to access a handler. Pairs with RolesGuard. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
