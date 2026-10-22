import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STATUSES = ["🛠️", "⏳", "⁉️", "✅", "🏁"];

// A line that is only `@path` in a context file is replaced by that file, as in Claude Code.
function expandIncludes(content: string, dir: string, depth = 0): string {
	if (depth > 3) return content;
	return content.replace(/^@(\S+)[ \t]*$/gm, (line, rel: string) => {
		const file = path.resolve(dir, rel);
		if (!fs.existsSync(file)) return line;
		return expandIncludes(fs.readFileSync(file, "utf8"), path.dirname(file), depth + 1);
	});
}

async function paseo(ctx: any, tool: string, args: object, signal?: AbortSignal): Promise<any> {
	const result: any = await ctx.executeTool(`mcp__paseo__${tool}`, args, { signal });
	const text = (result?.content ?? []).map((c: any) => c.text ?? "").join("\n");
	if (result?.isError) throw new Error(`${tool}: ${text}`);
	if (result?.structuredContent !== undefined) return result.structuredContent;
	const start = text.indexOf("{");
	try {
		return JSON.parse(start >= 0 ? text.slice(start) : text);
	} catch {
		return text;
	}
}

const stateDir = (cwd: string, id: string) => path.join(cwd, "state", "agents", id);
const label = (status: string, title: string) => `↳ ${status} ${title}`;
const ok = (text: string, details?: unknown) => ({ content: [{ type: "text" as const, text }], details });

function readMeta(cwd: string, id: string) {
	const file = path.join(stateDir(cwd, id), "agent.json");
	if (!fs.existsSync(file)) throw new Error(`No workstream "${id}" (missing ${file})`);
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Stable D-numbers for pending decisions, kept in state/decisions.json (not an index the user reads).
function loadNumbers(cwd: string) {
	const file = path.join(cwd, "state", "decisions.json");
	const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { next: 1, ids: {} };
	return { file, data: data as { next: number; ids: Record<string, number> } };
}

function pendingDecisions(cwd: string) {
	const root = path.join(cwd, "state", "agents");
	const files = fs.existsSync(root)
		? fs.readdirSync(root).flatMap((id) => {
				const dir = path.join(root, id, "to-decide");
				return fs.existsSync(dir)
					? fs
							.readdirSync(dir)
							.filter((f) => f.endsWith(".md"))
							.map((f) => path.join(dir, f))
					: [];
			})
		: [];
	const { file, data } = loadNumbers(cwd);
	for (const key of Object.keys(data.ids)) if (!files.includes(key)) delete data.ids[key];
	for (const f of files) if (!(f in data.ids)) data.ids[f] = data.next++;
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
	return files
		.map((f) => ({ d: `D${data.ids[f]}`, n: data.ids[f], path: f, id: path.basename(path.dirname(path.dirname(f))) }))
		.sort((a, b) => a.n - b.n);
}

export default function pasaak(pi: ExtensionAPI) {
	pi.on("before_agent_start", (event: any) => {
		for (const file of event.systemPromptOptions?.contextFiles ?? []) {
			file.content = expandIncludes(file.content, path.dirname(file.path));
		}
	});

	pi.registerTool(
		defineTool({
			name: "pasaak_spawn",
			label: "Pasaak spawn",
			description:
				"Start a workstream: create state/agents/<id>, a Paseo workspace (unless workspaceId is given) and an agent titled `↳ 🛠️ <title>`, whose prompt is the task followed by SUBAGENT.md. Give a Paseo profile name or a provider.",
			parameters: Type.Object({
				id: Type.String({ description: "Short kebab-case slug, e.g. fix-login-redirect" }),
				title: Type.String({ description: "Short human title, without the ↳ or status" }),
				task: Type.String({ description: "The task prompt, including the GitHub and live writes it authorizes" }),
				projectId: Type.Optional(Type.String({ description: "Paseo project of the source repo" })),
				path: Type.Optional(Type.String({ description: "Source checkout path, or the directory for a local workspace" })),
				branch: Type.Optional(Type.String({ description: "New branch, branched off base" })),
				base: Type.Optional(Type.String({ description: "Base ref for branch (default origin/main)" })),
				pr: Type.Optional(Type.Number({ description: "Check out this PR instead of a new branch" })),
				local: Type.Optional(Type.Boolean({ description: "Use path as a local (non-worktree) workspace" })),
				workspaceId: Type.Optional(Type.String({ description: "Reuse an existing workspace" })),
				profile: Type.Optional(Type.String({ description: "Paseo profile name, e.g. Programmer" })),
				provider: Type.Optional(Type.String({ description: "provider/model, if no profile" })),
				thinking: Type.Optional(Type.String()),
				mode: Type.Optional(Type.String()),
			}),
			reachesTools: () => ["paseo"],
			async execute(_id, p, signal, _onUpdate, ctx: any) {
				const dir = stateDir(ctx.cwd, p.id);
				if (fs.existsSync(path.join(dir, "agent.json"))) {
					throw new Error(`Workstream "${p.id}" exists; send follow-ups to its agent instead`);
				}
				for (const sub of ["to-decide", "decided"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
				if (!fs.existsSync(path.join(dir, "TODO.md"))) fs.writeFileSync(path.join(dir, "TODO.md"), "");

				let workspaceId = p.workspaceId;
				if (!workspaceId) {
					const args: any = { title: label("🛠️", p.title), projectId: p.projectId, path: p.path };
					if (p.local) args.isolation = "local";
					else if (p.pr) Object.assign(args, { isolation: "worktree", mode: "checkout-pr", prNumber: p.pr });
					else if (p.branch) {
						Object.assign(args, { isolation: "worktree", mode: "branch-off", branchName: p.branch, baseBranch: p.base ?? "origin/main" });
					} else throw new Error("Give branch, pr, local or workspaceId");
					workspaceId = (await paseo(ctx, "create_workspace", args, signal)).workspaceId;
				}

				let provider = p.provider;
				const settings: any = {};
				if (p.profile) {
					const { profiles } = await paseo(ctx, "list_profiles", {}, signal);
					const prof = profiles.find((x: any) => x.name === p.profile);
					if (!prof) throw new Error(`No Paseo profile "${p.profile}"`);
					provider = `${prof.provider}/${prof.model}`;
					if (prof.modeId) settings.modeId = prof.modeId;
					if (prof.thinkingOptionId) settings.thinkingOptionId = prof.thinkingOptionId;
					if (prof.featureValues) settings.features = prof.featureValues;
				}
				if (!provider) throw new Error("Give profile or provider");
				if (p.thinking) settings.thinkingOptionId = p.thinking;
				if (p.mode) settings.modeId = p.mode;

				const instructions = fs
					.readFileSync(path.join(ctx.cwd, "SUBAGENT.md"), "utf8")
					.replaceAll("<STATE>", dir)
					.replaceAll("<WORKSPACE_ID>", workspaceId)
					.replaceAll("<TITLE>", p.title);
				const agent = await paseo(
					ctx,
					"create_agent",
					{
						title: label("🛠️", p.title).slice(0, 60),
						provider,
						settings,
						workspaceId,
						labels: { pasaak: p.id },
						initialPrompt: `${p.task}\n\n${instructions}`,
					},
					signal,
				);
				const meta = { id: p.id, title: p.title, agentId: agent.agentId, workspaceId, provider };
				fs.writeFileSync(path.join(dir, "agent.json"), `${JSON.stringify(meta, null, 2)}\n`);
				return ok(`Started ${label("🛠️", p.title)}: agent ${agent.agentId}, workspace ${workspaceId}, state ${dir}`, meta);
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "pasaak_status",
			label: "Pasaak status",
			description: "Set a workstream's status on both its agent name and its workspace title (`↳ <status> <title>`).",
			parameters: Type.Object({
				id: Type.String(),
				status: Type.Union(STATUSES.map((s) => Type.Literal(s))),
				title: Type.Optional(Type.String({ description: "Replace the title too" })),
			}),
			reachesTools: () => ["paseo"],
			async execute(_id, p, signal, _onUpdate, ctx: any) {
				const meta = readMeta(ctx.cwd, p.id);
				if (p.title) {
					meta.title = p.title;
					fs.writeFileSync(path.join(stateDir(ctx.cwd, p.id), "agent.json"), `${JSON.stringify(meta, null, 2)}\n`);
				}
				const name = label(p.status, meta.title);
				const notes: string[] = [];
				for (const [tool, args] of [
					["update_agent", { agentId: meta.agentId, name }],
					["rename_workspace", { workspaceId: meta.workspaceId, title: name }],
				] as const) {
					try {
						await paseo(ctx, tool, args, signal);
					} catch (e) {
						notes.push(`${tool} failed: ${(e as Error).message}`);
					}
				}
				return ok([`Set ${name}`, ...notes].join("\n"));
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "pasaak_archive",
			label: "Pasaak archive",
			description: "Mark a finished workstream 🏁 and archive its workspace (and its agents). The state folder stays.",
			parameters: Type.Object({ id: Type.String() }),
			reachesTools: () => ["paseo"],
			async execute(_id, p, signal, _onUpdate, ctx: any) {
				const meta = readMeta(ctx.cwd, p.id);
				const name = label("🏁", meta.title);
				const notes: string[] = [];
				for (const [tool, args] of [
					["update_agent", { agentId: meta.agentId, name }],
					["archive_workspace", { workspaceId: meta.workspaceId }],
				] as const) {
					try {
						await paseo(ctx, tool, args, signal);
					} catch (e) {
						notes.push(`${tool} failed: ${(e as Error).message}`);
					}
				}
				return ok([`Archived ${name}`, ...notes].join("\n"));
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "pasaak_decisions",
			label: "Pasaak decisions",
			description:
				"List the pending decisions (to-decide files) of all workstreams with their stable D-numbers. Read each file before presenting it.",
			parameters: Type.Object({}),
			async execute(_id, _p, _signal, _onUpdate, ctx: any) {
				const list = pendingDecisions(ctx.cwd);
				if (list.length === 0) return ok("No pending decisions.", list);
				return ok(list.map((x) => `${x.d} · ${x.id} · ${x.path}`).join("\n"), list);
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "pasaak_decide",
			label: "Pasaak decide",
			description:
				"Record the user's decision: move the to-decide file to decided/ with a `---` line and the decision text appended.",
			parameters: Type.Object({
				d: Type.String({ description: "D-number, e.g. D3" }),
				decision: Type.String({ description: "What was decided, and by whom" }),
			}),
			async execute(_id, p, _signal, _onUpdate, ctx: any) {
				const item = pendingDecisions(ctx.cwd).find((x) => x.d === p.d);
				if (!item) throw new Error(`No pending decision ${p.d}`);
				const target = path.join(path.dirname(path.dirname(item.path)), "decided", path.basename(item.path));
				fs.mkdirSync(path.dirname(target), { recursive: true });
				fs.writeFileSync(target, `${fs.readFileSync(item.path, "utf8").trimEnd()}\n\n---\n\n${p.decision.trim()}\n`);
				fs.rmSync(item.path);
				pendingDecisions(ctx.cwd);
				return ok(`${p.d} recorded in ${target}`);
			},
		}),
	);
}
