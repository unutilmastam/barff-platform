import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LocalizedRichTextDto, RELATIVE_PATH_PATTERN } from '../../common/dto/localized.dto.js';

/**
 * Per-route SEO overrides.
 *
 * `path` is a route on this site, never an absolute URL, and never carries a
 * locale prefix: `/products`, not `https://barff.uz/uz/products`. One row
 * covers all three language versions, because the metadata itself is localized.
 */
export class UpsertSeoDto {
  @ApiProperty({ example: '/products', pattern: RELATIVE_PATH_PATTERN.source })
  @IsString()
  @MaxLength(300)
  @Matches(RELATIVE_PATH_PATTERN, { message: 'validation.path.mustBeRelative' })
  path!: string;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  title?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  description?: LocalizedRichTextDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() ogImageId?: string;

  @ApiPropertyOptional({ description: 'Absolute canonical URL, when it differs from the route.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  canonicalUrl?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Keeps the route out of search indexes without deleting the page.',
  })
  @IsOptional()
  @IsBoolean()
  noindex?: boolean;
}

export class SeoLookupDto {
  @ApiProperty({ example: '/products' })
  @IsString()
  @MaxLength(300)
  @Matches(RELATIVE_PATH_PATTERN, { message: 'validation.path.mustBeRelative' })
  path!: string;
}
