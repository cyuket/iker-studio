import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { StudioError } from "../../domain/errors";

/**
 * Environment access with lazy validation: each integration validates only its own
 * variables, and only when it is first used. A machine without R2 or YouTube credentials
 * can therefore run everything that does not touch R2 or YouTube.
 */

const optional = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === "" ? undefined : value.trim()));
const required = (name: string) =>
  optional.refine((value): value is string => value !== undefined, `${name} is not set`);

const GeneralSchema = z.object({
  NODE_ENV: optional.pipe(z.enum(["development", "test", "production"]).default("development")),
  OUTPUT_DIRECTORY: optional.pipe(z.string().default("output")),
  RENDER_CONCURRENCY: optional.pipe(z.coerce.number<string>().int().min(1).max(64).optional()),
  DEFAULT_FPS: optional.pipe(
    z.coerce
      .number<string>()
      .pipe(z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]))
      .default(30),
  ),
  DEFAULT_RESOLUTION: optional.pipe(z.enum(["720p", "1080p", "1440p", "2160p"]).default("1080p")),
  LOG_LEVEL: optional.pipe(z.enum(["debug", "info", "warn", "error"]).default("info")),
  LOG_FORMAT: optional.pipe(z.enum(["pretty", "json"]).default("pretty")),
});

const ElevenLabsSchema = z.object({
  ELEVENLABS_API_KEY: required("ELEVENLABS_API_KEY"),
  ELEVENLABS_VOICE_ID: required("ELEVENLABS_VOICE_ID"),
  ELEVENLABS_MODEL_ID: optional.pipe(z.string().default("eleven_multilingual_v2")),
  /** MP3 quality. 128 kbps works on every plan; 192 kbps needs Creator or above. */
  ELEVENLABS_OUTPUT_FORMAT: optional.pipe(
    z
      .string()
      .regex(/^mp3_\d+_\d+$/, "must be an mp3 format such as mp3_44100_128")
      .optional(),
  ),
  /** Your plan's price per 1,000 credits, used only to print money estimates. */
  ELEVENLABS_USD_PER_1K_CREDITS: optional.pipe(z.coerce.number<string>().positive().optional()),
});

const DemoSchema = z
  .object({
    IKER_DEMO_BASE_URL: required("IKER_DEMO_BASE_URL").pipe(z.url()),
    /**
     * `password` signs in with the two variables below. `session` reuses a session a person
     * created with `pnpm studio demo-login`, for accounts that sign in through Google.
     */
    IKER_DEMO_AUTH: optional.pipe(z.enum(["password", "session"]).optional()),
    IKER_DEMO_USERNAME: optional,
    IKER_DEMO_PASSWORD: optional,
    /** Extra hostnames to refuse, comma separated, on top of the built-in production hosts. */
    IKER_PRODUCTION_HOSTS: optional,
  })
  .superRefine((value, context) => {
    const usesPassword =
      value.IKER_DEMO_AUTH === "password" ||
      (value.IKER_DEMO_AUTH === undefined &&
        (value.IKER_DEMO_USERNAME !== undefined || value.IKER_DEMO_PASSWORD !== undefined));
    if (!usesPassword) return;
    for (const name of ["IKER_DEMO_USERNAME", "IKER_DEMO_PASSWORD"] as const) {
      if (value[name] === undefined) {
        context.addIssue({ code: "custom", path: [name], message: `${name} is not set` });
      }
    }
  });

const R2Schema = z.object({
  R2_ACCOUNT_ID: required("R2_ACCOUNT_ID"),
  R2_ACCESS_KEY_ID: required("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: required("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET_NAME: required("R2_BUCKET_NAME"),
  R2_RETENTION_DAYS: optional.pipe(z.coerce.number<string>().int().positive().optional()),
});

const YouTubeSchema = z.object({
  YOUTUBE_CLIENT_ID: required("YOUTUBE_CLIENT_ID"),
  YOUTUBE_CLIENT_SECRET: required("YOUTUBE_CLIENT_SECRET"),
});

/** Variables whose values must never be printed, logged or written to an artefact. */
const SECRET_VARIABLES = [
  "ELEVENLABS_API_KEY",
  "IKER_DEMO_PASSWORD",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "YOUTUBE_CLIENT_SECRET",
  "REMOTION_LICENSE_KEY",
] as const;

export type GeneralConfig = ReturnType<Config["general"]>;

export interface Config {
  general(): {
    nodeEnv: "development" | "test" | "production";
    outputDirectory: string;
    renderConcurrency: number | undefined;
    defaultFps: 24 | 25 | 30 | 60;
    /** Multiplier applied to a format's 1080-line base resolution for final renders. */
    resolutionScale: number;
    logLevel: "debug" | "info" | "warn" | "error";
    logFormat: "pretty" | "json";
  };
  elevenLabs(): {
    apiKey: string;
    voiceId: string;
    modelId: string;
    /** undefined uses the adapter's default, which every plan allows. */
    outputFormat: string | undefined;
    usdPerThousandCredits: number | null;
  };
  demo(): {
    baseUrl: string;
    /** null means a saved session is used instead of a username and password. */
    credentials: { username: string; password: string } | null;
    extraProductionHosts: string[];
  };
  r2(): {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    retentionDays: number | null;
  };
  youTube(): { clientId: string; clientSecret: string; publishingEnabled: boolean };
  /** Which optional integrations have their variables set, without validating or reading them. */
  configured(): { elevenLabs: boolean; demo: boolean; r2: boolean; youTube: boolean };
  /** Values to scrub from all output. */
  secretValues(): string[];
}

const RESOLUTION_SCALE = { "720p": 2 / 3, "1080p": 1, "1440p": 4 / 3, "2160p": 2 } as const;

function parse<T extends z.ZodType>(
  schema: T,
  env: NodeJS.ProcessEnv,
  integration: string,
): z.output<T> {
  const result = schema.safeParse(env);
  if (result.success) return result.data;
  // Only variable names and reasons are reported: zod messages here never include values.
  const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new StudioError(
    "CONFIG_INVALID",
    `${integration} is not configured: ${problems.join("; ")}`,
    {
      hint: "Set the variables in .env (see .env.example), then run `pnpm studio doctor`.",
    },
  );
}

const isSet = (env: NodeJS.ProcessEnv, names: readonly string[]): boolean =>
  names.every((name) => (env[name] ?? "").trim() !== "");

export function createConfig(env: NodeJS.ProcessEnv): Config {
  return {
    general() {
      const g = parse(GeneralSchema, env, "General settings");
      return {
        nodeEnv: g.NODE_ENV,
        outputDirectory: g.OUTPUT_DIRECTORY,
        renderConcurrency: g.RENDER_CONCURRENCY,
        defaultFps: g.DEFAULT_FPS,
        resolutionScale: RESOLUTION_SCALE[g.DEFAULT_RESOLUTION],
        logLevel: g.LOG_LEVEL,
        logFormat: g.LOG_FORMAT,
      };
    },
    elevenLabs() {
      const e = parse(ElevenLabsSchema, env, "ElevenLabs");
      return {
        apiKey: e.ELEVENLABS_API_KEY,
        voiceId: e.ELEVENLABS_VOICE_ID,
        modelId: e.ELEVENLABS_MODEL_ID,
        outputFormat: e.ELEVENLABS_OUTPUT_FORMAT,
        usdPerThousandCredits: e.ELEVENLABS_USD_PER_1K_CREDITS ?? null,
      };
    },
    demo() {
      const d = parse(DemoSchema, env, "The Iker demo environment");
      return {
        baseUrl: d.IKER_DEMO_BASE_URL.replace(/\/+$/, ""),
        credentials:
          d.IKER_DEMO_AUTH !== "session" &&
          d.IKER_DEMO_USERNAME !== undefined &&
          d.IKER_DEMO_PASSWORD !== undefined
            ? { username: d.IKER_DEMO_USERNAME, password: d.IKER_DEMO_PASSWORD }
            : null,
        extraProductionHosts: (d.IKER_PRODUCTION_HOSTS ?? "")
          .split(",")
          .map((host) => host.trim().toLowerCase())
          .filter(Boolean),
      };
    },
    r2() {
      const r = parse(R2Schema, env, "Cloudflare R2");
      return {
        accountId: r.R2_ACCOUNT_ID,
        accessKeyId: r.R2_ACCESS_KEY_ID,
        secretAccessKey: r.R2_SECRET_ACCESS_KEY,
        bucket: r.R2_BUCKET_NAME,
        retentionDays: r.R2_RETENTION_DAYS ?? null,
      };
    },
    youTube() {
      const y = parse(YouTubeSchema, env, "YouTube publishing");
      return {
        clientId: y.YOUTUBE_CLIENT_ID,
        clientSecret: y.YOUTUBE_CLIENT_SECRET,
        // Off unless switched on deliberately; credentials alone never enable publishing.
        publishingEnabled: (env.YOUTUBE_PUBLISHING_ENABLED ?? "").trim().toLowerCase() === "true",
      };
    },
    configured() {
      return {
        elevenLabs: isSet(env, ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]),
        demo:
          isSet(env, ["IKER_DEMO_BASE_URL"]) &&
          ((env.IKER_DEMO_AUTH ?? "").trim() === "session" ||
            isSet(env, ["IKER_DEMO_USERNAME", "IKER_DEMO_PASSWORD"])),
        r2: isSet(env, [
          "R2_ACCOUNT_ID",
          "R2_ACCESS_KEY_ID",
          "R2_SECRET_ACCESS_KEY",
          "R2_BUCKET_NAME",
        ]),
        youTube: isSet(env, ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"]),
      };
    },
    secretValues() {
      return SECRET_VARIABLES.map((name) => (env[name] ?? "").trim()).filter(Boolean);
    },
  };
}

/** Loads `.env` from the project root into the process environment, if the file exists. */
export function loadDotEnv(projectRoot: string): void {
  const file = path.join(projectRoot, ".env");
  if (existsSync(file)) process.loadEnvFile(file);
}
