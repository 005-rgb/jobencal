import { z } from "zod";
const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    BASE_PATH: z
        .string()
        .regex(/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/, "must be an absolute URL path")
        .default("/api"),
    ADS_ENABLED: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});
export function parseEnv(source) {
    const parsed = envSchema.safeParse(source);
    if (!parsed.success) {
        const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "environment");
        throw new Error(`Invalid environment configuration: ${[...new Set(fields)].join(", ")}`);
    }
    return parsed.data;
}
