import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { SupabaseService } from '../database/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: string;
}

interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    organizationId: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existingUser = await this.prismaService.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const existingOrg = await this.prismaService.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });

    if (existingOrg) {
      throw new ConflictException('Organization slug already taken');
    }

    const supabaseUser = await this.supabaseService.createUser(dto.email, dto.password);
    if (!supabaseUser) {
      throw new ConflictException('Failed to create authentication account');
    }

    let organization: Awaited<ReturnType<typeof this.prismaService.organization.create>>;
    let user: Awaited<ReturnType<typeof this.prismaService.user.create>>;

    try {
      // Both Prisma writes in a single transaction so partial failures are impossible
      const result = await this.prismaService.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: dto.organizationName,
            slug: dto.organizationSlug,
          },
        });

        const u = await tx.user.create({
          data: {
            email: dto.email,
            name: dto.name,
            role: 'admin',
            supabaseUserId: supabaseUser.id,
            organizationId: org.id,
          },
        });

        return { org, u };
      });

      organization = result.org;
      user = result.u;
    } catch (txError) {
      // Compensate: delete the Supabase user so the email can be retried
      await this.supabaseService.deleteUser(supabaseUser.id);
      this.logger.error({
        message: 'Registration rolled back — Supabase user deleted after Prisma failure',
        module: 'AuthService',
        email: dto.email,
        error: txError instanceof Error ? txError.message : String(txError),
      });
      throw txError;
    }

    this.logger.log({
      message: 'User registered',
      module: 'AuthService',
      userId: user.id,
      organizationId: organization.id,
    });

    const accessToken = this.generateToken({
      sub: user.id,
      email: user.email,
      organizationId: organization.id,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: organization.id,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const { data, error } = await this.supabaseService.getAnonClient().auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.prismaService.user.findUnique({
      where: { email: dto.email },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    const accessToken = this.generateToken({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    });

    this.logger.log({
      message: 'User logged in',
      module: 'AuthService',
      userId: user.id,
      organizationId: user.organizationId,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    };
  }

  async getProfile(userId: string): Promise<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    organizationId: string;
    organization: { id: string; name: string; slug: string; tier: string };
    createdAt: Date;
  }> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        tier: user.organization.tier,
      },
      createdAt: user.createdAt,
    };
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = this.generateToken({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    });

    return { accessToken };
  }

  async validateUser(userId: string): Promise<boolean> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    return !!user;
  }

  private generateToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }
}
