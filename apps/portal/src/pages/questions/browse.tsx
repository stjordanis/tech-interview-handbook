import { subMonths, subYears } from 'date-fns';
import Head from 'next/head';
import Router, { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { Bars3BottomLeftIcon } from '@heroicons/react/20/solid';
import { NoSymbolIcon } from '@heroicons/react/24/outline';
import type { QuestionsQuestionType } from '@prisma/client';
import type { TypeaheadOption } from '@tih/ui';
import { Button, SlideOut } from '@tih/ui';

import QuestionOverviewCard from '~/components/questions/card/question/QuestionOverviewCard';
import ContributeQuestionCard from '~/components/questions/ContributeQuestionCard';
import FilterSection from '~/components/questions/filter/FilterSection';
import PaginationLoadMoreButton from '~/components/questions/PaginationLoadMoreButton';
import QuestionSearchBar from '~/components/questions/QuestionSearchBar';
import CompanyTypeahead from '~/components/questions/typeahead/CompanyTypeahead';
import LocationTypeahead from '~/components/questions/typeahead/LocationTypeahead';
import RoleTypeahead from '~/components/questions/typeahead/RoleTypeahead';
import { JobTitleLabels } from '~/components/shared/JobTitles';

import type { QuestionAge } from '~/utils/questions/constants';
import { APP_TITLE } from '~/utils/questions/constants';
import { QUESTION_AGES, QUESTION_TYPES } from '~/utils/questions/constants';
import createSlug from '~/utils/questions/createSlug';
import relabelQuestionAggregates from '~/utils/questions/relabelQuestionAggregates';
import {
  useSearchParam,
  useSearchParamSingle,
} from '~/utils/questions/useSearchParam';
import { trpc } from '~/utils/trpc';

import type { Location } from '~/types/questions.d';
import { SortType } from '~/types/questions.d';
import { SortOrder } from '~/types/questions.d';

function locationToSlug(value: Location & TypeaheadOption): string {
  return [
    value.countryId,
    value.stateId,
    value.cityId,
    value.id,
    value.label,
    value.value,
  ].join('-');
}

export default function QuestionsBrowsePage() {
  const router = useRouter();

  const [
    selectedCompanySlugs,
    setSelectedCompanySlugs,
    areCompaniesInitialized,
  ] = useSearchParam('companies');
  const [
    selectedQuestionTypes,
    setSelectedQuestionTypes,
    areQuestionTypesInitialized,
  ] = useSearchParam<QuestionsQuestionType>('questionTypes', {
    stringToParam: (param) => {
      const uppercaseParam = param.toUpperCase();
      return (
        QUESTION_TYPES.find(
          (questionType) => questionType.value.toUpperCase() === uppercaseParam,
        )?.value ?? null
      );
    },
  });
  const [
    selectedQuestionAge,
    setSelectedQuestionAge,
    isQuestionAgeInitialized,
  ] = useSearchParamSingle<QuestionAge>('questionAge', {
    defaultValue: 'all',
    stringToParam: (param) => {
      const uppercaseParam = param.toUpperCase();
      return (
        QUESTION_AGES.find(
          (questionAge) => questionAge.value.toUpperCase() === uppercaseParam,
        )?.value ?? null
      );
    },
  });

  const [selectedRoles, setSelectedRoles, areRolesInitialized] =
    useSearchParam('roles');
  const [selectedLocations, setSelectedLocations, areLocationsInitialized] =
    useSearchParam<Location & TypeaheadOption>('locations', {
      paramToString: locationToSlug,
      stringToParam: (param) => {
        const [countryId, stateId, cityId, id, label, value] = param.split('-');
        return { cityId, countryId, id, label, stateId, value };
      },
    });

  const [sortOrder, setSortOrder, isSortOrderInitialized] =
    useSearchParamSingle<SortOrder>('sortOrder', {
      defaultValue: SortOrder.DESC,
      paramToString: (value) => {
        if (value === SortOrder.ASC) {
          return 'ASC';
        }
        if (value === SortOrder.DESC) {
          return 'DESC';
        }
        return null;
      },
      stringToParam: (param) => {
        const uppercaseParam = param.toUpperCase();
        if (uppercaseParam === 'ASC') {
          return SortOrder.ASC;
        }
        if (uppercaseParam === 'DESC') {
          return SortOrder.DESC;
        }
        return null;
      },
    });

  const [sortType, setSortType, isSortTypeInitialized] =
    useSearchParamSingle<SortType>('sortType', {
      defaultValue: SortType.TOP,
      paramToString: (value) => {
        if (value === SortType.NEW) {
          return 'NEW';
        }
        if (value === SortType.TOP) {
          return 'TOP';
        }
        return null;
      },
      stringToParam: (param) => {
        const uppercaseParam = param.toUpperCase();
        if (uppercaseParam === 'NEW') {
          return SortType.NEW;
        }
        if (uppercaseParam === 'TOP') {
          return SortType.TOP;
        }
        return null;
      },
    });

  const hasFilters = useMemo(
    () =>
      selectedCompanySlugs.length > 0 ||
      selectedQuestionTypes.length > 0 ||
      selectedQuestionAge !== 'all' ||
      selectedRoles.length > 0 ||
      selectedLocations.length > 0,
    [
      selectedCompanySlugs,
      selectedQuestionTypes,
      selectedQuestionAge,
      selectedRoles,
      selectedLocations,
    ],
  );

  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => {
    return selectedQuestionAge === 'last-year'
      ? subYears(new Date(), 1)
      : selectedQuestionAge === 'last-6-months'
      ? subMonths(new Date(), 6)
      : selectedQuestionAge === 'last-month'
      ? subMonths(new Date(), 1)
      : undefined;
  }, [selectedQuestionAge]);

  const questionsInfiniteQuery = trpc.useInfiniteQuery(
    [
      'questions.questions.getQuestionsByFilter',
      {
        // TODO: Enable filtering by countryIds and stateIds
        cityIds: selectedLocations
          .map(({ cityId }) => cityId)
          .filter((id) => id !== undefined) as Array<string>,
        companyIds: selectedCompanySlugs.map((slug) => slug.split('_')[0]),
        countryIds: [],
        endDate: today,
        limit: 10,
        questionTypes: selectedQuestionTypes,
        roles: selectedRoles,
        sortOrder,
        sortType,
        startDate,
        stateIds: [],
      },
    ],
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      keepPreviousData: true,
    },
  );

  const { data: questionsQueryData } = questionsInfiniteQuery;

  const questionCount = useMemo(() => {
    if (!questionsQueryData) {
      return undefined;
    }
    return questionsQueryData.pages.reduce(
      (acc, page) => acc + (page.data.length as number),
      0,
    );
  }, [questionsQueryData]);

  const utils = trpc.useContext();
  const { mutate: createQuestion } = trpc.useMutation(
    'questions.questions.user.create',
    {
      onSuccess: () => {
        utils.invalidateQueries('questions.questions.getQuestionsByFilter');
      },
    },
  );

  const [loaded, setLoaded] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const questionTypeFilterOptions = useMemo(() => {
    return QUESTION_TYPES.map((questionType) => ({
      ...questionType,
      checked: selectedQuestionTypes.includes(questionType.value),
    }));
  }, [selectedQuestionTypes]);

  const questionAgeFilterOptions = useMemo(() => {
    return QUESTION_AGES.map((questionAge) => ({
      ...questionAge,
      checked: selectedQuestionAge === questionAge.value,
    }));
  }, [selectedQuestionAge]);

  const areSearchOptionsInitialized = useMemo(() => {
    return (
      areCompaniesInitialized &&
      areQuestionTypesInitialized &&
      isQuestionAgeInitialized &&
      areRolesInitialized &&
      areLocationsInitialized &&
      isSortTypeInitialized &&
      isSortOrderInitialized
    );
  }, [
    areCompaniesInitialized,
    areQuestionTypesInitialized,
    isQuestionAgeInitialized,
    areRolesInitialized,
    areLocationsInitialized,
    isSortTypeInitialized,
    isSortOrderInitialized,
  ]);

  const { pathname } = router;
  useEffect(() => {
    if (areSearchOptionsInitialized) {
      // Router.replace used instead of router.replace to avoid
      // the page reloading itself since the router.replace
      // callback changes on every page load
      Router.replace({
        pathname,
        query: {
          companies: selectedCompanySlugs,
          locations: selectedLocations.map(locationToSlug),
          questionAge: selectedQuestionAge,
          questionTypes: selectedQuestionTypes,
          roles: selectedRoles,
          sortOrder: sortOrder === SortOrder.ASC ? 'ASC' : 'DESC',
          sortType: sortType === SortType.TOP ? 'TOP' : 'NEW',
        },
      });

      setLoaded(true);
    }
  }, [
    areSearchOptionsInitialized,
    loaded,
    pathname,
    selectedCompanySlugs,
    selectedRoles,
    selectedLocations,
    selectedQuestionAge,
    selectedQuestionTypes,
    sortOrder,
    sortType,
  ]);

  const selectedCompanyOptions = useMemo(() => {
    return selectedCompanySlugs.map((company) => {
      const [id, label] = company.split('_');
      return {
        checked: true,
        id,
        label,
        value: id,
      };
    });
  }, [selectedCompanySlugs]);

  const selectedRoleOptions = useMemo(() => {
    return selectedRoles.map((role) => ({
      checked: true,
      id: role,
      label: JobTitleLabels[role as keyof typeof JobTitleLabels],
      value: role,
    }));
  }, [selectedRoles]);

  const selectedLocationOptions = useMemo(() => {
    return selectedLocations.map((location) => ({
      checked: true,
      ...location,
    }));
  }, [selectedLocations]);

  if (!loaded) {
    return null;
  }

  const filterSidebar = (
    <div className="divide-y divide-slate-200 px-4">
      <Button
        addonPosition="start"
        className="my-4"
        disabled={!hasFilters}
        icon={Bars3BottomLeftIcon}
        label="Clear filters"
        variant="tertiary"
        onClick={() => {
          setSelectedCompanySlugs([]);
          setSelectedQuestionTypes([]);
          setSelectedQuestionAge('all');
          setSelectedRoles([]);
          setSelectedLocations([]);
        }}
      />
      <FilterSection
        label="Companies"
        options={selectedCompanyOptions}
        renderInput={({ onOptionChange, field: { ref: _, ...field } }) => (
          <CompanyTypeahead
            {...field}
            clearOnSelect={true}
            filterOption={(option) => {
              return !selectedCompanySlugs.some((companySlug) => {
                return companySlug === `${option.id}_${option.label}`;
              });
            }}
            isLabelHidden={true}
            placeholder="Search companies"
            onSelect={(option) => {
              // @ts-ignore TODO(questions): handle potentially null value.
              onOptionChange({
                ...option,
                checked: true,
              });
            }}
          />
        )}
        onOptionChange={(option) => {
          if (option.checked) {
            setSelectedCompanySlugs([
              ...selectedCompanySlugs,
              `${option.id}_${option.label}`,
            ]);
          } else {
            setSelectedCompanySlugs(
              selectedCompanySlugs.filter(
                (companySlug) => companySlug !== `${option.id}_${option.label}`,
              ),
            );
          }
        }}
      />
      <FilterSection
        label="Roles"
        options={selectedRoleOptions}
        renderInput={({
          onOptionChange,
          field: { ref: _, onChange: __, ...field },
        }) => (
          <RoleTypeahead
            {...field}
            clearOnSelect={true}
            filterOption={(option) => {
              return !selectedRoles.some((role) => {
                return role === option.value;
              });
            }}
            isLabelHidden={true}
            placeholder="Search roles"
            onSelect={(option) => {
              // @ts-ignore TODO(questions): handle potentially null value.
              onOptionChange({
                ...option,
                checked: true,
              });
            }}
          />
        )}
        onOptionChange={(option) => {
          if (option.checked) {
            setSelectedRoles([...selectedRoles, option.value]);
          } else {
            setSelectedRoles(
              selectedRoles.filter((role) => role !== option.value),
            );
          }
        }}
      />
      <FilterSection
        label="Question types"
        options={questionTypeFilterOptions}
        showAll={true}
        onOptionChange={(option) => {
          if (option.checked) {
            setSelectedQuestionTypes([...selectedQuestionTypes, option.value]);
          } else {
            setSelectedQuestionTypes(
              selectedQuestionTypes.filter(
                (questionType) => questionType !== option.value,
              ),
            );
          }
        }}
      />
      <FilterSection
        isSingleSelect={true}
        label="Question age"
        options={questionAgeFilterOptions}
        showAll={true}
        onOptionChange={({ value }) => {
          setSelectedQuestionAge(value);
        }}
      />
      <FilterSection
        label="Locations"
        options={selectedLocationOptions}
        renderInput={({
          onOptionChange,
          field: { ref: _, onChange: __, ...field },
        }) => (
          <LocationTypeahead
            {...field}
            clearOnSelect={true}
            filterOption={(option) => {
              return !selectedLocations.some((location) => {
                return location.id === option.id;
              });
            }}
            isLabelHidden={true}
            placeholder="Search locations"
            onSelect={(option) => {
              // @ts-ignore TODO(offers): fix potentially empty value.
              onOptionChange({
                ...option,
                checked: true,
              });
            }}
          />
        )}
        onOptionChange={(option) => {
          if (option.checked) {
            // TODO: Fix type inference, then remove the `as` cast.
            setSelectedLocations([
              ...selectedLocations,
              option as unknown as Location & TypeaheadOption,
            ]);
          } else {
            setSelectedLocations(
              selectedLocations.filter((location) => location.id !== option.id),
            );
          }
        }}
      />
    </div>
  );

  return (
    <>
      <Head>
        <title>Home - {APP_TITLE}</title>
      </Head>
      <main className="flex flex-1 flex-col items-stretch">
        <div className="flex h-full flex-1">
          <section className="flex min-h-0 flex-1 flex-col items-center overflow-auto">
            <div className="m-4 flex max-w-3xl flex-1 flex-col items-stretch justify-start gap-6">
              <ContributeQuestionCard
                onSubmit={(data) => {
                  const { cityId, countryId, stateId } = data.location;
                  createQuestion({
                    cityId,
                    companyId: data.company,
                    content: data.questionContent,
                    countryId,
                    questionType: data.questionType,
                    role: data.role.value,
                    seenAt: data.date,
                    stateId,
                  });
                }}
              />
              <div className="flex flex-col items-stretch gap-4">
                <div className="sticky top-0 border-b border-slate-300 bg-slate-50 py-4">
                  <QuestionSearchBar
                    sortOrderValue={sortOrder}
                    sortTypeValue={sortType}
                    onFilterOptionsToggle={() => {
                      setFilterDrawerOpen(!filterDrawerOpen);
                    }}
                    onSortOrderChange={setSortOrder}
                    onSortTypeChange={setSortType}
                  />
                </div>
                <div className="flex flex-col gap-2 pb-4">
                  {(questionsQueryData?.pages ?? []).flatMap(
                    ({ data: questions }) =>
                      questions.map((question) => {
                        const { companyCounts, countryCounts, roleCounts } =
                          relabelQuestionAggregates(
                            question.aggregatedQuestionEncounters,
                          );

                        return (
                          <QuestionOverviewCard
                            key={question.id}
                            answerCount={question.numAnswers}
                            companies={companyCounts}
                            content={question.content}
                            countries={countryCounts}
                            href={`/questions/${question.id}/${createSlug(
                              question.content,
                            )}`}
                            questionId={question.id}
                            receivedCount={question.receivedCount}
                            roles={roleCounts}
                            timestamp={question.seenAt.toLocaleDateString(
                              undefined,
                              {
                                month: 'short',
                                year: 'numeric',
                              },
                            )}
                            type={question.type}
                            upvoteCount={question.numVotes}
                          />
                        );
                      }),
                  )}
                  {questionCount !== 0 && (
                    <PaginationLoadMoreButton query={questionsInfiniteQuery} />
                  )}
                  {questionCount === 0 && (
                    <div className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-slate-200 p-4 text-slate-600">
                      <NoSymbolIcon className="h-6 w-6" />
                      <p>Nothing found.</p>
                      {hasFilters && <p>Try changing your search criteria.</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
          <aside className="hidden w-[300px] overflow-y-auto border-l bg-white py-4 lg:block">
            <h2 className="px-4 text-xl font-semibold">Filter by</h2>
            {filterSidebar}
          </aside>
          <SlideOut
            className="lg:hidden"
            enterFrom="end"
            isShown={filterDrawerOpen}
            size="sm"
            title="Filter by"
            onClose={() => {
              setFilterDrawerOpen(false);
            }}>
            {filterSidebar}
          </SlideOut>
        </div>
      </main>
    </>
  );
}
