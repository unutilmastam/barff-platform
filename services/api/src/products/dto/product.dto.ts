import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SortableQueryDto } from '../../common/dto/sort-query.dto.js';
import { ToBoolean } from '../../common/dto/to-boolean.decorator.js';
import {
  LocalizedRichTextDto,
  LocalizedTextDto,
  SLUG_PATTERN,
} from '../../common/dto/localized.dto.js';

export const PRODUCT_DOCUMENT_KINDS = [
  'CERTIFICATE',
  'SPECIFICATION',
  'SAFETY_DATA',
  'OTHER',
] as const;

export class SeoDto {
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

export class CreateProductDto {
  @ApiProperty({ example: 'granat', pattern: SLUG_PATTERN.source })
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_PATTERN, { message: 'validation.slug.invalidFormat' })
  slug!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  name!: LocalizedTextDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  shortDescription?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  description?: LocalizedRichTextDto;

  @ApiPropertyOptional({
    type: LocalizedRichTextDto,
    description:
      'Legally required on a published page. Not yet supplied by BARFF — see docs/OPEN-QUESTIONS.md Q-016.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  ingredients?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  storage?: LocalizedRichTextDto;

  @ApiPropertyOptional({ example: 'pomegranate' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  flavor?: string;

  @ApiPropertyOptional({ example: 180, description: 'Days from production. Q-016.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  shelfLifeDays?: number;

  @ApiPropertyOptional({ type: SeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoDto)
  seo?: SeoDto;

  @ApiPropertyOptional({
    default: false,
    description: 'Draft by default — a product reaches the public site only when published.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

/**
 * Update payload.
 *
 * `slug` is absent on purpose. It is the public URL of the page, so changing it
 * silently breaks every existing link, every share and every search result.
 * Renaming is a deliberate act with a redirect attached, which S13 owns — not
 * something a general update should allow by accident.
 */
export class UpdateProductDto {
  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  name?: LocalizedTextDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  shortDescription?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  description?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  ingredients?: LocalizedRichTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  storage?: LocalizedRichTextDto;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) flavor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  shelfLifeDays?: number;

  @ApiPropertyOptional({ type: SeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoDto)
  seo?: SeoDto;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
}

export class CreateVariantDto {
  @ApiProperty({ example: 350 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20_000)
  volumeMl!: number;

  @ApiPropertyOptional({ description: 'Not yet supplied by BARFF — Q-016.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) barcode?: string;

  @ApiPropertyOptional({ description: 'Units per case. Q-006.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  packSize?: number;

  @ApiPropertyOptional({ description: 'Per 100 ml. Q-016.' })
  @IsOptional()
  nutrition?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20_000)
  volumeMl?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) sku?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) barcode?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) packSize?: number;
  @ApiPropertyOptional() @IsOptional() nutrition?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
}

export class AttachImageDto {
  @ApiProperty() @IsUUID() mediaAssetId!: string;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  altText?: LocalizedRichTextDto;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isPrimary?: boolean;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class AttachDocumentDto {
  @ApiProperty() @IsUUID() mediaAssetId!: string;

  @ApiProperty({ enum: PRODUCT_DOCUMENT_KINDS })
  @IsIn(PRODUCT_DOCUMENT_KINDS)
  kind!: (typeof PRODUCT_DOCUMENT_KINDS)[number];

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title!: LocalizedTextDto;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class ReorderDto {
  @ApiProperty({ type: [String], description: 'Ids in the order they should appear.' })
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];
}

/** Admin listing — sees drafts, and can filter for them. */
export class AdminListProductsDto extends SortableQueryDto(
  ['displayOrder', 'createdAt', 'slug'] as const,
  'displayOrder',
) {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ description: 'Omit to see both drafts and published.' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) q?: string;
}

/** Public listing — never exposes a draft, and has no flag to ask for one. */
export class PublicListProductsDto extends SortableQueryDto(
  ['displayOrder', 'createdAt'] as const,
  'displayOrder',
) {
  @ApiPropertyOptional({ description: 'Category slug.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) flavor?: string;
}
