import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

/**
 * Session 42 — Analytics query contract (read-only, OLTP-derived).
 *
 * A date window `from`/`to` (inclusive, ISO-8601 date or datetime) scopes every
 * metric. Defaults: no window supplied => trailing DEFAULT_DAYS (30) days to now.
 * `from`/`to` are optional and independently validated; an unparseable value is a
 * 400. Whitelisted (forbidNonWhitelisted) so unknown query keys are rejected.
 */
export const ANALYTICS_DEFAULT_DAYS = 30;

export class AnalyticsQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Optional anchor for products/sellers lists (default +today) — same window. */
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month';
}

export class AnalyticsListQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Resolve a validated window into concrete Dates.
 * Returns { from, to } where `to` is inclusive (end-of-day if date-only).
 */
export function resolveWindow(from?: string, to?: string, defaultDays = ANALYTICS_DEFAULT_DAYS) {
  const now = new Date();
  let toDate: Date;
  if (to) {
    toDate = new Date(to.length <= 10 ? `${to}T23:59:59.999Z` : to);
  } else {
    toDate = now;
  }
  let fromDate: Date;
  if (from) {
    fromDate = new Date(from);
  } else {
    fromDate = new Date(toDate.getTime() - defaultDays * 86400000);
  }
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }
  return { from: fromDate, to: toDate };
}
