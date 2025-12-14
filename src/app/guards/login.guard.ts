@Injectable({
  providedIn: 'root'
})
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class LoginGuard implements CanActivate {

  constructor(private router: Router, private auth: AuthService) {}

  async canActivate(): Promise<boolean> {
    try {
      const session = await this.auth.getSession();
      const isAuthenticated = !!session;
      if (isAuthenticated) {
        this.router.navigate(['/dashboard']);
        return false;
      }
      return true;
    } catch (err) {
      return true;
    }
  }
}