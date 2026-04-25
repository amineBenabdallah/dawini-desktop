// Desktop edition — no SubscriptionPlan/SubscriptionStatus, no SUPER_ADMIN role

export enum Gender {
  M = 'M',
  F = 'F',
}

export enum AppointmentStatus {
  PLANNED = 'PLANNED',
  CONFIRMED = 'CONFIRMED',
  WAITING = 'WAITING',
  DONE = 'DONE',
  ABSENT = 'ABSENT',
  CANCELLED = 'CANCELLED',
}

export enum ConsultationStatus {
  EN_ATTENTE = 'EN_ATTENTE',
  OPEN = 'OPEN',
  FINALIZED = 'FINALIZED',
}

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  ESPECES = 'ESPECES',
  CHEQUE = 'CHEQUE',
  VIREMENT = 'VIREMENT',
  EDAHABIA = 'EDAHABIA',
  BARIDIMOB = 'BARIDIMOB',
  CIB = 'CIB',
  NONE = 'NONE',
}

export enum CertificatType {
  REPOS = 'REPOS',
  APTITUDE = 'APTITUDE',
  INAPTITUDE = 'INAPTITUDE',
  SCOLAIRE = 'SCOLAIRE',
}

export enum OrdonnanceStatus {
  ACTIVE = 'ACTIVE',
  ANNULEE = 'ANNULEE',
}

export enum CertificatStatus {
  ACTIVE = 'ACTIVE',
  ANNULEE = 'ANNULEE',
}

export enum QueueTokenStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  CALLED_MANUAL = 'CALLED_MANUAL',
  DONE = 'DONE',
  ABSENT = 'ABSENT',
}

export enum QueueTokenType {
  APPOINTMENT = 'APPOINTMENT',
  WALK_IN = 'WALK_IN',
}

export enum DeviceHint {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  UNKNOWN = 'UNKNOWN',
}

export enum AuditAction {
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum AuditResource {
  PATIENT = 'PATIENT',
  CONSULTATION = 'CONSULTATION',
  ORDONNANCE = 'ORDONNANCE',
  CERTIFICAT = 'CERTIFICAT',
  FACTURE = 'FACTURE',
}

export enum Role {
  ADMIN = 'ADMIN',
  DOCTEUR = 'DOCTEUR',
  SECRETAIRE = 'SECRETAIRE',
  EMPLOYE = 'EMPLOYE',
}
