import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';

interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    organizationId: string;
    role: string;
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user and organization' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email or slug already exists' })
  async register(@Body() dto: RegisterDto): Promise<ApiResponseDto<unknown>> {
    const result = await this.authService.register(dto);
    return ApiResponseDto.success(result, 'Registration successful');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto): Promise<ApiResponseDto<unknown>> {
    const result = await this.authService.login(dto);
    return ApiResponseDto.success(result, 'Login successful');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@Request() req: AuthenticatedRequest): Promise<ApiResponseDto<unknown>> {
    const profile = await this.authService.getProfile(req.user.sub);
    return ApiResponseDto.success(profile);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh JWT token' })
  async refreshToken(@Request() req: AuthenticatedRequest): Promise<ApiResponseDto<unknown>> {
    const result = await this.authService.refreshToken(req.user.sub);
    return ApiResponseDto.success(result, 'Token refreshed');
  }
}
