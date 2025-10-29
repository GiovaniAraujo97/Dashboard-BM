import { Component, Output, EventEmitter, OnInit } from '@angular/core';
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
export class SidebarComponent implements OnInit {
  isCollapsed = false;
  @Output() viewChange = new EventEmitter<string>();

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
      icon: '�'
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
      icon: '�'
    },
    {
      id: 'cobranca',
      label: 'Cobrança',
      icon: '�',
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
    this.loadBadgeData();
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
  }

  selectMenuItem(item: MenuItem) {
    this.menuItems.forEach(menuItem => menuItem.active = false);
    item.active = true;
    this.viewChange.emit(item.id);
  }
}