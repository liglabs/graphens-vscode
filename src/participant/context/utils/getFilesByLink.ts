

import path from "path";
import * as vscode from "vscode";
import logger from "../../../logger";

type LinkResult = {
	original: string;
	type: "local-relative" | "local-absolute" | "web" | "unknown";
	content: string;
};

/**
 * Detects links in the provided prompt and, where possible, fetches their content.
 * - local relative: resolved against `workspaceRoot` (or `process.cwd()` if omitted)
 * - local absolute: absolute filesystem paths
 * - web links: http/https
 *
 * Returns an array of LinkResult for each detected token that looks like a link/path.
 */
export async function getFilesByLink(prompt: string, workspaceRoot?: string): Promise<LinkResult[]> {
	if (!prompt) return [];

	// determine workspace root: prefer provided, then first workspaceFolder, then cwd
	const workspaceFolders = vscode.workspace.workspaceFolders;
	const inferredRoot = workspaceRoot || (workspaceFolders && workspaceFolders[0]?.uri.fsPath) || process.cwd();
	const root = inferredRoot;

	// Split on whitespace and common punctuation, but keep things like src/file.ts or C:\path\file
	const rawTokens = prompt.split(/\s+/);

	const tokens = rawTokens
		.map((t) => t.replace(/^["'\(<]+|["'\)>.,;:]+$/g, ""))
		.filter(Boolean);

	const results: LinkResult[] = [];

	const projectFiles: Array<{ original: string; uri: vscode.Uri; resolvedPath: string; isAbsolute: boolean }> = [];
	const webFiles: Array<{ original: string; url: string }> = [];

	function normalizeForCompare(p: string) {
		let np = path.resolve(p);
		// Normalize path separators
		np = path.normalize(np);
		// On Windows, lowercase only the drive letter (keep rest as-is)
		if (process.platform === 'win32') {
			np = np.charAt(0).toLowerCase() + np.slice(1)
		}
		// Ensure trailing separator for directory comparison
		if (!np.endsWith(path.sep)) np = np + path.sep;
		return np;
	}

	function isPathInside(childPath: string, parentPath: string) {
		try {
			const nc = normalizeForCompare(childPath);
			const np = normalizeForCompare(parentPath);
			return nc.startsWith(np) || nc === np;
		} catch (e) {
			return false;
		}
	}

	// First pass: classify tokens into projectFiles and webFiles (do not read yet)
	for (const token of tokens) {
		if (/^https?:\/\//i.test(token)) {
			webFiles.push({ original: token, url: token });
			continue;
		}

		const isAbsolute = path.isAbsolute(token) || /^[A-Za-z]:[\\/]/.test(token);
		if (isAbsolute) {
			logger.info('Checking abs path : ', token)
			logger.info('Root : ', root)
			logger.info('WF : ', workspaceFolders)
			const resolvedAbs = path.resolve(token);
			const insideWorkspace = workspaceFolders
				? workspaceFolders.some((wf) => isPathInside(resolvedAbs, wf.uri.fsPath))
				: isPathInside(resolvedAbs, root);

			if (insideWorkspace) {
				projectFiles.push({ original: token, uri: vscode.Uri.file(resolvedAbs), resolvedPath: resolvedAbs, isAbsolute: true });
			} else {
				// Do not save absolute paths that are outside the workspace; skip them silently
			}
			continue;
		}

		// relative-looking paths or plain filenames
		if (/^(?:\.\.?[\\/]|[^\s]+[\\/][^\s]+)$/.test(token) || /^[^\s]+\.[a-zA-Z0-9_-]+$/.test(token)) {
			const resolved = path.resolve(root, token);
			projectFiles.push({ original: token, uri: vscode.Uri.file(resolved), resolvedPath: resolved, isAbsolute: false });
			continue;
		}

		// otherwise ignore
	}

	// Fetch project files (use VS Code FS). Do in parallel but limit to avoid overload if desired.
	await Promise.all(
		projectFiles.map(async (pf) => {
			const { original, uri, resolvedPath, isAbsolute } = pf;
			const type: LinkResult['type'] = isAbsolute ? 'local-absolute' : 'local-relative';
			try {
				const stat = await vscode.workspace.fs.stat(uri);
				if ((stat.type & vscode.FileType.File) === vscode.FileType.File || stat.type === vscode.FileType.File) {
					const bytes = await vscode.workspace.fs.readFile(uri);
					results.push({ original, type, content: Buffer.from(bytes).toString('utf8') });
				} else {
					// Path exists but is not a file — do not save errors
				}
			} catch (err: any) {
				// stat/read failed — do not save errors
			}
		})
	);

	// Fetch web files
	await Promise.all(
		webFiles.map(async (wf) => {
			const { original, url } = wf;
			try {
				const res = await fetch(url);
				if (res.ok) {
					const text = await res.text();
					results.push({ original, type: 'web', content: text });
				} else {
					// non-ok response — do not save errors
				}
			} catch (err: any) {
				// fetch failed — do not save errors
			}
		})
	);

	return results;
}