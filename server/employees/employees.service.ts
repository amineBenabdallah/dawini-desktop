import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../auth/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { CabinetService } from '../common/services/cabinet.service';
import { Role } from '../common/enums';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private refreshRepo: Repository<RefreshToken>,
    private cabinetService: CabinetService,
  ) {}

  async findAll(cabinetId: string): Promise<User[]> {
    return this.userRepo.find({ where: { cabinetId }, order: { lastName: 'ASC' } });
  }

  /**
   * Invite flow: create account with a generated temp password.
   * No email server needed — admin shares the password verbally.
   */
  async invite(data: { email: string; role: Role }): Promise<{ tempPassword: string }> {
    const cabinetId = this.cabinetService.getCabinetId();
    const existing = await this.userRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Cet email est déjà utilisé.');

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = this.userRepo.create({
      email: data.email,
      passwordHash,
      role: data.role,
      cabinetId,
      firstName: null,
      lastName: null,
      isActive: true,
    });
    await this.userRepo.save(user);

    return { tempPassword };
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  /**
   * Desktop: create employee directly (no email invite needed).
   */
  async create(
    data: { email: string; password: string; role: Role; firstName: string; lastName: string },
  ): Promise<User> {
    const cabinetId = this.cabinetService.getCabinetId();
    const existing = await this.userRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Cet email est déjà utilisé.');

    if (data.password.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères.');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = this.userRepo.create({
      email: data.email,
      passwordHash,
      role: data.role,
      cabinetId,
      firstName: data.firstName,
      lastName: data.lastName,
      isActive: true,
    });

    return this.userRepo.save(user);
  }

  async toggleActive(id: string, cabinetId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, cabinetId } });
    if (!user) throw new NotFoundException('Employé introuvable.');

    user.isActive = !user.isActive;

    // If deactivating, revoke all refresh tokens for immediate session kill
    if (!user.isActive) {
      await this.refreshRepo.delete({ userId: user.id });
    }

    return this.userRepo.save(user);
  }

  async changeRole(id: string, cabinetId: string, role: Role): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, cabinetId } });
    if (!user) throw new NotFoundException('Employé introuvable.');
    user.role = role;
    return this.userRepo.save(user);
  }

  async updateShifts(
    id: string,
    cabinetId: string,
    shifts: { day: number; start: string; end: string }[],
  ): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, cabinetId } });
    if (!user) throw new NotFoundException('Employé introuvable.');
    user.shifts = shifts;
    return this.userRepo.save(user);
  }
}
