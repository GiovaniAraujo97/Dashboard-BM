import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmprestimoService, Cliente } from '../../services/dashboard.service';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss']
})
export class ClientesComponent implements OnInit {
  clientes: Cliente[] = [];
  showModal = false;
  showDeleteModal = false;
  editingCliente: Cliente | null = null;
  clienteToDelete: Cliente | null = null;
  searchTerm = '';
  
  novoCliente: Omit<Cliente, 'id' | 'dataCadastro'> = {
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    endereco: '',
    renda: 0,
    score: 0,
    status: 'ativo'
  };

  constructor(private emprestimoService: EmprestimoService) {}

  ngOnInit() {
    this.loadClientes();
  }

  loadClientes() {
    this.emprestimoService.getClientes().subscribe(clientes => {
      this.clientes = clientes;
    });
  }

  get clientesFiltrados() {
    if (!this.searchTerm) return this.clientes;
    
    return this.clientes.filter(cliente => 
      cliente.nome.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      cliente.cpf.includes(this.searchTerm) ||
      cliente.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      cliente.telefone.includes(this.searchTerm)
    );
  }

  openModal(cliente?: Cliente) {
    if (cliente) {
      this.editingCliente = cliente;
      this.novoCliente = { ...cliente };
    } else {
      this.editingCliente = null;
      this.resetForm();
    }
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingCliente = null;
    this.resetForm();
  }

  resetForm() {
    this.novoCliente = {
      nome: '',
      cpf: '',
      telefone: '',
      email: '',
      endereco: '',
      renda: 0,
      score: 0,
      status: 'ativo'
    };
  }

  salvarCliente() {
    if (!this.isFormValid()) return;

    if (this.editingCliente) {
      const clienteAtualizado: Cliente = {
        ...this.editingCliente,
        ...this.novoCliente
      };
      this.emprestimoService.atualizarCliente(clienteAtualizado);
    } else {
      this.emprestimoService.adicionarCliente(this.novoCliente);
    }

    this.closeModal();
    this.loadClientes();
  }

  confirmarExclusao(cliente: Cliente) {
    this.clienteToDelete = cliente;
    this.showDeleteModal = true;
  }

  excluirCliente() {
    if (this.clienteToDelete) {
      this.emprestimoService.excluirCliente(this.clienteToDelete.id);
      this.showDeleteModal = false;
      this.clienteToDelete = null;
      this.loadClientes();
    }
  }

  cancelarExclusao() {
    this.showDeleteModal = false;
    this.clienteToDelete = null;
  }

  isFormValid(): boolean {
    return !!(
      this.novoCliente.nome.trim() &&
      this.novoCliente.cpf.trim() &&
      this.novoCliente.telefone.trim() &&
      this.novoCliente.email.trim() &&
      this.novoCliente.endereco.trim() &&
      this.novoCliente.renda > 0
    );
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatCPF(cpf: string): string {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  formatPhone(phone: string): string {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ativo': return 'status-ativo';
      case 'inativo': return 'status-inativo';
      case 'bloqueado': return 'status-bloqueado';
      default: return '';
    }
  }

  getScoreColor(score: number): string {
    if (score >= 700) return 'score-alto';
    if (score >= 500) return 'score-medio';
    return 'score-baixo';
  }

  onCpfInput(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    this.novoCliente.cpf = value;
  }

  onPhoneInput(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    this.novoCliente.telefone = value;
  }

  getClientesAtivos(): number {
    return this.clientes.filter(c => c.status === 'ativo').length;
  }

  getRendaMedia(): string {
    if (this.clientes.length === 0) return this.formatCurrency(0);
    const media = this.clientes.reduce((sum, c) => sum + c.renda, 0) / this.clientes.length;
    return this.formatCurrency(media);
  }

  getScoreMedio(): number {
    if (this.clientes.length === 0) return 0;
    return Math.round(this.clientes.reduce((sum, c) => sum + c.score, 0) / this.clientes.length);
  }
}