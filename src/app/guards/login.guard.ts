import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class LoginGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean {
    const isAuthenticated = localStorage.getItem('authenticated') === 'true';
    
    if (isAuthenticated) {
      this.router.navigate(['/dashboard']);
      return false;
    }
    
    return true;
  }
}