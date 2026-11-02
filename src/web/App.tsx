/** Веб (#4): экран генерации карточки. Пока — каркас. */
import { Toaster } from "@/components/ui/sonner";

export function App() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Генератор карточек товара</h1>
      <p className="mt-2 text-muted-foreground">Каркас приложения. Форма появится в следующей задаче.</p>
      <Toaster />
    </main>
  );
}
