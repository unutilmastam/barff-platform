import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDefined, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * A system setting update.
 *
 * The key is never created through the API. Settings are declared in the seed,
 * where each one has a documented meaning and a default; letting an admin
 * invent `orders.auto_confirm` from a text box would create a key nothing
 * reads and hide the fact that the feature does not exist.
 */
export class UpdateSettingDto {
  @ApiProperty({
    description: 'JSON value — a string, number, boolean, array or object.',
    example: true,
  })
  @IsDefined()
  value!: unknown;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiPropertyOptional({
    description: 'Whether the public website may read this setting. Default is private.',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
