import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  senha: string = '';
  senhaIncorreta: boolean = false;
  carregando: boolean = false;

  constructor(private router: Router) {}

  async fazerLogin() {
    if (!this.senha.trim()) {
      return;
    }

    this.carregando = true;
    this.senhaIncorreta = false;

    // Simular delay de autenticação
    await new Promise(resolve => setTimeout(resolve, 800));

    if (this.senha === '1234') {
      // Salvar estado de autenticação
      localStorage.setItem('authenticated', 'true');
      this.router.navigate(['/dashboard']);
    } else {
      this.senhaIncorreta = true;
      this.senha = '';
    }

    this.carregando = false;
  }

  onEnterPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.fazerLogin();
    }
  }
}