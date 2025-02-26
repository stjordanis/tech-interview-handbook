import { useState } from 'react';
import type { TypeaheadOption } from '@tih/ui';
import { Typeahead } from '@tih/ui';

import { JobTitleLabels } from './JobTitles';

type Props = Readonly<{
  disabled?: boolean;
  isLabelHidden?: boolean;
  onSelect: (option: TypeaheadOption | null) => void;
  placeholder?: string;
  required?: boolean;
  value?: TypeaheadOption | null;
}>;

export default function JobTitlesTypeahead({
  disabled,
  onSelect,
  isLabelHidden,
  placeholder,
  required,
  value,
}: Props) {
  const [query, setQuery] = useState('');
  const options = Object.entries(JobTitleLabels)
    .map(([slug, label]) => ({
      id: slug,
      label,
      value: slug,
    }))
    .filter(
      ({ label }) =>
        label.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) > -1,
    );

  return (
    <Typeahead
      disabled={disabled}
      isLabelHidden={isLabelHidden}
      label="Job Title"
      noResultsMessage="No available job titles."
      nullable={true}
      options={options}
      placeholder={placeholder}
      required={required}
      textSize="inherit"
      value={value}
      onQueryChange={setQuery}
      onSelect={onSelect}
    />
  );
}
