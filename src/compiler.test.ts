import { describe, it, expect } from "bun:test";
import { compileCode, formatDiagnostics } from "./compiler";

describe("compileCode", () => {
  it("compiles valid TypeScript code", () => {
    const result = compileCode(`
      const x: number = 5;
      const y: string = "hello";
    `);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.js).toContain("const x = 5");
    expect(result.js).toContain('const y = "hello"');
  });

  it("compiles interfaces and functions", () => {
    const result = compileCode(`
      interface User {
        name: string;
        age: number;
      }

      function greet(user: User): string {
        return \`Hello \${user.name}\`;
      }
    `);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.js).toContain("function greet(user)");
    expect(result.js).toContain("return `Hello ${user.name}`");
    // Interface should be erased
    expect(result.js).not.toContain("interface");
  });

  it("detects type errors - property does not exist", () => {
    const result = compileCode(`
      interface User {
        name: string;
        age: number;
      }

      function greet(user: User) {
        return \`Hello \${user.firstName}\`;
      }
    `);

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    const error = result.diagnostics[0];
    expect(error.category).toBe("error");
    expect(error.message).toContain("firstName");
    expect(error.message).toContain("User");
    expect(error.code).toBe(2339); // Property does not exist on type
    expect(error.line).toBeDefined();
  });

  it("detects type mismatch errors", () => {
    const result = compileCode(`
      const x: number = "hello";
    `);

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    const error = result.diagnostics[0];
    expect(error.category).toBe("error");
    expect(error.code).toBe(2322); // Type 'X' is not assignable to type 'Y'
  });

  it("detects syntax errors", () => {
    const result = compileCode(`
      const x: number = 
    `);

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].category).toBe("error");
  });

  it("detects undefined variable", () => {
    const result = compileCode(`
      const x = unknownVariable;
    `);

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].code).toBe(2304); // Cannot find name
  });

  it("handles complex type annotations", () => {
    const result = compileCode(`
      type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

      function divide(a: number, b: number): Result<number, string> {
        if (b === 0) {
          return { ok: false, error: "Division by zero" };
        }
        return { ok: true, value: a / b };
      }
    `);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.js).toContain("function divide(a, b)");
  });

  it("supports ES2020 features", () => {
    const result = compileCode(`
      const obj = { a: 1, b: 2 };
      const value = obj?.a ?? 0;
      const bigInt = 9007199254740991n;
    `);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    // ES2020 should preserve optional chaining and nullish coalescing
    expect(result.js).toContain("?.a");
    expect(result.js).toContain("?? 0");
  });

  it("provides line and column information for errors", () => {
    const result = compileCode(`const x: number = "hello";`);

    expect(result.success).toBe(false);
    const error = result.diagnostics[0];
    expect(error.line).toBe(1);
    expect(error.column).toBeDefined();
  });

  it("handles multiple errors", () => {
    const result = compileCode(`
      const x: number = "hello";
      const y: string = 123;
      const z = unknownVar;
    `);

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(3);
  });
});

describe("formatDiagnostics", () => {
  it("formats errors with location", () => {
    const formatted = formatDiagnostics([
      {
        message: "Property 'firstName' does not exist on type 'User'",
        code: 2339,
        category: "error",
        line: 8,
        column: 25,
      },
    ]);

    expect(formatted).toBe(
      "error TS2339:8:25: Property 'firstName' does not exist on type 'User'"
    );
  });

  it("formats errors without location", () => {
    const formatted = formatDiagnostics([
      {
        message: "Some error message",
        code: 1234,
        category: "warning",
      },
    ]);

    expect(formatted).toBe("warning TS1234: Some error message");
  });
});
