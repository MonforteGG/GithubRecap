import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface GithubUser {
  login: string;
  avatar_url: string;
  name: string;
  bio: string;
  location: string;
  blog: string;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GithubRepo {
  name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  language: string;
  pushed_at: string;
  homepage: string; // url
  commitCount?: number; // Added for recap sorting
}

@Injectable({
  providedIn: 'root'
})
export class GithubService {
  private apiUrl = 'https://api.github.com';

  constructor(private http: HttpClient, private authService: AuthService) { }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getGithubToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getUser(username: string): Observable<GithubUser> {
    if (username === 'me') {
      return this.http.get<GithubUser>(`${this.apiUrl}/user`, { headers: this.getHeaders() });
    }
    return this.http.get<GithubUser>(`${this.apiUrl}/users/${username}`, { headers: this.getHeaders() });
  }

  getRepos(username: string): Observable<GithubRepo[]> {
    // If username is 'me' (our convention for auth user), we fetch proper private repos
    if (username === 'me') {
      return this.http.get<GithubRepo[]>(`${this.apiUrl}/user/repos?per_page=100&sort=pushed&type=all`, { headers: this.getHeaders() });
    }
    return this.http.get<GithubRepo[]>(`${this.apiUrl}/users/${username}/repos?per_page=100&sort=pushed`, { headers: this.getHeaders() });
  }

  // Helper to search issues/PRs
  searchIssues(query: string): Observable<{ total_count: number }> {
    return this.http.get<{ total_count: number }>(`${this.apiUrl}/search/issues?q=${encodeURIComponent(query)}`, { headers: this.getHeaders() });
  }

  // Helper to search commits (Requires preview header)
  searchCommits(query: string, page: number = 1): Observable<{ total_count: number, items: any[] }> {
    return this.http.get<{ total_count: number, items: any[] }>(`${this.apiUrl}/search/commits?q=${encodeURIComponent(query)}&per_page=100&page=${page}`, { headers: this.getHeaders() });
  }

  getParticipation(owner: string, repo: string): Observable<{ all: number[], owner: number[] }> {
    return this.http.get<{ all: number[], owner: number[] }>(`${this.apiUrl}/repos/${owner}/${repo}/stats/participation`, { headers: this.getHeaders() });
  }

  getContributors(owner: string, repo: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/repos/${owner}/${repo}/contributors`, { headers: this.getHeaders() });
  }
}
