import { Project, SyntaxKind } from "ts-morph";
import path from "path";
import fs from "fs";

const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!inputPath) {
  console.error(
    "Usage: node find-unused-methods.js /absolute/path/to/your/project-or-src",
  );
  process.exit(1);
}

let projectRoot, srcDir;
if (fs.existsSync(path.join(inputPath, "tsconfig.json"))) {
  projectRoot = inputPath;
  srcDir = path.join(inputPath, "src");
} else if (fs.existsSync(path.join(inputPath, "../tsconfig.json"))) {
  projectRoot = path.dirname(inputPath);
  srcDir = inputPath;
} else {
  console.error(
    "Could not find tsconfig.json. Please provide the project root or src directory.",
  );
  process.exit(1);
}

if (!fs.existsSync(srcDir)) {
  console.error("Source directory does not exist:", srcDir);
  process.exit(1);
}

const project = new Project({
  tsConfigFilePath: path.join(projectRoot, "tsconfig.json"),
  skipAddingFilesFromTsConfig: false,
});

const sourceFiles = project.getSourceFiles([
  `${srcDir}/**/*.ts`,
  `!${srcDir}/**/*.controller.ts`,
  `!${srcDir}/**/*.d.ts`,
]);

const unusedMethods = [];

for (const sourceFile of sourceFiles) {
  for (const cls of sourceFile.getClasses()) {
    const className = cls.getName();
    if (!className) continue;
    for (const method of cls.getMethods()) {
      if (
        method.hasModifier(SyntaxKind.PrivateKeyword) ||
        method.isStatic() ||
        method.getName() === "constructor"
      )
        continue;
      const methodName = method.getName();
      const refs = method.findReferences();
      let used = false;
      for (const ref of refs) {
        for (const refEntry of ref.getReferences()) {
          if (!refEntry.isDefinition()) {
            used = true;
            break;
          }
        }
        if (used) break;
      }
      if (!used) {
        const lineNumber = method.getNameNode().getStartLineNumber();
        unusedMethods.push({
          className,
          methodName,
          file: sourceFile.getFilePath(),
          line: lineNumber,
        });
      }
    }
  }
}

if (unusedMethods.length === 0) {
  console.log("No unused methods found.");
} else {
  console.log("Potentially unused methods:");
  unusedMethods.forEach(({ className, methodName, file, line }) => {
    console.log(`- ${className}.${methodName} in ${file}:${line}`);
  });
}
