import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshTokenStore } from './refresh-token.store.js';
import { TokenService } from './token.service.js';

/**
 * `JwtModule` is registered with no default secret on purpose: every sign and
 * verify call passes the access or refresh secret explicitly, so a missing
 * `secret` option can never silently fall back to the wrong key.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, RefreshTokenStore],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
