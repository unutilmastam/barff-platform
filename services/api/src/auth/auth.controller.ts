import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import { AppConfigService } from '../common/config/app-config.service.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { AuthService, type LoginResult, type RequestMetadata } from './auth.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { REFRESH_TOKEN_COOKIE, clearAuthCookies, setAuthCookies } from './cookies.js';
import { type AuthenticatedUser } from './types.js';

/** Path the refresh cookie is scoped to — it must match the route exactly. */
const REFRESH_COOKIE_PATH = '/api/v1/auth/refresh';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Tighter than the global limit: login is the endpoint worth brute-forcing,
  // and this is the per-IP half of the throttle. The per-account half lives in
  // AuthService, because an attacker with a botnet has many IPs but still only
  // one target account.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Sets HttpOnly access and refresh cookies. Non-browser clients may request tokens in the body with `X-Token-Delivery: body`.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Returned identically for an unknown account, a wrong password, a locked account and a deactivated one — the API does not confirm which emails exist.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.login(dto.email, dto.password, metadataFrom(request));
    return this.respondWithSession(result, request, response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Rotate the session',
    description:
      'Consumes the presented refresh token and issues a new pair. Presenting an already-rotated token revokes the whole session — it means the token leaked.',
  })
  @ApiBody({ type: RefreshDto, required: false })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[REFRESH_TOKEN_COOKIE] ?? dto.refreshToken;

    if (token === undefined || token.length === 0) {
      throw new UnauthorizedException({
        message: 'Session is no longer valid',
        code: 'INVALID_SESSION',
      });
    }

    const result = await this.auth.refresh(token, metadataFrom(request));
    return this.respondWithSession(result, request, response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Sign out',
    description: 'Revokes every refresh token in the session and clears the cookies.',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(user.sessionId, user.id, metadataFrom(request));
    clearAuthCookies(response, this.config.cookie, REFRESH_COOKIE_PATH);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Current identity',
    description:
      'Re-read from the database rather than decoded from the token, so a client can tell whether its session is still good.',
  })
  async me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }

  /**
   * Cookies always; tokens in the body only on explicit request.
   *
   * A browser that never receives the token in a response body cannot be
   * tricked into putting it in `localStorage`, which is what makes the
   * HttpOnly cookie worth having. The driver PWA (S33) needs the raw tokens for
   * its offline queue, so it opts in — and that opt-in is a deliberate,
   * greppable decision rather than the default for every client.
   */
  private respondWithSession(
    result: LoginResult,
    request: Request,
    response: Response,
  ): AuthResponseDto {
    setAuthCookies(
      response,
      { accessToken: result.accessToken, refreshToken: result.refreshToken },
      {
        accessSeconds: result.accessTokenExpiresIn,
        refreshSeconds: result.refreshTokenExpiresIn,
      },
      this.config.cookie,
      REFRESH_COOKIE_PATH,
    );

    const body: AuthResponseDto = {
      user: {
        id: result.user.id,
        email: result.user.email,
        roles: result.user.roles,
        permissions: result.user.permissions,
      },
      expiresIn: result.accessTokenExpiresIn,
    };

    if (request.headers['x-token-delivery'] === 'body') {
      body.accessToken = result.accessToken;
      body.refreshToken = result.refreshToken;
    }

    return body;
  }
}

function metadataFrom(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
