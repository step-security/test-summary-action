import path from "node:path"
import { fileURLToPath } from "node:url"

export const resourcePath = path.dirname(fileURLToPath(import.meta.url))
