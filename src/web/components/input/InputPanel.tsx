import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { ProductInput } from "../../../contract";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  EXAMPLE_INPUT,
  formToInput,
  inputToForm,
  parseJsonInput,
  type FormValues,
} from "@/lib/input-parse";

const EMPTY_FORM: FormValues = { name: "", manufacturer: "", specs: [{ key: "", value: "" }], description: "" };

interface Props {
  loading: boolean;
  onSubmit: (input: ProductInput) => void;
}

export function InputPanel({ loading, onSubmit }: Props) {
  const [tab, setTab] = useState<"form" | "json">("form");
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<FormValues>) => setForm((f) => ({ ...f, ...patch }));
  const updateSpec = (i: number, patch: Partial<FormValues["specs"][number]>) =>
    update({ specs: form.specs.map((row, j) => (j === i ? { ...row, ...patch } : row)) });

  const fillExample = () => {
    setForm(inputToForm(EXAMPLE_INPUT));
    setJson(JSON.stringify(EXAMPLE_INPUT, null, 2));
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = tab === "form" ? formToInput(form) : parseJsonInput(json);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onSubmit(result.input);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Данные о приборе</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={fillExample}>
          Подставить пример
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate>
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "form" | "json"); setError(null); }}>
            <TabsList>
              <TabsTrigger value="form">Форма</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="space-y-4 pt-2">
              <Field label="Название" htmlFor="f-name">
                <Input id="f-name" value={form.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field label="Производитель" htmlFor="f-manufacturer">
                <Input
                  id="f-manufacturer"
                  value={form.manufacturer}
                  onChange={(e) => update({ manufacturer: e.target.value })}
                />
              </Field>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Характеристики</legend>
                {form.specs.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      aria-label={`Характеристика ${i + 1}`}
                      placeholder="Параметр"
                      value={row.key}
                      onChange={(e) => updateSpec(i, { key: e.target.value })}
                    />
                    <Input
                      aria-label={`Значение ${i + 1}`}
                      placeholder="Значение"
                      value={row.value}
                      onChange={(e) => updateSpec(i, { value: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 shrink-0"
                      aria-label={`Удалить строку ${i + 1}`}
                      onClick={() =>
                        update({
                          specs: form.specs.length > 1 ? form.specs.filter((_, j) => j !== i) : [{ key: "", value: "" }],
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => update({ specs: [...form.specs, { key: "", value: "" }] })}
                >
                  <Plus className="size-4" /> Добавить строку
                </Button>
              </fieldset>
              <Field label="Описание или текст паспорта" htmlFor="f-description">
                <Textarea
                  id="f-description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </Field>
            </TabsContent>

            <TabsContent value="json" className="pt-2">
              <Field label="JSON с данными" htmlFor="f-json">
                <Textarea
                  id="f-json"
                  rows={12}
                  className="font-mono text-xs"
                  placeholder='{ "name": "…", "manufacturer": "…", "specs": { "…": "…" }, "description": "…" }'
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                />
              </Field>
            </TabsContent>
          </Tabs>

          {error && (
            <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Генерация…" : "Сгенерировать"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
