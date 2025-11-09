import { firebot } from "../main";

/**
 * Get the path to a data file in the script data directory
 *
 * This ensures the directory exists and returns the full path to the file.
 */
export function getDataFilePath(filename: string): string {
    // scriptDataDir was added in Firebot 5.65
    const { fs, path } = firebot.modules;
    const { scriptDataDir } = firebot;
    const result = path.join(scriptDataDir, filename);

    const dir = path.dirname(result);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return result;
}
