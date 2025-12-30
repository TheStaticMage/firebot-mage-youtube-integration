const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dependencyName = "@thestaticmage/mage-platform-lib-client";
const localDependencyValue = "file:../firebot-mage-platform-lib/packages/client";
const packageJsonPath = path.join(process.cwd(), "package.json");

const readPackageJson = () => {
    const contents = fs.readFileSync(packageJsonPath, "utf8");
    return JSON.parse(contents);
};

const writePackageJson = (json) => {
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(json, null, 4)}\n`, "utf8");
};

const runNpm = (args) => {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const result = spawnSync(npmCommand, args, { stdio: "inherit" });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
};

const packageJson = readPackageJson();

if (!packageJson.dependencies || !packageJson.dependencies[dependencyName]) {
    console.error(`Missing dependency ${dependencyName} in package.json`);
    process.exit(1);
}

const originalDependencyValue = packageJson.dependencies[dependencyName];

const setDependencyValue = (value) => {
    const updatedPackageJson = readPackageJson();
    updatedPackageJson.dependencies = updatedPackageJson.dependencies ?? {};
    updatedPackageJson.dependencies[dependencyName] = value;
    writePackageJson(updatedPackageJson);
};

try {
    if (originalDependencyValue !== localDependencyValue) {
        setDependencyValue(localDependencyValue);
    }

    runNpm(["install", dependencyName]);
    runNpm(["run", "build:dev:base"]);
} finally {
    setDependencyValue(originalDependencyValue);
    runNpm(["install", dependencyName]);
}
