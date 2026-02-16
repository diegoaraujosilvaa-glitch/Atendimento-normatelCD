
import { Ticket, User, TicketStatus } from '../types';

/**
 * DataService - Camada de Abstração de Dados
 * Esta classe centraliza todas as chamadas de dados do sistema.
 * Atualmente utiliza LocalStorage para persistência, mas está preparada
 * para integração imediata com Firebase, Supabase ou API REST.
 */
class DataService {
  private static async delay(ms: number = 300) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- TICKETS ---

  static async getTickets(date: string): Promise<Ticket[]> {
    await this.delay(); // Simula latência de rede
    const key = `normatel_tickets_${date}`;
    const saved = localStorage.getItem(key);
    if (!saved) return [];
    
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((t: any) => ({
        ...t,
        arrivalTime: new Date(t.arrivalTime),
        separationStartTime: t.separationStartTime ? new Date(t.separationStartTime) : undefined,
        separationEndTime: t.separationEndTime ? new Date(t.separationEndTime) : undefined,
        callTime: t.callTime ? new Date(t.callTime) : undefined,
        finishTime: t.finishTime ? new Date(t.finishTime) : undefined,
      }));
    } catch (e) {
      console.error("Erro ao ler tickets:", e);
      return [];
    }
  }

  static async saveTickets(date: string, tickets: Ticket[]): Promise<void> {
    await this.delay(150);
    const key = `normatel_tickets_${date}`;
    localStorage.setItem(key, JSON.stringify(tickets));
  }

  static async addTicket(date: string, ticket: Ticket): Promise<void> {
    const tickets = await this.getTickets(date);
    tickets.push(ticket);
    await this.saveTickets(date, tickets);
  }

  static async updateTicket(date: string, updatedTicket: Ticket): Promise<void> {
    const tickets = await this.getTickets(date);
    const index = tickets.findIndex(t => t.id === updatedTicket.id);
    if (index !== -1) {
      tickets[index] = updatedTicket;
      await this.saveTickets(date, tickets);
    }
  }

  static async deleteTicket(date: string, ticketId: string): Promise<void> {
    const tickets = await this.getTickets(date);
    const filtered = tickets.filter(t => t.id !== ticketId);
    await this.saveTickets(date, filtered);
  }

  // --- USUÁRIOS ---

  static async getUsers(): Promise<User[]> {
    await this.delay();
    const saved = localStorage.getItem('normatel_users');
    return saved ? JSON.parse(saved) : [];
  }

  static async saveUsers(users: User[]): Promise<void> {
    await this.delay(200);
    localStorage.setItem('normatel_users', JSON.stringify(users));
  }
}

export default DataService;
