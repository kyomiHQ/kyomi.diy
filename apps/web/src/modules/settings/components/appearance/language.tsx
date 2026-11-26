import { useId, useMemo } from "react";
import { translationLanguages } from "@kyomi/reader/schemas/translation";
import { NativeSelect } from "@kyomi/ui/components/native-select";

export function LanguageSettings({
  language,
  onLanguageChange,
}: {
  language: string;
  onLanguageChange: (value: string) => void;
}) {
  const fieldId = useId();
  const detailId = `${fieldId}-description`;
  const languages = useMemo(() => {
    const locales = [language === "ns" ? "nso" : language, "en"];
    const labels = new Intl.DisplayNames(locales, { type: "language" });
    const order = new Intl.Collator(locales);
    return [...new Set([language, ...translationLanguages])]
      .map((code) => ({ code, name: labels.of(code === "ns" ? "nso" : code) ?? code }))
      .sort((a, b) => order.compare(a.name, b.name));
  }, [language]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="min-w-0">
        <label htmlFor={fieldId} className="block text-sm font-medium text-foreground">
          Preferred language
        </label>
        <span id={detailId} className="block text-xs text-muted-foreground">
          Formats dates and times and sets the default for article translations.
        </span>
      </span>
      <NativeSelect
        id={fieldId}
        aria-describedby={detailId}
        className="w-44 max-w-full"
        value={language}
        onChange={(event) => onLanguageChange(event.target.value)}
      >
        {languages.map(({ code, name }) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
