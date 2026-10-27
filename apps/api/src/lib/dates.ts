// Colunas @db.Date são lidas/gravadas como meia-noite UTC; estas funções fazem a
// ponte com as strings "AAAA-MM-DD" / "AAAA-MM" usadas pela API.
import { todayISO, toISODate } from "@tributoleao/shared";

export function dateFromISO(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function monthFromISO(month: string): Date {
  return dateFromISO(`${month}-01`);
}

export function toISOMonth(date: Date): string {
  return toISODate(date).slice(0, 7);
}

export function today(): Date {
  return dateFromISO(todayISO());
}
