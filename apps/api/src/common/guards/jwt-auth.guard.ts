import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const authenticatedUser = super.handleRequest(err, user, info, context) as AuthenticatedUser;
    const request = context.switchToHttp().getRequest<Request>();

    if (!this.isEmailVerificationAllowedRoute(request) && !authenticatedUser.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email to continue.',
      });
    }

    return authenticatedUser as TUser;
  }

  private isEmailVerificationAllowedRoute(request: Request) {
    const path = request.path.replace(/\/+$/, '');
    const method = request.method.toUpperCase();

    return (
      (method === 'POST' && path === '/api/v1/auth/logout') ||
      (method === 'GET' && path === '/api/v1/auth/me') ||
      (method === 'POST' && path === '/api/v1/auth/send-email-verification')
    );
  }
}
