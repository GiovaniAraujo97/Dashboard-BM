import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EmprestimoService, Cliente, Emprestimo } from '../../services/dashboard.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-emprestimos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './emprestimos.component.html',
  styleUrl: './emprestimos.component.scss'
})
export class EmprestimosComponent implements OnInit {
  emprestimos$: Observable<Emprestimo[]>;
  clientes$: Observable<Cliente[]>;
  
  emprestimos: Emprestimo[] = [];
  clientes: Cliente[] = [];
  emprestimosFiltrados: Emprestimo[] = [];
  
  // Modais
  mostrarModalCriar = false;
  mostrarModalEditar = false;
  mostrarModalDetalhes = false;
  
  // Forms
  emprestimoForm: FormGroup;
  emprestimoSelecionado: Emprestimo | null = null;
  
  // Filtros
  filtroStatus: 'ativo' | 'pago' | 'vencido' | 'todos' = 'todos';
  filtroCliente = '';
  termoPesquisa = '';
  
  // Estatísticas
  get estatisticas() {
    const total = this.emprestimos.length;
    const ativos = this.emprestimos.filter(e => e.status === 'ativo').length;
    const pagos = this.emprestimos.filter(e => e.status === 'pago').length;
    const vencidos = this.emprestimos.filter(e => e.status === 'vencido').length;
    const valorTotal = this.emprestimos
      .filter(e => e.status === 'ativo')
      .reduce((sum, e) => sum + (Number(e.valorOriginal) || 0), 0);
    
    return { total, ativos, pagos, vencidos, valorTotal };
  }

  constructor(
    private emprestimoService: EmprestimoService,
    private fb: FormBuilder
  ) {
    this.emprestimos$ = this.emprestimoService.getEmprestimos();
    this.clientes$ = this.emprestimoService.getClientes();
    
    this.emprestimoForm = this.fb.group({
      clienteId: ['', Validators.required],
      valorOriginal: ['', [Validators.required, Validators.min(1)]],
      percentualJuros: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      frequencia: ['mensal', Validators.required],
      dataContrato: [''],
      observacoes: ['']
    });
  }

  ngOnInit() {
    this.emprestimos$.subscribe(emprestimos => {
      this.emprestimos = emprestimos;
      console.debug('🔍 Emprestimos carregados (emprestimos.component):', this.emprestimos);
      this.aplicarFiltros();
    });
    
    this.clientes$.subscribe(clientes => {
      this.clientes = clientes;
      console.log('🔧 Clientes carregados no componente empréstimos:', this.clientes);
    });
  }

  aplicarFiltros() {
    let resultado = this.emprestimos;

    // Filtro por status
    if (this.filtroStatus !== 'todos') {
      resultado = resultado.filter(e => e.status === this.filtroStatus);
    }

    // Filtro por cliente
    if (this.filtroCliente) {
      resultado = resultado.filter(e => e.clienteId.toString() === this.filtroCliente);
    }

    // Pesquisa por termo
    if (this.termoPesquisa) {
      const termo = this.termoPesquisa.toLowerCase();
      resultado = resultado.filter(e => {
        const cliente = this.getClienteNome(e.clienteId);
        return cliente.toLowerCase().includes(termo) ||
               e.valorOriginal.toString().includes(termo) ||
               e.observacoes?.toLowerCase().includes(termo);
      });
    }

    this.emprestimosFiltrados = resultado;
  }

  getClienteNome(clienteId: number): string {
    const cliente = this.clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nome : 'Cliente não encontrado';
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'ativo': return 'Ativo';
      case 'pago': return 'Pago';
      case 'vencido': return 'Vencido';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ativo': return 'status-ativo';
      case 'pago': return 'status-pago';
      case 'vencido': return 'status-vencido';
      default: return '';
    }
  }

  abrirModalCriar() {
    this.emprestimoForm.reset();
    this.mostrarModalCriar = true;
  }

  abrirModalEditar(emprestimo: Emprestimo) {
    this.emprestimoSelecionado = emprestimo;
    this.emprestimoForm.patchValue({
      clienteId: emprestimo.clienteId,
      valorOriginal: emprestimo.valorOriginal,
      percentualJuros: emprestimo.percentualJuros,
      observacoes: emprestimo.observacoes,
      dataContrato: emprestimo.dataContrato ? new Date(emprestimo.dataContrato).toISOString().slice(0,10) : ''
    });
    this.mostrarModalEditar = true;
  }

  abrirModalDetalhes(emprestimo: Emprestimo) {
    this.emprestimoSelecionado = emprestimo;
    this.mostrarModalDetalhes = true;
  }

  fecharModais() {
    this.mostrarModalCriar = false;
    this.mostrarModalEditar = false;
    this.mostrarModalDetalhes = false;
    this.emprestimoSelecionado = null;
  }

  async criarEmprestimo() {
    console.log('🔧 criarEmprestimo chamado');
    console.log('🔧 Form válido:', this.emprestimoForm.valid);
    console.log('🔧 Form value:', this.emprestimoForm.value);
    console.log('🔧 Form errors:', this.emprestimoForm.errors);
    
    if (this.emprestimoForm.valid) {
      const dadosEmprestimo = this.emprestimoForm.value;
      console.log('🔧 Dados do empréstimo:', dadosEmprestimo);
      
      // Validação específica: cliente deve ser selecionado
      if (!dadosEmprestimo.clienteId || dadosEmprestimo.clienteId === '') {
        alert('⚠️ Por favor, selecione um cliente para o empréstimo!');
        return;
      }
      
      // Verificar se o cliente existe
      const clienteExiste = this.clientes.find(c => c.id === parseInt(dadosEmprestimo.clienteId));
      console.log('🔧 Clientes disponíveis:', this.clientes.map(c => ({ id: c.id, nome: c.nome })));
      console.log('🔧 Procurando cliente ID:', parseInt(dadosEmprestimo.clienteId));
      console.log('🔧 Cliente existe:', clienteExiste);
      if (!clienteExiste) {
        alert('⚠️ Cliente selecionado não é válido!');
        return;
      }
      
      try {
        // allow historical contract date (dataContrato) to be provided
        const frequencia = dadosEmprestimo.frequencia || 'mensal';
        let dataContrato: Date;
        if (dadosEmprestimo.dataContrato) {
          if (typeof dadosEmprestimo.dataContrato === 'string') {
            const m = dadosEmprestimo.dataContrato.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) {
              dataContrato = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            } else {
              dataContrato = new Date(dadosEmprestimo.dataContrato);
            }
          } else {
            dataContrato = new Date(dadosEmprestimo.dataContrato);
          }
        } else {
          dataContrato = new Date();
        }
        // ensure numeric calculations
        const valorOriginal = Number(dadosEmprestimo.valorOriginal) || 0;
        const percentualJuros = Number(dadosEmprestimo.percentualJuros) || 0;
        const valorComJuros = Math.round(valorOriginal * (1 + percentualJuros / 100));

        const novo = {
          ...dadosEmprestimo,
          clienteId: Number(dadosEmprestimo.clienteId),
          cliente: clienteExiste ? clienteExiste.nome : '',
          valorOriginal: valorOriginal,
          percentualJuros: percentualJuros,
          valorComJuros: valorComJuros,
          valorPago: 0,
          saldoDevedor: Math.max(0, valorComJuros),
          dataContrato: dataContrato,
          // proximoVencimento will be computed by service when not provided
          proximoVencimento: dadosEmprestimo.proximoVencimento ? new Date(dadosEmprestimo.proximoVencimento) : undefined,
          status: 'ativo',
          ciclosVencidos: 0
        } as any;

        await this.emprestimoService.adicionarEmprestimo(novo);
        console.log('🔧 Empréstimo criado com sucesso!');
        this.fecharModais();
      } catch (error) {
        console.error('🔧 Erro ao criar empréstimo:', error);
        alert('❌ Erro ao criar empréstimo: ' + error);
      }
    } else {
      console.log('🔧 Form inválido - campos com erro:');
      Object.keys(this.emprestimoForm.controls).forEach(key => {
        const control = this.emprestimoForm.get(key);
        if (control && control.invalid) {
          console.log(`🔧 Campo ${key}:`, control.errors);
        }
      });
      alert('⚠️ Por favor, preencha todos os campos obrigatórios!');
    }
  }

  atualizarEmprestimo() {
    if (this.emprestimoForm.valid && this.emprestimoSelecionado) {
      const emprestimoAtualizado: Emprestimo = {
        ...this.emprestimoSelecionado,
        ...this.emprestimoForm.value
      };
      this.emprestimoService.atualizarEmprestimo(emprestimoAtualizado);
      this.fecharModais();
    }
  }

  excluirEmprestimo(emprestimo: Emprestimo) {
    if (confirm(`Tem certeza que deseja excluir o empréstimo #${emprestimo.id}?`)) {
      this.emprestimoService.excluirEmprestimo(emprestimo.id);
    }
  }

  limparEmprestimosOrfaos() {
    if (confirm('Deseja remover empréstimos sem cliente válido?')) {
      this.emprestimoService.limparEmprestimosOrfaos();
    }
  }

  calcularValorTotal(emprestimo: Emprestimo): number {
    return emprestimo.valorComJuros;
  }

  formatarMoeda(valor: number): string {
    const n = Number(valor);
    const safe = isFinite(n) ? n : 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(safe);
  }

  formatarData(data: Date): string {
    return new Date(data).toLocaleDateString('pt-BR');
  }

  onFiltroChange() {
    this.aplicarFiltros();
  }

  onPesquisaChange() {
    this.aplicarFiltros();
  }
}