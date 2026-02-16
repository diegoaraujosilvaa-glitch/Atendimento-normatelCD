
import { db } from './firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  Timestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { Ticket, User } from '../types';

/**
 * DataService - Camada de Abstração de Dados via Firebase Firestore
 */
class DataService {
  
  // Helper para converter Timestamps do Firestore para Date do JS
  private static parseFirestoreData(data: any): any {
    const parsed = { ...data };
    Object.keys(parsed).forEach(key => {
      if (parsed[key] instanceof Timestamp) {
        parsed[key] = parsed[key].toDate();
      }
    });
    return parsed;
  }

  /**
   * Função solicitada: getAtendimentos
   * Busca documentos da coleção "atendimentos"
   */
  static async getAtendimentos() {
    try {
      const q = query(collection(db, "atendimentos"), orderBy("criadoEm", "desc"), limit(50));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome,
        status: doc.data().status,
        criadoEm: doc.data().criadoEm instanceof Timestamp ? doc.data().criadoEm.toDate() : doc.data().criadoEm
      }));
    } catch (error) {
      console.error("Erro ao buscar atendimentos:", error);
      return [];
    }
  }

  // --- TICKETS (Integração com o App Atual) ---

  static async getTickets(date: string): Promise<Ticket[]> {
    try {
      const q = query(
        collection(db, "tickets"), 
        where("sessionDate", "==", date),
        orderBy("arrivalTime", "asc")
      );
      const querySnapshot = await getDocs(q);
      const tickets: Ticket[] = [];
      querySnapshot.forEach((doc) => {
        tickets.push({ id: doc.id, ...this.parseFirestoreData(doc.data()) } as Ticket);
      });
      return tickets;
    } catch (e) {
      console.error("Erro ao buscar tickets:", e);
      return [];
    }
  }

  static async addTicket(date: string, ticket: Omit<Ticket, 'id'>): Promise<void> {
    try {
      // Converte datas para Timestamp antes de salvar
      const payload = {
        ...ticket,
        sessionDate: date,
        arrivalTime: Timestamp.fromDate(new Date())
      };
      await addDoc(collection(db, "tickets"), payload);
    } catch (e) {
      console.error("Erro ao adicionar ticket:", e);
    }
  }

  static async updateTicket(date: string, updatedTicket: Ticket): Promise<void> {
    try {
      const { id, ...data } = updatedTicket;
      const ticketRef = doc(db, "tickets", id);
      
      const payload: any = { ...data };
      Object.keys(payload).forEach(key => {
        if (payload[key] instanceof Date) {
          payload[key] = Timestamp.fromDate(payload[key]);
        }
      });

      await updateDoc(ticketRef, payload);
    } catch (e) {
      console.error("Erro ao atualizar ticket:", e);
    }
  }

  static async deleteTicket(date: string, ticketId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "tickets", ticketId));
    } catch (e) {
      console.error("Erro ao deletar ticket:", e);
    }
  }

  // --- USUÁRIOS ---

  static async getUsers(): Promise<User[]> {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (e) {
      console.error("Erro ao buscar usuários:", e);
      return [];
    }
  }

  static async saveUser(user: User): Promise<void> {
    try {
      const { id, ...data } = user;
      await setDoc(doc(db, "users", id), data);
    } catch (e) {
      console.error("Erro ao salvar usuário:", e);
    }
  }

  static async deleteUser(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "users", id));
    } catch (e) {
      console.error("Erro ao remover usuário:", e);
    }
  }
}

export default DataService;
