import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { ToBoolean } from '../../common/dto/to-boolean.decorator.js';
import { LocalizedRichTextDto, LocalizedTextDto } from '../../common/dto/localized.dto.js';

export const PUBLIC_DOCUMENT_KINDS = [
  'CATALOG',
  'PRICE_LIST',
  'PRESENTATION',
  'CERTIFICATE',
  'LEGAL',
  'OTHER',
] as const;
export type PublicDocumentKindValue = (typeof PUBLIC_DOCUMENT_KINDS)[number];

export class CreatePublicDocumentDto {
  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title!: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  description?: LocalizedRichTextDto;

  @ApiProperty({ enum: PUBLIC_DOCUMENT_KINDS })
  @IsIn(PUBLIC_DOCUMENT_KINDS)
  kind!: PublicDocumentKindValue;

  @ApiProperty({ description: 'A DOCUMENT asset from the media library.' })
  @IsUUID()
  mediaAssetId!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdatePublicDocumentDto {
  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  description?: LocalizedRichTextDto;

  @ApiPropertyOptional({ enum: PUBLIC_DOCUMENT_KINDS })
  @IsOptional()
  @IsIn(PUBLIC_DOCUMENT_KINDS)
  kind?: PublicDocumentKindValue;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
}

export class PublicListDocumentsDto {
  @ApiPropertyOptional({ enum: PUBLIC_DOCUMENT_KINDS })
  @IsOptional()
  @IsIn(PUBLIC_DOCUMENT_KINDS)
  kind?: PublicDocumentKindValue;
}

export class AdminListDocumentsDto extends PublicListDocumentsDto {
  @ApiPropertyOptional({ description: 'Omit to see both drafts and published.' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
