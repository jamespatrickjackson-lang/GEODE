const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function newId(prefix?: string): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return prefix ? `${prefix}-${suffix}` : suffix;
}

const KEBAB_ID = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/;
const SNAKE_ID = /^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$/;

export function isValidId(value: unknown): value is string {
  return typeof value === "string" && (KEBAB_ID.test(value) || SNAKE_ID.test(value));
}

export function isValidKebabId(value: unknown): value is string {
  return typeof value === "string" && KEBAB_ID.test(value);
}

export function isValidSnakeId(value: unknown): value is string {
  return typeof value === "string" && SNAKE_ID.test(value);
}
