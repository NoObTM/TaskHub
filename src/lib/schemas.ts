import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .min(10, "Informe um telefone valido")
  .regex(/^\+?[0-9\s().-]{10,20}$/, "Informe um telefone valido");

export const loginSchema = z.object({
  email: z.email("E-mail invalido"),
  password: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Nome deve ter no minimo 2 caracteres"),
    email: z.email("E-mail invalido"),
    phone: phoneSchema,
    password: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao coincidem",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z
  .object({
    phone: phoneSchema,
    resetCode: z.string().regex(/^\d{6}$/, "Informe o codigo de 6 digitos"),
    password: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao coincidem",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
