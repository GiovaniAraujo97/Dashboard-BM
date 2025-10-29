import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { EmprestimoService } from '../../services/dashboard.service';
import { Emprestimo, Cliente } from '../../services/dashboard.service';

export interface Pagamento {
  id: number;
  emprestimoId: number;
  clienteId: number;
  valor: number;
  tipoPagamento: 'juros' | 'total';
  dataPagamento: Date;
  dataVencimento: Date;
  proximoVencimento?: Date;
  observacoes?: string;
  numeroTransacao?: string;
  formaPagamento: 'dinheiro' | 'pix' | 'transferencia' | 'cartao';
}

@Component({
  selector: 'app-pagamentos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './pagamentos.component.html',
  styleUrl: './pagamentos.component.scss'
})
export class PagamentosComponent implements OnInit {
  pagamentos: Pagamento[] = [];
  emprestimosAtivos: Emprestimo[] = [];
  clientes: Cliente[] = [];
  
  pagamentoForm: FormGroup;
  mostrarModalPagamento = false;
  mostrarModalDetalhes = false;
  pagamentoSelecionado: Pagamento | null = null;
  
  filtroStatus = '';
  filtroCliente = '';
  filtroPeriodo = '';

  constructor(
    private fb: FormBuilder,
    private emprestimoService: EmprestimoService
  ) {
    this.pagamentoForm = this.fb.group({
      emprestimoId: ['', Validators.required],
      valor: ['', [Validators.required, Validators.min(0.01)]],
      tipoPagamento: ['juros', Validators.required],
      formaPagamento: ['dinheiro', Validators.required],
      numeroTransacao: [''],
      observacoes: ['']
    });
  }

  ngOnInit() {
    this.carregarDados();
  }

  filtrarEmprestimosValidos(emprestimos: Emprestimo[]) {
    console.log('🔍 Todos empréstimos recebidos:', emprestimos);
    console.log('🔍 Clientes disponíveis:', this.clientes);
    
    // MOSTRAR TODOS OS EMPRÉSTIMOS (exceto órfãos sem cliente)
    this.emprestimosAtivos = emprestimos.filter((e: Emprestimo) => {
      const temClienteValido = e.clienteId && this.clientes.some(c => c.id === e.clienteId);
      
      console.log(`🔍 Empréstimo ${e.id}: clienteId=${e.clienteId}, status=${e.status}, temClienteValido=${temClienteValido}`);
      
      if (!temClienteValido) {
        console.warn(`Empréstimo órfão encontrado: ID ${e.id}, ClienteID ${e.clienteId}`);
      }
      
      return temClienteValido; // Mostrar TODOS que têm cliente válido
    });
    
    console.log('Empréstimos pendentes de pagamento:', this.emprestimosAtivos);
    
    // Recarregar pagamentos para limpar órfãos
    this.carregarPagamentos();
  }

  calcularDiasAtraso(emprestimo: Emprestimo): number {
    const hoje = new Date();
    const vencimento = new Date(emprestimo.proximoVencimento);
    const diffTime = hoje.getTime() - vencimento.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  calcularMulta(emprestimo: Emprestimo): number {
    const diasAtraso = this.calcularDiasAtraso(emprestimo);
    return diasAtraso * 50; // R$ 50 por dia de atraso
  }

  calcularValorTotalComMulta(emprestimo: Emprestimo): number {
    const valorComJuros = emprestimo.valorOriginal * (1 + emprestimo.percentualJuros / 100);
    const multa = this.calcularMulta(emprestimo);
    return valorComJuros + multa;
  }

  calcularJurosComMulta(emprestimo: Emprestimo): number {
    const juros = emprestimo.valorOriginal * (emprestimo.percentualJuros / 100);
    const multa = this.calcularMulta(emprestimo);
    return juros + multa;
  }

  carregarDados() {
    // Primeiro carrega clientes
    this.emprestimoService.getClientes().subscribe((clientes: Cliente[]) => {
      this.clientes = clientes;
      console.log('🔍 Clientes carregados em carregarDados:', this.clientes);
      
      // Sincronizar nomes de clientes nos empréstimos
      this.emprestimoService.sincronizarNomesClientes();
      
      // Depois carrega empréstimos
      this.emprestimoService.getEmprestimos().subscribe((emprestimos: Emprestimo[]) => {
        console.log('🔍 Empréstimos carregados em carregarDados:', emprestimos);
        this.filtrarEmprestimosValidos(emprestimos);
      });
    });

    this.carregarPagamentos();
  }

  carregarPagamentos() {
    const pagamentosSalvos = localStorage.getItem('pagamentos');
    if (pagamentosSalvos) {
      this.pagamentos = JSON.parse(pagamentosSalvos).map((p: any) => ({
        ...p,
        dataPagamento: new Date(p.dataPagamento),
        dataVencimento: new Date(p.dataVencimento),
        proximoVencimento: p.proximoVencimento ? new Date(p.proximoVencimento) : undefined
      }));
    }
    
    // Limpar pagamentos órfãos (sem empréstimo correspondente)
    this.limparPagamentosOrfaos();
  }

  limparPagamentosOrfaos() {
    this.emprestimoService.getEmprestimos().subscribe((emprestimos: Emprestimo[]) => {
      const idsEmprestimosValidos = emprestimos.map(e => e.id);
      const pagamentosValidos = this.pagamentos.filter(p => 
        idsEmprestimosValidos.includes(p.emprestimoId)
      );
      
      if (pagamentosValidos.length !== this.pagamentos.length) {
        this.pagamentos = pagamentosValidos;
        this.salvarPagamentos();
        console.log('Pagamentos órfãos removidos');
      }
    });
  }

  salvarPagamentos() {
    localStorage.setItem('pagamentos', JSON.stringify(this.pagamentos));
  }

  get estatisticasPagamentos() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const pagamentosHoje = this.pagamentos.filter(p => 
      new Date(p.dataPagamento).toDateString() === hoje.toDateString()
    );
    
    const pagamentosMes = this.pagamentos.filter(p => 
      new Date(p.dataPagamento) >= inicioMes
    );

    return {
      pagamentosHoje: pagamentosHoje.length,
      valorHoje: pagamentosHoje.reduce((sum, p) => sum + p.valor, 0),
      pagamentosMes: pagamentosMes.length,
      valorMes: pagamentosMes.reduce((sum, p) => sum + p.valor, 0),
      jurosRecebidos: pagamentosMes.filter(p => p.tipoPagamento === 'juros').reduce((sum, p) => sum + p.valor, 0),
      quitacoes: pagamentosMes.filter(p => p.tipoPagamento === 'total').length
    };
  }

  get pagamentosFiltrados() {
    let resultado = [...this.pagamentos];

    if (this.filtroCliente) {
      resultado = resultado.filter(p => p.clienteId === parseInt(this.filtroCliente));
    }

    if (this.filtroPeriodo) {
      const hoje = new Date();
      let dataInicio: Date;

      switch (this.filtroPeriodo) {
        case 'hoje':
          dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          break;
        case 'semana':
          dataInicio = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'mes':
          dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          break;
        default:
          dataInicio = new Date(0);
      }

      resultado = resultado.filter(p => new Date(p.dataPagamento) >= dataInicio);
    }

    return resultado.sort((a, b) => new Date(b.dataPagamento).getTime() - new Date(a.dataPagamento).getTime());
  }

  // Métodos para empréstimos ativos
  getStatusVencimento(vencimento: Date): string {
    const hoje = new Date();
    const venc = new Date(vencimento);
    
    if (venc < hoje) return 'vencido';
    
    const diffTime = venc.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 3) return 'vencendo-hoje';
    return 'em-dia';
  }

  getDiasAtraso(vencimento: Date): string {
    const hoje = new Date();
    const venc = new Date(vencimento);
    
    if (venc >= hoje) {
      const diffTime = venc.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Vence hoje';
      return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    } else {
      const diffTime = hoje.getTime() - venc.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} em atraso`;
    }
  }

  getEmprestimo(emprestimoId: number): Emprestimo | undefined {
    // Buscar em todos os empréstimos, não apenas nos ativos locais
    let emprestimo = this.emprestimosAtivos.find((e: Emprestimo) => e.id === emprestimoId);
    
    if (!emprestimo) {
      // Se não encontrou nos ativos locais, buscar via service
      this.emprestimoService.getEmprestimos().subscribe((emprestimos: Emprestimo[]) => {
        emprestimo = emprestimos.find((e: Emprestimo) => e.id === emprestimoId);
      });
    }
    
    return emprestimo;
  }

  getClienteNome(clienteId: number, emprestimo?: Emprestimo): string {
    // Primeira tentativa: usar o nome salvo no empréstimo
    if (emprestimo && emprestimo.cliente) {
      return emprestimo.cliente;
    }
    
    // Fallback: buscar pelo ID na lista de clientes
    const cliente = this.clientes.find(c => c.id === clienteId);
    console.log('Buscando cliente ID:', clienteId, 'Encontrado:', cliente);
    return cliente ? cliente.nome : `Cliente #${clienteId}`;
  }

  calcularProximoVencimento(dataAtual: Date): Date {
    const proximoVencimento = new Date(dataAtual);
    proximoVencimento.setDate(proximoVencimento.getDate() + 15);
    return proximoVencimento;
  }

  onEmprestimoChange() {
    const emprestimoId = this.pagamentoForm.get('emprestimoId')?.value;
    if (emprestimoId) {
      const emprestimo = this.getEmprestimo(parseInt(emprestimoId));
      if (emprestimo) {
        // Pré-preencher valor sugerido baseado no tipo de pagamento
        this.onTipoPagamentoChange();
      }
    }
  }

  onTipoPagamentoChange() {
    const emprestimoId = this.pagamentoForm.get('emprestimoId')?.value;
    const tipoPagamento = this.pagamentoForm.get('tipoPagamento')?.value;
    
    if (emprestimoId && tipoPagamento) {
      const emprestimo = this.getEmprestimo(parseInt(emprestimoId));
      if (emprestimo) {
        let valorSugerido = 0;
        
        if (tipoPagamento === 'juros') {
          // Calcular valor para renovação do período
          valorSugerido = emprestimo.valorOriginal * (emprestimo.percentualJuros / 100);
        } else if (tipoPagamento === 'total') {
          // Valor total com juros
          valorSugerido = emprestimo.valorComJuros;
        }
        
        this.pagamentoForm.patchValue({ valor: valorSugerido.toFixed(2) });
      }
    }
  }

  abrirModalPagamento(tipo: 'juros' | 'total', emprestimo: Emprestimo) {
    // Só funciona com empréstimo específico
    this.pagamentoForm.patchValue({
      emprestimoId: emprestimo.id,
      tipoPagamento: tipo,
      valor: tipo === 'juros' ? 
        this.calcularJurosComMulta(emprestimo).toFixed(2) : 
        this.calcularValorTotalComMulta(emprestimo).toFixed(2),
      formaPagamento: 'dinheiro'
    });
    this.mostrarModalPagamento = true;
  }

  abrirModalDetalhes(pagamento: Pagamento) {
    this.pagamentoSelecionado = pagamento;
    this.mostrarModalDetalhes = true;
  }

  fecharModais() {
    this.mostrarModalPagamento = false;
    this.mostrarModalDetalhes = false;
    this.pagamentoSelecionado = null;
  }

  validarEmprestimoExiste(emprestimoId: number): boolean {
    return this.emprestimosAtivos.some(e => e.id === emprestimoId);
  }

  registrarPagamento() {
    if (this.pagamentoForm.valid) {
      const formData = this.pagamentoForm.value;
      const emprestimoId = parseInt(formData.emprestimoId);
      
      // Validar se o empréstimo ainda existe
      if (!this.validarEmprestimoExiste(emprestimoId)) {
        alert('Erro: Este empréstimo não existe mais ou foi removido!');
        this.fecharModais();
        this.carregarDados(); // Recarregar dados atualizados
        return;
      }
      
      const emprestimo = this.getEmprestimo(emprestimoId);
      
      if (!emprestimo) {
        alert('Empréstimo não encontrado!');
        return;
      }

      const novoPagamento: Pagamento = {
        id: Date.now(),
        emprestimoId: emprestimoId,
        clienteId: emprestimo.clienteId,
        valor: parseFloat(formData.valor),
        tipoPagamento: formData.tipoPagamento,
        dataPagamento: new Date(),
        dataVencimento: new Date(emprestimo.proximoVencimento), // Data atual como vencimento pago
        formaPagamento: formData.formaPagamento,
        numeroTransacao: formData.numeroTransacao,
        observacoes: formData.observacoes
      };

      // Lógica quinzenal: se pago total, marcar como pago; se renovação, renovar por 15 dias
      if (formData.tipoPagamento === 'total') {
        // Pagamento total - marcar empréstimo como pago
        this.emprestimoService.atualizarStatusEmprestimo(emprestimo.id, 'pago');
        console.log('Empréstimo quitado:', emprestimo.id);
      } else {
        // Renovação - renovar por mais 15 dias
        const proximoVencimento = this.calcularProximoVencimento(new Date());
        novoPagamento.proximoVencimento = proximoVencimento;
        
        // Atualizar o empréstimo para resetar o ciclo de vencimento
        this.emprestimoService.renovarEmprestimoPor15Dias(emprestimo.id, proximoVencimento);
        console.log('Empréstimo renovado por 15 dias:', emprestimo.id, 'Novo vencimento:', proximoVencimento);
      }

      this.pagamentos.push(novoPagamento);
      this.salvarPagamentos();
      this.fecharModais();
      
      // Recarregar dados para mostrar as mudanças
      this.carregarDados();
    }
  }

  limparEmprestimosOrfaos() {
    if (confirm('Tem certeza que deseja limpar empréstimos órfãos (sem cliente válido)?')) {
      this.emprestimoService.limparEmprestimosOrfaos();
      this.carregarDados();
      alert('Empréstimos órfãos removidos com sucesso!');
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
  }

  getTipoPagamentoText(tipo: string): string {
    return tipo === 'juros' ? 'Juros (15 dias)' : 'Quitação Total';
  }

  getFormaPagamentoText(forma: string): string {
    const formas: { [key: string]: string } = {
      'dinheiro': 'Dinheiro',
      'pix': 'PIX',
      'transferencia': 'Transferência',
      'cartao': 'Cartão'
    };
    return formas[forma] || forma;
  }
}