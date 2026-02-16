
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
   * Assina atualizações em tempo real para os tickets da data selecionada
   * CRÍTICO: Garante que o doc.id seja o ID REAL do Firestore
   */
  static subscribeTickets(date: string, callback: (tickets: Ticket[]) => void) {
    const q = query(
      collection(db, "tickets"), 
      where("sessionDate", "==", date),
      orderBy("arrivalTime", "asc")
    );

    return onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(document => {
        const data = document.data();
        return {
          ...this.parseFirestoreData(data),
          id: document.id // Garante o ID real do documento para operações posteriores
        } as Ticket;
      });
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
        arrivalTime: Timestamp.fromDate(new Date())
      };
      const docRef = await addDoc(collection(db, "tickets"), payload);
      console.log("Ticket criado com ID:", docRef.id);
    } catch (e) {
      console.error("Erro ao adicionar ticket:", e);
    }
  }

  /**
   * Atualiza um ticket existente
   * CRÍTICO: Usa doc(db, "tickets", id) com o ID capturado via onSnapshot
   */
  static async updateTicket(date: string, updatedTicket: Ticket): Promise<void> {
    try {
      const { id, ...data } = updatedTicket;
      
      console.log("Tentando atualizar ticket com ID:", id);
      
      if (!id || id.length < 5) {
        console.error("ERRO: Tentativa de atualizar ticket com ID inválido ou ausente.");
        return;
      }

      const ticketRef = doc(db, "tickets", id);
      
      const payload: any = { ...data };
      Object.keys(payload).forEach(key => {
        if (payload[key] instanceof Date) {
          payload[key] = Timestamp.fromDate(payload[key]);
        }
      });

      await updateDoc(ticketRef, payload);
      console.log(`Sucesso: Ticket ${id} atualizado.`);
    } catch (e: any) {
      console.error("Falha ao atualizar ticket no Firestore:", e);
      if (e.code === 'not-found') {
        console.error(`Documento com ID ${updatedTicket.id} não existe na coleção 'tickets'.`);
      }
    }
  }

  static async deleteTicket(date: string, ticketId: string): Promise<void> {
    try {
      console.log("Deletando ticket ID:", ticketId);
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
