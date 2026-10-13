import { Component, ElementRef, output, viewChild } from '@angular/core';

@Component({
  selector: 'modal',
  standalone: true,
  templateUrl: './modal.html',
})
export class Modal {
  private dialogEl = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  requestClose = output<void>();

  ngAfterViewInit(): void {
    this.dialogEl().nativeElement.showModal();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.requestClose.emit();
    }
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.requestClose.emit();
  }
}
