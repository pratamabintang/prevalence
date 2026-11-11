import { Component, input, signal } from '@angular/core';
import { DatasetTableModel } from './dataset-table.model';

@Component({
  selector: 'app-dataset-table',
  standalone: true,
  templateUrl: './dataset-table.component.html',
})
export class DatasetTableComponent {
  readonly model = input.required<DatasetTableModel>();
  readonly title = input('Masalah Gizi');
  readonly description = input('');
  readonly badgeLabel = input('');

  readonly contentExpanded = signal(false);

  toggleContent(): void {
    this.contentExpanded.update((v) => !v);
  }

  onHeaderKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleContent();
    }
  }
}
