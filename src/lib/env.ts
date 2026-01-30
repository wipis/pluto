import { env } from "cloudflare:workers";

export function getEnv(): Cloudflare.Env {
  return env as Cloudflare.Env;
}
