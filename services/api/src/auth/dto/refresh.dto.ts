import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Only for non-browser clients such as the driver PWA. Browsers send the HttpOnly cookie and must leave this empty.',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
