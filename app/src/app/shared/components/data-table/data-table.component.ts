import { Component, input, output, computed } from '@angular/core';

export interface Column {
  key: string;
  label: string;
  width?: string;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  templateUrl: './data-table.component.html',
})
export class DataTableComponent {
  readonly columns  = input.required<Column[]>();
  readonly rows     = input<Record<string, unknown>[]>([]);
  readonly total    = input(0);
  readonly page     = input(1);
  readonly limit    = input(20);
  readonly loading  = input(false);
  readonly pageChange = output<number>();
  readonly rowClick   = output<Record<string, unknown>>();

  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit()) || 1);
  readonly pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1)
  );

  cell(row: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((obj, k) =>
      obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[k] : undefined, row);
  }

  cellStr(row: Record<string, unknown>, key: string): string {
    const val = this.cell(row, key);
    return val != null ? String(val) : '—';
  }
}
