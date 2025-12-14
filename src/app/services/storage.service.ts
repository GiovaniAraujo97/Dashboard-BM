import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { Emprestimo, Cliente } from './dashboard.service';
import { AuthService } from './auth.service';
import { SupabaseClient } from '@supabase/supabase-js';

interface AppData {
  emprestimos: Emprestimo[];
  clientes: Cliente[];
  lastUpdated: string;
  version: number;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private supabase!: SupabaseClient;
  private userId: string | null = null;
  private readonly LOCAL_STORAGE_KEY = 'bm-emprestimos-data';
  private readonly SYNC_INTERVAL = 30000; // 30 segundos

  private dataSubject = new BehaviorSubject<AppData>(this.getInitialData());
  public data$ = this.dataSubject.asObservable();

  constructor(private auth: AuthService) {
    // inicializar supabase client e estado do usuário
    this.supabase = this.auth.getClient();
    this.initForUser();
    // Inicializar sincronização automática
    this.startAutoSync();
    // Carregar dados locais (fallback)
    this.loadFromLocal();
  }

  private async initForUser() {
    try {
      const session = await this.auth.getSession();
      this.userId = session?.user?.id ?? null;
      if (this.userId) {
        await this.loadFromRemote();
      }
      // escutar mudanças de autenticação
      this.auth.onAuthStateChange(async (_event, session) => {
        this.userId = session?.user?.id ?? null;
        if (this.userId) {
          await this.loadFromRemote();
        } else {
          // usuário saiu — manter apenas local
          this.dataSubject.next(this.getInitialData());
        }
      });
    } catch (err) {
      console.warn('Erro inicializando StorageService auth:', err);
    }
  }

  private getInitialData(): AppData {
    return {
      emprestimos: [],
      clientes: [],
      lastUpdated: new Date().toISOString(),
      version: 1
    };
  }

  // Salvar dados localmente
  private saveToLocal(data: AppData): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar dados localmente:', error);
    }
  }

  // Carregar dados locais
  private loadFromLocal(): AppData {
    try {
      const saved = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.dataSubject.next(data);
        return data;
      }
    } catch (error) {
      console.error('Erro ao carregar dados locais:', error);
    }
    return this.getInitialData();
  }

  // Sincronizar a partir do Supabase (dados por usuário)
  private async loadFromRemote(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data, error } = await this.supabase
        .from('user_data')
        .select('content')
        .eq('user_id', this.userId)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao ler user_data:', error.message || error);
        return;
      }

      if (data && data.content) {
        const remoteData: AppData = data.content;
        this.dataSubject.next(remoteData);
        this.saveToLocal(remoteData);
        console.log('Dados sincronizados do Supabase (por usuário)');
      } else {
        // se não existe registro, criar um inicial
        const initial = this.getInitialData();
        const { error: insertErr } = await this.supabase.from('user_data').insert({ user_id: this.userId, content: initial });
        if (insertErr) console.warn('Erro ao inserir registro inicial user_data:', insertErr.message || insertErr);
      }
    } catch (err) {
      console.error('Erro ao carregar dados remotos:', err);
    }
  }

  // Enviar/atualizar dados no Supabase para o usuário atual
  private async syncToRemote(data: AppData): Promise<void> {
    if (!this.userId) {
      console.warn('Usuário não autenticado — salvando apenas localmente');
      return;
    }
    try {
      // tentar atualizar
      const { data: updated, error: updateError } = await this.supabase
        .from('user_data')
        .update({ content: data, updated_at: new Date().toISOString() })
        .eq('user_id', this.userId)
        .select();

      if (updateError) {
        console.warn('Erro ao atualizar user_data:', updateError.message || updateError);
      }

      if (!updated || (Array.isArray(updated) && updated.length === 0)) {
        // inserir se não havia registro
        const { error: insertErr } = await this.supabase.from('user_data').insert({ user_id: this.userId, content: data });
        if (insertErr) console.warn('Erro ao inserir user_data:', insertErr.message || insertErr);
      }
    } catch (err) {
      console.error('Erro ao sincronizar para Supabase:', err);
    }
  }

  // Iniciar sincronização automática
  private startAutoSync(): void {
    interval(this.SYNC_INTERVAL).subscribe(() => {
      if (this.userId) this.loadFromRemote();
    });
  }

  // Métodos públicos para manipulação de dados
  
  getCurrentData(): AppData {
    return this.dataSubject.value;
  }

  async addCliente(cliente: Cliente): Promise<void> {
    await this.loadFromRemote(); // Garante dado mais recente
    const currentData = this.getCurrentData();
    const newData: AppData = {
      ...currentData,
      clientes: [...currentData.clientes, cliente],
      lastUpdated: new Date().toISOString(),
      version: currentData.version + 1
    };

    this.dataSubject.next(newData);
    this.saveToLocal(newData);
    await this.syncToRemote(newData);
    await this.loadFromRemote();
  }

  async updateCliente(cliente: Cliente): Promise<void> {
    await this.loadFromRemote();
    const currentData = this.getCurrentData();
    const newData: AppData = {
      ...currentData,
      clientes: currentData.clientes.map(c => c.id === cliente.id ? cliente : c),
      lastUpdated: new Date().toISOString(),
      version: currentData.version + 1
    };

    this.dataSubject.next(newData);
    this.saveToLocal(newData);
    await this.syncToRemote(newData);
    await this.loadFromRemote();
  }

  async removeCliente(id: number): Promise<void> {
    await this.loadFromRemote();
    const currentData = this.getCurrentData();
    const newData: AppData = {
      ...currentData,
      clientes: currentData.clientes.filter(c => c.id !== id),
      lastUpdated: new Date().toISOString(),
      version: currentData.version + 1
    };

    this.dataSubject.next(newData);
    this.saveToLocal(newData);
    await this.syncToRemote(newData);
    await this.loadFromRemote();
  }

  async addEmprestimo(emprestimo: Emprestimo): Promise<void> {
    await this.loadFromRemote();
    const currentData = this.getCurrentData();
    const newData: AppData = {
      ...currentData,
      emprestimos: [...currentData.emprestimos, emprestimo],
      lastUpdated: new Date().toISOString(),
      version: currentData.version + 1
    };

    this.dataSubject.next(newData);
    this.saveToLocal(newData);
    await this.syncToRemote(newData);
    await this.loadFromRemote();
  }

  async updateEmprestimo(emprestimo: Emprestimo): Promise<void> {
    await this.loadFromRemote();
    const currentData = this.getCurrentData();
    const newData: AppData = {
      ...currentData,
      emprestimos: currentData.emprestimos.map(e => e.id === emprestimo.id ? emprestimo : e),
      lastUpdated: new Date().toISOString(),
      version: currentData.version + 1
    };

    this.dataSubject.next(newData);
    this.saveToLocal(newData);
    await this.syncToRemote(newData);
    await this.loadFromRemote();
  }

  async removeEmprestimo(id: number): Promise<void> {
    await this.loadFromRemote();
    const currentData = this.getCurrentData();
    const newData: AppData = {
      ...currentData,
      emprestimos: currentData.emprestimos.filter(e => e.id !== id),
      lastUpdated: new Date().toISOString(),
      version: currentData.version + 1
    };

    this.dataSubject.next(newData);
    this.saveToLocal(newData);
    await this.syncToRemote(newData);
    await this.loadFromRemote();
  }

  // Método para forçar sincronização manual
  async forceSync(): Promise<void> {
    await this.loadFromRemote();
  }

  // Método para resetar dados (útil para desenvolvimento)
  async resetData(): Promise<void> {
    const newData = this.getInitialData();
    this.dataSubject.next(newData);
    this.saveToLocal(newData);
    await this.syncToRemote(newData);
  }
}