import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RecapService, RecapData } from '../../services/recap.service';
import { catchError, of } from 'rxjs';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-recap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recap.component.html',
  styleUrl: './recap.component.css'
})
export class RecapComponent implements OnInit {
  username: string = '';
  recapData: RecapData | null = null;
  loading: boolean = true;
  error: string | null = null;
  currentSlide: number = 0;
  totalSlides: number = 5;
  isDownloading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recapService: RecapService
  ) { }

  ngOnInit() {
    this.username = this.route.snapshot.paramMap.get('username') || '';
    if (!this.username) {
      this.router.navigate(['/']);
      return;
    }

    this.recapService.getRecap(this.username).pipe(
      catchError(err => {
        this.error = 'Could not load data. User might not exist or rate limit exceeded.';
        this.loading = false;
        return of(null);
      })
    ).subscribe(data => {
      this.recapData = data;
      this.loading = false;
    });
  }

  getIcon(lang: string): string {
    const l = lang.toLowerCase();
    const map: { [key: string]: string } = {
      'TypeScript': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
      'JavaScript': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
      'Python': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
      'Java': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
      'C#': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg',
      'HTML': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg',
      'CSS': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg',
      'Angular': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg',
      'React': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
      'Vue': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg',
      'Go': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original-wordmark.svg',
      'Rust': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg'
    };
    return map[l] || `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${l}/${l}-original.svg`;
  }

  getMaxActivity(): number {
    if (!this.recapData?.stats2025?.weeklyActivity) return 1;
    return Math.max(...this.recapData.stats2025.weeklyActivity);
  }

  getMonthName(index: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[index % 12];
  }

  nextSlide() {
    if (this.currentSlide < this.totalSlides - 1) {
      this.currentSlide++;
    }
  }

  prevSlide() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    }
  }

  restart() {
    this.router.navigate(['/']);
  }

  downloadCard() {
    this.isDownloading = true;
    // Wait for the button to hide (via boolean if we wanted, but here we might just want to capture everything)
    // Actually typically we want to hide the download button itself.

    // We'll target the slide content.
    const element = document.getElementById('recap-card');
    if (element) {
      html2canvas(element, {
        backgroundColor: null, // Transparent background
        scale: 2, // Retina quality
        useCORS: true // For images
      } as any).then(canvas => {
        const link = document.createElement('a');
        link.download = `github-recap-2025-${this.username}-slide-${this.currentSlide}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.isDownloading = false;
      }).catch(err => {
        console.error('Download failed', err);
        this.isDownloading = false;
      });
    } else {
      this.isDownloading = false;
    }
  }
}
