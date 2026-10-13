import { Component, computed, inject, input } from '@angular/core';
import { ErrorService } from '../../error';
import { Modal } from '../modal';

@Component({
  selector: 'error-modal',
  standalone: true,
  templateUrl: './error.html',
  imports: [Modal],
})
export class ErrorModal {
  private readonly errorService = inject(ErrorService);

  message = input<string[]>();

  readonly safeMessages = computed<string[]>(() => {
    const msg = this.message();
    if (Array.isArray(msg) && msg.length) return msg;
    return ['unknown error'];
  });

  onClearError(): void {
    this.errorService.clearError();
  }

  async copyError(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.safeMessages().join('\n- '));
    } catch {
      console.warn('clipboard unavailable/ need permission');
    }
  }
}
