// Validación de teléfonos (cliente y servidor). No comprueba que la línea exista,
// pero descarta números con formato imposible o claramente inventados.

// DDD válidos en Brasil (Anatel).
const DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Números de relleno: todo el mismo dígito, secuencias 12345678 / 87654321, o casi sin variedad. */
function looksFake(sub: string): boolean {
  if (/^(\d)\1+$/.test(sub)) return true;
  if ("0123456789012345".includes(sub) || "9876543210987654".includes(sub)) return true;
  if (new Set(sub).size < 3) return true;
  return false;
}

function validBR(n: string): boolean {
  if (n.length !== 10 && n.length !== 11) return false;
  if (!DDD.has(Number(n.slice(0, 2)))) return false;
  const sub = n.slice(2);
  if (n.length === 11 && sub[0] !== "9") return false; // móvil: 9 + 8 dígitos
  if (n.length === 10 && !/^[2-9]/.test(sub)) return false; // fijo (2–5) o móvil escrito sin el 9 inicial
  return !looksFake(n.length === 11 ? sub.slice(1) : sub);
}

function validES(n: string): boolean {
  if (!/^[6789]\d{8}$/.test(n)) return false;
  return !looksFake(n.slice(1));
}

export function validPhone(raw: string, lang: "es" | "pt"): boolean {
  const s = String(raw || "").trim();
  let d = s.replace(/\D/g, "");
  const intl = s.startsWith("+") || d.startsWith("00");
  if (d.startsWith("00")) d = d.slice(2);

  if (intl || (lang === "pt" && d.length === 13 && d.startsWith("55")) || (lang === "es" && d.length === 11 && d.startsWith("34"))) {
    if (d.startsWith("55")) return validBR(d.slice(2));
    if (d.startsWith("34")) return validES(d.slice(2));
    // Otros países: longitud internacional razonable y sin pinta de inventado.
    return d.length >= 9 && d.length <= 15 && !looksFake(d.slice(-8));
  }
  // Sin prefijo: número nacional del país del formulario.
  if (lang === "pt") return validBR(d.replace(/^0/, ""));
  if (validES(d)) return true;
  // Formulario de España con un número extranjero escrito sin "+" (p. ej. 44 7911…).
  return d.length >= 11 && d.length <= 15 && !d.startsWith("34") && !looksFake(d.slice(-8));
}
