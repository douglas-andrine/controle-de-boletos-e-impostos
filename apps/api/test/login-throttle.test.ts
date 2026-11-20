import { describe, expect, it } from "vitest";
import { clearLoginAttempts, consumeLoginAttempt, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } from "../src/lib/login-throttle";

describe("limite de login por email", () => {
  it("bloqueia depois do máximo e libera quando a janela acaba", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) expect(consumeLoginAttempt("janela@x.com", t0).allowed).toBe(true);

    const blocked = consumeLoginAttempt("janela@x.com", t0 + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(LOGIN_WINDOW_MS / 1000 - 1);

    expect(consumeLoginAttempt("janela@x.com", t0 + LOGIN_WINDOW_MS).allowed).toBe(true);
  });

  it("login certo zera o contador", () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) consumeLoginAttempt("zera@x.com");
    clearLoginAttempts("zera@x.com");
    expect(consumeLoginAttempt("zera@x.com").allowed).toBe(true);
  });
});
