import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  error?: string;

  @ApiProperty()
  timestamp: string;

  @ApiPropertyOptional()
  correlationId?: string;

  constructor(partial: Partial<ApiResponseDto<T>>) {
    this.success = partial.success ?? true;
    this.data = partial.data;
    this.message = partial.message;
    this.error = partial.error;
    this.timestamp = partial.timestamp ?? new Date().toISOString();
    this.correlationId = partial.correlationId;
  }

  static success<T>(data: T, message?: string, correlationId?: string): ApiResponseDto<T> {
    return new ApiResponseDto<T>({
      success: true,
      data,
      message,
      correlationId,
    });
  }

  static error<T>(error: string, message?: string, correlationId?: string): ApiResponseDto<T> {
    return new ApiResponseDto<T>({
      success: false,
      error,
      message,
      correlationId,
    });
  }
}
