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
  modalEmprestimo: Emprestimo | null = null;
  
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

  private normalizeDate(value: Date): Date {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private isSameDay(a: Date, b: Date): boolean {
    const da = this.normalizeDate(a);
    const db = this.normalizeDate(b);
    return da.getTime() === db.getTime();
  }

  private isAtrasado(emprestimo: Emprestimo): boolean {
    if (emprestimo.status === 'pago') return false;
    const hoje = this.normalizeDate(new Date());
    const vencimento = this.normalizeDate(emprestimo.proximoVencimento);
    return vencimento.getTime() < hoje.getTime();
  }

  private isVencendoHoje(emprestimo: Emprestimo): boolean {
    if (emprestimo.status === 'pago') return false;
    return this.isSameDay(emprestimo.proximoVencimento, new Date());
  }

  estaAtrasado(emprestimo: Emprestimo): boolean {
    return this.isAtrasado(emprestimo);
  }

  estaVencendoHoje(emprestimo: Emprestimo): boolean {
    return this.isVencendoHoje(emprestimo);
  }

  getLinhaEmprestimoClass(emprestimo: Emprestimo): string {
    if (emprestimo.status === 'pago') return 'row-pago';
    if (this.isAtrasado(emprestimo)) return 'row-atrasado';
    if (this.isVencendoHoje(emprestimo)) return 'row-vencendo-hoje';
    return '';
  }

  getStatusCellClass(emprestimo: Emprestimo): string {
    if (emprestimo.status === 'pago') return 'pago';
    if (this.isAtrasado(emprestimo)) return 'vencido';
    if (this.isVencendoHoje(emprestimo)) return 'vencendo-hoje';
    return 'ativo';
  }

  calcularDiasAtraso(emprestimo: Emprestimo): number {
    const hoje = this.normalizeDate(new Date());
    const vencimento = this.normalizeDate(emprestimo.proximoVencimento);
    const diffTime = hoje.getTime() - vencimento.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
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
    const hoje = this.normalizeDate(new Date());
    const venc = this.normalizeDate(vencimento);
    
    if (venc < hoje) return 'vencido';
    
    const diffTime = venc.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 3) return 'vencendo-hoje';
    return 'em-dia';
  }

  getDiasAtraso(vencimento: Date): string {
    const hoje = this.normalizeDate(new Date());
    const venc = this.normalizeDate(vencimento);
    
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
        // Atualizar referência do modal (se estiver aberto) e pré-preencher valor sugerido
        this.modalEmprestimo = emprestimo;
        this.onTipoPagamentoChange();
      }
    }
  }

  onTipoPagamentoChange() {
    const emprestimoId = this.pagamentoForm.get('emprestimoId')?.value;
    const tipoPagamento = this.pagamentoForm.get('tipoPagamento')?.value;

    if (!tipoPagamento) return;

    // Preferir o empréstimo carregado no modal quando disponível
    let emprestimo: Emprestimo | undefined;
    if (this.modalEmprestimo) {
      emprestimo = this.modalEmprestimo;
    } else if (emprestimoId) {
      emprestimo = this.getEmprestimo(parseInt(emprestimoId));
    }

    if (emprestimo) {
      let valorSugerido = 0;
      if (tipoPagamento === 'juros') {
        // Calcular valor para renovação do período (juros do ciclo)
        valorSugerido = emprestimo.valorOriginal * (emprestimo.percentualJuros / 100);
      } else if (tipoPagamento === 'total') {
        // Valor total com juros
        valorSugerido = emprestimo.valorComJuros;
      }
      this.pagamentoForm.patchValue({ valor: valorSugerido.toFixed(2) });
    }
  }

  abrirModalPagamento(tipo: 'juros' | 'total', emprestimo: Emprestimo) {
    // Guardar referência do empréstimo no modal para uso na UI
    this.modalEmprestimo = emprestimo;

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
    this.modalEmprestimo = null;
    this.mostrarModalDetalhes = true;
  }

  fecharModais() {
    this.mostrarModalPagamento = false;
    this.mostrarModalDetalhes = false;
    this.pagamentoSelecionado = null;
    this.modalEmprestimo = null;
  }

  validarEmprestimoExiste(emprestimoId: number): boolean {
    return this.emprestimosAtivos.some(e => e.id === emprestimoId);
  }

  async registrarPagamento() {
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

      // Se pagamento total, marcar como pago; caso contrário renovação conforme frequência
      if (formData.tipoPagamento === 'total') {
        // Pagamento total - marcar empréstimo como pago
        await this.emprestimoService.atualizarStatusEmprestimo(emprestimo.id, 'pago');
        console.log('Empréstimo quitado:', emprestimo.id);
      } else {
        // Renovação genérica: call service to advance next due by 15/30 days
        const novoVencimento = await this.emprestimoService.renovarEmprestimo(emprestimo.id);
        if (novoVencimento) {
          novoPagamento.proximoVencimento = novoVencimento;
          console.log('Empréstimo renovado:', emprestimo.id, 'Novo vencimento:', novoVencimento);
        } else {
          console.warn('Falha ao renovar empréstimo:', emprestimo.id);
        }
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

  getTipoPagamentoText(tipo: string, emprestimo?: Emprestimo | undefined): string {
    if (tipo === 'juros') {
      const dias = emprestimo?.frequencia === 'quinzenal' ? 15 : 30;
      return `Juros (${dias} dias)`;
    }
    return 'Quitação Total';
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

  // Helpers para WhatsApp
  private onlyDigits(s: string): string {
    return (s || '').toString().replace(/\D/g, '');
  }

  private formatPhoneForWhatsApp(raw: string): string | null {
    const digits = this.onlyDigits(raw);
    if (!digits) return null;

    // Se já tem código do país (começa com 55), usa direto
    if (digits.startsWith('55') && digits.length >= 11) return digits;

    // Se tiver 10 ou 11 dígitos (BR sem DDI), prefixa com 55
    if (digits.length === 10 || digits.length === 11) return '55' + digits;

    // Para outros casos, tentar usar diretamente (pode já ter DDI)
    return digits;
  }

  private buildWhatsAppMessage(emprestimo: Emprestimo): string {
    const cliente = this.clientes.find(c => c.id === emprestimo.clienteId);
    const nome = cliente?.nome || emprestimo.cliente || 'Cliente';
    const valor = this.formatCurrency(this.calcularValorTotalComMulta(emprestimo));
    const venc = this.formatDate(emprestimo.proximoVencimento);

    const hoje = new Date();
    let texto = '';
    const diasAtraso = this.calcularDiasAtraso(emprestimo);

    if (this.isSameDay(emprestimo.proximoVencimento, hoje)) {
      texto = `Olá ${nome}, tudo bem? Lembrete: seu pagamento de ${valor} vence hoje (${venc}). Por favor, confirme o pagamento ou entre em contato.`;
    } else if (new Date(emprestimo.proximoVencimento) < hoje) {
      texto = `Olá ${nome}, seu pagamento de ${valor} venceu há ${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'} (vencimento ${venc}). Por favor regularize o quanto antes.`;
    } else {
      const diffTime = new Date(emprestimo.proximoVencimento).getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      texto = `Olá ${nome}, lembrete: seu pagamento de ${valor} vence em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} (${venc}). Obrigado!`;
    }

    return texto;
  }

  getWhatsAppLink(emprestimo: Emprestimo): string | null {
    // Buscar telefone do cliente
    const cliente = this.clientes.find(c => c.id === emprestimo.clienteId);
    const rawPhone = cliente?.telefone || '';
    const phone = this.formatPhoneForWhatsApp(rawPhone);
    if (!phone) return null;

    const mensagem = this.buildWhatsAppMessage(emprestimo);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
    return url;
  }
}