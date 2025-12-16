import { DurableObject } from "cloudflare:workers";
import { stubStub } from "./stub-stub";

export class Greeter extends DurableObject implements stubStub.Callable {
  callMethod(params: stubStub.CallMethodParams) {
    return stubStub.callMethodImpl(this, params);
  }

  async getGreeting({ language }: { language: "en" | "fr" }): Promise<string> {
    if (language === "en") return "Hello";
    if (language === "fr") return "Bonjour";
    throw new Error(`Invalid language: ${language}`);
  }
}
