
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
  getDoc,
  Timestamp,
  orderBy,
  limit,
  runTransaction
} from "firebase/firestore";
import { Ticket, User, Priority, TicketStatus, PrismaEntry, PrismaTargetConfig } from '../types';

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

  // Helper para limpar campos undefined antes de enviar ao Firestore (evita erros do SDK)
  private static cleanFirestorePayload(data: Record<string, any>): Record<string, any> {
    const clean: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val === undefined) continue;
      if (val instanceof Date) {
        clean[key] = Timestamp.fromDate(val);
      } else {
        clean[key] = val;
      }
    }
    return clean;
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

  /**
   * Cria um novo ticket com numeração sequencial atômica e independente por fila (Normal e Prioritário).
   * 
   * Resolve:
   * 1. Filas separadas: Normal (N-001, N-002...) e Prioritário (P-001, P-002...) sem pular números
   * 2. Persistência de sequência: Exclusão ou cancelamento de senhas antigas não quebra nem retrocede a ordem
   * 3. Concorrência: Transação atômica no Firestore evita senhas duplicadas entre múltiplos operadores
   */
  static async createSequentialTicket(
    date: string,
    ticketData: Omit<Ticket, 'id' | 'password' | 'arrivalTime' | 'status'>,
    existingTickets: Ticket[] = []
  ): Promise<string> {
    const isPriority = ticketData.priority === Priority.PRIORITY;
    const prefix = isPriority ? 'P' : 'N';
    const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');

    // 1. Identifica o maior número existente na lista atual de tickets do dia
    let maxInTickets = 0;
    for (const t of existingTickets) {
      if (t.password) {
        const match = t.password.match(regex);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxInTickets) {
            maxInTickets = num;
          }
        }
      }
    }

    // 2. Proteção local no navegador contra cancelamentos/exclusões que poderiam reduzir a lista
    const localKey = `normatel_seq_${prefix}_${date}`;
    let localMax = 0;
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) localMax = parseInt(saved, 10) || 0;
    } catch (e) {}

    const counterRef = doc(db, "daily_counters", date);
    let finalPassword = '';

    try {
      // 3. Executa transação atômica no Firestore para sincronizar todos os operadores em tempo real
      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let lastN = 0;
        let lastP = 0;

        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (typeof data.lastN === 'number') lastN = data.lastN;
          if (typeof data.lastP === 'number') lastP = data.lastP;
        }

        let nextNum: number;
        if (isPriority) {
          nextNum = Math.max(lastP, maxInTickets, localMax) + 1;
          lastP = nextNum;
        } else {
          nextNum = Math.max(lastN, maxInTickets, localMax) + 1;
          lastN = nextNum;
        }

        finalPassword = `${prefix}-${nextNum.toString().padStart(3, '0')}`;

        transaction.set(counterRef, {
          sessionDate: date,
          lastN,
          lastP,
          updatedAt: Timestamp.now()
        }, { merge: true });

        const ticketDocRef = doc(collection(db, "tickets"));
        const payload = {
          ...ticketData,
          password: finalPassword,
          sessionDate: date,
          status: TicketStatus.WAITING_SEPARATION,
          arrivalTime: Timestamp.now()
        };
        transaction.set(ticketDocRef, payload);
      });

      try {
        const generatedNum = parseInt(finalPassword.split('-')[1], 10);
        if (!isNaN(generatedNum)) {
          localStorage.setItem(localKey, generatedNum.toString());
        }
      } catch (e) {}

      return finalPassword;
    } catch (err) {
      console.warn("Transação atômica falhou ou indisponível, usando fallback seguro:", err);
      // Fallback seguro caso haja regras de permissão ou oscilação de rede
      const nextNum = Math.max(maxInTickets, localMax) + 1;
      finalPassword = `${prefix}-${nextNum.toString().padStart(3, '0')}`;

      try {
        localStorage.setItem(localKey, nextNum.toString());
      } catch (e) {}

      const payload = {
        ...ticketData,
        password: finalPassword,
        sessionDate: date,
        status: TicketStatus.WAITING_SEPARATION,
        arrivalTime: Timestamp.fromDate(new Date())
      };
      await addDoc(collection(db, "tickets"), payload);
      return finalPassword;
    }
  }

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

  // --- MÓDULO PRISMA (PORTARIA DO CD) ---

  /**
   * Assina em tempo real os registros do módulo PRISMA para a data da sessão
   * Ordena em memória para dispensar índices compostos manuais no Firestore
   */
  static subscribePrismaEntries(date: string, callback: (entries: PrismaEntry[]) => void) {
    const q = query(
      collection(db, "prisma_entries"),
      where("sessionDate", "==", date)
    );

    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(document => {
        const data = document.data();
        return {
          ...this.parseFirestoreData(data),
          id: document.id
        } as PrismaEntry;
      }).sort((a, b) => {
        const timeA = a.entryTime ? new Date(a.entryTime).getTime() : 0;
        const timeB = b.entryTime ? new Date(b.entryTime).getTime() : 0;
        return timeB - timeA; // Mais recente primeiro
      });
      callback(entries);
    }, (error) => {
      console.error("Erro na escuta em tempo real do PRISMA:", error);
    });
  }

  /**
   * Registra a entrada de um veículo no portão do CD
   */
  static async addPrismaEntry(
    date: string, 
    entryData: Omit<PrismaEntry, 'id' | 'entryTime' | 'status'>
  ): Promise<string> {
    try {
      const rawPayload: any = {
        ...entryData,
        sessionDate: date,
        status: 'IN_CD',
        entryTime: Timestamp.now()
      };

      const payload = this.cleanFirestorePayload(rawPayload);
      const docRef = await addDoc(collection(db, "prisma_entries"), payload);
      return docRef.id;
    } catch (e) {
      console.error("Erro ao adicionar registro PRISMA:", e);
      throw e;
    }
  }

  /**
   * Atualiza um registro do PRISMA (por exemplo, finalizando saída ou justificando problema)
   */
  static async updatePrismaEntry(updatedEntry: PrismaEntry): Promise<void> {
    try {
      const { id, ...data } = updatedEntry;
      if (!id) return;

      const entryRef = doc(db, "prisma_entries", id);
      const payload = this.cleanFirestorePayload(data);

      await updateDoc(entryRef, payload);
    } catch (e) {
      console.error("Erro ao atualizar registro PRISMA:", e);
      throw e;
    }
  }

  /**
   * Finaliza a saída do veículo pelo portão do CD
   */
  static async completePrismaExit(
    entry: PrismaEntry, 
    problemJustification?: string
  ): Promise<void> {
    try {
      const exitDate = new Date();
      const entryDate = new Date(entry.entryTime);
      const durationMinutes = Math.max(1, Math.round((exitDate.getTime() - entryDate.getTime()) / 60000));
      const withinTarget = durationMinutes <= entry.targetMinutes;

      const rawPayload: any = {
        status: 'COMPLETED',
        exitTime: Timestamp.fromDate(exitDate),
        durationMinutes,
        withinTarget
      };

      if (problemJustification && problemJustification.trim()) {
        rawPayload.problemJustification = problemJustification.trim();
      }

      const payload = this.cleanFirestorePayload(rawPayload);
      const entryRef = doc(db, "prisma_entries", entry.id);
      await updateDoc(entryRef, payload);
    } catch (e) {
      console.error("Erro ao finalizar saída no PRISMA:", e);
      throw e;
    }
  }

  /**
   * Remove um registro do PRISMA
   */
  static async deletePrismaEntry(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "prisma_entries", id));
    } catch (e) {
      console.error("Erro ao deletar registro PRISMA:", e);
      throw e;
    }
  }

  /**
   * Escuta a configuração de metas do PRISMA (CLIENTE e FRETE)
   */
  static subscribePrismaTargets(callback: (config: PrismaTargetConfig) => void) {
    const defaultTargets: PrismaTargetConfig = {
      clientTargetMinutes: 45,
      freightTargetMinutes: 90
    };

    const docRef = doc(db, "system_settings", "prisma_targets");
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          clientTargetMinutes: Number(data.clientTargetMinutes) || 45,
          freightTargetMinutes: Number(data.freightTargetMinutes) || 90
        });
      } else {
        // Inicializa se não existir
        callback(defaultTargets);
      }
    }, (err) => {
      console.warn("Erro ao buscar metas PRISMA, usando padrão:", err);
      callback(defaultTargets);
    });
  }

  /**
   * Salva novas metas de tempo de permanência do PRISMA
   */
  static async savePrismaTargets(config: PrismaTargetConfig): Promise<void> {
    try {
      const docRef = doc(db, "system_settings", "prisma_targets");
      await setDoc(docRef, {
        clientTargetMinutes: Math.max(1, Number(config.clientTargetMinutes) || 45),
        freightTargetMinutes: Math.max(1, Number(config.freightTargetMinutes) || 90),
        updatedAt: Timestamp.now()
      }, { merge: true });
    } catch (e) {
      console.error("Erro ao salvar metas do PRISMA:", e);
      throw e;
    }
  }
}

export default DataService;
