import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SortableQueryDto } from '../../common/dto/sort-query.dto.js';

export const MEDIA_KINDS = ['IMAGE', 'DOCUMENT', 'VIDEO'] as const;
export const MEDIA_VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const;

export class UploadMediaDto {
  @ApiPropertyOptional({
    enum: MEDIA_VISIBILITIES,
    default: 'PRIVATE',
    description:
      'PRIVATE unless explicitly published. A caller that forgets this gets the safe option.',
  })
  @IsOptional()
  @IsIn(MEDIA_VISIBILITIES)
  visibility?: (typeof MEDIA_VISIBILITIES)[number];

  @ApiPropertyOptional({ description: 'Localized alt text as JSON, e.g. {"uz":"…","ru":"…"}.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  altText?: string;

  @ApiPropertyOptional({ description: 'Localized title as JSON.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  title?: string;
}

export class ListMediaDto extends SortableQueryDto(
  ['createdAt', 'sizeBytes'] as const,
  'createdAt',
) {
  @ApiPropertyOptional({ enum: MEDIA_KINDS })
  @IsOptional()
  @IsIn(MEDIA_KINDS)
  kind?: (typeof MEDIA_KINDS)[number];

  @ApiPropertyOptional({ enum: MEDIA_VISIBILITIES })
  @IsOptional()
  @IsIn(MEDIA_VISIBILITIES)
  visibility?: (typeof MEDIA_VISIBILITIES)[number];

  @ApiPropertyOptional({ description: 'Substring match on the original filename.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Type(() => String)
  q?: string;
}

export class MediaVariantDto {
  @ApiProperty({ example: '600.webp' }) label!: string;
  @ApiProperty({ example: 'webp' }) format!: string;
  @ApiProperty({ example: 600 }) width!: number;
  @ApiProperty({ example: 600 }) height!: number;
  @ApiProperty({ example: 48213 }) sizeBytes!: number;
  @ApiProperty({ description: 'Signed for private assets, CDN URL for public ones.' })
  url!: string;
}

export class MediaAssetDto {
  @ApiProperty() id!: string;
  @ApiProperty() originalFilename!: string;
  @ApiProperty({ description: 'Detected from magic bytes, not from the filename.' })
  mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ enum: MEDIA_KINDS }) kind!: string;
  @ApiProperty({ enum: MEDIA_VISIBILITIES }) visibility!: string;
  @ApiPropertyOptional({ nullable: true }) width?: number | null;
  @ApiPropertyOptional({ nullable: true }) height?: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Inline base64 blur placeholder.' })
  blurDataUrl?: string | null;
  @ApiProperty({ type: [MediaVariantDto] }) variants!: MediaVariantDto[];
  @ApiProperty({ description: 'Signed URL for the original. Expires.' }) url!: string;
  @ApiProperty() createdAt!: string;
}
