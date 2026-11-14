"use client";

import { Building2, Sparkles, UserRound } from "lucide-react";

import { FieldError, FormMessage, TextField } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { useHydrated } from "@/components/forms/use-hydrated";
import {
  deleteAccount,
  finishOnboarding,
  saveIdentity,
  savePrivacy,
  saveProfile,
  type FormState,
} from "@/server/actions/account";
import {
  PROFESSIONAL_ROLES,
  PROFESSIONAL_ROLE_LABELS,
  PROFILE_SECTIONS,
  PROFILE_SECTION_LABELS,
  type ProfileSection,
} from "@/lib/validation/profile";
import { Spinner } from "@/components/ui/busy";

function Submit({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  const hydrated = useHydrated();
  const disabled = pending || !hydrated;
  return (
    <button
      type="submit"
      className="action action-primary"
      disabled={disabled}
      aria-disabled={disabled}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state.status === "error" && state.message) {
    return <FormMessage tone="error">{state.message}</FormMessage>;
  }
  if (state.status === "success" && state.message) {
    return <FormMessage tone="success">{state.message}</FormMessage>;
  }
  return null;
}

function RoleChoices({ selected, error }: { selected: string[]; error?: string }) {
  return (
    <fieldset className="field" aria-describedby={error ? "roles-error" : "roles-hint"}>
      <legend className="field-label">
        What kind of work do you do? <span className="field-optional">(up to three)</span>
      </legend>
      <p id="roles-hint" className="field-hint">
        Shown on your profile. You can change it later.
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {PROFESSIONAL_ROLES.map((role) => (
          <label
            key={role}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-surface px-4 text-note font-semibold transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-canvas has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link"
          >
            <input
              type="checkbox"
              name="roles"
              value={role}
              defaultChecked={selected.includes(role)}
              className="sr-only"
            />
            {PROFESSIONAL_ROLE_LABELS[role]}
          </label>
        ))}
      </div>
      <FieldError id="roles-error" message={error} />
    </fieldset>
  );
}

const INTENTS = [
  {
    value: "contributor",
    icon: UserRound,
    title: "Build my record",
    body: "Record the work I have done and ask organisations to confirm it.",
  },
  {
    value: "organisation",
    icon: Building2,
    title: "Set up an organisation",
    body: "Review contributions and confirm the ones we stand behind.",
  },
  {
    value: "both",
    icon: Sparkles,
    title: "Both",
    body: "I contribute, and I also help run a project.",
  },
] as const;

export function OnboardingForm({
  suggestedName,
  suggestedUsername,
}: {
  suggestedName: string;
  suggestedUsername: string;
}) {
  const { state, pending, onSubmit } = useFormAction(finishOnboarding);
  const errors = state.errors ?? {};

  return (
    <form onSubmit={onSubmit} method="post" className="form-stack gap-7" noValidate>
      <Feedback state={state} />

      <fieldset className="field" aria-describedby={errors.intent ? "intent-error" : undefined}>
        <legend className="field-label">What would you like to do first?</legend>
        <p className="field-hint">This is only a starting point. One account can do both.</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {INTENTS.map((intent, index) => (
            <label
              key={intent.value}
              className="flex cursor-pointer flex-col gap-2 rounded-2xl border-[1.5px] border-line-strong bg-surface p-4 transition-colors hover:border-ink has-[:checked]:border-brand has-[:checked]:bg-highlight/40 has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link"
            >
              <span className="flex items-center justify-between">
                <intent.icon aria-hidden="true" size={22} strokeWidth={2} />
                <input
                  type="radio"
                  name="intent"
                  value={intent.value}
                  defaultChecked={index === 0}
                  className="size-4"
                />
              </span>
              <span className="font-display text-lead font-bold">{intent.title}</span>
              <span className="text-meta text-muted">{intent.body}</span>
            </label>
          ))}
        </div>
        <FieldError id="intent-error" message={errors.intent} />
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="displayName"
          label="Name on your profile"
          required
          defaultValue={suggestedName}
          maxLength={80}
          autoComplete="name"
          error={errors.displayName}
        />
        <TextField
          name="username"
          label="Username"
          required
          defaultValue={suggestedUsername}
          maxLength={30}
          prefix="atesta/u/"
          spellCheck={false}
          autoComplete="username"
          hint="Lowercase letters, numbers and hyphens."
          error={errors.username}
        />
      </div>

      <TextField
        name="bio"
        label="Short bio"
        multiline
        maxLength={400}
        hint="One or two sentences about the work you do."
        error={errors.bio}
      />

      <RoleChoices selected={[]} error={errors.roles} />

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Submit pending={pending} label="Finish setting up" pendingLabel="Saving…" />
        <p className="text-note text-muted">
          Your profile stays private until you choose to share it.
        </p>
      </div>
    </form>
  );
}

export interface ProfileFormValues {
  displayName: string;
  username: string;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
  roles: string[];
  skills: string[];
}

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const { state, pending, onSubmit } = useFormAction(saveProfile);
  const errors = state.errors ?? {};

  return (
    <form onSubmit={onSubmit} method="post" className="form-stack" noValidate>
      <Feedback state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="displayName"
          label="Name on your profile"
          required
          defaultValue={initial.displayName}
          maxLength={80}
          error={errors.displayName}
        />
        <TextField
          name="username"
          label="Username"
          required
          defaultValue={initial.username}
          maxLength={30}
          prefix="atesta/u/"
          spellCheck={false}
          error={errors.username}
          hint="Changing it changes your profile link."
        />
      </div>
      <TextField
        name="bio"
        label="Short bio"
        multiline
        maxLength={400}
        defaultValue={initial.bio}
        error={errors.bio}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="location"
          label="Location"
          defaultValue={initial.location}
          maxLength={80}
          error={errors.location}
        />
        <TextField
          name="websiteUrl"
          label="Website"
          type="url"
          inputMode="url"
          defaultValue={initial.websiteUrl}
          error={errors.websiteUrl}
          hint="A full https:// link."
        />
      </div>
      <RoleChoices selected={initial.roles} error={errors.roles} />
      <TextField
        name="skills"
        label="Skills"
        defaultValue={initial.skills.join(", ")}
        hint="Separate with commas, for example: TypeScript, Figma, Governance."
        error={errors.skills}
      />
      <div className="border-t border-line pt-6">
        <Submit pending={pending} label="Save profile" pendingLabel="Saving…" />
      </div>
    </form>
  );
}

export interface IdentityFormValues {
  github: string;
  x: string;
  linkedin: string;
  other: string;
}

export function IdentityForm({ initial }: { initial: IdentityFormValues }) {
  const { state, pending, onSubmit } = useFormAction(saveIdentity);
  const errors = state.errors ?? {};

  return (
    <form onSubmit={onSubmit} method="post" className="form-stack" noValidate>
      <Feedback state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="github"
          label="GitHub"
          type="url"
          inputMode="url"
          defaultValue={initial.github}
          hint="https://github.com/your-name"
          error={errors.github}
        />
        <TextField
          name="x"
          label="X"
          type="url"
          inputMode="url"
          defaultValue={initial.x}
          hint="https://x.com/your-name"
          error={errors.x}
        />
        <TextField
          name="linkedin"
          label="LinkedIn"
          type="url"
          inputMode="url"
          defaultValue={initial.linkedin}
          hint="https://linkedin.com/in/your-name"
          error={errors.linkedin}
        />
        <TextField
          name="other"
          label="Another link"
          type="url"
          inputMode="url"
          defaultValue={initial.other}
          error={errors.other}
        />
      </div>
      <div className="border-t border-line pt-6">
        <Submit pending={pending} label="Save links" pendingLabel="Saving…" />
      </div>
    </form>
  );
}

export function PrivacyForm({
  visibility,
  sections,
}: {
  visibility: "public" | "private";
  sections: Record<ProfileSection, boolean>;
}) {
  const { state, pending, onSubmit } = useFormAction(savePrivacy);

  return (
    <form onSubmit={onSubmit} method="post" className="form-stack" noValidate>
      <Feedback state={state} />
      <fieldset className="field">
        <legend className="field-label">Who can see your profile?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["private", "Only you", "Nobody else can open your profile page."],
              [
                "public",
                "Anyone with the link",
                "Your profile page is public. Drafts and pending work never are.",
              ],
            ] as const
          ).map(([value, title, body]) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-2xl border-[1.5px] border-line-strong bg-surface p-4 transition-colors hover:border-ink has-[:checked]:border-brand has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link"
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                defaultChecked={visibility === value}
                className="mt-1 size-4"
              />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-meta text-muted">{body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend className="field-label">Show on your public profile</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PROFILE_SECTIONS.map((section) => (
            <label
              key={section}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1"
            >
              <input
                type="checkbox"
                name={`show-${section}`}
                defaultChecked={sections[section]}
                className="size-4"
              />
              {PROFILE_SECTION_LABELS[section]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="border-t border-line pt-6">
        <Submit pending={pending} label="Save privacy settings" pendingLabel="Saving…" />
      </div>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const { state, pending, onSubmit } = useFormAction(deleteAccount);
  const hydrated = useHydrated();

  return (
    <form onSubmit={onSubmit} method="post" className="form-stack" noValidate>
      <TextField
        name="confirm"
        label={`Type your username, ${username}, to confirm`}
        required
        spellCheck={false}
        autoComplete="off"
        error={state.errors?.confirm}
      />
      <div>
        <button
          type="submit"
          className="action border-[1.5px] border-bad-ink bg-bad text-bad-ink hover:bg-bad-ink hover:text-surface"
          disabled={pending || !hydrated}
        >
          {pending ? "Closing your account…" : "Close my account"}
        </button>
      </div>
    </form>
  );
}
