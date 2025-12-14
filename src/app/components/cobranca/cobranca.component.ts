import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmprestimoService, Emprestimo, Cliente } from '../../services/dashboard.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-cobranca',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobranca.component.html',
  styleUrls: ['./cobranca.component.scss']
})
export class CobrancaComponent implements OnInit {
  emprestimos: Emprestimo[] = [];
  clientes: Cliente[] = [];
  emprestimosHoje: Emprestimo[] = [];
  emprestimosRestantes: Emprestimo[] = [];
  activePaymentId: number | null = null;
  private pixKeys: { [id: number]: string } = {};

  constructor(private emprestimoService: EmprestimoService) {}

  ngOnInit(): void {
    this.emprestimoService.getClientes().subscribe(c => this.clientes = c);
    this.emprestimoService.getEmprestimos().subscribe(e => {
      this.updateLists(e);
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  formatDate(d: Date): string {
    return new Date(d).toLocaleDateString('pt-BR');
  }

  getClienteNome(clienteId: number, emprestimo?: Emprestimo): string {
    if (emprestimo && emprestimo.cliente) return emprestimo.cliente;
    const c = this.clientes.find(x => x.id === clienteId);
    return c ? c.nome : `Cliente #${clienteId}`;
  }

  calcularDiasAtraso(emprestimo: Emprestimo): number {
    const hoje = new Date();
    const venc = new Date(emprestimo.proximoVencimento);
    const diff = hoje.getTime() - venc.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  calcularValorTotalComMulta(emprestimo: Emprestimo): number {
    const valorComJuros = emprestimo.valorOriginal * (1 + emprestimo.percentualJuros / 100);
    const multa = this.calcularDiasAtraso(emprestimo) * 50;
    return valorComJuros + multa;
  }

  calcularJurosComMulta(emprestimo: Emprestimo): number {
    const juros = emprestimo.valorOriginal * (emprestimo.percentualJuros / 100);
    const multa = this.calcularDiasAtraso(emprestimo) * 50;
    return juros + multa;
  }

  // --- WhatsApp helpers (mesma lógica utilitária usada em Pagamentos)
  private onlyDigits(s: string): string { return (s||'').toString().replace(/\D/g,''); }
  private formatPhoneForWhatsApp(raw: string): string | null {
    const digits = this.onlyDigits(raw);
    if (!digits) return null;
    if (digits.startsWith('55') && digits.length >= 11) return digits;
    if (digits.length === 10 || digits.length === 11) return '55' + digits;
    return digits;
  }
  private isSameDay(a: Date, b: Date): boolean {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear()===db.getFullYear() && da.getMonth()===db.getMonth() && da.getDate()===db.getDate();
  }
  private buildWhatsAppMessage(emprestimo: Emprestimo): string {
    const cliente = this.clientes.find(c => c.id === emprestimo.clienteId);
    const nome = cliente?.nome || emprestimo.cliente || 'Cliente';
    const valor = this.formatCurrency(this.calcularValorTotalComMulta(emprestimo));
    const venc = this.formatDate(emprestimo.proximoVencimento);
    const hoje = new Date();
    const diasAtraso = this.calcularDiasAtraso(emprestimo);
    if (this.isSameDay(emprestimo.proximoVencimento, hoje)) {
      return `Olá ${nome}, lembrete: seu pagamento de ${valor} vence hoje (${venc}). Por favor, confirme o pagamento.`;
    }
    if (new Date(emprestimo.proximoVencimento) < hoje) {
      return `Olá ${nome}, seu pagamento de ${valor} venceu há ${diasAtraso} ${diasAtraso===1?'dia':'dias'} (vencimento ${venc}). Por favor regularize o quanto antes.`;
    }
    const diff = Math.ceil((new Date(emprestimo.proximoVencimento).getTime() - hoje.getTime())/(1000*60*60*24));
    return `Olá ${nome}, lembrete: seu pagamento de ${valor} vence em ${diff} ${diff===1?'dia':'dias'} (${venc}). Obrigado!`;
  }

  getWhatsAppLink(emprestimo: Emprestimo): string | null {
    const cliente = this.clientes.find(c => c.id === emprestimo.clienteId);
    const raw = cliente?.telefone || '';
    const phone = this.formatPhoneForWhatsApp(raw);
    if (!phone) return null;
    return `https://wa.me/${phone}?text=${encodeURIComponent(this.buildWhatsAppMessage(emprestimo))}`;
  }

  async renovarEmprestimo(emprestimo: Emprestimo) {
    await this.emprestimoService.renovarEmprestimo(emprestimo.id);
    // reload
    this.emprestimoService.getEmprestimos().subscribe(e => this.updateLists(e));
  }

  async quitarEmprestimo(emprestimo: Emprestimo) {
    await this.emprestimoService.atualizarStatusEmprestimo(emprestimo.id, 'pago');
    this.emprestimoService.getEmprestimos().subscribe(e => this.updateLists(e));
  }

  private updateLists(all: Emprestimo[]) {
    const filtered = all.filter(x => x.status === 'ativo' || x.status === 'vencido');
    // ordenar por próximo vencimento asc
    filtered.sort((a, b) => new Date(a.proximoVencimento).getTime() - new Date(b.proximoVencimento).getTime());
    this.emprestimos = filtered;
    const hoje = new Date();
    this.emprestimosHoje = filtered.filter(e => this.isSameDay(new Date(e.proximoVencimento), hoje));
    this.emprestimosRestantes = filtered.filter(e => !this.isSameDay(new Date(e.proximoVencimento), hoje));
  }

  // --- Mensagens específicas para ações (renovar / quitar) com chave PIX aleatória
  private generateRandomPixKey(): string {
    // gerar uma chave aleatória simulada (uuid curto)
    return 'pix-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  private buildActionMessage(emprestimo: Emprestimo, action: 'juros' | 'total'): string {
    const cliente = this.clientes.find(c => c.id === emprestimo.clienteId);
    const nome = cliente?.nome || emprestimo.cliente || 'Cliente';
    const venc = this.formatDate(emprestimo.proximoVencimento);
    const pix = this.getPixKeyFor(emprestimo);

    if (action === 'juros') {
      const valorJuros = this.formatCurrency(this.calcularJurosComMulta(emprestimo));
      return `Olá ${nome}, confirmação de pagamento parcial (juros) referente ao empréstimo com vencimento em ${venc}. Valor: ${valorJuros}. Pagamento via PIX: ${pix}. Obrigado.`;
    }

    const valorTotal = this.formatCurrency(this.calcularValorTotalComMulta(emprestimo));
    return `Olá ${nome}, confirmação de quitação total do empréstimo com vencimento em ${venc}. Valor total: ${valorTotal}. PIX para transferência: ${pix}. Obrigado.`;
  }

  getWhatsAppLinkForAction(emprestimo: Emprestimo, action: 'juros' | 'total'): string | null {
    const cliente = this.clientes.find(c => c.id === emprestimo.clienteId);
    const raw = cliente?.telefone || '';
    const phone = this.formatPhoneForWhatsApp(raw);
    if (!phone) return null;
    const msg = this.buildActionMessage(emprestimo, action);
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  togglePaymentOptions(id: number) {
    if (this.activePaymentId === id) this.activePaymentId = null;
    else {
      this.activePaymentId = id;
      if (!this.pixKeys[id]) this.pixKeys[id] = this.generateRandomPixKey();
    }
  }

  getPixKeyFor(emprestimo: Emprestimo): string {
    const id = emprestimo.id;
    if (!this.pixKeys[id]) this.pixKeys[id] = this.generateRandomPixKey();
    return this.pixKeys[id];
  }
}
