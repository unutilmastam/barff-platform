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
import {
  LocalizedRichTextDto,
  LocalizedTextDto,
  SLUG_PATTERN,
} from '../../common/dto/localized.dto.js';

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
