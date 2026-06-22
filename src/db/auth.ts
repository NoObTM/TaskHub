import { ApiError, apiFetch } from "./api";
import type { User } from "./schema";

export type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

export type AuthResult = {
  user: User;
  token: string;
};

export class EmailInUseError extends Error {
  constructor() {
    super("E-mail já cadastrado");
    this.name = "EmailInUseError";
  }
}

export class PhoneInUseError extends Error {
  constructor() {
    super("Telefone ja cadastrado");
    this.name = "PhoneInUseError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("E-mail ou senha inválidos");
    this.name = "InvalidCredentialsError";
  }
}

function mapAuthError(error: unknown): never {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.message.toLowerCase().includes("telefone")) {
      throw new PhoneInUseError();
    }
    if (error.status === 409) throw new EmailInUseError();
    if (error.status === 401) throw new InvalidCredentialsError();
  }
  throw error;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  try {
    return await apiFetch<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (error) {
    return mapAuthError(error);
  }
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    return await apiFetch<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    return mapAuthError(error);
  }
}

export function requestPasswordReset(phone: string): Promise<void> {
  return apiFetch<void>("/auth/reset-password/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function resetPassword(
  phone: string,
  resetCode: string,
  password: string
): Promise<void> {
  return apiFetch<void>("/auth/reset-password", {
    method: "PATCH",
    body: JSON.stringify({ phone, resetCode, password }),
  });
}

export async function listAllUsers(): Promise<User[]> {
  return apiFetch<User[]>("/users");
}

export async function getUserById(id: string): Promise<User | null> {
  return apiFetch<User | null>(`/users/${id}`);
}

export async function updateUserAvatarUri(
  id: string,
  avatarUri: string
): Promise<User | null> {
  return apiFetch<User | null>(`/users/${id}/avatar`, {
    method: "PATCH",
    body: JSON.stringify({ avatarUri }),
  });
}
