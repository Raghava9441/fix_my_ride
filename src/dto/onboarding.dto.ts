import { z } from "zod";

export const SignupOrganizationSchema = z.object({
  ownerFirstName: z.string().min(1).max(50),
  ownerLastName: z.string().min(1).max(50),
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: "Password must contain at least one lowercase, one uppercase letter, and one number",
    }),
  organizationName: z.string().min(1).max(100),
  contactPhone: z.string().min(1),
  contactEmail: z.string().email().optional(),
  serviceCenterName: z.string().min(1).max(100).optional(),
  businessRegistrationNumber: z.string().min(1),
  city: z.string().min(1),
});

export type SignupOrganizationDTO = z.infer<typeof SignupOrganizationSchema>;
