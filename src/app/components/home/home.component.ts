import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule], // Add CommonModule to imports
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  isLoading: boolean = false;
  error: string | null = null;

  constructor(private router: Router, private authService: AuthService) { }

  login() {
    this.isLoading = true;
    this.error = null;
    this.authService.loginWithGithub().subscribe({
      next: () => {
        this.router.navigate(['/recap/me']);
      },
      error: (err) => {
        console.error('Login failed', err);
        this.error = 'Login failed. Please try again.';
        this.isLoading = false;
      }
    });
  }
}
