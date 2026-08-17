export const WHATSAPP_NUMBER = "916395628206";

export function whatsappHref(text?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
