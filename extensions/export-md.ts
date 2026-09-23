import type { ExtensionAPI, ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

interface MessageContentItem {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: Record<string, unknown>;
}

interface SessionMessage {
  role?: string;
  content?: string | MessageContentItem[];
  toolName?: string;
}

interface SessionEntry {
  type: string;
  message?: SessionMessage;
}

function getEffectiveId(sessionId: string, sessionFile: string, full = false): string {
  if (sessionId && sessionId !== "session") {
    if (full) return sessionId;
    return sessionId.length > 8 ? sessionId.slice(0, 8) : sessionId;
  }
  if (sessionFile) {
    const base = path.basename(sessionFile, ".jsonl");
    const match = /_([a-zA-Z0-9-]+)$/.exec(base);
    if (match) {
      if (full) return match[1];
      return match[1].slice(0, 8);
    }
  }
  return "";
}

function resolveTargetFileName(
  rawFileName: string,
  sessionId: string,
  sessionFile: string,
  useFullId = false
): string {
  const effectiveId = getEffectiveId(sessionId, sessionFile, useFullId);
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  if (!rawFileName) {
    return effectiveId ? `omp-chat-${effectiveId}-${dateStr}.md` : `omp-chat-${dateStr}.md`;
  }

  let clean = rawFileName;
  if (clean.endsWith(".md")) {
    clean = clean.slice(0, -3);
  }

  // If already contains the ID, don't duplicate
  if (effectiveId && !clean.includes(effectiveId)) {
    return `${clean}-${effectiveId}.md`;
  }
  return `${clean}.md`;
}

function formatMarkdown(
  branch: readonly unknown[],
  options: { includeTools: boolean; includeThinking: boolean }
): string {
  const sections: string[] = [];
  let currentRole: "user" | "assistant" | null = null;
  let currentContent: string[] = [];

  const flushRole = () => {
    if (currentRole && currentContent.length > 0) {
      const header = currentRole === "user" ? "## 👤 User" : "## 🤖 Assistant";
      const body = currentContent.join("\n\n").trim();
      if (body) {
        sections.push(`${header}\n\n${body}`);
      }
      currentContent = [];
    }
  };

  for (const rawEntry of branch) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = rawEntry as SessionEntry;
    if (entry.type !== "message" || !entry.message) continue;
    const msg = entry.message;

    if (msg.role === "user") {
      const parts: string[] = [];
      if (typeof msg.content === "string" && msg.content.trim()) {
        parts.push(msg.content.trim());
      } else if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === "text" && item.text?.trim()) {
            parts.push(item.text.trim());
          }
        }
      }
      if (parts.length > 0) {
        flushRole();
        currentRole = "user";
        currentContent.push(...parts);
      }
    } else if (msg.role === "assistant") {
      const parts: string[] = [];
      if (typeof msg.content === "string" && msg.content.trim()) {
        parts.push(msg.content.trim());
      } else if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === "thinking" && options.includeThinking && item.thinking?.trim()) {
            parts.push(`<details>\n<summary>💭 思考过程 (Thinking)</summary>\n\n${item.thinking.trim()}\n\n</details>`);
          } else if (item.type === "text" && item.text?.trim()) {
            parts.push(item.text.trim());
          } else if (item.type === "toolCall" && options.includeTools) {
            const argsStr = JSON.stringify(item.arguments || {}, null, 2);
            parts.push(`> **🛠️ 工具调用: \`${item.name}\`**\n>\n> \`\`\`json\n> ${argsStr.split("\n").join("\n> ")}\n> \`\`\``);
          }
        }
      }
      if (parts.length > 0) {
        if (currentRole !== "assistant") {
          flushRole();
          currentRole = "assistant";
        }
        currentContent.push(...parts);
      }
    } else if (msg.role === "toolResult" && options.includeTools) {
      let contentStr = "";
      if (typeof msg.content === "string") {
        contentStr = msg.content;
      } else if (Array.isArray(msg.content)) {
        contentStr = msg.content
          .map((c: unknown) => {
            if (typeof c === "string") return c;
            if (c && typeof c === "object" && "text" in c) {
              const textVal = c.text;
              if (typeof textVal === "string") return textVal;
            }
            return JSON.stringify(c);
          })
          .join("\n");
      }
      if (contentStr.trim()) {
        if (currentRole !== "assistant") {
          flushRole();
          currentRole = "assistant";
        }
        currentContent.push(`<details>\n<summary>⚙️ 工具执行结果 (${msg.toolName || "tool"})</summary>\n\n\`\`\`\n${contentStr.trim()}\n\`\`\`\n\n</details>`);
      }
    }
  }

  flushRole();
  return sections.join("\n\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function handleExport(args: string, ctx: ExtensionCommandContext) {
  try {
    const branch = ctx.sessionManager.getBranch();
    const sessionId = ctx.sessionManager.getSessionId?.() || "session";
    const sessionFile = ctx.sessionManager.getSessionFile?.() || "";

    const tokens = (args || "").trim().split(/\s+/).filter(Boolean);
    let targetFileName = "";
    let includeTools = true;
    let includeThinking = true;
    let useFullId = false;

    for (const token of tokens) {
      if (token === "--no-tools" || token === "-T") {
        includeTools = false;
      } else if (token === "--no-thinking") {
        includeThinking = false;
      } else if (token === "--clean" || token === "-c") {
        includeTools = false;
        includeThinking = false;
      } else if (token === "--full-id") {
        useFullId = true;
      } else if (!token.startsWith("-") && !targetFileName) {
        targetFileName = token;
      }
    }

    const finalFileName = resolveTargetFileName(targetFileName, sessionId, sessionFile, useFullId);
    const targetPath = path.isAbsolute(finalFileName)
      ? finalFileName
      : path.join(ctx.cwd, finalFileName);

    const header = [
      `# 📝 OMP 对话记录导出`,
      `- **会话 ID**: \`${sessionId}\``,
      `- **导出时间**: ${new Date().toLocaleString()}`,
      `- **工作目录**: \`${ctx.cwd}\``,
      sessionFile ? `- **源文件**: \`${sessionFile}\`` : "",
      `\n---\n`,
    ].filter(Boolean).join("\n");

    const body = formatMarkdown(branch, { includeTools, includeThinking });
    fs.writeFileSync(targetPath, header + "\n" + (body ? body + "\n" : ""), "utf-8");

    const successMsg = `对话已导出到: ${targetPath}`;
    if (ctx.ui?.notify) {
      ctx.ui.notify(successMsg, "info");
    } else if (ctx.ui?.setStatus) {
      ctx.ui.setStatus(successMsg);
    }
    console.log(successMsg);
  } catch (err: unknown) {
    const errMsg = `导出失败: ${err instanceof Error ? err.message : String(err)}`;
    if (ctx.ui?.notify) {
      ctx.ui.notify(errMsg, "error");
    }
    console.error(errMsg);
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("export-md", {
    description: "导出当前会话为 Markdown: /export-md [filename] [--clean] [--no-tools] [--no-thinking] [--full-id]",
    handler: async (args: string, ctx: ExtensionCommandContext) => handleExport(args, ctx),
  });

  pi.registerCommand("md", {
    description: "导出当前会话为 Markdown: /md [filename] [--clean] [--no-tools] [--no-thinking] [--full-id]",
    handler: async (args: string, ctx: ExtensionCommandContext) => handleExport(args, ctx),
  });
}
