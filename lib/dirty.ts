"use client";
// Marca global de "cambios sin guardar" para avisar antes de salir del editor.
let dirty = false;
export const setDirty = (v: boolean) => { dirty = v; };
export function confirmLeave(): boolean {
  if (!dirty) return true;
  const ok = window.confirm("Tienes cambios sin guardar. ¿Salir sin guardar?");
  if (ok) dirty = false;
  return ok;
}
