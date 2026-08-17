// Cursor-based pagination helper.

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function encodeCursor(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

export function decodeCursor<T = Record<string, unknown>>(cursor: string): T {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    return {} as T;
  }
}

export function paginate<T extends { id: string }>(
  items: T[],
  limit: number
): CursorPage<T> {
  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;
  const last = sliced[sliced.length - 1];
  return {
    items: sliced,
    nextCursor: hasMore && last ? encodeCursor({ id: last.id }) : null,
  };
}
