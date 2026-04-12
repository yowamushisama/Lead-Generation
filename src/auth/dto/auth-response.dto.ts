import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiProperty({ example: 'admin' }) role!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
}

/** Shape returned by POST /auth/register and POST /auth/login */
export class LoginResponseDto {
  @ApiProperty({ description: 'Signed JWT access token' }) accessToken!: string;
  @ApiProperty({ type: () => AuthUserDto }) user!: AuthUserDto;
}

/** register() returns the same shape as login() */
export class RegisterResponseDto extends LoginResponseDto {}

/** Shape returned by POST /auth/refresh — only a new token, no user payload */
export class RefreshResponseDto {
  @ApiProperty({ description: 'Refreshed signed JWT access token' }) accessToken!: string;
}

export class UserProfileOrganizationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Acme Corp' }) name!: string;
  @ApiProperty({ example: 'acme-corp' }) slug!: string;
  @ApiProperty({ example: 'starter' }) tier!: string;
}

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiProperty({ example: 'admin' }) role!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ type: () => UserProfileOrganizationDto }) organization!: UserProfileOrganizationDto;
  @ApiProperty() createdAt!: Date;
}
