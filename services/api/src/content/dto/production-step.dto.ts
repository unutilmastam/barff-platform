import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { LocalizedRichTextDto, LocalizedTextDto } from '../../common/dto/localized.dto.js';

/**
 * Production steps are edited, never created or deleted through the API.
 *
 * The eight stages and their order come from `CLAUDE.md` §4 and are seeded.
 * They describe how BARFF makes juice; that is not something a CMS user should
 * be able to add a ninth of, or quietly drop one from, by clicking around in
 * the admin panel. What an editor legitimately changes is the wording, the
 * photograph and whether a stage is shown.
 */
export class UpdateProductionStepDto {
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

  @ApiPropertyOptional({ description: 'Factory photograph from the media library. Q-012.' })
  @IsOptional()
  @IsUUID()
  mediaAssetId?: string;

  @ApiPropertyOptional({ description: 'Position in the process.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
