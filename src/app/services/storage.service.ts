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
  private supabase: SupabaseClient | null = null;
  private userId: string | null = null;
  private readonly LOCAL_STORAGE_KEY = 'bm-emprestimos-data';
  private readonly SYNC_INTERVAL = 30000; // 30 segundos

  private dataSubject = new BehaviorSubject<AppData>(this.getInitialData());
  public data$ = this.dataSubject.asObservable();

  constructor(private auth: AuthService) {
    // carregar dados locais imediatamente (modo fallback)
    this.loadFromLocal();

    // inicializar supabase client se disponível e então estado do usuário
    this.supabase = this.auth.getClient();
    if (this.supabase) {
      this.initForUser();
      // Inicializar sincronização automática
      this.startAutoSync();
    } else {
      console.warn('StorageService: Supabase não disponível — usando apenas localStorage');
    }
  }

  private async initForUser() {
    try {
      const session = await this.auth.getSession();
      this.userId = session?.user?.id ?? null;
      if (this.userId) {
        await this.loadFromRemote();
      }
      // escutar mudanças de autenticação
      this.auth.onAuthStateChange(async (_event: string, session: any) => {
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
        const parsed = JSON.parse(saved);
        const data = this.normalizeAppData(parsed);
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
    if (!this.userId || !this.supabase) return;
    try {
      const { data, error } = await this.supabase!
        .from('user_data')
        .select('content')
        .eq('user_id', this.userId)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao ler user_data:', error.message || error);
        return;
      }

      if (data && data.content) {
        const remoteData: Partial<AppData> = data.content;
        // Mesclar com valores iniciais para garantir arrays e campos presentes
        const mergedRaw: AppData = {
          ...this.getInitialData(),
          ...remoteData,
          emprestimos: remoteData.emprestimos ?? this.getInitialData().emprestimos,
          clientes: remoteData.clientes ?? this.getInitialData().clientes,
          lastUpdated: remoteData.lastUpdated ?? this.getInitialData().lastUpdated,
          version: remoteData.version ?? this.getInitialData().version
        } as AppData;

        const merged = this.normalizeAppData(mergedRaw);

        this.dataSubject.next(merged);
        this.saveToLocal(merged);
        console.log('Dados sincronizados do Supabase (por usuário) — merged com defaults');
      } else {
        // se não existe registro, criar um inicial
        const initial = this.getInitialData();
        const { error: insertErr } = await this.supabase!.from('user_data').insert({ user_id: this.userId, content: initial });
        if (insertErr) console.warn('Erro ao inserir registro inicial user_data:', insertErr.message || insertErr);
      }
    } catch (err) {
      console.error('Erro ao carregar dados remotos:', err);
    }
  }

  // Enviar/atualizar dados no Supabase para o usuário atual
  private async syncToRemote(data: AppData): Promise<void> {
    if (!this.userId || !this.supabase) {
      console.warn('Usuário não autenticado — salvando apenas localmente');
      return;
    }
    try {
      // tentar atualizar
      const { data: updated, error: updateError } = await this.supabase!
        .from('user_data')
        .update({ content: data, updated_at: new Date().toISOString() })
        .eq('user_id', this.userId)
        .select();

      if (updateError) {
        console.warn('Erro ao atualizar user_data:', updateError.message || updateError);
      }

      if (!updated || (Array.isArray(updated) && updated.length === 0)) {
        // inserir se não havia registro
        const { error: insertErr } = await this.supabase!.from('user_data').insert({ user_id: this.userId, content: data });
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

  // Normaliza tipos de campos vindos do storage/remote (strings -> numbers/dates)
  private normalizeAppData(raw: any): AppData {
    const base = this.getInitialData();
    const data: AppData = {
      ...base,
      ...raw,
      emprestimos: Array.isArray(raw?.emprestimos) ? raw.emprestimos.map((e: any) => this.normalizeEmprestimo(e)) : base.emprestimos,
      clientes: Array.isArray(raw?.clientes) ? raw.clientes.map((c: any) => this.normalizeCliente(c)) : base.clientes,
      lastUpdated: raw?.lastUpdated ?? base.lastUpdated,
      version: raw?.version ?? base.version
    } as AppData;

    return data;
  }

  private normalizeEmprestimo(e: any): Emprestimo {
    const valorOriginal = this.parseNumber(e?.valorOriginal);
    const percentualJuros = this.parseNumber(e?.percentualJuros);
    const valorComJuros = this.parseNumber(e?.valorComJuros) || Math.round(valorOriginal * (1 + percentualJuros / 100));
    const valorPago = this.parseNumber(e?.valorPago);
    const saldoDevedor = this.parseNumber(e?.saldoDevedor) || Math.max(0, valorComJuros - valorPago);

    // Normalize dates to ISO strings if valid, otherwise keep null
    const dataContrato = this.tryNormalizeDate(e?.dataContrato);
    const proximoVencimento = this.tryNormalizeDate(e?.proximoVencimento);

    return {
      id: Number(e?.id) || 0,
      clienteId: Number(e?.clienteId) || 0,
      cliente: e?.cliente ?? '',
      valorOriginal,
      percentualJuros,
      valorComJuros,
      frequencia: e?.frequencia ?? 'mensal',
      dataContrato: dataContrato ? new Date(dataContrato) : new Date(),
      proximoVencimento: proximoVencimento ? new Date(proximoVencimento) : new Date(),
      status: e?.status ?? 'ativo',
      valorPago,
      saldoDevedor,
      ciclosVencidos: Number(e?.ciclosVencidos) || 0,
      observacoes: e?.observacoes ?? ''
    } as Emprestimo;
  }

  private normalizeCliente(c: any): Cliente {
    const dc = this.tryNormalizeDate(c?.dataCadastro);
    return {
      id: Number(c?.id) || 0,
      nome: c?.nome ?? '',
      cpf: c?.cpf ?? '',
      telefone: c?.telefone ?? '',
      email: c?.email ?? '',
      endereco: c?.endereco ?? '',
      renda: this.parseNumber(c?.renda),
      dataCadastro: dc ? new Date(dc) : new Date(),
      score: Number(c?.score) || 0,
      status: c?.status ?? 'ativo'
    } as Cliente;
  }

  private tryNormalizeDate(value: any): string | null {
    if (!value) return null;
    // accept ISO, timestamps, or Brazilian format DD/MM/YYYY
    if (typeof value === 'string') {
      const brazilMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (brazilMatch) {
        const [, dd, mm, yyyy] = brazilMatch;
        const iso = `${yyyy}-${mm}-${dd}`;
        const d = new Date(iso);
        return isFinite(d.getTime()) ? d.toISOString() : null;
      }
    }
    const d = new Date(value);
    return isFinite(d.getTime()) ? d.toISOString() : null;
  }

  private parseNumber(v: any): number {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      // remove currency symbols and spaces
      let s = v.replace(/[^0-9.,-]/g, '').trim();
      // if contains both dot and comma, assume dot is thousand separator
      if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
        s = s.replace(/\./g, ''); // remove thousand sep
        s = s.replace(/,/g, '.');
      } else if (s.indexOf(',') !== -1) {
        s = s.replace(/,/g, '.');
      }
      const n = Number(s);
      return isFinite(n) ? n : 0;
    }
    return 0;
  }
}