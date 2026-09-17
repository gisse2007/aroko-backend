// src/utils/validarNombre.js

// Letras (con tildes y ñ/Ñ) y espacios únicamente — sin números ni caracteres especiales.
export const NOMBRE_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;

export function esNombreValido(valor) {
  if (typeof valor !== 'string') return false;
  const v = valor.trim();
  if (!v) return false;
  return NOMBRE_REGEX.test(v);
}

export const MENSAJE_NOMBRE_INVALIDO = 'El nombre solo puede contener letras y espacios (sin números ni caracteres especiales).';
