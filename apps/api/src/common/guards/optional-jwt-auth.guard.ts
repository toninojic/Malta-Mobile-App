import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | undefined>; query?: Record<string, unknown> }>();
    const authorization = request.headers?.authorization;
    const queryToken = request.query?.token;

    if (!authorization && !queryToken) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(_error: unknown, user: TUser) {
    return (user ?? null) as TUser;
  }
}
