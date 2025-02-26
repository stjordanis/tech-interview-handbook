import { startOfMonth } from 'date-fns';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ArrowPathIcon } from '@heroicons/react/20/solid';
import type { QuestionsQuestionType } from '@prisma/client';
import type { TypeaheadOption } from '@tih/ui';
import { CheckboxInput } from '@tih/ui';
import { Button, HorizontalDivider, Select, TextArea } from '@tih/ui';

import { QUESTION_TYPES } from '~/utils/questions/constants';
import relabelQuestionAggregates from '~/utils/questions/relabelQuestionAggregates';
import {
  useFormRegister,
  useSelectRegister,
} from '~/utils/questions/useFormRegister';
import { trpc } from '~/utils/trpc';

import SimilarQuestionCard from '../card/question/SimilarQuestionCard';
import CompanyTypeahead from '../typeahead/CompanyTypeahead';
import LocationTypeahead from '../typeahead/LocationTypeahead';
import RoleTypeahead from '../typeahead/RoleTypeahead';
import type { Month } from '../../shared/MonthYearPicker';
import MonthYearPicker from '../../shared/MonthYearPicker';

import type { Location } from '~/types/questions';

export type ContributeQuestionData = {
  company: string;
  date: Date;
  location: Location & TypeaheadOption;
  position: string;
  questionContent: string;
  questionType: QuestionsQuestionType;
  role: TypeaheadOption;
};

export type ContributeQuestionFormProps = {
  onDiscard: () => void;
  onSimilarQuestionFound: () => void;
  onSubmit: (data: ContributeQuestionData) => void;
};

export default function ContributeQuestionForm({
  onDiscard,
  onSimilarQuestionFound,
  onSubmit,
}: ContributeQuestionFormProps) {
  const {
    control,
    register: formRegister,
    handleSubmit,
    watch,
  } = useForm<ContributeQuestionData>({
    defaultValues: {
      date: startOfMonth(new Date()),
    },
  });

  const [contentToCheck, setContentToCheck] = useState('');

  const { data: similarQuestions } = trpc.useQuery(
    ['questions.questions.getRelatedQuestions', { content: contentToCheck }],
    {
      keepPreviousData: true,
    },
  );

  const utils = trpc.useContext();

  const { mutateAsync: addEncounterAsync } = trpc.useMutation(
    'questions.questions.encounters.user.create',
    {
      onSuccess: () => {
        utils.invalidateQueries(
          'questions.questions.encounters.getAggregatedEncounters',
        );
        utils.invalidateQueries('questions.questions.getQuestionById');
      },
    },
  );

  const questionContent = watch('questionContent');
  const register = useFormRegister(formRegister);
  const selectRegister = useSelectRegister(formRegister);

  const [checkedSimilar, setCheckedSimilar] = useState<boolean>(false);
  const handleCheckSimilarQuestions = (checked: boolean) => {
    setCheckedSimilar(checked);
  };

  useEffect(() => {
    if (questionContent !== contentToCheck) {
      setCheckedSimilar(false);
    }
  }, [questionContent, contentToCheck]);

  return (
    <div className="flex flex-col justify-between gap-4">
      <form
        className="flex flex-1 flex-col items-stretch justify-center gap-y-4"
        onSubmit={handleSubmit(onSubmit)}>
        <div className="min-w-[113px] max-w-[113px] flex-1">
          <Select
            defaultValue="coding"
            label="Type"
            options={QUESTION_TYPES}
            required={true}
            {...selectRegister('questionType')}
          />
        </div>
        <TextArea
          label="Question Prompt"
          placeholder="Contribute a question"
          required={true}
          rows={5}
          {...register('questionContent')}
        />
        <h2 className="text-md text-primary-800 font-semibold">
          Additional information
        </h2>
        <div className="flex flex-col flex-wrap items-stretch gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 sm:min-w-[150px] sm:max-w-[300px]">
            <Controller
              control={control}
              name="location"
              render={({ field }) => (
                <LocationTypeahead
                  {...field}
                  required={true}
                  onSelect={(option) => {
                    // @ts-ignore TODO(questions): handle potentially null value.
                    field.onChange(option);
                  }}
                />
              )}
            />
          </div>
          <div className="flex-1 sm:min-w-[150px] sm:max-w-[300px]">
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <MonthYearPicker
                  monthRequired={true}
                  value={{
                    month: ((field.value.getMonth() as number) + 1) as Month,
                    year: field.value.getFullYear(),
                  }}
                  yearRequired={true}
                  onChange={({ month, year }) => {
                    field.onChange(startOfMonth(new Date(year!, month! - 1)));
                  }}
                />
              )}
            />
          </div>
        </div>
        <div className="flex flex-col flex-wrap items-stretch gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 sm:min-w-[150px] sm:max-w-[300px]">
            <Controller
              control={control}
              name="company"
              render={({ field: { value: _, ...field } }) => (
                <CompanyTypeahead
                  {...field}
                  required={true}
                  // @ts-ignore TODO(questions): handle potentially null value.
                  onSelect={({ id }) => {
                    field.onChange(id);
                  }}
                />
              )}
            />
          </div>
          <div className="flex-1 sm:min-w-[150px] sm:max-w-[200px]">
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <RoleTypeahead
                  {...field}
                  required={true}
                  onSelect={(option) => {
                    // @ts-ignore TODO(questions): handle potentially null value.
                    field.onChange(option);
                  }}
                />
              )}
            />
          </div>
        </div>
        <div className="w-full">
          <HorizontalDivider />
        </div>
        <h2
          className="text-primary-900 mb-3
        text-lg font-semibold
        ">
          Are these questions the same as yours?
        </h2>
        <Button
          addonPosition="start"
          disabled={questionContent === contentToCheck}
          icon={ArrowPathIcon}
          label="Refresh similar questions"
          variant="primary"
          onClick={() => {
            setContentToCheck(questionContent);
          }}
        />
        <div className="flex flex-col gap-y-2">
          {similarQuestions?.map((question) => {
            const { companyCounts, countryCounts, roleCounts } =
              relabelQuestionAggregates(question.aggregatedQuestionEncounters);

            return (
              <SimilarQuestionCard
                key={question.id}
                companies={companyCounts}
                content={question.content}
                countries={countryCounts}
                createEncounterButtonText="Yes, this is my question"
                questionId={question.id}
                roles={roleCounts}
                timestamp={
                  question.seenAt.toLocaleDateString(undefined, {
                    month: 'short',
                    year: 'numeric',
                  }) ?? null
                }
                type={question.type}
                onReceivedSubmit={async (data) => {
                  await addEncounterAsync({
                    cityId: data.cityId,
                    companyId: data.company,
                    countryId: data.countryId,
                    questionId: question.id,
                    role: data.role,
                    seenAt: data.seenAt,
                    stateId: data.stateId,
                  });

                  onSimilarQuestionFound();
                }}
              />
            );
          })}
          {similarQuestions?.length === 0 && (
            <p className="font-semibold text-slate-900">
              No similar questions found.
            </p>
          )}
        </div>
        <div
          className="bg-primary-50 flex w-full justify-between gap-y-2 py-3 shadow-[0_0_0_100vmax_theme(colors.primary.50)]"
          style={{
            // Hack to make the background bleed outside the container
            clipPath: 'inset(0 -100vmax)',
          }}>
          <div className="my-2 flex items-center sm:my-0">
            <CheckboxInput
              disabled={questionContent !== contentToCheck}
              label={
                questionContent !== contentToCheck
                  ? 'I have checked that my question is new (Refresh similar questions to proceed)'
                  : 'I have checked that my question is new'
              }
              value={checkedSimilar}
              onChange={handleCheckSimilarQuestions}
            />
          </div>
          <div className="flex gap-x-2">
            <button
              className="focus:ring-primary-500 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              type="button"
              onClick={onDiscard}>
              Discard
            </button>
            <Button
              className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 inline-flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-slate-400 sm:ml-3 sm:w-auto sm:text-sm"
              label="Contribute"
              type="submit"
              variant="primary"></Button>
          </div>
        </div>
      </form>
    </div>
  );
}
