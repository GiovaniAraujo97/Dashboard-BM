import { Component, Output, EventEmitter, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmprestimoService, Emprestimo } from '../../services/dashboard.service';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
  badge?: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnChanges {
  @Input() currentView: string = 'dashboard';
  isCollapsed = false;
  @Output() viewChange = new EventEmitter<string>();
  @Output() collapsedChange = new EventEmitter<boolean>();

  menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      active: true
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: '👥'
    },
    {
      id: 'emprestimos',
      label: 'Empréstimos',
      icon: '💰',
      badge: 0
    },
    {
      id: 'pagamentos',
      label: 'Pagamentos',
      icon: '💳'
    },
    {
      id: 'cobranca',
      label: 'Cobrança',
      icon: '📞',
      badge: 0
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      icon: '📄'
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: '⚙️'
    }
  ];

  constructor(private emprestimoService: EmprestimoService) {}

  ngOnInit() {
    this.syncActiveMenu(this.currentView);
    this.loadBadgeData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['currentView']) {
      this.syncActiveMenu(this.currentView);
    }
  }

  loadBadgeData() {
    this.emprestimoService.getEmprestimos().subscribe((emprestimos: Emprestimo[]) => {
      // Atualizar badge de empréstimos (total de empréstimos ativos + vencidos)
      const emprestimosAtivos = emprestimos.filter(e => e.status === 'ativo' || e.status === 'vencido').length;
      this.updateBadge('emprestimos', emprestimosAtivos);
      
      // Atualizar badge de cobrança (empréstimos vencidos)
      const emprestimosVencidos = emprestimos.filter(e => e.status === 'vencido').length;
      this.updateBadge('cobranca', emprestimosVencidos);
    });
  }

  updateBadge(itemId: string, value: number) {
    const item = this.menuItems.find(item => item.id === itemId);
    if (item) {
      item.badge = value;
    }
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedChange.emit(this.isCollapsed);
  }

  irParaDashboard() {
    const dashboardItem = this.menuItems.find(item => item.id === 'dashboard');
    if (dashboardItem) {
      this.selectMenuItem(dashboardItem);
      return;
    }

    this.viewChange.emit('dashboard');
  }

  selectMenuItem(item: MenuItem) {
    this.menuItems.forEach(menuItem => menuItem.active = false);
    item.active = true;
    this.viewChange.emit(item.id);
  }

  private syncActiveMenu(viewId: string) {
    const target = this.menuItems.find(item => item.id === viewId);
    if (!target) return;

    this.menuItems.forEach(menuItem => menuItem.active = false);
    target.active = true;
  }
}