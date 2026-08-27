import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ nullable: true }) phone?: string | null;
  @ApiPropertyOptional({ nullable: true }) firstName?: string | null;
  @ApiPropertyOptional({ nullable: true }) lastName?: string | null;
  @ApiPropertyOptional({ example: 'uz' }) locale?: string;

  @ApiProperty({ isArray: true, example: ['ADMIN'] })
  roles!: string[];

  @ApiProperty({ isArray: true, example: ['orders:read', 'orders:update_status'] })
  permissions!: string[];
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ description: 'Access token lifetime in seconds.', example: 900 })
  expiresIn!: number;

  @ApiPropertyOptional({
    description:
      'Returned only to non-browser clients that ask via `X-Token-Delivery: body`. Browsers receive HttpOnly cookies and never see this field.',
  })
  accessToken?: string;

  @ApiPropertyOptional({ description: 'See `accessToken`.' })
  refreshToken?: string;
}
