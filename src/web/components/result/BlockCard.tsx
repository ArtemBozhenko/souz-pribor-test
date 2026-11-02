import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { copyText } from "@/lib/clipboard";

interface Props {
  title: string;
  copy: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/** Блок результата с кнопкой копирования. */
export function BlockCard({ title, copy, aside, children }: Props) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copyText(copy)) {
      setCopied(true);
      toast.success(`Скопировано: ${title}`);
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Не удалось скопировать. Выделите текст вручную.");
    }
  };
  return (
    <Card role="region" aria-label={title}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {aside}
        </div>
        <Button variant="outline" size="sm" onClick={onCopy} aria-label={`Копировать: ${title}`}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Скопировано" : "Копировать"}
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
