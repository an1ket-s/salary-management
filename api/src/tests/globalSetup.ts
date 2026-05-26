import { execSync } from "child_process";
import path from "path";

export default function setup() {
  execSync("npx prisma db push --force-reset", {
    cwd: path.resolve(__dirname, "../.."),
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
