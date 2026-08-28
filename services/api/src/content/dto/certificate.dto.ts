import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ToBoolean } from '../../common/dto/to-boolean.decorator.js';
import { LocalizedRichTextDto, LocalizedTextDto } from '../../common/dto/localized.dto.js';

/**
 * A certificate row.
 *
 * Issuer, number and dates are all optional. They are BARFF facts nobody has
 * supplied yet (Q-002, Q-013), and requiring them would force whoever enters
 * the first row to invent one. `CLAUDE.md` §19 is explicit: never generate a
 * certificate that does not exist.
 */
export class CreateCertificateDto {
  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title!: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedRichTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedRichTextDto)
  description?: LocalizedRichTextDto;

  @ApiPropertyOptional({ description: 'Issuing body. Q-002.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuer?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) certificateNumber?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 date.' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 date.' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'PDF scan from the media library.' })
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() imageId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateCertificateDto {
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

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) issuer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) certificateNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() issuedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() documentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() imageId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
}

/** Admin listing filter. The public listing takes no parameters at all. */
export class AdminListCertificatesDto {
  @ApiPropertyOptional({ description: 'Omit to see both drafts and published.' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
