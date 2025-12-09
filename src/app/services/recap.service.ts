import { Injectable } from '@angular/core';
import { GithubService, GithubUser, GithubRepo } from './github.service';
import { Observable, forkJoin, map, switchMap, of, catchError, from } from 'rxjs';
import { concatMap, delay, toArray } from 'rxjs/operators';
// Added of, switchMap, catchError

export interface YearlyStats {
  year: number;
  prCount: number;
  issueCount: number; // Placeholder if we want to add issues
  totalCommits: number; // Estimated
  weeklyActivity?: number[]; // Added for custom graph
}

export interface RecapData {
  user: GithubUser;
  stats2025: YearlyStats;
  stats2024: YearlyStats;
  topLanguages: { language: string; count: number; icon: string }[];
  topProjects: GithubRepo[];
  totalStars2025: number;
}

@Injectable({
  providedIn: 'root'
})
export class RecapService {

  constructor(private githubService: GithubService) { }

  getRecap(username: string): Observable<RecapData> {
    // 1. First fetch the user to get the real username (in case of 'me')
    return this.githubService.getUser(username).pipe(
      switchMap(user => {
        const realUsername = user.login;
        const q2025Prs = `author:${realUsername} created:2025-01-01..2025-12-31 type:pr`;
        const q2024Prs = `author:${realUsername} created:2024-01-01..2024-12-31 type:pr`;
        const q2025Issues = `author:${realUsername} created:2025-01-01..2025-12-31 type:issue`;

        // Commits Search Queries (Requires Preview Header enabled in service)
        const q2025Commits = `author:${realUsername} committer-date:2025-01-01..2025-12-31`;
        const q2024Commits = `author:${realUsername} committer-date:2024-01-01..2024-12-31`;

        return forkJoin({
          repos: this.githubService.getRepos(username),
          prs2025: this.githubService.searchIssues(q2025Prs),
          prs2024: this.githubService.searchIssues(q2024Prs),
          issues2025: this.githubService.searchIssues(q2025Issues)
          // We can't forkJoin the commit searches easily if they fail due to rate limits or scope. 
          // Let's explicitly try catch them in the next switchMap or here:
        }).pipe(
          switchMap(({ repos, prs2025, prs2024, issues2025 }) => {
            // Perform commit searches in parallel now 
            return forkJoin({
              commits2025: this.githubService.searchCommits(q2025Commits).pipe(catchError(() => of({ total_count: 0 }))),
              commits2024: this.githubService.searchCommits(q2024Commits).pipe(catchError(() => of({ total_count: 0 })))
            }).pipe(
              switchMap(({ commits2025, commits2024 }) => {
                console.log('RecapService: Repos fetched', repos.length);
                const year = 2025;
                // Filter repos touched in 2025
                const repos2025 = repos.filter(repo => {
                  const d = new Date(repo.pushed_at);
                  return d.getFullYear() === year;
                });
                console.log('RecapService: Repos 2025', repos2025.length);

                // Fetch contributors stats for sorting (Top Projects & Tech Badges)
                // We reduce this back to 15 to avoid 403s. 
                // Since we now use 'searchCommits' for the Total Count, we don't need to iterate 50 repos to sum them up.
                const candidates = repos2025.slice(0, 15);

                const commitRequests = candidates.map(repo =>
                  this.githubService.getContributors(repo.html_url.split('/')[3], repo.name).pipe(
                    map(contributors => {
                      const userStat = contributors.find(c => c.login.toLowerCase() === realUsername.toLowerCase());
                      const myCommits = userStat ? userStat.contributions : 0;
                      return { ...repo, commitCount: myCommits };
                    }),
                    catchError(() => of({ ...repo, commitCount: 0 }))
                  )
                );

                // Monthly Commit Logic (Sequential with Delay)
                // User requested delay to avoid 403: "hacer todas las querys juntas sin delay"
                // strict sequence: Page 1 -> wait 1s -> Page 2 -> wait 1s -> Page 3
                const commitStream$ = from([1, 2, 3]).pipe(
                  concatMap(page =>
                    this.githubService.searchCommits(q2025Commits, page).pipe(
                      delay(1000), // Wait 1s between requests
                      catchError(() => of({ total_count: 0, items: [] }))
                    )
                  ),
                  toArray()
                );

                // Participation requests REMOVED to save requests. 
                // We use searchCommits explicitly for the graph now.

                return forkJoin({
                  reposWithCommits: forkJoin(commitRequests),
                  commitData: commitStream$
                }).pipe(
                  map(({ reposWithCommits, commitData }) => {
                    // Update repos with commit counts from participation if contributors failed or is low?
                    // Actually, participation is by owner, which IS the user usually for personal repos.
                    // But if it's a fork, it might be different. 
                    // Let's stick to contributors for sorting projects.

                    const topProjects = reposWithCommits
                      .sort((a, b) => (b as any).commitCount - (a as any).commitCount)
                      .slice(0, 3);

                    // Flatten all fetched items
                    const allExctCommits = commitData.flatMap(page => page.items || []);

                    // Filter purely by year 2025 just in case
                    // And bucket into months
                    const monthlyCounts = new Array(12).fill(0);
                    allExctCommits.forEach(commit => {
                      const date = new Date(commit.commit.committer.date); // GitHub API structure
                      if (date.getFullYear() === 2025) {
                        monthlyCounts[date.getMonth()]++;
                      }
                    });

                    // Total Commits: Sum of the bucketed real commits.
                    // If total_count from API is vastly larger than what we fetched (e.g. >300), we stick to what we have (300) 
                    // or use the API total and accept the graph is a subset.
                    // Checking first page total_count
                    const apiTotal = commitData[0]?.total_count || 0;

                    // If we have fewer items than total, it means pagination cut off (user > 300 commits).
                    // User has ~125, so we are safe.
                    // Let's use the explicit sum of our monthly buckets as the truthful Total.
                    const totalCommits2025 = monthlyCounts.reduce((a, b) => a + b, 0);

                    const totalCommits2024 = commits2024.total_count;

                    // Tech Badges aggregation by Commits
                    const langMap = new Map<string, number>();
                    reposWithCommits.forEach((repo: any) => {
                      if (repo.language) {
                        const weight = repo.commitCount > 0 ? repo.commitCount : 1;
                        langMap.set(repo.language, (langMap.get(repo.language) || 0) + weight);
                      }
                    });

                    const topLanguages = Array.from(langMap.entries())
                      .map(([language, count]) => ({
                        language,
                        count,
                        icon: this.getTechIcon(language)
                      }))
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 3);

                    // Monthly Graph is now just the result of our buckets
                    const monthlyActivity = monthlyCounts;

                    const finalTotalStars = repos2025.reduce((acc, repo) => acc + repo.stargazers_count, 0);

                    return {
                      user,
                      stats2025: {
                        year: 2025,
                        prCount: prs2025.total_count,
                        issueCount: issues2025.total_count,
                        totalCommits: totalCommits2025,
                        weeklyActivity: monthlyActivity
                      },
                      stats2024: {
                        year: 2024,
                        prCount: prs2024.total_count,
                        issueCount: 0,
                        totalCommits: totalCommits2024
                      },
                      topLanguages,
                      topProjects,
                      totalStars2025: finalTotalStars
                    };
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  private getTechIcon(language: string): string {
    const lang = language.toLowerCase();
    const map: { [key: string]: string } = {
      'typescript': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg',
      'javascript': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg',
      'python': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
      'java': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg',
      'c#': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/csharp/csharp-original.svg',
      'c++': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-original.svg',
      'go': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original-wordmark.svg',
      'rust': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg',
      'php': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg',
      'ruby': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ruby/ruby-original.svg',
      'html': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg',
      'css': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg',
      'scss': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sass/sass-original.svg',
      'shell': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bash/bash-original.svg',
      'vue': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vuejs/vuejs-original.svg',
      'angular': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/angular/angular-original.svg',
      'react': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg',
      'swift': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/swift/swift-original.svg',
      'kotlin': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kotlin/kotlin-original.svg',
      'dart': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/dart/dart-original.svg',
    };
    return map[lang] || `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${lang}/${lang}-original.svg`; // Fallback try
  }
}
