import { Component, Output, EventEmitter, OnInit, OnDestroy, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EmprestimoService, Emprestimo, Cliente } from '../../services/dashboard.service';
import { StorageService } from '../../services/storage.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

interface NotificacaoEmprestimo {
  id: number;
  tipo: 'vencimento' | 'atraso' | 'renovacao';
  emprestimo: Emprestimo;
  cliente: string;
  message: string;
  diasAtraso?: number;
  valor: number;
  urgencia: 'alta' | 'media' | 'baixa';
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() novoEmprestimo = new EventEmitter<void>();
  @Output() novoCliente = new EventEmitter<void>();
  @Output() registrarPagamento = new EventEmitter<void>();
  @Output() voltarDashboard = new EventEmitter<void>();
  @Output() navegarPara = new EventEmitter<string>();
  
  @Input() currentView: string = 'dashboard';

  private subscriptions: any[] = [];
  
  currentUser = {
    name: 'Administrador',
    role: 'Gerente Financeiro',
    avatar: 'assets/images/avatar-placeholder.svg'
  };

  // Sistema de notificações dinâmico
  notificacoes: NotificacaoEmprestimo[] = [];
  mostrarNotificacoes = false;
  emprestimos: Emprestimo[] = [];
  clientes: Cliente[] = [];
  
  // Controle do menu mobile
  menuMobileAberto = false;
  mostrarUserMenu = false;
  mostrarUserDropdown = false;

  // Opções do menu mobile
  menuMobileOptions = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'clientes', label: 'Clientes', icon: '👥' },
    { id: 'emprestimos', label: 'Empréstimos', icon: '💰' },
    { id: 'pagamentos', label: 'Pagamentos', icon: '💳' },
    { id: 'cobranca', label: 'Cobrança', icon: '📞' },
    { id: 'relatorios', label: 'Relatórios', icon: '📈' }
  ];

  get unreadNotifications(): number {
    return this.notificacoes.filter(n => n.urgencia === 'alta').length;
  }

  constructor(private emprestimoService: EmprestimoService, private router: Router, private auth: AuthService, private storageService: StorageService) {}

  ngOnInit() {
    // Carregar dados e monitorar mudanças
    const emprestimosSubscription = this.emprestimoService.getEmprestimos().subscribe(emprestimos => {
      this.emprestimos = emprestimos;
      this.atualizarNotificacoes();
    });

    const clientesSubscription = this.emprestimoService.getClientes().subscribe(clientes => {
      this.clientes = clientes;
      this.atualizarNotificacoes();
    });

    this.subscriptions.push(emprestimosSubscription, clientesSubscription);

    // populate current user from auth session (email)
    (async () => {
      try {
        const session = await this.auth.getSession();
        const user = session?.user ?? session?.user ?? null;
        if (user && (user as any).email) {
          this.currentUser.name = (user as any).email;
        }
      } catch (err) {
        console.debug('Header: failed to read session', err);
      }
    })();

    // subscribe to auth state changes to update UI when user logs in/out
    try {
      const authSub: any = this.auth.onAuthStateChange((event: string, session: any) => {
        const user = session?.user ?? null;
        if (user && user.email) {
          this.currentUser.name = user.email;
        } else {
          // reset to default when signed out
          this.currentUser.name = 'Administrador';
        }
      });
      if (authSub) this.subscriptions.push(authSub);
    } catch (err) {
      console.debug('Header: could not subscribe to auth changes', err);
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      try {
        if (!sub) return;
        const anySub = sub as any;
        if (anySub && typeof anySub.unsubscribe === 'function') {
          anySub.unsubscribe();
          return;
        }
        if (anySub && anySub.subscription && typeof anySub.subscription.unsubscribe === 'function') {
          anySub.subscription.unsubscribe();
          return;
        }
        if (typeof anySub === 'function') {
          anySub();
          return;
        }
      } catch (e) {
        // ignore
      }
    });
  }

  atualizarNotificacoes() {
    if (this.emprestimos.length === 0 || this.clientes.length === 0) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    this.notificacoes = [];

    this.emprestimos.forEach(emprestimo => {
      if (emprestimo.status === 'pago') return;

      const cliente = this.clientes.find(c => c.id === emprestimo.clienteId);
      const nomeCliente = cliente ? cliente.nome : 'Cliente não encontrado';
      
      const vencimento = new Date(emprestimo.proximoVencimento);
      vencimento.setHours(0, 0, 0, 0);
      
      const diffTime = vencimento.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Empréstimos em atraso
      if (diffDays < 0) {
        this.notificacoes.push({
          id: emprestimo.id,
          tipo: 'atraso',
          emprestimo,
          cliente: nomeCliente,
          message: `Empréstimo em atraso há ${Math.abs(diffDays)} dias`,
          diasAtraso: Math.abs(diffDays),
          valor: emprestimo.valorOriginal * (emprestimo.percentualJuros / 100) + (Math.abs(diffDays) * 50),
          urgencia: 'alta'
        });
      }
      // Empréstimos vencendo hoje
      else if (diffDays === 0) {
        this.notificacoes.push({
          id: emprestimo.id,
          tipo: 'vencimento',
          emprestimo,
          cliente: nomeCliente,
          message: `Vencimento hoje - Renovação disponível`,
          valor: emprestimo.valorOriginal * (emprestimo.percentualJuros / 100),
          urgencia: 'alta'
        });
      }
      // Empréstimos vencendo amanhã
      else if (diffDays === 1) {
        this.notificacoes.push({
          id: emprestimo.id,
          tipo: 'renovacao',
          emprestimo,
          cliente: nomeCliente,
          message: `Vence amanhã - Prepare a renovação`,
          valor: emprestimo.valorOriginal * (emprestimo.percentualJuros / 100),
          urgencia: 'media'
        });
      }
    });

    // Ordenar por urgência e data
    this.notificacoes.sort((a, b) => {
      if (a.urgencia === 'alta' && b.urgencia !== 'alta') return -1;
      if (a.urgencia !== 'alta' && b.urgencia === 'alta') return 1;
      return new Date(a.emprestimo.proximoVencimento).getTime() - new Date(b.emprestimo.proximoVencimento).getTime();
    });
  }

  toggleNotifications() {
    this.mostrarNotificacoes = !this.mostrarNotificacoes;
  }

  fecharNotificacoes() {
    this.mostrarNotificacoes = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const notificationBtn = target.closest('.notification-btn');
    const notificationDropdown = target.closest('.notifications-dropdown');
    const userBtn = target.closest('.user-btn');
    const userDropdown = target.closest('.user-dropdown');
    const menuMobileBtn = target.closest('.menu-mobile-btn');
    const menuMobile = target.closest('.menu-mobile');
    
    if (!notificationBtn && !notificationDropdown) {
      this.mostrarNotificacoes = false;
    }
    
    if (!userBtn && !userDropdown) {
      this.mostrarUserDropdown = false;
    }
    
    if (!menuMobileBtn && !menuMobile) {
      this.menuMobileAberto = false;
    }
  }

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  formatarData(data: Date): string {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // Open file picker (triggered from template) and upload avatar
  async onChangeAvatar(fileInput: HTMLInputElement) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const url = await this.storageService.uploadAvatar(file);
      if (url) {
        this.currentUser.avatar = url;
      } else {
        alert('Falha ao enviar a imagem. Veja o console para detalhes.');
      }
    } catch (err) {
      console.error('Erro upload avatar:', err);
      alert('Falha ao enviar a imagem.');
    } finally {
      // reset input
      try { fileInput.value = ''; } catch (e) { /* ignore */ }
    }
  }

  getIconeNotificacao(tipo: string): string {
    switch (tipo) {
      case 'atraso': return '🚨';
      case 'vencimento': return '⏰';
      case 'renovacao': return '📅';
      default: return '🔔';
    }
  }

  irParaPagamentos() {
    this.registrarPagamento.emit();
    this.fecharNotificacoes();
  }

  toggleUserMenu() {
    this.mostrarUserDropdown = !this.mostrarUserDropdown;
    this.mostrarNotificacoes = false;
    this.menuMobileAberto = false;
  }

  toggleMenuMobile() {
    this.menuMobileAberto = !this.menuMobileAberto;
  }

  fecharMenuMobile() {
    this.menuMobileAberto = false;
  }

  fecharTodosMenus() {
    this.mostrarNotificacoes = false;
    this.mostrarUserMenu = false;
    this.mostrarUserDropdown = false;
    this.menuMobileAberto = false;
  }

  onNovoEmprestimo() {
    this.novoEmprestimo.emit();
  }

  onNovoCliente() {
    this.novoCliente.emit();
  }

  onRegistrarPagamento() {
    this.registrarPagamento.emit();
  }

  async onSincronizar() {
    try {
      await this.emprestimoService.sincronizar();
      // feedback rápido ao usuário
      alert('Sincronização solicitada. Aguarde alguns segundos e atualize a outra sessão.');
    } catch (err) {
      console.error('Erro ao forçar sincronização:', err);
      alert('Falha ao solicitar sincronização. Veja o console para detalhes.');
    }
  }

  onVoltarDashboard() {
    this.voltarDashboard.emit();
  }

  navegarParaTela(tela: string) {
    console.log('Header: navegarParaTela ->', tela);
    this.navegarPara.emit(tela);
    this.menuMobileAberto = false; // Fechar menu mobile após navegação
  }

  get mostrarBotaoVoltar(): boolean {
    return this.currentView !== 'dashboard';
  }

  getViewTitle(): string {
    const titles: { [key: string]: string } = {
      'clientes': 'Clientes',
      'emprestimos': 'Empréstimos',
      'pagamentos': 'Pagamentos',
      'cobranca': 'Cobrança',
      'relatorios': 'Relatórios'
    };
    return titles[this.currentView] || 'Dashboard';
  }

  fecharUserDropdown() {
    this.mostrarUserDropdown = false;
  }

  async logout() {
    console.log('Header: logout clicked');
    try {
      await this.auth.signOut();
      console.log('Header: auth.signOut resolved');
    } catch (err) {
      console.warn('Erro ao deslogar via Supabase:', err);
    }
    localStorage.removeItem('authenticated');
    this.router.navigate(['/login']);
  }
}