import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { CabinetService } from '../common/services/cabinet.service';
import { Role } from '../common/enums';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_EXPIRY_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private refreshRepo: Repository<RefreshToken>,
    private jwtService: JwtService,
    private cabinetService: CabinetService,
  ) {}

  async login(email: string, password: string) {
    console.log('[AUTH LOGIN] attempting email:', JSON.stringify(email));
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      const allEmails = await this.userRepo.find({ select: ['email'] });
      console.log('[AUTH LOGIN] NO USER FOUND. DB has emails:', allEmails.map((u) => JSON.stringify(u.email)));
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }
    console.log('[AUTH LOGIN] user found. hash prefix:', user.passwordHash.substring(0, 15), 'isActive:', user.isActive);

    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte a été désactivé.');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Compte verrouillé. Réessayez dans ${minutes} minute(s).`,
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    console.log('[AUTH LOGIN] bcrypt.compare result:', valid);
    if (!valid) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      }
      await this.userRepo.save(user);
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }

    // Reset failed attempts on success
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await this.userRepo.save(user);
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    const prefix = refreshToken.split('.')[0];
    if (!prefix) {
      throw new UnauthorizedException('Token de rafraîchissement invalide.');
    }

    const stored = await this.refreshRepo.findOne({
      where: { id: prefix, expiresAt: MoreThan(new Date()) },
    });

    if (!stored) {
      throw new UnauthorizedException('Token de rafraîchissement expiré ou invalide.');
    }

    const valid = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!valid) {
      await this.refreshRepo.delete(stored.id);
      throw new UnauthorizedException('Token de rafraîchissement invalide.');
    }

    // Delete used token (single-use)
    await this.refreshRepo.delete(stored.id);

    const user = await this.userRepo.findOne({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur introuvable ou désactivé.');
    }

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const prefix = refreshToken.split('.')[0];
    if (prefix) {
      await this.refreshRepo.delete(prefix);
    }
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    return user;
  }

  /**
   * Initial setup — create the first admin user for this cabinet.
   * Only allowed once (when no users exist).
   */
  async setup(email: string, password: string, firstName: string, lastName: string) {
    const existing = await this.userRepo.count();
    if (existing > 0) {
      throw new ConflictException('Le cabinet est déjà configuré.');
    }

    if (password.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères.');
    }

    const cabinetId = this.cabinetService.getCabinetId();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = this.userRepo.create({
      email,
      passwordHash,
      role: Role.ADMIN,
      cabinetId,
      firstName,
      lastName,
      isActive: true,
    });

    await this.userRepo.save(user);
    this.cabinetService.markSetupComplete();

    return this.generateTokens(user);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect.');

    if (newPassword.length < 8) {
      throw new BadRequestException('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepo.save(user);
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, cabinetId: user.cabinetId, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token: "{uuid}.{random}" for indexed DB lookups
    const tokenId = uuid();
    const randomPart = require('crypto').randomBytes(32).toString('hex');
    const rawRefreshToken = `${tokenId}.${randomPart}`;
    const tokenHash = await bcrypt.hash(rawRefreshToken, BCRYPT_ROUNDS);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRY_DAYS);

    const refreshToken = this.refreshRepo.create({
      id: tokenId,
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    await this.refreshRepo.save(refreshToken);

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
