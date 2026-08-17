// Tiny classnames helper (since we don't need full clsx surface here).
export function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}
