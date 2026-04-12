export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

/** Shape returned by the Nest ApiResponseDto.success() wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}
