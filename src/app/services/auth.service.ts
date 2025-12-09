import { Injectable, inject } from '@angular/core';
import { Auth, GithubAuthProvider, signInWithPopup, User, user, getIdTokenResult } from '@angular/fire/auth';
import { Observable, from, map } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth = inject(Auth);
    user$: Observable<User | null> = user(this.auth);

    loginWithGithub() {
        const provider = new GithubAuthProvider();
        provider.addScope('repo'); // Request repo scope for private data
        return from(signInWithPopup(this.auth, provider)).pipe(
            map(credential => {
                // Extract the OAuth Access Token
                const credentialAny = credential as any;
                const token = GithubAuthProvider.credentialFromResult(credential)?.accessToken;
                if (token) {
                    this.setGithubToken(token);
                }
                return credential;
            })
        );
    }

    logout() {
        return from(this.auth.signOut());
    }

    // Get the OAuth Access Token. Note: Firebase Auth tokens (JWT) are different from the Provider Access Token (OAuth).
    // Getting the actual GitHub Access Token via Firebase SDK client-side is tricky.
    // signInWithPopup returns a UserCredential which contains `credential.accessToken`.
    // We need to store this token upon login because we can't get it later from the Auth object easily in client SDKs.
    // We will manage it in local state or localStorage for this session.

    private _githubAccessToken: string | null = null;

    setGithubToken(token: string) {
        this._githubAccessToken = token;
        localStorage.setItem('gh_token', token);
    }

    getGithubToken(): string | null {
        return this._githubAccessToken || localStorage.getItem('gh_token');
    }
}
