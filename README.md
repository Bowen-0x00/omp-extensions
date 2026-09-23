# OMP Extensions (Oh My Pi 自定义扩展集)

[English Documentation](README_EN.md) | **中文文档**

面向 [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi) 的自定义扩展与工作流增强工具集，开箱即用，支持全局或单项目配置。

---

## 包含功能

### 1. `/idea` — 双模型闭环研究与审查系统
针对科学研究、体系结构创新、算法优化与工程探索设计的**双模型闭环迭代工作流**。

- **核心机制**：
  - **Model A（提案与实验者）**：查阅现有文献/代码，提出具体可证伪的假说（v1），根据批评调整方向，编写代码并在本地运行真实测试/仿真，收集原始数据。
  - **Model B（独立审查者 / 怀疑论者）**：通过内置的 `idea-reviewer` 独立子 Agent 运行，专门挑刺、质疑逻辑缺陷与同质化、发出实验质询，并亲自核查原始日志与数据。
- **闭环迭代路径**：
  $$\text{A 构思假说 (v1)} \xrightarrow{\text{送审}} \text{B 挑刺/否定 (REVISE/REJECT)} \xrightarrow{\text{调整}} \text{A 换方向 (v2)}$$
  $$\xrightarrow{\text{质询}} \text{B 要求实测 (NEED\_EXPERIMENT)} \xrightarrow{\text{运行实验}} \text{A 提交实测数据} \xrightarrow{\text{核验}} \text{B 认可 (ACCEPT)} \xrightarrow{} \text{沉淀可靠成果}$$
- **特性**：
  - **自由模型配对**：支持通过 `-a` 和 `-b` 自由指定任意模型组合（如 `-a gemini-3.8-flash -b gpt-6`），彻底解耦硬编码。
  - **底层动态覆盖**：基于 OMP 生命周期钩子 `before_subagent_spawn`，无需修改任何系统配置即可无缝覆盖审查模型的实例。
  - **强实证约束**：B 提出 `NEED_EXPERIMENT` 时，A 必须调用本地工具真实运行代码/基准，严禁“只讨论不做实验”。

### 2. `/md` (`/export-md`) — 智能 Markdown 会话导出
将当前会话历史导出为结构优美的 Markdown 文档。

- **文件名自动带 ID**：导出的文件名默认带有会话短 ID（例如 `omp-chat-01a0cd04-2026-09-23T15-00-00.md` 或 `report-01a0cd04.md`），方便随时通过 `omp --resume <id>` 恢复对应会话。
- **纯净阅读模式 (`--clean`)**：彻底剔除工具调用中间轮次产生的空白 `## 🤖 Assistant` 标题与多余空行，聚合连续发言，篇幅缩减近半，大幅提升阅读体验。
- **完整保留**：亦可不加 `--clean` 完整保留思考折叠块（Thinking）与工具调用执行详情。

---

## 快速安装

克隆本仓库后，直接运行安装脚本：

```bash
git clone https://github.com/Bowen-0x00/omp-extensions.git
cd omp-extensions

# 方式 A：全局安装（推荐，所有 OMP 会话全局可用）
./install.sh

# 方式 B：仅安装到指定项目目录下（协作者随项目共享）
./install.sh -p /path/to/your/project
```

### 手动安装（无需脚本）

只需复制对应文件即可生效（OMP 启动时自动扫描加载）：

```bash
# 全局安装
mkdir -p ~/.omp/agent/extensions ~/.omp/agent/agents
cp extensions/*.ts ~/.omp/agent/extensions/
cp agents/*.md ~/.omp/agent/agents/

# 或项目级安装（在项目根目录下）
mkdir -p .omp/extensions .omp/agents
cp extensions/*.ts .omp/extensions/
cp agents/*.md .omp/agents/
```

---

## 使用指南

### 1. `/idea` 指令

```text
用法：
  /idea [选项] <研究问题及约束>
  /idea help                      显示帮助，不调用模型
  /idea status                    显示本分支最近课题的配置，不调用模型
  /idea feedback [选项] <补充意见> 对最近课题补充反馈，交由 A 调整并重新送审
  /idea continue [选项]           从实际记录继续最近课题，不重置轮次

选项参数：
  -a, --model-a <model>           指定 A（研究与实验模型，如 gemini-3.8-flash，默认当前会话模型）
  -b, --model-b <model>           指定 B（独立审查模型，如 gpt-6、opus、@slow，默认 @slow）
  -r, --rounds N / --rounds=N     累计审查上限，默认 6，整数 1–20
  --                              结束选项解析，后面全部作为课题原文
  -h, --help                      等同 help
```

#### 常见示例

- **指定 A 为 Gemini 3.8 Flash，B 为 GPT-6 进行双模型对抗研究**：
  ```bash
  /idea -a gemini-3.8-flash -b gpt-6 帮我研究如何降低稀疏矩阵乘法的访存开销，先检索再设计最小实验
  ```
- **使用当前模型作为 A，指定 gpt-6-astra 作为 B，上限 8 轮**：
  ```bash
  /idea -b gpt-6-astra -r 8 研究 CXL 上的图计算优化；只有 CPU，实验总时长不超过 30 分钟
  ```
- **补充反馈约束（可同时更换审查模型）**：
  ```bash
  /idea feedback 不接受只在合成数据上有效，请补充真实数据基线
  /idea feedback -b gpt-6 请加强对并发边界与死锁风险的审查
  ```
- **继续已有课题**：
  ```bash
  /idea continue
  /idea continue -b gpt-6
  ```

---

### 2. `/md` 指令

```text
用法：
  /md [filename] [--clean] [--no-tools] [--no-thinking] [--full-id]
  /export-md [filename] [--clean] [--no-tools] [--no-thinking] [--full-id]
```

#### 常见示例

- **纯净模式导出（无空标题、无多余空行，自动带 ID）**：
  ```bash
  /md --clean
  # 输出: omp-chat-01a0cd04-2026-09-23T15-00-00.md
  ```
- **自定义文件名导出（自动附带会话 ID）**：
  ```bash
  /md my_analysis --clean
  # 输出: my_analysis-01a0cd04.md
  ```
- **导出完整 36 位 UUID 格式文件名**：
  ```bash
  /md --clean --full-id
  # 输出: omp-chat-01a0cd04-7111-73ee-a9ec-950056e48a74-2026-09-23T15-00-00.md
  ```
- **完整导出（包含工具调用过程与折叠思考）**：
  ```bash
  /md
  ```

---

## 仓库结构

```text
omp-extensions/
├── extensions/
│   ├── idea.ts              # /idea 双模型闭环研究与审查扩展
│   └── export-md.ts         # /md 纯净 Markdown 会话导出扩展
├── agents/
│   └── idea-reviewer.md     # idea-reviewer 独立审查 Agent 角色定义
├── install.sh               # 一键安装脚本（支持全局与项目级）
├── uninstall.sh             # 一键卸载脚本
├── README.md                # 中文说明文档
├── README_EN.md             # 英文说明文档
└── LICENSE                  # MIT 开源许可证
```

---

## 卸载

```bash
# 全局卸载
./uninstall.sh

# 从指定项目中卸载
./uninstall.sh -p /path/to/your/project
```

---

## 开源协议

本项目采用 [MIT License](LICENSE) 授权协议。
