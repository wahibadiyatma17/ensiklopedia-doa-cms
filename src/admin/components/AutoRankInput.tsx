import * as React from 'react';
import { useField, useFetchClient } from '@strapi/strapi/admin';
import { Field, NumberInput } from '@strapi/design-system';

const UID = 'api::category.category';
const MAIN_CATEGORY_FIELD = 'Main Category';

/**
 * A value still counts as "empty" (i.e. eligible for auto-fill) when it is
 * null/undefined or equal to the schema default of 99. Any other number means
 * the user (or an existing entry) already has a real rank, so we leave it.
 */
const needsAutoFill = (value: unknown) =>
  value === null || value === undefined || value === '' || value === 99;

type AutoRankInputProps = {
  name: string;
  value?: number | null;
  onChange: (event: {
    target: { name: string; value: number | null; type: string };
  }) => void;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  labelAction?: React.ReactNode;
  placeholder?: string;
};

const AutoRankInput = React.forwardRef<HTMLInputElement, AutoRankInputProps>(
  (props, ref) => {
    const {
      name,
      value,
      onChange,
      label,
      hint,
      error,
      required,
      disabled,
      labelAction,
      placeholder,
    } = props;

    const { get } = useFetchClient();
    const mainCategory = useField(MAIN_CATEGORY_FIELD);
    const isMainCategory = mainCategory?.value === true;

    // Guard so we only auto-fill once per "toggle on", and never clobber a
    // value the user has typed themselves.
    const hasAutoFilled = React.useRef(false);

    const setValue = React.useCallback(
      (next: number | null) => {
        onChange({ target: { name, value: next, type: 'number' } });
      },
      [onChange, name]
    );

    React.useEffect(() => {
      // When Main Category is turned off, reset so toggling back re-fetches.
      if (!isMainCategory) {
        hasAutoFilled.current = false;
        return;
      }
      if (hasAutoFilled.current || !needsAutoFill(value)) return;

      hasAutoFilled.current = true;
      let cancelled = false;

      (async () => {
        try {
          // Let the fetch client serialize the query (matches the pattern in
          // extensions/components/CategoryArticlesList.tsx and handles the
          // space in "Main Category" correctly).
          const { data } = await get(
            `/content-manager/collection-types/${UID}`,
            {
              params: {
                page: 1,
                pageSize: 1,
                sort: 'rank:desc',
                fields: ['rank'],
                filters: { [MAIN_CATEGORY_FIELD]: { $eq: true } },
              },
            }
          );

          const highest = data?.results?.[0];
          const highestRank =
            typeof highest?.rank === 'number' ? highest.rank : 0;

          if (!cancelled) setValue(highestRank + 1);
        } catch {
          // Re-arm so a transient failure can retry on the next render.
          hasAutoFilled.current = false;
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [isMainCategory, value, get, setValue]);

    return (
      <Field.Root name={name} error={error} hint={hint} required={required}>
        <Field.Label action={labelAction}>{label}</Field.Label>
        <NumberInput
          ref={ref}
          value={value ?? undefined}
          onValueChange={(next) => setValue(next ?? null)}
          disabled={disabled}
          placeholder={placeholder}
        />
        <Field.Hint />
        <Field.Error />
      </Field.Root>
    );
  }
);

AutoRankInput.displayName = 'AutoRankInput';

export default AutoRankInput;
