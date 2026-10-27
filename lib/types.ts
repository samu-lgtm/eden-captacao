export type FieldType = "text" | "longtext" | "email" | "phone" | "instagram" | "url" | "select" | "consent";

export interface Field {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
  text?: string;
}

export interface FormSettings {
  thanks: string;
  redirect_url: string;
  pixel_id: string;
  capi_token: string;
  event_name: string;
  test_event_code: string;
  notify_email: boolean;
  notify_to: string;
  auto_reply: boolean;
  privacy_url: string;
  intro_enabled: boolean;
  intro_title: string;
  intro_bullets: string;
  intro_note: string;
  intro_button: string;
  partial_enabled: boolean;
  partial_notice: string;
}

export interface Form {
  id: string;
  name: string;
  slug: string;
  folder: string;
  status: "ativo" | "pausado";
  lang: "es" | "pt";
  fields: Field[];
  settings: FormSettings;
  created_at: string;
  updated_at: string;
}

export interface ResponseRow {
  id: string;
  form_id: string;
  created_at: string;
  answers: Record<string, string | boolean>;
  source: Record<string, string>;
  event_id: string;
  meta_status: "enviado" | "erro" | "off";
  meta_error: string | null;
}

export const FIELD_TYPES: Record<FieldType, string> = {
  text: "Texto corto",
  longtext: "Texto largo",
  email: "E-mail",
  phone: "Teléfono / WhatsApp",
  instagram: "Instagram",
  url: "Web",
  select: "Opción múltiple",
  consent: "Consentimiento RGPD/LGPD",
};

export const DEFAULT_SETTINGS: FormSettings = {
  thanks: "Gracias. Te escribimos en menos de 24 horas.",
  redirect_url: "",
  pixel_id: "",
  capi_token: "",
  event_name: "Lead",
  test_event_code: "",
  notify_email: true,
  notify_to: "samu@edenperformance.net",
  auto_reply: false,
  privacy_url: "https://edenperformance.net/politica-de-privacidad/",
  intro_enabled: false,
  intro_title: "",
  intro_bullets: "",
  intro_note: "",
  intro_button: "",
  partial_enabled: false,
  partial_notice: "",
};

export const PARTIAL_NOTICE = {
  es: "Guardamos tus datos de contacto desde este paso para poder ayudarte si no terminas el formulario.",
  pt: "Guardamos seus dados de contato a partir desta etapa para poder ajudar caso você não termine o formulário.",
};

/** Lo que el navegador del lead puede ver: nunca el token de la Conversions API. */
export function publicForm(f: Form) {
  return {
    id: f.id,
    name: f.name,
    slug: f.slug,
    lang: f.lang,
    fields: f.fields,
    thanks: f.settings.thanks,
    redirect_url: f.settings.redirect_url,
    pixel_id: f.settings.pixel_id,
    event_name: f.settings.event_name || "Lead",
    privacy_url: f.settings.privacy_url,
    intro: f.settings.intro_enabled
      ? {
          title: f.settings.intro_title,
          bullets: f.settings.intro_bullets.split("\n").map((x) => x.trim()).filter(Boolean),
          note: f.settings.intro_note,
          button: f.settings.intro_button || (f.lang === "pt" ? "Começar" : "Empezar"),
        }
      : null,
    partial: f.settings.partial_enabled
      ? { notice: f.settings.partial_notice || PARTIAL_NOTICE[f.lang] }
      : null,
  };
}
export type PublicForm = ReturnType<typeof publicForm>;
