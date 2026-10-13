import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorService } from './shared/error';
import { ErrorModal } from './shared/modal/error/error';
import { AppNavbarComponent } from './shared/ui/navbar/navbar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ErrorModal, AppNavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('dinkes');
  private readonly errorService = inject(ErrorService);

  error = this.errorService.error;
}
