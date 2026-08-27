import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'admin@barff.uz' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'validation.email.invalid' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'a-long-passphrase', writeOnly: true })
  // Presence only. Applying the strength rules here would leak the policy to
  // anyone probing the login form, and would lock out users whose password
  // predates a policy change.
  @IsString()
  @MinLength(1, { message: 'validation.password.required' })
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    description: 'Reserved for a longer refresh lifetime. Not yet honoured.',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
