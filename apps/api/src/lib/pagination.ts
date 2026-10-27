import type { PageMeta } from "@tributoleao/shared";

export function pageArgs(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageMeta(page: number, pageSize: number, total: number): PageMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
