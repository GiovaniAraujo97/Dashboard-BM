import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  // login fields
  loginEmail: string = '';
  loginSenha: string = '';
  loginErro: boolean = false;
  carregando: boolean = false;

  // signup fields
  signupEmail: string = '';
  signupSenha: string = '';
  signupSenhaConfirm: string = '';
  signupMessage: string = '';

  constructor(private router: Router, private auth: AuthService) {}

  async testarConexao() {
    try {
      const client = this.auth.getClient();
      if (!client) {
        this.signupMessage = 'Cliente Supabase não inicializado (verifique SUPABASE_ANON_KEY).';
        return;
      }
      // fazer uma chamada leve para o supabase (lista de tables ou ping) — usar getSession como não-invasivo
      const session = await this.auth.getSession();
      this.signupMessage = session ? 'Conexão OK (sessão ativa).' : 'Conexão OK (sem sessão).';
    } catch (err: any) {
      console.error('Erro testarConexao:', err);
      const rawMsg = err?.message || (err && typeof err === 'object' ? JSON.stringify(err) : String(err));
      this.signupMessage = 'Teste de conexão falhou: ' + rawMsg;
    }
  }

  async fazerLogin() {
    if (!this.loginEmail.trim() || !this.loginSenha.trim()) return;

    this.carregando = true;
    this.loginErro = false;

    try {
      const { error } = await this.auth.signIn(this.loginEmail.trim(), this.loginSenha);
      if (error) throw error;
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      console.error('Erro auth:', err);
      this.loginErro = true;
      this.loginSenha = '';
    } finally {
      this.carregando = false;
    }
  }

  onEnterPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.fazerLogin();
    }
  }

  async fazerCadastro() {
    this.signupMessage = '';
    if (!this.signupEmail.trim() || !this.signupSenha) return;
    if (this.signupSenha !== this.signupSenhaConfirm) {
      this.signupMessage = 'As senhas não coincidem.';
      return;
    }

    try {
      const res = await this.auth.signUp(this.signupEmail.trim(), this.signupSenha);
      if ((res as any).error) throw (res as any).error;
      this.signupMessage = 'Conta criada. Verifique seu e-mail para confirmar.';
      this.signupEmail = this.signupSenha = this.signupSenhaConfirm = '';
    } catch (err: any) {
      console.error('Erro signup:', err);
      // Prefer explicit error message fields, fall back to stringified object
      const rawMsg = err?.message || err?.error?.message || (err && typeof err === 'object' ? JSON.stringify(err) : String(err));
      // If the low-level fetch failed, suggest common causes (network/CORS/URL)
      if (rawMsg && rawMsg.indexOf('Failed to fetch') !== -1) {
        this.signupMessage = rawMsg + ' — Verifique sua conexão, a URL do Supabase e as configurações de CORS (origem: ' + window.location.origin + ').';
      } else {
        this.signupMessage = rawMsg || 'Falha ao criar conta.';
      }
    }
  }
}