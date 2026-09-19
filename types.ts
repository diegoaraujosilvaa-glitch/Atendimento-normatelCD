
export enum Priority {
  NORMAL = 'NORMAL',
  PRIORITY = 'PRIORITÁRIO'
}

export enum ClientType {
  CLIENT = 'Cliente',
  REPRESENTATIVE = 'Representante',
  FREIGHT = 'Frete'
}

export enum VehicleType {
  PASSENGER = 'Veículo de Passeio',
  MOTORCYCLE = 'Motocicleta',
  PICKUP = 'Pickup',
  TRUCK = 'Caminhão',
  VAN = 'Van'
}

export enum TicketStatus {
  WAITING_SEPARATION = 'Aguardando separação',
  IN_SEPARATION = 'Separação em andamento',
  READY = 'Pronto para atendimento',
  CALLED = 'Chamado para atendimento',
  FINISHED = 'Atendimento finalizado',
  CANCELLED = 'Atendimento cancelado'
}

export interface Ticket {
  id: string;
  password: string;
  customerName: string;
  collectorName?: string;
  priority: Priority;
  clientType: ClientType;
  vehicleType: VehicleType;
  orderNumber: string;
  arrivalTime: Date;
  status: TicketStatus;
  separationStartTime?: Date;
  separationEndTime?: Date;
  callTime?: Date;
  finishTime?: Date;
  cancelTime?: Date;
  cancelReason?: string;
}

export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  name: string;
}

export type AppModule = 'reception' | 'separation' | 'dashboard' | 'reports' | 'users' | 'prisma';

export type PrismaClientType = 'CLIENTE' | 'FRETE';

export interface PrismaTargetConfig {
  clientTargetMinutes: number;
  freightTargetMinutes: number;
}

export interface PrismaEntry {
  id: string;
  sessionDate: string;
  clientType: PrismaClientType;
  plate: string;
  orderNumber: string;
  vehicleType: string;
  driverName?: string;
  entryTime: Date;
  exitTime?: Date;
  durationMinutes?: number;
  status: 'IN_CD' | 'COMPLETED' | 'CANCELLED';
  problemJustification?: string;
  targetMinutes: number;
  withinTarget?: boolean;
  registeredBy?: string;
}
