import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Slug format, shared by every addressable record.
 *
 * Matches `isValidSlug` in `@barff/utils` — lowercase, digits, single hyphens.
 * The pattern is repeated here because class-validator needs a literal, and the
 * two are asserted to agree in `slug-pattern.test.ts` rather than trusted to.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Relative path, for anything an editor types as a link target.
 *
 * Absolute URLs are refused on purpose: a CMS field that accepts `https://…`
 * is an open-redirect surface, and every legitimate call to action on this site
 * points at one of our own routes.
 *
 * The `(?!\/)` matters as much as the leading slash. `//evil.example` is a
 * protocol-relative URL — a browser resolves it against the current scheme and
 * navigates off-site — and it satisfies "starts with a slash" perfectly well.
 * That is the standard way an open-redirect filter gets walked past.
 * Backslashes are excluded for the same reason: several browsers normalise
 * `\\` to `//`.
 */
export const RELATIVE_PATH_PATTERN = /^\/(?!\/)[A-Za-z0-9\-._~/]*$/;

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

/** Longer localized copy — descriptions, ingredients, storage, captions. */
export class LocalizedRichTextDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) uz?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) ru?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) en?: string;
}

/**
 * Article-length localized copy.
 *
 * Separate from `LocalizedRichTextDto` rather than raising that limit: a news
 * body is legitimately long, a product description is not, and one shared cap
 * would have to be the looser of the two everywhere.
 */
export class LocalizedBodyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50_000) uz?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50_000) ru?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50_000) en?: string;
}
