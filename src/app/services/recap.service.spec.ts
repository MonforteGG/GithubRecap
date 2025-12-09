import { TestBed } from '@angular/core/testing';
import { RecapService } from './recap.service';
import { GithubService, GithubUser, GithubRepo } from './github.service';
import { of } from 'rxjs';

describe('RecapService', () => {
    let service: RecapService;
    let githubServiceSpy: jasmine.SpyObj<GithubService>;

    beforeEach(() => {
        const spy = jasmine.createSpyObj('GithubService', ['getUser', 'getRepos', 'searchIssues', 'searchCommits', 'getContributors', 'getParticipation']); // Added searchCommits

        TestBed.configureTestingModule({
            providers: [
                RecapService,
                { provide: GithubService, useValue: spy }
            ]
        });
        service = TestBed.inject(RecapService);
        githubServiceSpy = TestBed.inject(GithubService) as jasmine.SpyObj<GithubService>;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should generate correct recap with monthly stats', (done) => {
        // 1. Mock Data
        const mockUser: GithubUser = {
            login: 'Ivan',
            name: 'Ivan Developer',
            followers: 76,
            public_repos: 10,
            avatar_url: 'url',
            bio: 'Bio',
            location: 'Loc',
            blog: 'blog',
            following: 10
        };

        const mockRepos: GithubRepo[] = [
            { name: 'Repo1', html_url: 'http://github.com/Ivan/Repo1', description: 'Desc', stargazers_count: 5, language: 'TypeScript', pushed_at: '2025-05-01T00:00:00Z', homepage: '' }
        ];

        githubServiceSpy.searchIssues.and.returnValue(of({ total_count: 5 }));
        githubServiceSpy.searchCommits.and.returnValue(of({ total_count: 100 })); // Mock commit searches

        githubServiceSpy.getUser.and.returnValue(of(mockUser));
        githubServiceSpy.getRepos.and.returnValue(of(mockRepos));

        githubServiceSpy.getContributors.and.returnValue(of([]));

        // Monthly Aggregation Test
        // 52 weeks of '1' commit each = 52 commits.
        // aggregated into 12 months -> approx 4-5 per month.
        githubServiceSpy.getParticipation.and.returnValue(of({ all: [], owner: Array(52).fill(1) }));

        service.getRecap('Ivan').subscribe(data => {
            expect(data.stats2025.weeklyActivity?.length).toBe(12); // Should be 12 months now
            expect(data.stats2025.totalCommits).toBe(100); // Should use search API count
            done();
        });
    });
});
