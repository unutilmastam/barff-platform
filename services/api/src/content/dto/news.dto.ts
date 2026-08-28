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
import { SortDirection } from '@barff/types';
import { IsIn } from 'class-validator';
import { SortableQueryDto } from '../../common/dto/sort-query.dto.js';
import { ToBoolean } from '../../common/dto/to-boolean.decorator.js';
import {
  LocalizedBodyDto,
  LocalizedRichTextDto,
  LocalizedTextDto,
  SLUG_PATTERN,
} from '../../common/dto/localized.dto.js';

export class SeoOverrideDto {
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
}

export class CreateNewsDto {
  @ApiProperty({ example: 'yangi-liniya-ishga-tushdi', pattern: SLUG_PATTERN.source })
  @IsString()
  @MaxLength(160)
  @Matches(SLUG_PATTERN, { message: 'validation.slug.invalidFormat' })
  slug!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title!: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  excerpt?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedBodyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedBodyDto)
  body?: LocalizedBodyDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() coverImageId?: string;

  @ApiPropertyOptional({ type: SeoOverrideDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoOverrideDto)
  seo?: SeoOverrideDto;
}

/**
 * Update payload.
 *
 * `slug` is absent for the same reason it is absent from `UpdateProductDto`: it
 * is the article's public URL, and every share and search result already points
 * at it.
 */
export class UpdateNewsDto {
  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  excerpt?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedBodyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedBodyDto)
  body?: LocalizedBodyDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() coverImageId?: string;

  @ApiPropertyOptional({ type: SeoOverrideDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoOverrideDto)
  seo?: SeoOverrideDto;
}

/**
 * Newest first.
 *
 * The shared query DTO defaults to ascending, which is right for a
 * display-order list and wrong for a news feed — it would open the archive on
 * the oldest article on the site.
 */
class NewestFirstQuery extends SortableQueryDto(
  ['publishedAt', 'createdAt', 'slug'] as const,
  'publishedAt',
) {
  @ApiPropertyOptional({ enum: Object.values(SortDirection), default: SortDirection.DESC })
  @IsOptional()
  @IsIn(Object.values(SortDirection))
  override sortDir: SortDirection = SortDirection.DESC;
}

/** Admin listing — sees drafts, and can filter for them. */
export class AdminListNewsDto extends NewestFirstQuery {
  @ApiPropertyOptional({ description: 'Omit to see both drafts and published.' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) q?: string;
}

/**
 * Public listing.
 *
 * No `isActive`, and no sort column that could order by a draft-only field: an
 * unpublished article cannot be requested here at all.
 */
export class PublicListNewsDto extends SortableQueryDto(['publishedAt'] as const, 'publishedAt') {
  @ApiPropertyOptional({ enum: Object.values(SortDirection), default: SortDirection.DESC })
  @IsOptional()
  @IsIn(Object.values(SortDirection))
  override sortDir: SortDirection = SortDirection.DESC;
}
