import type { ExtensionAPI, ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import { randomUUID } from "node:crypto";

const STATE_TYPE = "local.idea-workflow.request.v1";
const MESSAGE_TYPE = "local.idea-workflow.notice";
const DEFAULT_ROUNDS = 6;
const MAX_ROUNDS = 20;

interface IdeaRequest {
  id: string;
  topic: string;
  rounds: number;
  createdAt: string;
  modelA?: string;
  modelB?: string;
}

type Action =
  | { kind: "help" }
  | { kind: "status" }
  | { kind: "continue"; modelB?: string }
  | { kind: "feedback"; text: string; modelB?: string }
  | { kind: "start"; topic: string; rounds: number; modelA?: string; modelB?: string };

const HELP = `# /idea — 双模型研究与审查

用法：
  /idea [选项] <研究问题及约束>
  /idea help                      显示帮助，不调用模型
  /idea status                    显示本分支最近课题的配置，不调用模型
  /idea feedback [选项] <补充或纠正> 对最近课题补充反馈，交由 A 调整并重新送审
  /idea continue [选项]           从实际记录继续最近课题，不重置轮次

选项参数：
  -b, --model-b <model>           指定 B（独立审查模型），如 gpt-6、claude-opus-4-7、@slow（默认 @slow）
  -a, --model-a <model>           指定 A（研究与实验模型），如 gemini-3.8-flash（默认当前会话模型）
  -r, --rounds N / --rounds=N     累计审查上限，默认 6，整数 1–20
  --                              结束选项解析，后面全部作为课题原文
  -h, --help                      等同 help
  参数可放在课题或子命令前后；课题支持多行，正文内的引号和选项原样保留。

双模型闭环研究流程：
  由 A（发散探索与实验执行）与 B（独立批判与证据把关）构成科学迭代闭环：
  1. A 构思方案：A 深入调研项目背景与文献，提出具体、可证伪的 idea v1 并提交 B 审查。
  2. B 独立挑刺：B 作为严格审查者（idea-reviewer），挑剔假设缺陷、同质化或论证漏洞（REVISE / REJECT）。
  3. A 调整/换方向：A 认真吸收 B 的意见，修正机制或切换到替代假说（v2），重新送审。
  4. B 提出实验要求：理论推演不能代替实证，B 质询真实可行性，要求最小对照实验（NEED_EXPERIMENT）。
  5. A 真实实验验证：A 编写代码运行测试/仿真/基准程序，保存原始日志，向 B 提交实测数据。
  6. B 核验证据并认可：B 亲自查验原始日志与对照数据，确认达标且无遗留阻断问题后给出 ACCEPT。
  7. 产出可靠结论：A 汇总结论、理论机制、实测对比、适用边界与复现指南，结束研究。

示例：
  # 指定 A 为 gemini 3.8 flash，B 为 gpt-6 进行研究
  /idea -a gemini-3.8-flash -b gpt-6 帮我研究如何降低稀疏矩阵乘法的访存开销，先检索再设计最小实验

  # 使用当前会话模型作为 A，指定 gpt-6-astra 作为 B，上限 8 轮
  /idea -b gpt-6-astra -r 8 研究 CXL 上的图计算；只有 CPU，实验总时长不超过 30 分钟

  # 对最近课题补充反馈（可同时换用新的审查模型）
  /idea feedback 不接受只在合成数据上有效，请补充真实数据基线
  /idea feedback -b gpt-6 请加强对并发一致性边界的审查

  # 继续最近课题
  /idea continue
  /idea continue -b gpt-6
`;

const PROTOCOL = `你是 A：研究提案者、实验执行者和流程协调者。
具名子 Agent idea-reviewer 是 B：独立审查者与怀疑论者。
目标不是获得形式上的通过，而是通过“假说 → 批判挑刺 → 调整/换假说 → 实验质询 → 真实实验验证 → 严格核验”的闭环，产出经得起推敲、有实测支撑、有明确边界的靠谱结论。

一、角色分工与协作基石
- A 的职责（发散与实证）：文献/代码调研、提出创新 idea、根据批评调整方向、设计实验、编写代码、运行真实程序/基准测试、收集原始日志与数据、沉淀最终结论。
- B 的职责（批判与审验）：独立客观、严谨苛刻、挑剔假设与漏洞、考察创新性、要求实测对照、直接核验原始输出与日志、把控验收标准。
- 双模型协同机制：
  1. 启动审查：有首份具体提案后，通过 task(agent="idea-reviewer", ...) 启动 B。B 拥有只读工具和独立上下文。
  2. 持续对话：首次 task 返回后记录 B 的实际 agent ID，后续轮次通过 hub send 向同一个 B 发送修改、实验数据与日志，用 hub wait 等待回复，保持审查上下文连贯。
  3. 严禁代劳：本流程由 A 与 B 真实互动推进，严禁 A 伪造 B 的回复、严禁单模型自审自查代替 B。
  4. 首次反馈：向用户回显研究问题、目标、资源约束、轮次上限、当前 A 模型与 B 审查模型。只对影响方向或授权的关键信息询问，不无故反问。

二、标准闭环研究流程（按此节奏推进）
1. 【A 构思假说 (v1)】：
   - 查阅项目现有资料、代码与论文，提炼一个具体、可证伪的研究提案 v1。
   - 包含：核心问题、创新机制、关键假设、基线对比、预期效果与可证伪预测。
   - 通过 task 提交给 B 审查。
2. 【B 独立挑刺 (REVISE / REJECT)】：
   - B 审查机制合理性、创新性及是否已被现有工作解决。
   - 若存在明显缺陷或与现有工作同质，B 返回 REVISE（要求修补定义/收窄主张）或 REJECT（核心缺陷不可挽回，要求换方向）。
3. 【A 吸收批评，调整或切换 Idea (v2)】：
   - A 不得无视 B 的批评强行推进，必须逐项回应 B 的质疑。
   - 若 B 指出方向走不通，A 果断换新 idea 或对机制做出实质性改良，递增版本为 v2，通过 hub send 提交给同一个 B。
4. 【B 提出实测质询 (NEED_EXPERIMENT)】：
   - 当逻辑表面通顺时，B 绝不仅凭推演通过，而是质询：“这在真实环境/硬件/数据上是否成立？”
   - B 发出 NEED_EXPERIMENT 判定，并列出最小对照实验、关键指标、基线以及验证标准。
5. 【A 动手做实验，提交真实数据与日志】：
   - A 使用工具（bash/write/edit/read 等）在本地实际编写并运行测试、仿真或基准脚本。
   - 绝不转述“实验已通过”，必须记录完整命令、环境、参数、退出码，并将原始输出与指标保存到 research/idea-<课题 ID>/。
   - 将真实数据、对照对比与原始日志路径通过 hub send 提交给 B 核验。无论结果符合预期还是反常，均诚实汇报。
6. 【B 核验原始证据并裁决 (ACCEPT)】：
   - B 亲自读取原始日志与输出文件，核对数据是否达到预定验收标准，确认结论没有过度外推。
   - 若达标且无关键阻断问题，B 给出 ACCEPT；若数据暴露新漏洞，B 继续要求修复或补充对照。
7. 【A 沉淀最终可靠成果】：
   - 得到 B 明确 ACCEPT 后，A 输出最终完整的结构化研究结论报告：课题背景、最终机制、相对已有工作的差异、实测数据与对比、复现步骤、有效边界与局限性。

三、版本管理与材料留存
- 版本管理：每次核心改动递增版本（v1 -> v2 -> ...），无论修订还是换方向，均计入累计审查轮次，严禁重置计数。
- 产物留存：所有过程材料统一保存在 research/idea-<课题 ID>/ 下，包含状态文件 (status.json)、各版本提案、B 审查记录、实验代码与配置、原始运行日志。
- 状态报告：每收到一次 B 判定，立即向用户报告“第 r/N 轮 | vK | verdict”，简要说明核心分歧、实验进展与下一步。

四、判定分支处理规则
- REVISE：修改假说、澄清概念或收敛有效范围，重新送审。
- REJECT：分析并记录失败教训；在剩余轮次内提出新的替代方向送审。
- NEED_EXPERIMENT：明确实验假设与度量指标，直接执行实验并留存原始日志供 B 读取核实。
- ACCEPT：仅当 B 亲自核对真实实验结果且无阻断问题时有效。若后续主张或目标发生变更，旧 ACCEPT 自动作废。
- 上限到达：若达到累计审查上限仍未获 ACCEPT，客观输出阶段性结论，标记未解难题与阻断点，绝不伪造通过。
`;

function parseAction(raw: string): Action {
  let rest = raw.trim();
  if (!rest || ["help", "-h", "--help"].includes(rest)) return { kind: "help" };

  let rounds = DEFAULT_ROUNDS;
  let hasRounds = false;
  let modelA: string | undefined;
  let modelB: string | undefined;
  let literal = false;

  const parseOpts = () => {
    while (rest.startsWith("-")) {
      if (rest === "--" || rest.startsWith("-- ")) {
        rest = rest.slice(2).trimStart();
        literal = true;
        break;
      }
      let m = /^(?:--rounds|-r)(?:=|\s+)(\S+)(?:\s+|$)/.exec(rest);
      if (m) {
        if (hasRounds) throw new Error("--rounds / -r 只能指定一次。");
        const val = Number(m[1]);
        if (!/^\d+$/.test(m[1]) || val < 1 || val > MAX_ROUNDS) {
          throw new Error(`--rounds 必须是 1–${MAX_ROUNDS} 的整数。`);
        }
        rounds = val;
        hasRounds = true;
        rest = rest.slice(m[0].length).trimStart();
        continue;
      }
      m = /^(?:--model-a|-a)(?:=|\s+)(\S+)(?:\s+|$)/.exec(rest);
      if (m) {
        if (modelA) throw new Error("--model-a / -a 只能指定一次。");
        modelA = m[1].trim();
        rest = rest.slice(m[0].length).trimStart();
        continue;
      }
      m = /^(?:--model-b|-b|--reviewer)(?:=|\s+)(\S+)(?:\s+|$)/.exec(rest);
      if (m) {
        if (modelB) throw new Error("--model-b / -b / --reviewer 只能指定一次。");
        modelB = m[1].trim();
        rest = rest.slice(m[0].length).trimStart();
        continue;
      }
      if (/^(?:-h|--help)(?:\s+|$)/.test(rest)) {
        return "help";
      }
      throw new Error(`未知选项 "${rest.split(/\s+/)[0]}"。支持 -a/--model-a, -b/--model-b, -r/--rounds。可用 /idea help 查看详情。以连字符开头的课题请使用 /idea -- <课题>。`);
    }
  };

  const optRes = parseOpts();
  if (optRes === "help") return { kind: "help" };

  if (rest === "status") return { kind: "status" };
  if (rest.startsWith("continue")) {
    rest = rest.slice("continue".length).trimStart();
    parseOpts();
    if (rest && !literal) {
      throw new Error("continue 不接收正文（仅支持 -b 指定审查模型）。");
    }
    return { kind: "continue", modelB };
  }

  if (rest.startsWith("feedback")) {
    rest = rest.slice("feedback".length).trimStart();
    parseOpts();
    if (!rest.trim()) {
      throw new Error("请提供反馈内容，例如 /idea feedback 请加入真实数据基线");
    }
    return { kind: "feedback", text: rest.trim(), modelB };
  }

  if (!literal && /^(help|status)\s/.test(rest)) {
    throw new Error("help/status 不接收正文；补充意见用 /idea feedback <内容>，同名课题用 /idea -- <课题>。");
  }

  if (!rest.trim()) {
    throw new Error("缺少研究问题。例如 /idea -a gemini-3.8-flash -b gpt-6 帮我研究降低图计算访存开销的方法");
  }

  return { kind: "start", topic: rest, rounds, modelA, modelB };
}

function latestRequest(ctx: ExtensionCommandContext): IdeaRequest | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
    const data = entry.data as Partial<IdeaRequest> | undefined;
    if (
      data &&
      typeof data.id === "string" &&
      typeof data.topic === "string" &&
      typeof data.createdAt === "string" &&
      typeof data.rounds === "number" &&
      Number.isInteger(data.rounds) &&
      data.rounds >= 1 &&
      data.rounds <= MAX_ROUNDS
    ) {
      return data as IdeaRequest;
    }
  }
  return undefined;
}

function modelLabel(ctx: ExtensionCommandContext): string {
  const model = ctx.models.current();
  return model ? `${model.provider}/${model.id}` : "未选择模型";
}

export default function (pi: ExtensionAPI) {
  let sessionModelB: string | undefined;

  // Intercept subagent spawning: if idea-reviewer is spawned, override its model to modelB
  pi.on("before_subagent_spawn", async (event, ctx) => {
    if (event.agent === "idea-reviewer") {
      const prev = latestRequest(ctx);
      const targetModel = sessionModelB || prev?.modelB;
      if (targetModel && targetModel !== "@slow") {
        return { model: targetModel, note: `idea-workflow reviewer override: ${targetModel}` };
      }
    }
  });

  pi.registerCommand("idea", {
    description: "双模型研究循环：/idea [选项] <问题>；-a 模型A, -b 模型B, -r 轮次；help、status、feedback、continue",
    handler: async (args, ctx) => {
      // Informational commands must not steer or wake a running agent.
      const show = (text: string) => {
        if (!ctx.isIdle()) {
          ctx.ui.notify(text, "info");
          return;
        }
        pi.sendMessage({
          customType: MESSAGE_TYPE,
          content: text,
          display: true,
          attribution: "agent",
        }, { triggerTurn: false });
      };

      let action: Action;
      try {
        action = parseAction(args);
      } catch (error) {
        show(`输入错误：${error instanceof Error ? error.message : String(error)}\n未启动研究。`);
        return;
      }

      if (action.kind === "help") {
        show(`${HELP}\n当前会话 A：${modelLabel(ctx)}\n默认审查 B：idea-reviewer (默认 @slow，可通过 -b 指定任意模型)`);
        return;
      }

      const previous = latestRequest(ctx);
      if (action.kind === "status") {
        show(previous
          ? `最近课题配置（不是实时审查状态）\n` +
            `ID：${previous.id}\n` +
            `创建：${previous.createdAt}\n` +
            `课题：${previous.topic}\n` +
            `累计审查上限：${previous.rounds} 轮\n` +
            `模型 A（研究/实验）：${previous.modelA || modelLabel(ctx)}（当前会话：${modelLabel(ctx)}）\n` +
            `模型 B（独立审查）：${previous.modelB || "idea-reviewer (默认 @slow)"}\n\n` +
            `双模型闭环流程：\n` +
            `1. A 深入调研并提出具体假说 idea v1 送审 B\n` +
            `2. B 独立挑刺与严格质询（REVISE / REJECT）\n` +
            `3. A 吸收意见调整方案或切换方向（v2）再次送审\n` +
            `4. B 提出实测质询，要求最小对照实验（NEED_EXPERIMENT）\n` +
            `5. A 编写代码执行真实实验，将实测数据与原始日志提交给 B\n` +
            `6. B 亲自核验原始证据，达标后给出 ACCEPT\n` +
            `7. A 沉淀并输出经受住考验的最终可靠结论\n\n` +
            `进度与证据请查看研究目录；用 /idea continue 或 /idea feedback <内容> 继续。`
          : "本分支尚无 /idea 课题。用 /idea <研究问题> 开始；/idea help 查看帮助。");
        return;
      }

      if (action.kind !== "start" && !previous) {
        show("本分支没有可继续或反馈的课题。请先用 /idea <研究问题> 开始，或恢复原研究会话。");
        return;
      }

      if (!ctx.isIdle() || ctx.hasPendingMessages()) {
        show("当前正在运行或有排队消息，未提交本次请求。请等待完成，或按 Esc 停止当前运行后重试；/idea help 和 /idea status 随时可用。");
        return;
      }

      const activeTools = pi.getActiveTools();
      const missing = ["task", "hub"].filter((name) => !activeTools.includes(name));
      if (missing.length) {
        show(`无法启动双模型循环：缺少工具 ${missing.join(", ")}。请在启用这些工具的会话中重试，不能以单模型自审代替 B。`);
        return;
      }

      // If modelA is explicitly specified in start, switch to it
      if (action.kind === "start" && action.modelA) {
        try {
          const resolved = ctx.models.resolve(action.modelA);
          if (resolved) {
            const ok = await pi.setModel(resolved);
            if (!ok) {
              show(`提示：未能切换到指定模型 ${action.modelA}（可能未配置对应 API Key）。保持当前 A：${modelLabel(ctx)}`);
            }
          } else {
            show(`提示：无法解析模型名称 "${action.modelA}"。保持当前 A：${modelLabel(ctx)}`);
          }
        } catch (err) {
          show(`切换模型 A 失败：${err instanceof Error ? err.message : String(err)}。保持当前 A：${modelLabel(ctx)}`);
        }
      }

      if (!ctx.models.current()) {
        show("未选择主模型 A。请先通过 /model 选择模型，再运行 /idea。");
        return;
      }

      // Determine modelB
      if (action.modelB) {
        sessionModelB = action.modelB;
      } else if (action.kind === "start") {
        sessionModelB = undefined;
      }

      const chosenB = action.modelB || (action.kind !== "start" && previous?.modelB ? previous.modelB : "@slow");

      let request: IdeaRequest;
      if (action.kind === "start") {
        request = {
          id: randomUUID(),
          topic: action.topic,
          rounds: action.rounds,
          createdAt: new Date().toISOString(),
          modelA: modelLabel(ctx),
          modelB: chosenB,
        };
        pi.appendEntry(STATE_TYPE, request);
      } else {
        request = { ...previous! };
        if (action.modelB) {
          request.modelB = action.modelB;
          pi.appendEntry(STATE_TYPE, request);
        }
      }

      const instruction = action.kind === "start"
        ? "这是一个新课题，请从输入核对和首份提案开始，按标准双模型闭环研究流程推进，不沿用其他课题的审查认可。"
        : action.kind === "feedback"
          ? `用户对本课题新增反馈如下（原文）：\n${action.text}\n\n先逐项说明反馈影响哪些目标、约束、主张和证据；需要变更则升级版本，并提交同一个 B 重新审查。`
          : "继续本课题。先从实际记录恢复版本、累计轮次、B ID、最新审查与实验状态；不要重跑已完成实验或重置计数。已经通过且没有新增要求时，报告现有通过版本和证据即可。";

      const modelConfigInfo =
        `A（研究与实验执行）：${modelLabel(ctx)}\n` +
        `B（独立批判审查）：${request.modelB || "idea-reviewer (默认 @slow)"}`;

      show(
        `已提交 ${action.kind === "start" ? "新课题" : action.kind === "feedback" ? "反馈" : "继续请求"}：${request.id}\n` +
        `${modelConfigInfo}\n` +
        `累计审查上限：${request.rounds} 轮。\n` +
        `流程：A 提案构思 → B 挑刺与实测质询 → A 调整方案并执行真实实验 → B 亲自核验证据 → 最终靠谱结论。`
      );

      const promptPayload =
        `${PROTOCOL}\n` +
        `本次课题 ID：${request.id}\n` +
        `累计审查上限：${request.rounds} 轮（所有版本、设计审查和继续请求合计）\n` +
        `当前双模型配置：\n${modelConfigInfo}\n\n` +
        `用户研究问题与约束（原文）：\n${request.topic}\n\n` +
        `本次操作：\n${instruction}`;

      pi.sendUserMessage(promptPayload, { attribution: "agent" });
    },
  });
}
