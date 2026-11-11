import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against a bug found in testing: React 19 resets a form after a
 * `<form action={...}>` submission, so after a validation error, fields jump
 * back to their defaults while the person believes their choice still stands.
 * A reviewer who chose "ask for more" ended up approving a claim.
 *
 * Rule: a `<form action={...}>` may only wrap buttons. Any form with an input,
 * select, textarea or field component must use `useFormAction` (onSubmit).
 * Plain search forms that navigate with `method="get"` to a URL are not
 * server actions and are never reset, so they are allowed.
 */

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/**
 * The source of each `<form action={...}>` element, up to its closing
 * tag. The opening tag may span several lines once Prettier wraps it.
 */
function actionForms(source: string): string[] {
  const forms: string[] = [];
  for (const match of source.matchAll(/<form\b[^>]*>/g)) {
    // Only `action={...}` can be a React action; `action="/url"` is plain HTML.
    if (!/\saction=\{/.test(match[0])) continue;
    const end = source.indexOf("</form>", match.index);
    forms.push(source.slice(match.index, end === -1 ? undefined : end));
  }
  return forms;
}

const FIELD = /<(input|select|textarea)\b|<(TextField|Select|SelectField)\b/;

/** A GET form navigates to a URL; React never resets it. */
const isGetForm = (form: string) => /^<form\b[^>]*\bmethod="get"/.test(form);

describe("forms with fields never use React's auto-resetting form action", () => {
  const sources = [...files("components"), ...files("app")];

  it("finds component files to check", () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  for (const file of sources) {
    const source = readFileSync(file, "utf8");
    const offending = actionForms(source).filter((form) => FIELD.test(form) && !isGetForm(form));
    if (offending.length > 0) {
      it(`${file} has no auto-resetting form with fields`, () => {
        expect(offending.map((form) => form.slice(0, 120))).toEqual([]);
      });
    }
  }

  it("catches the pattern it is meant to catch", () => {
    const bad = `<form action={action}><input name="x" /></form>`;
    expect(actionForms(bad).some((form) => FIELD.test(form))).toBe(true);
    const fine = `<form action={action}><button type="submit">Go</button></form>`;
    expect(actionForms(fine).some((form) => FIELD.test(form))).toBe(false);
    const search = `<form action={path} method="get" role="search"><input name="q" /></form>`;
    expect(actionForms(search).every(isGetForm)).toBe(true);
    expect(isGetForm(bad)).toBe(false);
  });
});
