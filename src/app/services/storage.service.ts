import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { Emprestimo, Cliente } from './dashboard.service';

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
  // Note: token removed from client. We use Netlify serverless functions as a secure proxy.
  private readonly GIST_ID = '004c3f9e832b7a8ad79fdb6a7e1796d5'; // Gist ID público
  private readonly GIST_READ_ENDPOINT = this.getGistEndpoint('gist-read');
  private readonly GIST_WRITE_ENDPOINT = this.getGistEndpoint('gist-write');

  private getGistEndpoint(fn: 'gist-read' | 'gist-write') {
    // Usa endpoint absoluto em produção (Netlify), relativo em dev/local
    const isProd = window.location.hostname.includes('netlify.app');
    if (isProd) {
      return `https://bm-emprestimos.netlify.app/.netlify/functions/${fn}`;
    }
    return `/.netlify/functions/${fn}`;
  }
  private readonly LOCAL_STORAGE_KEY = 'bm-emprestimos-data';
  private readonly SYNC_INTERVAL = 30000; // 30 segundos

  private dataSubject = new BehaviorSubject<AppData>(this.getInitialData());
  public data$ = this.dataSubject.asObservable();

  constructor() {
    // Sempre buscar do Gist ao abrir a página
    this.syncFromRemote();
    // Inicializar sincronização automática
    this.startAutoSync();
    // Carregar dados locais (fallback)
    this.loadFromLocal();
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

  // Sincronizar com GitHub Gist
  private async syncFromRemote(): Promise<void> {
    try {
      const response = await fetch(this.GIST_READ_ENDPOINT);
      if (response.ok) {
        const json = await response.json();
        const fileContent = json.content;
        if (fileContent) {
          const remoteData: AppData = JSON.parse(fileContent);
          const localData = this.dataSubject.value;

          // Sempre sobrescrever o dado local pelo remoto ao sincronizar
          this.dataSubject.next(remoteData);
          this.saveToLocal(remoteData);
          console.log('Dados sincronizados do servidor (via proxy)');
        }
      } else {
        console.warn('Não foi possível ler o Gist via proxy:', response.status);
      }
    } catch (error) {
      console.error('Erro ao sincronizar dados remotos (proxy):', error);
    }
  }

  // Enviar dados para GitHub Gist
  private async syncToRemote(data: AppData): Promise<void> {
    try {
      const response = await fetch(this.GIST_WRITE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: JSON.stringify(data, null, 2) })
      });

      if (response.ok) {
        console.log('Dados enviados para o servidor com sucesso (via proxy)');
      } else {
        console.error('Erro ao enviar dados para o servidor (proxy):', response.statusText);
      }
    } catch (error) {
      console.error('Erro ao enviar dados para o servidor (proxy):', error);
    }
  }

  // Iniciar sincronização automática
  private startAutoSync(): void {
    interval(this.SYNC_INTERVAL).subscribe(() => {
      this.syncFromRemote();
    });
  }

  // Métodos públicos para manipulação de dados
  
  getCurrentData(): AppData {
    return this.dataSubject.value;
  }

  async addCliente(cliente: Cliente): Promise<void> {
    await this.syncFromRemote(); // Garante dado mais recente
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
    await this.syncFromRemote();
  }

  async updateCliente(cliente: Cliente): Promise<void> {
    await this.syncFromRemote();
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
    await this.syncFromRemote();
  }

  async removeCliente(id: number): Promise<void> {
    await this.syncFromRemote();
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
    await this.syncFromRemote();
  }

  async addEmprestimo(emprestimo: Emprestimo): Promise<void> {
    await this.syncFromRemote();
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
    await this.syncFromRemote();
  }

  async updateEmprestimo(emprestimo: Emprestimo): Promise<void> {
    await this.syncFromRemote();
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
    await this.syncFromRemote();
  }

  async removeEmprestimo(id: number): Promise<void> {
    await this.syncFromRemote();
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
    await this.syncFromRemote();
  }

  // Método para forçar sincronização manual
  async forceSync(): Promise<void> {
    await this.syncFromRemote();
  }

  // Método para resetar dados (útil para desenvolvimento)
  async resetData(): Promise<void> {
    const newData = this.getInitialData();
    this.dataSubject.next(newData);
    this.saveToLocal(newData);
    await this.syncToRemote(newData);
  }
}