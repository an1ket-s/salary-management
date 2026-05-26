import { execSync } from "child_process";
import path from "path";

export default function setup() {
  execSync("npx prisma db push", {
    cwd: path.resolve(__dirname, "../.."),
    stdio: "pipe",
  });
}
