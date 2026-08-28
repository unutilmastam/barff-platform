import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ToBoolean } from '../../common/dto/to-boolean.decorator.js';
import {
  LocalizedBodyDto,
  LocalizedRichTextDto,
  LocalizedTextDto,
  RELATIVE_PATH_PATTERN,
  SLUG_PATTERN,
} from '../../common/dto/localized.dto.js';

export const PAGE_SECTION_TYPES = ['HERO', 'RICH_TEXT', 'STATS', 'MEDIA', 'CTA'] as const;
export type PageSectionTypeValue = (typeof PAGE_SECTION_TYPES)[number];

/**
 * Pages the CMS may attach a section to.
 *
 * An allow-list rather than free text: a typo would otherwise create a section
 * on a page that does not exist, and nobody would find out until someone
 * noticed the homepage was missing a block.
 */
export const PAGE_KEYS = ['home', 'company', 'production', 'quality', 'partners'] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export class CreatePageSectionDto {
  @ApiProperty({ enum: PAGE_KEYS })
  @IsIn(PAGE_KEYS)
  page!: PageKey;

  @ApiProperty({ example: 'hero', pattern: SLUG_PATTERN.source })
  @IsString()
  @MaxLength(60)
  @Matches(SLUG_PATTERN, { message: 'validation.slug.invalidFormat' })
  key!: string;

  @ApiProperty({ enum: PAGE_SECTION_TYPES })
  @IsIn(PAGE_SECTION_TYPES)
  type!: PageSectionTypeValue;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  heading?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  subheading?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedBodyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedBodyDto)
  body?: LocalizedBodyDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() mediaAssetId?: string;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  ctaLabel?: LocalizedTextDto;

  @ApiPropertyOptional({
    example: '/become-partner',
    description: 'A path on this site. Absolute URLs are refused — see RELATIVE_PATH_PATTERN.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(RELATIVE_PATH_PATTERN, { message: 'validation.path.mustBeRelative' })
  ctaHref?: string;

  @ApiPropertyOptional({
    description: 'Type-specific payload. Shape is defined per section type by the web app (S12).',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

/** `page` and `key` are absent: together they are the section's identity. */
export class UpdatePageSectionDto {
  @ApiPropertyOptional({ enum: PAGE_SECTION_TYPES })
  @IsOptional()
  @IsIn(PAGE_SECTION_TYPES)
  type?: PageSectionTypeValue;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  heading?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  subheading?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedBodyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedBodyDto)
  body?: LocalizedBodyDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() mediaAssetId?: string;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  ctaLabel?: LocalizedTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(RELATIVE_PATH_PATTERN, { message: 'validation.path.mustBeRelative' })
  ctaHref?: string;

  @ApiPropertyOptional() @IsOptional() @IsObject() data?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
}

export class AdminListSectionsDto {
  @ApiPropertyOptional({ enum: PAGE_KEYS })
  @IsOptional()
  @IsIn(PAGE_KEYS)
  page?: PageKey;

  @ApiPropertyOptional({ description: 'Omit to see both drafts and published.' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
