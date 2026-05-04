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
  showPhotoModal = false;
  photoModalSrc = '';
  photoModalNome = '';
  editingCliente: Cliente | null = null;
  clienteToDelete: Cliente | null = null;
  searchTerm = '';
  buscandoCep = false;
  cepErro = '';
  
  novoCliente: Omit<Cliente, 'id' | 'dataCadastro'> = {
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: '',
    complemento: '',
    foto: '',
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
      this.novoCliente = {
        ...cliente,
        cep: cliente.cep || '',
        bairro: cliente.bairro || '',
        cidade: cliente.cidade || '',
        complemento: cliente.complemento || '',
        foto: cliente.foto || ''
      };
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
      cep: '',
      endereco: '',
      bairro: '',
      cidade: '',
      complemento: '',
      foto: '',
      renda: 0,
      score: 0,
      status: 'ativo'
    };
    this.cepErro = '';
    this.buscandoCep = false;
  }

  async salvarCliente() {
    if (!this.isFormValid()) return;

    if (this.editingCliente) {
      const clienteAtualizado: Cliente = {
        ...this.editingCliente,
        ...this.novoCliente
      };
      await this.emprestimoService.atualizarCliente(clienteAtualizado);
    } else {
      await this.emprestimoService.adicionarCliente(this.novoCliente);
    }

    this.closeModal();
    this.loadClientes();
  }

  confirmarExclusao(cliente: Cliente) {
    this.clienteToDelete = cliente;
    this.showDeleteModal = true;
  }

  async excluirCliente() {
    if (this.clienteToDelete) {
      await this.emprestimoService.excluirCliente(this.clienteToDelete.id);
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

  onCepInput(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    this.novoCliente.cep = value;
    this.cepErro = '';
  }

  formatCep(cep: string | undefined): string {
    const digits = (cep || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  async buscarCep() {
    const cep = (this.novoCliente.cep || '').replace(/\D/g, '');
    if (cep.length === 0) {
      this.cepErro = '';
      return;
    }

    if (cep.length !== 8) {
      this.cepErro = 'CEP invalido. Use 8 digitos.';
      return;
    }

    this.buscandoCep = true;
    this.cepErro = '';

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) {
        throw new Error('Falha ao consultar CEP');
      }

      const data = await response.json();
      if (data.erro) {
        this.cepErro = 'CEP nao encontrado.';
        return;
      }

      this.novoCliente.endereco = (data.logradouro || this.novoCliente.endereco || '').trim();
      this.novoCliente.bairro = (data.bairro || this.novoCliente.bairro || '').trim();
      this.novoCliente.cidade = [data.localidade, data.uf]
        .filter((v: string) => !!v && v.trim().length > 0)
        .join(' - ')
        .trim();
      this.novoCliente.complemento = (data.complemento || this.novoCliente.complemento || '').trim();
      this.novoCliente.cep = cep;
    } catch (error) {
      this.cepErro = 'Nao foi possivel consultar o CEP agora.';
    } finally {
      this.buscandoCep = false;
    }
  }

  onSelecionarFoto(event: any) {
    const file: File | null = event?.target?.files?.[0] || null;
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.novoCliente.foto = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }

  removerFoto() {
    this.novoCliente.foto = '';
  }

  getClienteFotoPreview(): string {
    if (this.novoCliente.foto && this.novoCliente.foto.trim()) {
      return this.novoCliente.foto;
    }
    return 'assets/images/avatar-placeholder.svg';
  }

  openPhotoModal(src: string | undefined, nome: string) {
    this.photoModalSrc = src && src.trim() ? src : 'assets/images/avatar-placeholder.svg';
    this.photoModalNome = nome;
    this.showPhotoModal = true;
  }

  closePhotoModal() {
    this.showPhotoModal = false;
    this.photoModalSrc = '';
    this.photoModalNome = '';
  }

  downloadPhoto() {
    if (!this.photoModalSrc) return;

    const link = document.createElement('a');
    link.href = this.photoModalSrc;
    link.download = `cliente-${(this.photoModalNome || 'foto').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  mostrarCamposEnderecoCep(): boolean {
    const cepCompleto = (this.novoCliente.cep || '').replace(/\D/g, '').length === 8;
    return cepCompleto || !!this.novoCliente.bairro || !!this.novoCliente.cidade || !!this.novoCliente.complemento;
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