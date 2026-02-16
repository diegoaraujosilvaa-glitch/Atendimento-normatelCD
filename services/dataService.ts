
import { db } from './firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
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
 * DataService - Camada de Abstração de Dados via Firebase Firestore (Tempo Real)
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
   * Assina atualizações em tempo real para a coleção "atendimentos"
   */
  static subscribeAtendimentos(callback: (data: any[]) => void) {
    const q = query(collection(db, "atendimentos"), orderBy("criadoEm", "desc"), limit(50));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...this.parseFirestoreData(doc.data())
      }));
      callback(data);
    });
  }

  /**
   * Assina atualizações em tempo real para os tickets da data selecionada
   */
  static subscribeTickets(date: string, callback: (tickets: Ticket[]) => void) {
    const q = query(
      collection(db, "tickets"), 
      where("sessionDate", "==", date),
      orderBy("arrivalTime", "asc")
    );

    return onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        id: doc.id, 
        ...this.parseFirestoreData(doc.data()) 
      } as Ticket));
      callback(tickets);
    }, (error) => {
      console.error("Erro na escuta em tempo real:", error);
    });
  }

  // --- MÉTODOS DE ESCRITA ---

  static async addTicket(date: string, ticket: Omit<Ticket, 'id'>): Promise<void> {
    try {
      const payload = {
        ...ticket,
        sessionDate: date,
        // Garante que o Firestore salve como Timestamp para ordenação correta
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
      // Converte quaisquer objetos Date de volta para Timestamp antes do update
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

  static subscribeUsers(callback: (users: User[]) => void) {
    return onSnapshot(collection(db, "users"), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      callback(users);
    });
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
