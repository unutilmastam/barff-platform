import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { SortableQueryDto } from '../../common/dto/sort-query.dto.js';
import { ToBoolean } from '../../common/dto/to-boolean.decorator.js';
import { LocalizedRichTextDto, LocalizedTextDto } from '../../common/dto/localized.dto.js';

export const GALLERY_CATEGORIES = [
  'FACTORY',
  'PRODUCTION',
  'PRODUCTS',
  'WAREHOUSE',
  'TEAM',
  'EVENTS',
  'OTHER',
] as const;
export type GalleryCategoryValue = (typeof GALLERY_CATEGORIES)[number];

export class CreateGalleryItemDto {
  @ApiProperty({ description: 'An IMAGE asset from the media library.' })
  @IsUUID()
  mediaAssetId!: string;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  caption?: LocalizedRichTextDto;

  @ApiPropertyOptional({ enum: GALLERY_CATEGORIES, default: 'OTHER' })
  @IsOptional()
  @IsIn(GALLERY_CATEGORIES)
  category?: GalleryCategoryValue;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateGalleryItemDto {
  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  caption?: LocalizedRichTextDto;

  @ApiPropertyOptional({ enum: GALLERY_CATEGORIES })
  @IsOptional()
  @IsIn(GALLERY_CATEGORIES)
  category?: GalleryCategoryValue;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
}

/**
 * Public filter — category only. There is no way to ask for a draft.
 *
 * Paginated, unlike certificates and documents: a gallery is the one content
 * list an editor can plausibly grow to hundreds of rows, and an unbounded
 * response would eventually mean signing hundreds of URLs for one page view.
 */
export class PublicListGalleryDto extends SortableQueryDto(
  ['displayOrder', 'createdAt'] as const,
  'displayOrder',
) {
  @ApiPropertyOptional({ enum: GALLERY_CATEGORIES })
  @IsOptional()
  @IsIn(GALLERY_CATEGORIES)
  category?: GalleryCategoryValue;
}

export class AdminListGalleryDto extends PublicListGalleryDto {
  @ApiPropertyOptional({ description: 'Omit to see both drafts and published.' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
