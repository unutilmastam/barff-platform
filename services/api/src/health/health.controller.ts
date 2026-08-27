import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator.js';
import { PostgresHealthIndicator } from './indicators/postgres.health.js';
import { RedisHealthIndicator } from './indicators/redis.health.js';

/**
 * Health endpoints.
 *
 * Liveness and readiness are separate because they answer different questions
 * and get different reactions from an orchestrator:
 *
 * - **liveness** — is the process wedged? A failure here means *restart me*.
 *   It must not depend on Postgres or Redis: restarting the API does not fix a
 *   database outage, it just removes capacity during one.
 * - **readiness** — can this instance serve traffic right now? A failure means
 *   *stop routing to me*, and it does depend on Postgres and Redis.
 *
 * Throttling is skipped: ECS and the load balancer poll these on a fixed
 * interval, and rate-limiting a probe turns a busy minute into a false outage.
 */
@ApiTags('health')
@Controller({ path: 'health', version: '1' })
@SkipThrottle()
// Probes are unauthenticated: the load balancer and ECS have no credentials,
// and a health endpoint that needs a token cannot report an auth outage.
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PostgresHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness and readiness',
    description: 'Process health plus Postgres and Redis connectivity.',
  })
  @ApiOkResponse({ description: 'Every dependency is reachable.' })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency is down.' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.postgres.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness only',
    description: 'Answers as long as the event loop is responsive. No dependencies are touched.',
  })
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness only', description: 'Postgres and Redis connectivity.' })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency is down.' })
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.postgres.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
