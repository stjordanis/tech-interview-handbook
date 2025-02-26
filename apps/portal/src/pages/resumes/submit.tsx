import axios from 'axios';
import clsx from 'clsx';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FileRejection } from 'react-dropzone';
import { useDropzone } from 'react-dropzone';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { ArrowUpCircleIcon } from '@heroicons/react/24/outline';
import {
  Button,
  CheckboxInput,
  Dialog,
  Select,
  Spinner,
  TextArea,
  TextInput,
} from '@tih/ui';

import { useGoogleAnalytics } from '~/components/global/GoogleAnalytics';
import SubmissionGuidelines from '~/components/resumes/submit-form/SubmissionGuidelines';

import { RESUME_STORAGE_KEY } from '~/constants/file-storage-keys';
import { EXPERIENCES, LOCATIONS, ROLES } from '~/utils/resumes/resumeFilters';
import { trpc } from '~/utils/trpc';

const FILE_SIZE_LIMIT_MB = 3;
const FILE_SIZE_LIMIT_BYTES = FILE_SIZE_LIMIT_MB * 1000000;

const TITLE_PLACEHOLDER =
  'e.g. Applying for Company XYZ, please help me to review!';
const ADDITIONAL_INFO_PLACEHOLDER = `e.g. I’m applying for company XYZ. I have been resume-rejected by N companies that I have applied for. Please help me to review so company XYZ gives me an interview!`;
const FILE_UPLOAD_ERROR = `Please upload a PDF file that is less than ${FILE_SIZE_LIMIT_MB}MB.`;

type IFormInput = {
  additionalInfo?: string;
  experience: string;
  file: File;
  isChecked: boolean;
  location: string;
  role: string;
  title: string;
};

type InputKeys = keyof IFormInput;

type InitFormDetails = {
  additionalInfo?: string;
  experience: string;
  location: string;
  resumeId: string;
  role: string;
  title: string;
  url: string;
};

type Props = Readonly<{
  initFormDetails?: InitFormDetails | null;
  onClose: () => void;
}>;

export default function SubmitResumeForm({
  initFormDetails,
  onClose = () => undefined,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [invalidFileUploadError, setInvalidFileUploadError] = useState<
    string | null
  >(null);
  const [isDialogShown, setIsDialogShown] = useState(false);

  const { status } = useSession();
  const router = useRouter();
  const trpcContext = trpc.useContext();
  const resumeUpsertMutation = trpc.useMutation('resumes.resume.user.upsert');
  const { event: gaEvent } = useGoogleAnalytics();

  const isNewForm = initFormDetails == null;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    clearErrors,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<IFormInput>({
    defaultValues: {
      additionalInfo: '',
      experience: '',
      isChecked: false,
      location: '',
      role: '',
      title: '',
      ...initFormDetails,
    },
  });

  const resumeFile = watch('file');

  const onFileDrop = useCallback(
    (acceptedFiles: Array<File>, fileRejections: Array<FileRejection>) => {
      if (fileRejections.length === 0) {
        setInvalidFileUploadError('');
        setValue('file', acceptedFiles[0], {
          shouldDirty: true,
        });
      } else {
        setInvalidFileUploadError(FILE_UPLOAD_ERROR);
      }
    },
    [setValue],
  );

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    maxSize: FILE_SIZE_LIMIT_BYTES,
    noClick: isLoading,
    noDrag: isLoading,
    onDrop: onFileDrop,
  });

  // Route user to sign in if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin');
    }
  }, [router, status]);

  const onSubmit: SubmitHandler<IFormInput> = async (data) => {
    setIsLoading(true);
    let fileUrl = initFormDetails?.url ?? '';

    // Only update file in fs when it changes
    if (dirtyFields.file) {
      const formData = new FormData();
      formData.append('key', RESUME_STORAGE_KEY);
      formData.append('file', resumeFile);

      const res = await axios.post('/api/file-storage', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      fileUrl = res.data.url;
    }

    resumeUpsertMutation.mutate(
      {
        additionalInfo: data.additionalInfo,
        experience: data.experience,
        id: initFormDetails?.resumeId,
        location: data.location,
        role: data.role,
        title: data.title,
        url: fileUrl,
      },
      {
        onError(error) {
          console.error(error);
        },
        onSettled() {
          setIsLoading(false);
        },
        onSuccess() {
          if (isNewForm) {
            trpcContext.invalidateQueries('resumes.resume.findAll');
            router.push('/resumes');
            gaEvent({
              action: 'resumes.submit_button_click',
              category: 'engagement',
              label: 'Submit Resume',
            });
          } else {
            onClose();
          }
        },
      },
    );
  };

  const onClickClear = () => {
    if (isDirty) {
      setIsDialogShown(true);
    } else {
      onClose();
    }
  };

  const onClickResetDialog = () => {
    onClose();
    setIsDialogShown(false);
    reset();
    setInvalidFileUploadError(null);
  };

  const onClickDownload = async (
    event: React.MouseEvent<HTMLParagraphElement, MouseEvent>,
  ) => {
    // Prevent click event from propagating up to dropzone
    event.stopPropagation();

    const url = window.URL.createObjectURL(resumeFile);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', resumeFile.name);
    document.body.appendChild(link);

    // Start download
    link.click();

    // Clean up and remove the link and object URL
    link.remove();
    URL.revokeObjectURL(url);
  };

  const fileUploadError = useMemo(() => {
    if (invalidFileUploadError != null) {
      return invalidFileUploadError;
    }
    if (errors?.file != null) {
      return 'Resume cannot be empty!';
    }
  }, [errors?.file, invalidFileUploadError]);

  const onValueChange = (section: InputKeys, value: string) => {
    setValue(section, value.trim(), { shouldDirty: true });
  };

  return (
    <>
      <Head>
        <title>Upload a Resume</title>
      </Head>
      {status === 'loading' && (
        <div className="w-full pt-4">
          {' '}
          <Spinner display="block" size="lg" />{' '}
        </div>
      )}
      {status === 'authenticated' && (
        <main className="h-[calc(100vh-4rem)] flex-1 overflow-y-auto">
          <section
            aria-labelledby="primary-heading"
            className="flex h-full min-w-0 flex-1 flex-col lg:order-last">
            {/* Reset Dialog component */}
            <Dialog
              isShown={isDialogShown}
              primaryButton={
                <Button
                  display="block"
                  label="OK"
                  variant="primary"
                  onClick={onClickResetDialog}
                />
              }
              secondaryButton={
                <Button
                  display="block"
                  label="Cancel"
                  variant="tertiary"
                  onClick={() => setIsDialogShown(false)}
                />
              }
              title={
                isNewForm
                  ? 'Are you sure you want to clear?'
                  : 'Are you sure you want to leave?'
              }
              onClose={() => setIsDialogShown(false)}>
              Note that your current input will not be saved!
            </Dialog>
            <form
              className="mt-8 w-full max-w-screen-lg space-y-6 self-center rounded-lg bg-white p-10 shadow-lg"
              onSubmit={handleSubmit(onSubmit)}>
              <h1 className="mb-4 text-center text-2xl font-semibold">
                {isNewForm ? 'Upload a resume' : 'Update details'}
              </h1>
              {/*  Title Section */}
              <TextInput
                {...(register('title', { required: true }), {})}
                defaultValue={initFormDetails?.title}
                disabled={isLoading}
                errorMessage={
                  errors.title?.message != null
                    ? 'Title cannot be empty'
                    : undefined
                }
                label="Title"
                placeholder={TITLE_PLACEHOLDER}
                required={true}
                onChange={(val) => onValueChange('title', val)}
              />
              <div className="flex flex-wrap gap-6">
                <Select
                  {...register('role', { required: true })}
                  defaultValue={undefined}
                  disabled={isLoading}
                  label="Role"
                  options={ROLES}
                  placeholder=" "
                  required={true}
                  onChange={(val) => onValueChange('role', val)}
                />
                <Select
                  {...register('experience', { required: true })}
                  disabled={isLoading}
                  label="Experience Level"
                  options={EXPERIENCES}
                  placeholder=" "
                  required={true}
                  onChange={(val) => onValueChange('experience', val)}
                />
              </div>
              <Select
                {...register('location', { required: true })}
                disabled={isLoading}
                label="Location"
                options={LOCATIONS}
                placeholder=" "
                required={true}
                onChange={(val) => onValueChange('location', val)}
              />
              {/* Upload resume form */}
              {isNewForm && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    Upload resume (PDF format)
                    <span aria-hidden="true" className="text-danger-500">
                      {' '}
                      *
                    </span>
                  </p>
                  <div
                    {...getRootProps()}
                    className={clsx(
                      fileUploadError
                        ? 'border-danger-600'
                        : 'border-slate-300',
                      'cursor-pointer flex-col items-center space-y-1 rounded-md border-2 border-dashed bg-slate-100 py-4 px-4 text-center',
                    )}>
                    <input
                      {...register('file', { required: true })}
                      {...getInputProps()}
                      accept="application/pdf"
                      className="sr-only"
                      disabled={isLoading}
                      id="file-upload"
                      name="file-upload"
                      type="file"
                    />
                    {resumeFile == null ? (
                      <ArrowUpCircleIcon className="text-primary-500 m-auto h-10 w-10" />
                    ) : (
                      <p
                        className="hover:text-primary-600 cursor-pointer underline underline-offset-1"
                        onClick={onClickDownload}>
                        {resumeFile.name}
                      </p>
                    )}
                    <label
                      className="focus-within:ring-primary-500 cursor-pointer text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                      htmlFor="file-upload">
                      <span className="font-medium">Drop file here</span>
                      <span className="mr-1 ml-1 font-light">or</span>
                      <span className="text-primary-600 hover:text-primary-400 font-medium">
                        {resumeFile == null ? 'Select file' : 'Replace file'}
                      </span>
                    </label>
                    <p className="text-xs text-slate-500">
                      PDF up to {FILE_SIZE_LIMIT_MB}MB
                    </p>
                  </div>
                  {fileUploadError && (
                    <p className="text-danger-600 text-sm">{fileUploadError}</p>
                  )}
                </div>
              )}
              {/*  Additional Info Section */}
              <TextArea
                {...(register('additionalInfo'),
                { defaultValue: initFormDetails?.additionalInfo })}
                disabled={isLoading}
                label="Additional Information"
                placeholder={ADDITIONAL_INFO_PLACEHOLDER}
                onChange={(val) => onValueChange('additionalInfo', val)}
              />
              {/*  Submission Guidelines */}
              {isNewForm && (
                <>
                  <SubmissionGuidelines />
                  <CheckboxInput
                    {...register('isChecked', { required: true })}
                    disabled={isLoading}
                    errorMessage={
                      !errors.file && errors.isChecked
                        ? 'Please tick the checkbox after reading through the guidelines.'
                        : undefined
                    }
                    label="I have read and will follow the guidelines stated."
                    onChange={(val) => {
                      if (val) {
                        clearErrors('isChecked');
                      }
                      setValue('isChecked', val);
                    }}
                  />
                </>
              )}
              {/*  Clear and Submit Buttons */}
              <div className="flex justify-end gap-4">
                <Button
                  addonPosition="start"
                  disabled={isLoading}
                  label={isNewForm ? 'Clear' : 'Cancel'}
                  variant="tertiary"
                  onClick={onClickClear}
                />
                <Button
                  addonPosition="start"
                  disabled={isLoading}
                  isLoading={isLoading}
                  label="Submit"
                  type="submit"
                  variant="primary"
                />
              </div>
            </form>
          </section>
        </main>
      )}
    </>
  );
}
