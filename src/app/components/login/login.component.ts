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
  email: string = '';
  senha: string = '';
  senhaIncorreta: boolean = false;
  carregando: boolean = false;
  modoCadastro: boolean = false;

  constructor(private router: Router, private auth: AuthService) {}

  async fazerLogin() {
    if (!this.email.trim() || !this.senha.trim()) return;

    this.carregando = true;
    this.senhaIncorreta = false;

    try {
      if (this.modoCadastro) {
        const { error } = await this.auth.signUp(this.email.trim(), this.senha);
        if (error) throw error;
        alert('Conta criada. Verifique seu e-mail para confirmar.');
      } else {
        const { error } = await this.auth.signIn(this.email.trim(), this.senha);
        if (error) throw error;
        this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      console.error('Erro auth:', err);
      this.senhaIncorreta = true;
      this.senha = '';
    } finally {
      this.carregando = false;
    }
  }

  onEnterPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.fazerLogin();
    }
  }

  toggleModo() {
    this.modoCadastro = !this.modoCadastro;
    this.senhaIncorreta = false;
  }
}