import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { CabinetService } from '../common/services/cabinet.service';
import { Role } from '../common/enums';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: any;
  let refreshRepo: any;
  let jwtService: any;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'doctor@test.com',
    passwordHash: '',
    role: Role.ADMIN,
    cabinetId: 'cab-1',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    firstName: 'Ali',
    lastName: 'Benali',
  };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('password123', 10);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            create: jest.fn((d: any) => ({ ...d, id: 'new-user' })),
            save: jest.fn((d: any) => Promise.resolve(d)),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((d: any) => d),
            save: jest.fn((d: any) => Promise.resolve(d)),
            delete: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
        {
          provide: CabinetService,
          useValue: {
            getCabinetId: jest.fn().mockReturnValue('cab-1'),
            markSetupComplete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    refreshRepo = module.get(getRepositoryToken(RefreshToken));
    jwtService = module.get(JwtService);
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.login('doctor@test.com', 'password123');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      await expect(service.login('doctor@test.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.login('nobody@test.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when user is inactive', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.login('doctor@test.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when account is locked', async () => {
      const locked = { ...mockUser, lockedUntil: new Date(Date.now() + 60000) };
      userRepo.findOne.mockResolvedValue(locked);
      await expect(service.login('doctor@test.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should increment failedLoginAttempts on wrong password', async () => {
      const user = { ...mockUser, failedLoginAttempts: 0 };
      userRepo.findOne.mockResolvedValue(user);

      try { await service.login('doctor@test.com', 'wrong'); } catch {}

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginAttempts: 1 }),
      );
    });
  });

  describe('setup', () => {
    it('should create admin user on empty database', async () => {
      userRepo.count.mockResolvedValue(0);
      const result = await service.setup('doc@test.com', 'password123', 'Ali', 'Benali');
      expect(result.accessToken).toBeDefined();
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.ADMIN }),
      );
    });

    it('should reject if users already exist', async () => {
      userRepo.count.mockResolvedValue(1);
      await expect(service.setup('doc@test.com', 'password123', 'Ali', 'B')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject short passwords', async () => {
      userRepo.count.mockResolvedValue(0);
      await expect(service.setup('doc@test.com', '123', 'Ali', 'B')).rejects.toThrow();
    });
  });
});
