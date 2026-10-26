import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

interface CatalogOption {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  price?: number;
  [key: string]: unknown;
}

interface EventRequest {
  eventTypeId: string;
  description: string;
  email: string;
  programmedDate: string;
  packId: string;
}

@Component({
  imports: [CommonModule, FormsModule, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = '/api';

  protected readonly eventTypes = signal<CatalogOption[]>([]);
  protected readonly packs = signal<CatalogOption[]>([]);
  protected readonly loadingCatalogs = signal(true);
  protected readonly catalogError = signal('');
  protected readonly submitting = signal(false);
  protected readonly success = signal(false);
  protected readonly submitError = signal('');
  protected readonly isAdminRoute = signal(false);
  protected readonly minEventDate = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  protected readonly form: EventRequest = {
    eventTypeId: '',
    description: '',
    email: '',
    programmedDate: '',
    packId: '',
  };

  constructor() {
    this.isAdminRoute.set(this.router.url.startsWith('/admin'));
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.isAdminRoute.set((event as NavigationEnd).urlAfterRedirects.startsWith('/admin'));
    });
    afterNextRender(() => this.loadCatalogs());
  }

  private loadCatalogs(): void {
    forkJoin({
      eventTypes: this.http.get<CatalogOption[]>(`${this.apiUrl}/event-types`),
      packs: this.http.get<CatalogOption[]>(`${this.apiUrl}/packs`),
    }).subscribe({
      next: ({ eventTypes, packs }) => {
        this.eventTypes.set(eventTypes);
        this.packs.set(packs);
        this.loadingCatalogs.set(false);
      },
      error: (error: HttpErrorResponse) => {
        const endpoint = error.url ? ` (${error.url})` : '';
        const detail = error.status === 405
          ? 'Spring Boot no admite GET en esta ruta.'
          : 'Comprueba que la API esté funcionando y vuelve a intentarlo.';
        this.catalogError.set(`No pudimos cargar las opciones${endpoint}. ${detail}`);
        this.loadingCatalogs.set(false);
      },
    });
  }

  protected optionLabel(option: CatalogOption): string {
    return option.name ?? option.title ?? option.description ?? 'Opción';
  }

  protected submitEvent(): void {
    this.success.set(false);
    this.submitError.set('');
    this.submitting.set(true);

    this.http.post(`${this.apiUrl}/events`, this.form).subscribe({
      next: () => {
        this.success.set(true);
        this.form.description = '';
        this.form.email = '';
        this.form.programmedDate = '';
        this.form.eventTypeId = '';
        this.form.packId = '';
        this.submitting.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.submitError.set(error.error?.message ?? 'No pudimos enviar tu solicitud. Inténtalo de nuevo en unos minutos.');
        this.submitting.set(false);
      },
    });
  }
}
