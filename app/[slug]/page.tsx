import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFormBySlug } from "@/lib/db";
import { publicForm } from "@/lib/types";
import FormRunner from "./FormRunner";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const f = await getFormBySlug(params.slug).catch(() => null);
  return { title: f ? `${f.name} · Eden` : "Eden" };
}

export default async function Page({ params, searchParams }: { params: { slug: string }; searchParams: { preview?: string } }) {
  const form = await getFormBySlug(params.slug);
  if (!form) notFound();
  // Un formulario en pausa solo se abre con ?preview=1 (para probarlo desde el panel).
  if (form.status !== "ativo" && searchParams.preview !== "1") notFound();
  return <FormRunner form={publicForm(form)} live={form.status === "ativo"} />;
}
