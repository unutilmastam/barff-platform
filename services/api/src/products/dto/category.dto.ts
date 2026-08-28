import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
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
import { LOCALES } from '@barff/types';

/**
 * Slug format, shared by categories and products.
 *
 * Matches `isValidSlug` in `@barff/utils` — lowercase, digits, single hyphens.
 * The pattern is repeated here because class-validator needs a literal, and the
 * two are asserted to agree in a unit test rather than trusted to.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Localized text, `{ uz, ru, en }`.
 *
 * All three are required for anything a visitor reads. A missing translation
 * shows the key — or nothing — on exactly the language version nobody on the
 * team checks.
 */
export class LocalizedTextDto {
  @ApiProperty({ example: 'Anor sharbati' })
  @IsString()
  @MaxLength(500)
  uz!: string;

  @ApiProperty({ example: 'Гранатовый сок' })
  @IsString()
  @MaxLength(500)
  ru!: string;

  @ApiProperty({ example: 'Pomegranate juice' })
  @IsString()
  @MaxLength(500)
  en!: string;
}

/** Longer localized copy — descriptions, ingredients, storage. */
export class LocalizedRichTextDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) uz?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) ru?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) en?: string;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'sharbatlar', pattern: SLUG_PATTERN.source })
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_PATTERN, { message: 'validation.slug.invalidFormat' })
  slug!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  name!: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  description?: LocalizedRichTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Every field optional; the slug is deliberately absent — see UpdateProductDto. */
export class UpdateCategoryDto {
  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  name?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  description?: LocalizedRichTextDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ description: `Localized: ${LOCALES.join(', ')}` }) name!: Record<string, string>;
  @ApiPropertyOptional({ nullable: true }) description?: Record<string, string> | null;
  @ApiPropertyOptional({ nullable: true }) parentId?: string | null;
  @ApiProperty() displayOrder!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() productCount!: number;
}
