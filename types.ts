
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
  FINISHED = 'Atendimento finalizado'
}

export interface Ticket {
  id: string;
  password: string;
  customerName: string;
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
}

export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  name: string;
}

export type AppModule = 'reception' | 'separation' | 'dashboard' | 'reports' | 'users';
