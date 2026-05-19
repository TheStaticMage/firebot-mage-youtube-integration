import { spawnSync } from "node:child_process";

describe("TypeScript compilation", () => {
    it("passes `npx tsc --noEmit`", () => {
        const result = spawnSync("npx", ["tsc", "--noEmit"], {
            cwd: process.cwd(),
            encoding: "utf-8"
        });

        if (result.status !== 0) {
            throw new Error(`TypeScript compilation failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
        }

        expect(result.status).toBe(0);
    });
});
