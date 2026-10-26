import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { afterNextRender, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

interface AdminRecord {
  id?: string;
  description?: string;
  name?: string;
  title?: string;
  price?: number;
  [key: string]: unknown;
}

type AdminSection = 'events' | 'eventTypes' | 'services' | 'packs';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
})
export class Admin {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  protected readonly loggedIn = signal(false);
  protected readonly activeSection = signal<AdminSection>('events');
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly username = signal('');
  protected readonly events = signal<AdminRecord[]>([]);
  protected readonly eventTypes = signal<AdminRecord[]>([]);
  protected readonly services = signal<AdminRecord[]>([]);
  protected readonly packs = signal<AdminRecord[]>([]);
  protected readonly credentials = { username: '', password: '' };
  protected readonly serviceForm = { description: '', price: null as number | null };
  protected readonly eventTypeForm = { description: '' };
  protected readonly packForm = { description: '', eventTypeId: '', serviceIds: [] as string[] };
  protected readonly attachForm = { packId: '', serviceId: '' };

  constructor() {
    afterNextRender(() => {
      const storage = sessionStorage;
      const savedUser = storage.getItem('events-admin-username');
      const loggedIn = storage.getItem('events-admin-session') === 'active';
      if (loggedIn) {
        this.username.set(savedUser ?? 'Administrador');
        this.loggedIn.set(true);
        this.loadData();
      }
    });
  }

  protected login(): void {
    this.clearMessages();
    this.busy.set(true);
    this.http.post<unknown>(`${this.apiUrl}/auth/login`, this.credentials, { withCredentials: true }).subscribe({
      next: (response) => {
        const token = this.findToken(response);
        if (token) sessionStorage.setItem('events-admin-token', token);
        sessionStorage.setItem('events-admin-session', 'active');
        sessionStorage.setItem('events-admin-username', this.credentials.username);
        this.username.set(this.credentials.username);
        this.loggedIn.set(true);
        this.credentials.password = '';
        this.busy.set(false);
        this.loadData();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.errorMessage(error, 'No pudimos iniciar sesión. Revisa tu usuario y contraseña.'));
        this.busy.set(false);
      },
    });
  }

  protected logout(): void {
    sessionStorage.removeItem('events-admin-token');
    sessionStorage.removeItem('events-admin-session');
    sessionStorage.removeItem('events-admin-username');
    this.loggedIn.set(false);
    this.credentials.username = '';
    this.credentials.password = '';
    this.clearMessages();
  }

  protected loadData(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      events: this.http.get<unknown>(`${this.apiUrl}/events`, this.requestOptions()),
      eventTypes: this.http.get<unknown>(`${this.apiUrl}/event-types`, this.requestOptions()),
      services: this.http.get<unknown>(`${this.apiUrl}/services`, this.requestOptions()),
      packs: this.http.get<unknown>(`${this.apiUrl}/packs`, this.requestOptions()),
    }).subscribe({
      next: (data) => {
        this.events.set(this.asRecords(data.events));
        this.eventTypes.set(this.asRecords(data.eventTypes));
        this.services.set(this.asRecords(data.services));
        this.packs.set(this.asRecords(data.packs));
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        const endpoint = error.url ? ` Falló ${error.url}.` : '';
        const detail = error.status === 405
          ? 'El backend no permite GET en ese endpoint; revisa el mapping del controlador Spring.'
          : this.errorMessage(error, 'No pudimos cargar los datos. Comprueba la sesión y vuelve a intentarlo.');
        this.error.set(`${detail}${endpoint}`);
        this.loading.set(false);
      },
    });
  }

  protected createService(): void {
    this.postAndRefresh('/services', { description: this.serviceForm.description.trim(), price: this.serviceForm.price }, 'Servicio creado.', () => {
      this.serviceForm.description = '';
      this.serviceForm.price = null;
    });
  }

  protected createEventType(): void {
    this.postAndRefresh('/event-types', { description: this.eventTypeForm.description.trim() }, 'Tipo de evento creado.', () => {
      this.eventTypeForm.description = '';
    });
  }

  protected createPack(): void {
    this.postAndRefresh('/packs', {
      description: this.packForm.description.trim(),
      eventTypeId: this.packForm.eventTypeId,
      serviceIds: [...this.packForm.serviceIds],
    }, 'Pack creado.', () => {
      this.packForm.description = '';
      this.packForm.eventTypeId = '';
      this.packForm.serviceIds = [];
    });
  }

  protected attachService(): void {
    const packId = this.attachForm.packId;
    const serviceId = this.attachForm.serviceId;
    if (!packId || !serviceId) return;
    this.postAndRefresh(`/packs/${encodeURIComponent(packId)}/services`, { serviceId }, 'Servicio agregado al pack.', () => {
      this.attachForm.serviceId = '';
    });
  }

  protected selectSection(section: AdminSection): void {
    this.activeSection.set(section);
    this.clearMessages();
  }

  protected label(record: AdminRecord): string {
    return record.description ?? record.name ?? record.title ?? 'Sin descripción';
  }

  protected eventTypeLabel(id: unknown): string {
    return this.lookupLabel(this.eventTypes(), id);
  }

  protected lookupPack(id: unknown): string {
    return this.lookupLabel(this.packs(), id);
  }

  protected serviceLabels(ids: unknown): string {
    if (!Array.isArray(ids)) return '—';
    return ids.map((id) => this.lookupLabel(this.services(), id)).join(', ') || '—';
  }

  protected displayValue(value: unknown): string {
    if (value == null || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  protected trackRecord(index: number, record: AdminRecord): string | number {
    return record.id ?? index;
  }

  private postAndRefresh(path: string, body: unknown, successMessage: string, onSuccess?: () => void): void {
    this.clearMessages();
    this.busy.set(true);
    this.http.post(`${this.apiUrl}${path}`, body, this.requestOptions()).subscribe({
      next: () => {
        this.notice.set(successMessage);
        onSuccess?.();
        this.busy.set(false);
        this.loadData();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.errorMessage(error, 'No pudimos completar la operación. Revisa los datos e inténtalo otra vez.'));
        this.busy.set(false);
      },
    });
  }

  private requestOptions(): { headers: HttpHeaders; withCredentials: boolean } {
    const token = sessionStorage.getItem('events-admin-token');
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return { headers, withCredentials: true };
  }

  private asRecords(value: unknown): AdminRecord[] {
    if (Array.isArray(value)) return value as AdminRecord[];
    if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      for (const key of ['content', 'items', 'data', 'events', 'services', 'packs', 'eventTypes']) {
        if (Array.isArray(object[key])) return object[key] as AdminRecord[];
      }
    }
    return [];
  }

  private lookupLabel(records: AdminRecord[], id: unknown): string {
    if (!id) return '—';
    if (typeof id === 'object') {
      const value = id as AdminRecord;
      if (value.description || value.name || value.title) return this.label(value);
      id = value.id;
    }
    const record = records.find((item) => item.id === id);
    return record ? this.label(record) : String(id);
  }

  private findToken(value: unknown): string | null {
    if (typeof value === 'string' && value.split('.').length === 3) return value;
    if (!value || typeof value !== 'object') return null;
    const object = value as Record<string, unknown>;
    for (const key of ['token', 'accessToken', 'access_token', 'jwt']) {
      if (typeof object[key] === 'string') return object[key] as string;
    }
    for (const nested of Object.values(object)) {
      if (nested && typeof nested === 'object') {
        const token = this.findToken(nested);
        if (token) return token;
      }
    }
    return null;
  }

  private errorMessage(error: HttpErrorResponse, fallback: string): string {
    if (typeof error.error === 'string' && error.error.trim()) return error.error;
    return error.error?.message ?? error.error?.detail ?? fallback;
  }

  private clearMessages(): void {
    this.error.set('');
    this.notice.set('');
  }
}
