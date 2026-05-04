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
  loginErroMensagem: string = '';
  carregando: boolean = false;

  // signup fields
  signupNomeCompleto: string = '';
  signupEmail: string = '';
  signupSenha: string = '';
  signupSenhaConfirm: string = '';
  signupMessage: string = '';

  // UI toggles
  showSignup: boolean = false;
  showLoginPassword: boolean = false;
  showSignupPassword: boolean = false;
  showSignupConfirm: boolean = false;

  constructor(private router: Router, private auth: AuthService) {}
 

  async fazerLogin() {
    if (!this.loginEmail.trim() || !this.loginSenha.trim()) return;

    this.carregando = true;
    this.loginErro = false;
    this.loginErroMensagem = '';

    try {
      const { error } = await this.auth.signIn(this.loginEmail.trim(), this.loginSenha);
      if (error) throw error;

      await this.auth.syncCurrentProfileFromSession();

      const tenantContext = await this.auth.getCurrentTenantContext();
      if (!tenantContext) {
        await this.auth.signOut();
        throw new Error('Acesso pendente. Aguarde a confirmação do administrador.');
      }

      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      console.error('Erro auth:', err);
      this.loginErro = true;
      this.loginErroMensagem = err?.message || 'Não foi possível entrar na conta.';
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
    if (!this.signupNomeCompleto.trim() || !this.signupEmail.trim() || !this.signupSenha) return;
    if (this.signupSenha !== this.signupSenhaConfirm) {
      this.signupMessage = 'As senhas não coincidem.';
      return;
    }

    try {
      const res = await this.auth.signUp(this.signupEmail.trim(), this.signupSenha, this.signupNomeCompleto.trim());
      if ((res as any).error) throw (res as any).error;

      await this.auth.syncCurrentProfileFromSession();
      await this.auth.signOut();
      this.signupMessage = 'Cadastro Realizado com Sucesso, aguardo a confirmação do administrador';

      this.signupNomeCompleto = this.signupEmail = this.signupSenha = this.signupSenhaConfirm = '';
    } catch (err: any) {
      console.error('Erro signup:', err);
      // Prefer explicit error message fields, fall back to stringified object
      const rawMsg = err?.message || err?.error?.message || (err && typeof err === 'object' ? JSON.stringify(err) : String(err));
      // Friendly hint for network/config issues between frontend and Supabase
      if (rawMsg && rawMsg.indexOf('Failed to fetch') !== -1) {
        this.signupMessage = 'Não foi possível conectar ao Supabase agora. Verifique SUPABASE_URL, SUPABASE_ANON_KEY, projeto ativo e URL autorizada (' + window.location.origin + ').';
      } else {
        this.signupMessage = rawMsg || 'Falha ao criar conta.';
      }
    }
  }
}