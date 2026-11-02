import { Toaster as Sonner, toast, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return <Sonner position="top-right" richColors {...props} />;
}

export { toast };
