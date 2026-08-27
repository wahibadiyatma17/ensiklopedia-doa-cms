import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from 'styled-components';
import { useFetchClient, useQueryParams } from '@strapi/strapi/admin';
import {
  Box,
  Button,
  DatePicker,
  Divider,
  Field,
  Flex,
  Loader,
  Popover,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { Calendar } from '@strapi/icons';
import {
  HIJRI_MONTHS,
  MONTH_START_TYPE,
  UID,
  findMonthStart,
  hijriToUtc,
  toIsoDate,
  toMonthStarts,
} from '../../api/calendar-entry/hijri';
import type { MonthStart, MonthStartRow } from '../../api/calendar-entry/hijri';

type Bound = '$gte' | '$lte';
type Clause = Record<string, Record<string, unknown>>;
type ListQuery = {
  filters?: { $and?: Clause[] } & Record<string, unknown>;
  page?: number | string;
};
type Range = { from?: string; to?: string };
type HijriPoint = { day: string; month: string; year: string };
type CalendarMode = 'gregorian' | 'hijri';

const EMPTY_POINT: HijriPoint = { day: '', month: '', year: '' };

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const pad = (n: number) => String(n).padStart(2, '0');

const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromIso = (iso: string | undefined): Date | undefined => {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
};

const formatIso = (iso: string | undefined) => {
  const date = fromIso(iso);
  return date ? DATE_FORMAT.format(date) : undefined;
};

const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

const boundOf = (clause: Clause): Bound | undefined => {
  const keys = Object.keys(clause);
  const operators = Object.keys(clause.date ?? {});
  if (keys.length !== 1 || keys[0] !== 'date' || operators.length !== 1) return undefined;
  return operators[0] === '$gte' || operators[0] === '$lte' ? operators[0] : undefined;
};

const boundValue = (clauses: Clause[], bound: Bound) => {
  const clause = clauses.find((candidate) => boundOf(candidate) === bound);
  const value = clause?.date[bound];
  return typeof value === 'string' ? value : undefined;
};

const resolveHijri = (
  point: HijriPoint,
  starts: MonthStart[],
  edge: 'start' | 'end',
): { iso?: string; error?: string } => {
  if (!point.day && !point.month && !point.year) return {};
  if (!point.month || !point.year) return { error: 'Pick both a Hijri month and year.' };

  const start = findMonthStart(starts, point.month, Number(point.year));
  if (!start) return { error: `${point.month} ${point.year} is not in the month-start table yet.` };

  const day = point.day ? Number(point.day) : edge === 'start' ? 1 : start.length;
  if (day < 1 || day > start.length) {
    return { error: `${point.month} ${point.year} has only ${start.length} days.` };
  }
  return { iso: toIsoDate(hijriToUtc(start, day)) };
};

const useDateRangeQuery = () => {
  const [{ query }, setQuery] = useQueryParams<ListQuery>();
  const clauses = React.useMemo(
    () => (Array.isArray(query.filters?.$and) ? query.filters.$and : []),
    [query.filters],
  );

  const applied = React.useMemo<Range>(
    () => ({ from: boundValue(clauses, '$gte'), to: boundValue(clauses, '$lte') }),
    [clauses],
  );

  const write = React.useCallback(
    (range: Range) => {
      const { $and: _replaced, ...otherFilters } = query.filters ?? {};
      const next = [
        ...clauses.filter((clause) => !boundOf(clause)),
        ...(range.from ? [{ date: { $gte: range.from } }] : []),
        ...(range.to ? [{ date: { $lte: range.to } }] : []),
      ];
      const hasOtherFilters = Object.keys(otherFilters).length > 0;
      setQuery({
        filters: next.length ? { ...otherFilters, $and: next } : hasOtherFilters ? otherFilters : undefined,
        page: 1,
      });
    },
    [clauses, query.filters, setQuery],
  );

  return { applied, write };
};

const useMonthStarts = (enabled: boolean) => {
  const { get } = useFetchClient();
  const [starts, setStarts] = React.useState<MonthStart[]>();
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || starts || failed) return;
    let cancelled = false;

    (async () => {
      try {
        const rows: MonthStartRow[] = [];
        for (let page = 1, pageCount = 1; page <= pageCount; page++) {
          const { data } = await get(`/content-manager/collection-types/${UID}`, {
            params: {
              page,
              pageSize: 100,
              sort: 'date:asc',
              fields: ['date', 'hijriMonth', 'hijriYear'],
              filters: { type: { $eq: MONTH_START_TYPE } },
            },
          });
          rows.push(...(data?.results ?? []));
          pageCount = data?.pagination?.pageCount ?? 1;
        }
        if (!cancelled) setStarts(toMonthStarts(rows));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, starts, failed, get]);

  return { starts, failed };
};

type HijriPointFieldsProps = {
  name: string;
  title: string;
  hint: string;
  value: HijriPoint;
  onChange: (next: HijriPoint) => void;
};

const HijriPointFields = ({ name, title, hint, value, onChange }: HijriPointFieldsProps) => (
  <Flex direction="column" alignItems="stretch" gap={1}>
    <Typography variant="pi" fontWeight="bold" textColor="neutral600">
      {title}
    </Typography>
    <Flex gap={2} alignItems="flex-end">
      <Field.Root name={`${name}-day`} width="5rem" shrink={0}>
        <Field.Label>Day</Field.Label>
        <TextInput
          placeholder="—"
          value={value.day}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...value, day: digits(event.target.value, 2) })
          }
        />
      </Field.Root>
      <Field.Root name={`${name}-month`} flex="1" minWidth={0}>
        <Field.Label>Month</Field.Label>
        <SingleSelect
          placeholder="Month"
          value={value.month}
          onChange={(month) => onChange({ ...value, month: String(month ?? '') })}
          onClear={() => onChange({ ...value, month: '' })}
        >
          {HIJRI_MONTHS.map((month) => (
            <SingleSelectOption key={month} value={month}>
              {month}
            </SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>
      <Field.Root name={`${name}-year`} width="6rem" shrink={0}>
        <Field.Label>Year</Field.Label>
        <TextInput
          placeholder="1447"
          value={value.year}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...value, year: digits(event.target.value, 4) })
          }
        />
      </Field.Root>
    </Flex>
    <Typography variant="pi" textColor="neutral500">
      {hint}
    </Typography>
  </Flex>
);

const DateRangePopover = () => {
  const theme = useTheme();
  const { applied, write } = useDateRangeQuery();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<CalendarMode>('gregorian');
  const [from, setFrom] = React.useState<Date>();
  const [to, setTo] = React.useState<Date>();
  const [hijriFrom, setHijriFrom] = React.useState(EMPTY_POINT);
  const [hijriTo, setHijriTo] = React.useState(EMPTY_POINT);
  const { starts, failed } = useMonthStarts(open && mode === 'hijri');

  React.useEffect(() => {
    if (!open) return;
    setFrom(fromIso(applied.from));
    setTo(fromIso(applied.to));
    if (!applied.from && !applied.to) {
      setHijriFrom(EMPTY_POINT);
      setHijriTo(EMPTY_POINT);
    }
  }, [open, applied.from, applied.to]);

  const resolved = React.useMemo<Range & { error?: string }>(() => {
    if (mode === 'gregorian') {
      return { from: from && toIso(from), to: to && toIso(to) };
    }
    if (!starts) return {};
    const start = resolveHijri(hijriFrom, starts, 'start');
    const end = resolveHijri(hijriTo, starts, 'end');
    return { from: start.iso, to: end.iso, error: start.error ?? end.error };
  }, [mode, from, to, hijriFrom, hijriTo, starts]);

  const outOfOrder = Boolean(resolved.from && resolved.to && resolved.from > resolved.to);
  const error = resolved.error ?? (outOfOrder ? 'The end date is before the start date.' : undefined);
  const canApply = !error && Boolean(resolved.from || resolved.to);

  const apply = () => {
    write({ from: resolved.from, to: resolved.to });
    setOpen(false);
  };

  const reset = () => {
    setFrom(undefined);
    setTo(undefined);
    setHijriFrom(EMPTY_POINT);
    setHijriTo(EMPTY_POINT);
    write({});
    setOpen(false);
  };

  const appliedFrom = formatIso(applied.from);
  const appliedTo = formatIso(applied.to);
  const label =
    appliedFrom && appliedTo
      ? `${appliedFrom} – ${appliedTo}`
      : appliedFrom
        ? `From ${appliedFrom}`
        : appliedTo
          ? `Until ${appliedTo}`
          : 'Date range';

  const previewFrom = formatIso(resolved.from);
  const previewTo = formatIso(resolved.to);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <Button variant="tertiary" startIcon={<Calendar />}>
          {label}
        </Button>
      </Popover.Trigger>
      <Popover.Content
        align="end"
        sideOffset={4}
        collisionPadding={16}
        style={{ zIndex: theme.zIndices.popover - 1 }}
      >
        <Box padding={4} width="26rem" maxWidth="100vw">
          <Flex direction="column" alignItems="stretch" gap={3}>
            <Field.Root name="range-calendar">
              <Field.Label>Calendar</Field.Label>
              <SingleSelect value={mode} onChange={(value) => setMode(value as CalendarMode)}>
                <SingleSelectOption value="gregorian">Gregorian</SingleSelectOption>
                <SingleSelectOption value="hijri">Hijri</SingleSelectOption>
              </SingleSelect>
            </Field.Root>

            <Divider />

            {mode === 'gregorian' ? (
              <Flex direction="column" alignItems="stretch" gap={3}>
                <Field.Root name="range-from" width="100%">
                  <Field.Label>From</Field.Label>
                  <DatePicker value={from} onChange={setFrom} onClear={() => setFrom(undefined)} />
                </Field.Root>
                <Field.Root name="range-to" width="100%">
                  <Field.Label>To</Field.Label>
                  <DatePicker value={to} onChange={setTo} onClear={() => setTo(undefined)} />
                </Field.Root>
              </Flex>
            ) : failed ? (
              <Typography variant="pi" textColor="danger600">
                Could not load the month-start table. Close and reopen to retry.
              </Typography>
            ) : !starts ? (
              <Flex justifyContent="center" padding={4}>
                <Loader small>Loading the month-start table…</Loader>
              </Flex>
            ) : (
              <Flex direction="column" alignItems="stretch" gap={3}>
                <HijriPointFields
                  name="hijri-from"
                  title="From"
                  hint="Leave Day empty to start at the first day of the month."
                  value={hijriFrom}
                  onChange={setHijriFrom}
                />
                <HijriPointFields
                  name="hijri-to"
                  title="To"
                  hint="Leave Day empty to end at the last day of the month."
                  value={hijriTo}
                  onChange={setHijriTo}
                />
              </Flex>
            )}

            <Divider />

            {error ? (
              <Typography variant="pi" textColor="danger600">
                {error}
              </Typography>
            ) : previewFrom || previewTo ? (
              <Typography variant="pi" textColor="neutral600">
                {`${previewFrom ?? 'Any'} → ${previewTo ?? 'Any'}`}
              </Typography>
            ) : (
              <Typography variant="pi" textColor="neutral500">
                Either side may be left empty.
              </Typography>
            )}

            <Flex gap={2} justifyContent="flex-end">
              <Button variant="tertiary" onClick={reset}>
                Reset
              </Button>
              <Button onClick={apply} disabled={!canApply}>
                Apply
              </Button>
            </Flex>
          </Flex>
        </Box>
      </Popover.Content>
    </Popover.Root>
  );
};

const CalendarDateRangeFilter = () => {
  const { pathname } = useLocation();
  return pathname.includes(UID) ? <DateRangePopover /> : null;
};

export default CalendarDateRangeFilter;
