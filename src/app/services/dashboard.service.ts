import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { StorageService } from './storage.service';

export interface Cliente {
  id: number;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  renda: number;
  dataCadastro: Date;
  score: number;
  status: 'ativo' | 'inativo' | 'bloqueado';
}

export interface Emprestimo {
  id: number;
  clienteId: number;
  cliente: string;
  valorOriginal: number;
  percentualJuros: number;
  valorComJuros: number;
  dataContrato: Date;
  proximoVencimento: Date;
  frequencia?: 'quinzenal' | 'mensal';
  status: 'ativo' | 'pago' | 'vencido';
  valorPago: number;
  saldoDevedor: number;
  ciclosVencidos: number;
  observacoes?: string;
}

export interface Pagamento {
  id: number;
  emprestimoId: number;
  cliente: string;
  numeroParcela: number;
  valor: number;
  dataPagamento: Date;
  dataVencimento: Date;
  status: 'pago' | 'pendente' | 'atrasado';
  diasAtraso?: number;
}

export interface DashboardMetrics {
  totalEmprestado: number;
  totalRecebido: number;
  saldoDevedor: number;
  emprestimosAtivos: number;
  clientesAtivos: number;
  taxaInadimplencia: number;
  faturamentoMensal: number;
  crescimentoMensal: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmprestimoService {
  constructor(private storageService: StorageService) {
    // Inicializar dados padrão se não existirem
    this.initializeDefaultData();
  }

  private async initializeDefaultData(): Promise<void> {
    const currentData = this.storageService.getCurrentData();
    
    // Se não há dados, criar dados iniciais
    if (currentData.clientes.length === 0 && currentData.emprestimos.length === 0) {
      const defaultClientes = this.getDefaultClientes();
      const defaultEmprestimos = this.getDefaultEmprestimos();

      // Adicionar clientes padrão
      for (const cliente of defaultClientes) {
        await this.storageService.addCliente(cliente);
      }

      // Adicionar empréstimos padrão
      for (const emprestimo of defaultEmprestimos) {
        await this.storageService.addEmprestimo(emprestimo);
      }
    }
  }

  // Observables para componentes
  getClientes(): Observable<Cliente[]> {
    return this.storageService.data$.pipe(
      map(data => data.clientes)
    );
  }

  getEmprestimos(): Observable<Emprestimo[]> {
    return this.storageService.data$.pipe(
      map(data => data.emprestimos)
    );
  }

  getPagamentos(): Observable<Pagamento[]> {
    // Por enquanto, gerar pagamentos baseados nos empréstimos
    return this.storageService.data$.pipe(
      map(data => this.generatePagamentosFromEmprestimos(data.emprestimos))
    );
  }

  // Métodos CRUD para Clientes
  async adicionarCliente(cliente: Omit<Cliente, 'id' | 'dataCadastro'>): Promise<Cliente> {
    const currentData = this.storageService.getCurrentData();
    const newId = Math.max(...currentData.clientes.map(c => c.id), 0) + 1;
    
    const novoCliente: Cliente = {
      ...cliente,
      id: newId,
      dataCadastro: new Date()
    };

    await this.storageService.addCliente(novoCliente);
    return novoCliente;
  }

  async atualizarCliente(cliente: Cliente): Promise<void> {
    await this.storageService.updateCliente(cliente);
  }

  async removerCliente(id: number): Promise<void> {
    await this.storageService.removeCliente(id);
  }

  async excluirCliente(id: number): Promise<void> {
    await this.storageService.removeCliente(id);
  }

  // Métodos CRUD para Empréstimos
  async adicionarEmprestimo(emprestimo: Omit<Emprestimo, 'id'>): Promise<Emprestimo> {
    const currentData = this.storageService.getCurrentData();
    const newId = Math.max(...currentData.emprestimos.map(e => e.id), 0) + 1;
    const valorOriginal = Number((emprestimo as any).valorOriginal) || 0;
    const percentualJuros = Number((emprestimo as any).percentualJuros) || 0;
    const valorComJuros = Number((emprestimo as any).valorComJuros) || Math.round(valorOriginal * (1 + percentualJuros / 100));
    const valorPago = Number((emprestimo as any).valorPago) || 0;
    const saldoDevedor = Number((emprestimo as any).saldoDevedor) || Math.max(0, valorComJuros - valorPago);

    const novoEmprestimo: Emprestimo = {
      id: newId,
      clienteId: Number((emprestimo as any).clienteId) || 0,
      cliente: (emprestimo as any).cliente ?? '',
      valorOriginal: valorOriginal,
      percentualJuros: percentualJuros,
      valorComJuros: valorComJuros,
      dataContrato: (emprestimo as any).dataContrato ? new Date((emprestimo as any).dataContrato) : new Date(),
      proximoVencimento: (emprestimo as any).proximoVencimento ? new Date((emprestimo as any).proximoVencimento) : new Date(),
      frequencia: (emprestimo as any).frequencia ?? 'mensal',
      status: (emprestimo as any).status ?? 'ativo',
      valorPago: valorPago,
      saldoDevedor: saldoDevedor,
      ciclosVencidos: Number((emprestimo as any).ciclosVencidos) || 0,
      observacoes: (emprestimo as any).observacoes
    } as Emprestimo;

    await this.storageService.addEmprestimo(novoEmprestimo);
    return novoEmprestimo;
  }

  async atualizarEmprestimo(emprestimo: Emprestimo): Promise<void> {
    await this.storageService.updateEmprestimo(emprestimo);
  }

  async removerEmprestimo(id: number): Promise<void> {
    await this.storageService.removeEmprestimo(id);
  }

  async excluirEmprestimo(id: number): Promise<void> {
    await this.storageService.removeEmprestimo(id);
  }

  async atualizarStatusEmprestimo(id: number, status: 'ativo' | 'pago' | 'vencido'): Promise<void> {
    const currentData = this.storageService.getCurrentData();
    const emprestimo = currentData.emprestimos.find(e => e.id === id);
    if (emprestimo) {
      emprestimo.status = status;
      await this.storageService.updateEmprestimo(emprestimo);
    }
  }

  /**
   * Renova um empréstimo avançando o próximo vencimento conforme a frequência
   * (quinzenal = 15 dias, mensal = 30 dias). Retorna a nova data de vencimento.
   */
  async renovarEmprestimo(id: number): Promise<Date | null> {
    const currentData = this.storageService.getCurrentData();
    const emprestimo = currentData.emprestimos.find(e => e.id === id);
    if (!emprestimo) return null;

    const hoje = new Date();
    let baseDate = emprestimo.proximoVencimento ? new Date(emprestimo.proximoVencimento) : new Date();
    if (baseDate < hoje) {
      baseDate = hoje;
    }

    const freq = (emprestimo as any).frequencia ?? 'mensal';
    const dias = freq === 'quinzenal' ? 15 : 30;

    const novoVencimento = new Date(baseDate);
    novoVencimento.setDate(novoVencimento.getDate() + dias);

    emprestimo.proximoVencimento = novoVencimento;
    emprestimo.status = 'ativo';

    await this.storageService.updateEmprestimo(emprestimo);
    return novoVencimento;
  }

  async limparEmprestimosOrfaos(): Promise<void> {
    // Por enquanto, não fazemos nada - método placeholder
    console.log('Limpeza de empréstimos órfãos executada');
  }

  async sincronizarNomesClientes(): Promise<void> {
    // Por enquanto, não fazemos nada - método placeholder
    console.log('Sincronização de nomes de clientes executada');
  }

  // Método para forçar sincronização
  async sincronizar(): Promise<void> {
    await this.storageService.forceSync();
  }

  // Gerar pagamentos baseados nos empréstimos
  private generatePagamentosFromEmprestimos(emprestimos: Emprestimo[]): Pagamento[] {
    const pagamentos: Pagamento[] = [];
    let pagamentoId = 1;

    emprestimos.forEach(emprestimo => {
      if (emprestimo.status === 'ativo') {
        // Gerar pagamentos para os próximos 6 ciclos quinzenais
        for (let i = 0; i < 6; i++) {
          const dataVencimento = new Date(emprestimo.proximoVencimento);
          dataVencimento.setDate(dataVencimento.getDate() + (i * 15));
          
          const hoje = new Date();
          const diasAtraso = Math.max(0, Math.floor((hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24)));
          
          let status: 'pago' | 'pendente' | 'atrasado' = 'pendente';
          if (dataVencimento < hoje && diasAtraso > 0) {
            status = 'atrasado';
          }

          pagamentos.push({
            id: pagamentoId++,
            emprestimoId: emprestimo.id,
            cliente: emprestimo.cliente,
            numeroParcela: i + 1,
            valor: emprestimo.valorComJuros / 10, // Dividir em 10 parcelas quinzenais
            dataPagamento: new Date(),
            dataVencimento: dataVencimento,
            status: status,
            diasAtraso: status === 'atrasado' ? diasAtraso : undefined
          });
        }
      }
    });

    return pagamentos;
  }

  // Dados padrão para inicialização
  private getDefaultClientes(): Cliente[] {
    return [
      {
        id: 1,
        nome: 'Maria Silva Santos',
        cpf: '123.456.789-01',
        telefone: '(11) 99999-0001',
        email: 'maria.santos@email.com',
        endereco: 'Rua das Flores, 123 - São Paulo, SP',
        renda: 3500,
        dataCadastro: new Date('2024-01-15'),
        score: 750,
        status: 'ativo'
      },
      {
        id: 2,
        nome: 'João Carlos Oliveira',
        cpf: '987.654.321-02',
        telefone: '(11) 99999-0002',
        email: 'joao.oliveira@email.com',
        endereco: 'Av. Paulista, 456 - São Paulo, SP',
        renda: 4200,
        dataCadastro: new Date('2024-02-20'),
        score: 680,
        status: 'ativo'
      },
      {
        id: 3,
        nome: 'Ana Paula Costa',
        cpf: '456.789.123-03',
        telefone: '(11) 99999-0003',
        email: 'ana.costa@email.com',
        endereco: 'Rua Augusta, 789 - São Paulo, SP',
        renda: 2800,
        dataCadastro: new Date('2024-03-10'),
        score: 620,
        status: 'ativo'
      }
    ];
  }

  private getDefaultEmprestimos(): Emprestimo[] {
    const hoje = new Date();
    const proximoVencimento1 = new Date(hoje);
    proximoVencimento1.setDate(hoje.getDate() + 7);
    
    const proximoVencimento2 = new Date(hoje);
    proximoVencimento2.setDate(hoje.getDate() + 3);
    
    const proximoVencimento3 = new Date(hoje);
    proximoVencimento3.setDate(hoje.getDate() - 2); // Atrasado

    return [
      {
        id: 1,
        clienteId: 1,
        cliente: 'Maria Silva Santos',
        valorOriginal: 5000,
        percentualJuros: 15,
        valorComJuros: 5750,
        dataContrato: new Date('2024-10-01'),
        proximoVencimento: proximoVencimento1,
        status: 'ativo',
        valorPago: 1150,
        saldoDevedor: 4600,
        ciclosVencidos: 2,
        observacoes: 'Cliente pontual, histórico excelente'
      },
      {
        id: 2,
        clienteId: 2,
        cliente: 'João Carlos Oliveira',
        valorOriginal: 3000,
        percentualJuros: 18,
        valorComJuros: 3540,
        dataContrato: new Date('2024-10-15'),
        proximoVencimento: proximoVencimento2,
        status: 'ativo',
        valorPago: 708,
        saldoDevedor: 2832,
        ciclosVencidos: 2,
        observacoes: 'Primeiro empréstimo do cliente'
      },
      {
        id: 3,
        clienteId: 3,
        cliente: 'Ana Paula Costa',
        valorOriginal: 2000,
        percentualJuros: 20,
        valorComJuros: 2400,
        dataContrato: new Date('2024-09-20'),
        proximoVencimento: proximoVencimento3,
        status: 'ativo',
        valorPago: 480,
        saldoDevedor: 1920,
        ciclosVencidos: 2,
        observacoes: 'Atenção: pagamento em atraso'
      }
    ];
  }
}