import { AsyncLocalStorage } from "async_hooks";
import { expect, test } from "bun:test";
import { stubStub } from "./stub-stub.ts";

test("stubStub", async () => {
  const storage = new AsyncLocalStorage<Record<string, string>>();

  class MyClass implements stubStub.Callable {
    callMethod(params: stubStub.CallMethodParams) {
      return storage.run(params.context, () => stubStub.callMethodImpl(this, params));
    }

    async getGreeting({ language }: { language: "en" | "fr" }) {
      if (language === "en") return "Hello";
      if (language === "fr") return "Bonjour";

      throw new Error("Invalid language. Context: " + JSON.stringify(storage.getStore()));
    }
  }

  const raw = new MyClass();
  const stub = stubStub(raw, { requestId: "abc123" });

  await expect(stub.getGreeting({ language: "en" })).resolves.toBe("Hello");
  await expect(stub.getGreeting({ language: "fr" })).resolves.toBe("Bonjour");

  await expect(stub.getGreeting({ language: "de" as never })).rejects.toThrow(
    'Invalid language. Context: {"requestId":"abc123"}',
  );
  const stack = await stub.getGreeting({ language: "de" as never }).catch((e) => simplifyCallStack(e.stack));
  expect(stack).toContain('Error: Invalid language. Context: {"requestId":"abc123"}');
  expect(stack).toContain("at getGreeting ({cwd}/src/stub-stub.test.ts:{line}:{column})");
  expect(stack).toContain("at callMethodImpl ({cwd}/src/stub-stub.ts:{line}:{column})");
  expect(stack).toContain("at <anonymous> ({cwd}/src/stub-stub.ts:{line}:{column})");
  expect(stack).toContain("at <anonymous> ({cwd}/src/stub-stub.test.ts:{line}:{column})");
});

test("stubStub passes caller stack", async () => {
  const loggedErrors: Error[] = [];
  const storage = new AsyncLocalStorage<{ context: Record<string, string>; callerStack: string }>();

  class MyClass implements stubStub.Callable {
    callMethod(params: stubStub.CallMethodParams) {
      return storage.run({ context: params.context, callerStack: params.callerStack }, () =>
        stubStub.callMethodImpl(this, params),
      );
    }

    async getGreeting({ language }: { language: "en" | "fr" }) {
      if (language === "en") return "Hello";
      if (language === "fr") return "Bonjour";

      loggedErrors.push(new Error("Invalid language. Context: " + JSON.stringify(storage.getStore())));
      return null;
    }
  }

  const raw = new MyClass();
  const stub = stubStub(raw, { requestId: "abc123" });

  await expect(stub.getGreeting({ language: "en" })).resolves.toBe("Hello");
  await expect(stub.getGreeting({ language: "fr" })).resolves.toBe("Bonjour");

  await expect(stub.getGreeting({ language: "de" as never })).resolves.toBeNull();
  expect(loggedErrors).toHaveLength(1);
  expect(loggedErrors[0].message).toMatch(/Invalid language. Context: {.*}/);
  const call = loggedErrors[0];
  const { callerStack } = JSON.parse(call.message.slice(call.message.indexOf("{")));
  expect(simplifyCallStack(callerStack)).toContain("at <anonymous> ({cwd}/src/stub-stub.ts:{line}:{column})");
  expect(simplifyCallStack(callerStack)).toContain("at <anonymous> ({cwd}/src/stub-stub.test.ts:{line}:{column})");

  const logStack = simplifyCallStack(call.stack!.replace(/Context: {.*}/, "Context: {***}"));
  expect(logStack).toContain("Error: Invalid language. Context: {***}");
  expect(logStack).toContain("at getGreeting ({cwd}/src/stub-stub.test.ts:{line}:{column})");
});

const simplifyCallStack = (stack: string) =>
  stack
    .replaceAll(process.cwd(), "{cwd}")
    .replaceAll(/file:\/\/\/.*node_modules\/([^/]+)\/.*:\d+:\d+\b/g, "node_modules/$1/{line}:{column}")
    .replaceAll(/:\d+:\d+\b/g, ":{line}:{column}");
