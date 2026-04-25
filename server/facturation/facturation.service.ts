import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Facture } from './entities/facture.entity';
import { Paiement } from './entities/paiement.entity';
import { CabinetService } from '../common/services/cabinet.service';
import { InvoiceStatus } from '../common/enums';

@Injectable()
export class FacturationService {
  constructor(
    @InjectRepository(Facture) private factureRepo: Repository<Facture>,
    @InjectRepository(Paiement) private paiementRepo: Repository<Paiement>,
    private cabinetService: CabinetService,
  ) {}

  async createInvoice(data: Partial<Facture>): Promise<Facture> {
    const cabinetId = this.cabinetService.getCabinetId();
    const numero = await this.generateNumber(cabinetId);
    const facture = this.factureRepo.create({ ...data, cabinetId, numero });
    return this.factureRepo.save(facture);
  }

  async findAll(cabinetId: string) {
    return this.factureRepo.find({ where: { cabinetId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, cabinetId: string): Promise<Facture> {
    const f = await this.factureRepo.findOne({ where: { id, cabinetId } });
    if (!f) throw new NotFoundException('Facture introuvable.');
    return f;
  }

  async recordPayment(factureId: string, cabinetId: string, data: Partial<Paiement>): Promise<Facture> {
    const facture = await this.findOne(factureId, cabinetId);

    if (facture.statut === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Impossible d\'enregistrer un paiement sur une facture annulée.');
    }

    const paiement = this.paiementRepo.create({
      ...data,
      factureId: facture.id,
      datePaiement: new Date(),
    });
    await this.paiementRepo.save(paiement);

    // Update paid amount
    const totalPaid = await this.paiementRepo
      .createQueryBuilder('p')
      .select('SUM(p.montant)', 'total')
      .where('p.factureId = :factureId', { factureId })
      .getRawOne();

    facture.montantPaye = totalPaid?.total || 0;
    facture.statut =
      facture.montantPaye >= facture.montantTotal
        ? InvoiceStatus.PAID
        : facture.montantPaye > 0
          ? InvoiceStatus.PARTIAL
          : InvoiceStatus.UNPAID;

    return this.factureRepo.save(facture);
  }

  private async generateNumber(cabinetId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FAC-${year}-`;
    const last = await this.factureRepo.createQueryBuilder('f')
      .where('f.cabinetId = :cabinetId', { cabinetId })
      .andWhere('f.numero LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('f.numero', 'DESC').getOne();
    let seq = 1;
    if (last) seq = parseInt(last.numero.replace(prefix, ''), 10) + 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
