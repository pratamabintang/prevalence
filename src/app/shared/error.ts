import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ErrorService {
  private _error = signal<string[]>([]);

  error = this._error.asReadonly();

  showError(message: string | string[]) {
    const errors = Array.isArray(message) ? message : [message];
    this._error.set(errors);
  }

  clearError() {
    this._error.set([]);
  }
}
