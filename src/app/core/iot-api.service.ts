import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL, ENDPOINTS } from './api-endpoints';
import { ApiRecord, EndpointDefinition } from './app.models';

@Injectable({ providedIn: 'root' })
export class IotApiService {
  readonly endpoints = ENDPOINTS;

  constructor(private readonly http: HttpClient) {}

  list(endpoint: EndpointDefinition): Observable<ApiRecord[]> {
    return this.http
      .get<ApiRecord[] | { results: ApiRecord[] }>(this.url(endpoint))
      .pipe(map((response) => (Array.isArray(response) ? response : response.results ?? [])));
  }

  create(endpoint: EndpointDefinition, payload: ApiRecord): Observable<ApiRecord> {
    return this.http.post<ApiRecord>(this.url(endpoint), payload);
  }

  update(endpoint: EndpointDefinition, id: string | number, payload: ApiRecord): Observable<ApiRecord> {
    return this.http.put<ApiRecord>(`${this.url(endpoint)}${id}/`, payload);
  }

  remove(endpoint: EndpointDefinition, id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.url(endpoint)}${id}/`);
  }

  private url(endpoint: EndpointDefinition): string {
    return `${API_BASE_URL}/${endpoint.path}`;
  }
}
