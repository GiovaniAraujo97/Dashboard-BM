import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmprestimoService, Emprestimo, Cliente } from '../../services/dashboard.service';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MetricCardComponent, MetricData } from '../metric-card/metric-card.component';
import { EmprestimosComponent } from '../emprestimos/emprestimos.component';
import { ClientesComponent } from '../clientes/clientes.component';
import { PagamentosComponent } from '../pagamentos/pagamentos.component';

interface ResumoEmprestimos {
  ativos: number;
  pendentes: number;
  emAtraso: number;
  quitados: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    MetricCardComponent,
    EmprestimosComponent,
    ClientesComponent,
    PagamentosComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  currentView = 'dashboard';
  
  // Dados do dashboard
  emprestimos: Emprestimo[] = [];
  clientes: Cliente[] = [];
  metrics: MetricData[] = [];
  resumoEmprestimos: ResumoEmprestimos = {
    ativos: 0,
    pendentes: 0,
    emAtraso: 0,
    quitados: 0
  };

  constructor(private emprestimoService: EmprestimoService) {}

  ngOnInit() {
    this.carregarDados();
  }

  carregarDados() {
    this.emprestimoService.getEmprestimos().subscribe(emprestimos => {
      this.emprestimos = emprestimos;
      this.atualizarMetricas();
    });

    this.emprestimoService.getClientes().subscribe(clientes => {
      this.clientes = clientes;
    });
  }

  atualizarMetricas() {
    const totalEmprestado = this.emprestimos.reduce((total, emp) => total + emp.valorOriginal, 0);
    const totalRecebido = this.emprestimos.reduce((total, emp) => total + emp.valorPago, 0);
    const saldoDevedor = totalEmprestado - totalRecebido;
    const emprestimosVencidos = this.emprestimos.filter(emp => {
      if (emp.status === 'pago') return false;
      const vencimento = new Date(emp.proximoVencimento);
      return vencimento < new Date();
    });
    const taxaInadimplencia = this.emprestimos.length > 0 ? (emprestimosVencidos.length / this.emprestimos.length) * 100 : 0;

    // Atualizar resumo
    this.resumoEmprestimos = {
      ativos: this.emprestimos.filter(emp => emp.status === 'ativo').length,
      pendentes: this.emprestimos.filter(emp => emp.status === 'ativo' && new Date(emp.proximoVencimento) > new Date()).length,
      emAtraso: emprestimosVencidos.length,
      quitados: this.emprestimos.filter(emp => emp.status === 'pago').length
    };

    this.metrics = [
      {
        title: 'Total Emprestado',
        value: this.formatarMoeda(totalEmprestado),
        change: 15.8,
        changeType: 'increase',
        subtitle: 'capital em circulação',
        icon: '💰',
        color: 'green'
      },
      {
        title: 'Total Recebido',
        value: this.formatarMoeda(totalRecebido),
        change: 8.5,
        changeType: 'increase',
        subtitle: 'pagamentos confirmados',
        icon: '📈',
        color: 'blue'
      },
      {
        title: 'Saldo Devedor',
        value: this.formatarMoeda(saldoDevedor),
        change: -5.2,
        changeType: 'decrease',
        subtitle: 'em aberto',
        icon: '⏱️',
        color: 'yellow'
      },
      {
        title: 'Taxa Inadimplência',
        value: `${taxaInadimplencia.toFixed(1)}%`,
        change: -2.1,
        changeType: 'decrease',
        subtitle: 'contratos em atraso',
        icon: '⚠️',
        color: 'red'
      }
    ];
  }

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  onViewChange(view: string) {
    this.currentView = view;
  }

  onVoltarDashboard() {
    this.currentView = 'dashboard';
  }

  // Métodos temporários para os botões
  onNovoEmprestimo() {
    console.log('Novo empréstimo - modal ainda não implementado');
  }

  onNovoCliente() {
    console.log('Novo cliente - modal ainda não implementado');
  }

  onRegistrarPagamento() {
    console.log('Registrar pagamento - modal ainda não implementado');
  }
}