# OMP Extensions

**English Documentation** | [中文文档](README.md)

A suite of productivity extensions and research workflows for [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi). Ready to use out of the box with support for both global and project-level installations.

---

## Included Features

### 1. `/idea` — Dual-Model Iterative Research & Review Workflow
A closed-loop research and review system tailored for scientific exploration, architecture innovation, algorithm optimization, and empirical investigations.

- **Core Roles**:
  - **Model A (Proposer & Experimenter)**: Researches prior art, formulates concrete, falsifiable hypotheses (v1), adapts to critiques, writes code, executes local benchmarks/simulations, and reports raw observations.
  - **Model B (Independent Critic / Skeptic)**: Runs as an isolated subagent (`idea-reviewer`), rigorously auditing assumptions, flagging unnovel ideas, demanding empirical verification, and checking raw logs and metrics.
- **Closed-Loop Scientific Trajectory**:
  $$\text{A forms hypothesis (v1)} \xrightarrow{\text{submit}} \text{B critiques (REVISE/REJECT)} \xrightarrow{\text{pivot}} \text{A refines (v2)}$$
  $$\xrightarrow{\text{challenge}} \text{B demands test (NEED\_EXPERIMENT)} \xrightarrow{\text{run tools}} \text{A submits raw logs} \xrightarrow{\text{verify}} \text{B accepts (ACCEPT)} \xrightarrow{} \text{Final validated report}$$
- **Key Highlights**:
  - **Decoupled Model Pairing**: Freely select any model combination via `-a` and `-b` (e.g. `-a gemini-3.8-flash -b gpt-6`).
  - **Dynamic Hook-Based Model Override**: Leverages OMP's `before_subagent_spawn` lifecycle hook to dynamically override the reviewer model on the fly without modifying global configs.
  - **Enforced Empirical Rigor**: When B issues `NEED_EXPERIMENT`, A must execute real tools/commands in the environment and record raw logs. Hand-waving discussion cannot substitute for empirical proof.

### 2. `/md` (`/export-md`) — Clean Markdown Session Exporter
Exports current chat session history into beautifully formatted Markdown documents.

- **Automatic Session ID in Filename**: Exported filenames automatically include the session's short ID prefix (e.g. `omp-chat-01a0cd04-2026-09-23T15-00-00.md` or `report-01a0cd04.md`), making it effortless to copy the ID and resume via `omp --resume <id>`.
- **Clean Mode (`--clean`)**: Strips out empty `## 🤖 Assistant` headers and excessive blank lines caused by intermediate tool-calling turns, combining consecutive remarks into cohesive paragraphs. Cuts document length by ~45%.
- **Full Trace Preservation**: Run without `--clean` to preserve collapsible thinking blocks and detailed tool execution arguments and results.

---

## Quick Installation

Clone the repository and run the installer:

```bash
git clone https://github.com/Bowen-0x00/omp-extensions.git
cd omp-extensions

# Option A: Global Installation (Recommended, available across all OMP sessions)
./install.sh

# Option B: Project-level Installation (Scoped to a specific repository)
./install.sh -p /path/to/your/project
```

### Manual Installation (Without Scripts)

Simply copy the files to the appropriate directory (OMP automatically scans and loads them on startup):

```bash
# Global installation
mkdir -p ~/.omp/agent/extensions ~/.omp/agent/agents
cp extensions/*.ts ~/.omp/agent/extensions/
cp agents/*.md ~/.omp/agent/agents/

# Or project-level installation (inside your project root)
mkdir -p .omp/extensions .omp/agents
cp extensions/*.ts .omp/extensions/
cp agents/*.md .omp/agents/
```

---

## Usage Guide

### 1. `/idea` Command

```text
Usage:
  /idea [options] <research question & constraints>
  /idea help                      Show help information (no model invoked)
  /idea status                    Show configuration for the latest topic
  /idea feedback [options] <text> Provide feedback for Model A to adjust & resubmit
  /idea continue [options]        Resume latest topic from saved state

Options:
  -a, --model-a <model>           Specify Model A (proposer & empiricist, default: current session model)
  -b, --model-b <model>           Specify Model B (critic & auditor, default: @slow)
  -r, --rounds N / --rounds=N     Cumulative review round ceiling (default: 6, 1–20)
  --                              End option parsing; subsequent text treated verbatim
  -h, --help                      Show help
```

#### Examples

- **Pair Gemini 3.8 Flash as A with GPT-6 as B**:
  ```bash
  /idea -a gemini-3.8-flash -b gpt-6 Research memory reduction for sparse matrix multiplication, start with prior art then design minimal test
  ```
- **Use current session model as A, specify gpt-6-astra as B, up to 8 rounds**:
  ```bash
  /idea -b gpt-6-astra -r 8 Study graph computing on CXL; CPU only, runtime within 30 minutes
  ```
- **Add feedback with a new reviewer model**:
  ```bash
  /idea feedback Synthetic benchmarks are insufficient, please add real-world baselines
  /idea feedback -b gpt-6 Please focus review on concurrency boundaries and deadlock risks
  ```
- **Continue previous topic**:
  ```bash
  /idea continue
  /idea continue -b gpt-6
  ```

---

### 2. `/md` Command

```text
Usage:
  /md [filename] [--clean] [--no-tools] [--no-thinking] [--full-id]
  /export-md [filename] [--clean] [--no-tools] [--no-thinking] [--full-id]
```

#### Examples

- **Clean export (no empty headers, no blank line bloat, auto session ID)**:
  ```bash
  /md --clean
  # Output: omp-chat-01a0cd04-2026-09-23T15-00-00.md
  ```
- **Custom filename (automatically appends session ID)**:
  ```bash
  /md my_analysis --clean
  # Output: my_analysis-01a0cd04.md
  ```
- **Export with full 36-character UUID**:
  ```bash
  /md --clean --full-id
  # Output: omp-chat-01a0cd04-7111-73ee-a9ec-950056e48a74-2026-09-23T15-00-00.md
  ```
- **Full export (including tool calls and collapsible thinking details)**:
  ```bash
  /md
  ```

---

## Repository Structure

```text
omp-extensions/
├── extensions/
│   ├── idea.ts              # /idea dual-model research and review workflow
│   └── export-md.ts         # /md clean markdown exporter
├── agents/
│   └── idea-reviewer.md     # idea-reviewer subagent definition
├── install.sh               # One-click installation script
├── uninstall.sh             # One-click uninstallation script
├── README.md                # Chinese documentation
├── README_EN.md             # English documentation
└── LICENSE                  # MIT License
```

---

## Uninstallation

```bash
# Global uninstallation
./uninstall.sh

# Uninstallation from a specific project
./uninstall.sh -p /path/to/your/project
```

---

## License

This project is licensed under the [MIT License](LICENSE).
