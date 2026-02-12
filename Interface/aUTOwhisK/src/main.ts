import { invoke } from "@tauri-apps/api/core";
import "./style.css";

interface Task {
  id: string;
  prompt: string;
  type: "t2v" | "i2v" | "i2v-2";
  ratio: "16:9" | "9:16";
  count: number;
  imageStart?: string;
  imageEnd?: string;
  mediaIdStart?: string;
  mediaIdEnd?: string;
  status: "pending" | "queued" | "running" | "done" | "error";
  operations: VideoOperation[];
  results: string[];
}

interface VideoOperation {
  operation_name: string;
  scene_id: string;
  status: string;
  media_url?: string;
}

interface AccountInfo {
  id: string;
  email: string;
  credits?: number;
  has_cookies: boolean;
  expires_in?: string;
  is_expired: boolean;
}

class VEO3BatchApp {
  private tasks: Task[] = [];
  private selectedAccount: string | null = null;
  private isRunning = false;
  private maxConcurrent = 3;
  private taskIdCounter = 0;

  constructor() {
    this.init();
  }

  private async init() {
    this.log("🚀 VEO3 Batch Tool started");
    this.setupEvents();
    await this.loadAccounts();
    this.addRow();
  }

  private log(msg: string, type: "info" | "error" | "success" = "info") {
    const logs = document.getElementById("logs");
    if (!logs) return;
    const time = new Date().toLocaleTimeString("vi-VN", { hour12: false });
    const div = document.createElement("div");
    div.className = `log-line ${type}`;
    div.textContent = `[${time}] ${msg}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
  }

  private setupEvents() {
    document.getElementById("refreshBtn")?.addEventListener("click", () => this.loadAccounts());
    document.getElementById("clearLogs")?.addEventListener("click", () => {
      const logs = document.getElementById("logs");
      if (logs) logs.innerHTML = "";
    });

    document.getElementById("accountSelect")?.addEventListener("change", (e) => {
      this.selectedAccount = (e.target as HTMLSelectElement).value || null;
      if (this.selectedAccount) {
        this.log(`✅ Account: ${this.selectedAccount}`, "success");
      }
    });

    document.getElementById("addAccountBtn")?.addEventListener("click", () => this.addAccount());
    document.getElementById("addRowBtn")?.addEventListener("click", () => this.addRow());
    document.getElementById("addMultiBtn")?.addEventListener("click", () => this.showMultiModal());
    document.getElementById("importBtn")?.addEventListener("click", () => document.getElementById("importFile")?.click());
    document.getElementById("importFile")?.addEventListener("change", (e) => this.importTasks(e));
    document.getElementById("exportBtn")?.addEventListener("click", () => this.exportTasks());
    document.getElementById("runSelectedBtn")?.addEventListener("click", () => this.runSelected());
    document.getElementById("runAllBtn")?.addEventListener("click", () => this.runAll());
    document.getElementById("selectAll")?.addEventListener("change", (e) => this.toggleSelectAll((e.target as HTMLInputElement).checked));

    document.getElementById("multiCancel")?.addEventListener("click", () => this.hideMultiModal());
    document.getElementById("multiAdd")?.addEventListener("click", () => this.addMultiPrompts());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.hideMultiModal();
    });
  }

  private async loadAccounts() {
    try {
      const accounts = await invoke<AccountInfo[]>("list_accounts");
      const select = document.getElementById("accountSelect") as HTMLSelectElement;
      if (!select) return;

      select.innerHTML = '<option value="">-- Chọn account --</option>' +
        accounts.map((a) => {
          const credits = a.credits ? ` (${a.credits})` : "";
          const expiry = a.expires_in ? ` - ${a.expires_in}` : "";
          const expired = a.is_expired ? " ⚠️" : "";
          return `<option value="${a.id}">${a.email || a.id}${credits}${expiry}${expired}</option>`;
        }).join("");

      if (this.selectedAccount) {
        select.value = this.selectedAccount;
      }
      
      this.log(`📋 ${accounts.length} accounts`, "info");
    } catch (e: any) {
      this.log(`❌ Load accounts: ${e}`, "error");
    }
  }

  private async addAccount() {
    const accountId = `acc-${Date.now()}`;
    this.log(`🌐 Mở Chrome đăng nhập...`);
    try {
      const result = await invoke<{success: boolean; message?: string; email?: string}>("open_login", { accountId });
      if (result.success) {
        this.log(`✅ Captured: ${result.email || 'OK'}`, "success");
        await this.loadAccounts();
      } else {
        this.log(`⚠️ ${result.message || 'Chưa capture'}`, "error");
      }
    } catch (e: any) {
      this.log(`❌ ${e}`, "error");
    }
  }

  private addRow(prompt = "", type?: string, ratio?: string): Task {
    const defaultType = (document.getElementById("defaultType") as HTMLSelectElement)?.value || "t2v";
    const defaultRatio = (document.getElementById("defaultRatio") as HTMLSelectElement)?.value || "16:9";
    
    const task: Task = {
      id: `task-${++this.taskIdCounter}`,
      prompt,
      type: (type || defaultType) as Task["type"],
      ratio: (ratio || defaultRatio) as Task["ratio"],
      count: 2,
      status: "pending",
      operations: [],
      results: [],
    };
    this.tasks.push(task);
    this.renderTasks();
    return task;
  }

  private removeRow(id: string) {
    const task = this.tasks.find(t => t.id === id);
    if (task && task.status !== "pending") return;
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.renderTasks();
  }

  private toggleSelectAll(checked: boolean) {
    document.querySelectorAll<HTMLInputElement>('.task-check').forEach(cb => {
      const task = this.tasks.find(t => t.id === cb.dataset.id);
      if (task?.status === "pending") cb.checked = checked;
    });
  }

  private showMultiModal() {
    document.getElementById("multiModal")?.classList.remove("hidden");
    (document.getElementById("multiPrompts") as HTMLTextAreaElement)?.focus();
  }

  private hideMultiModal() {
    document.getElementById("multiModal")?.classList.add("hidden");
    (document.getElementById("multiPrompts") as HTMLTextAreaElement).value = "";
  }

  private addMultiPrompts() {
    const textarea = document.getElementById("multiPrompts") as HTMLTextAreaElement;
    const lines = textarea.value.split("\n").map(l => l.trim()).filter(l => l);
    
    if (lines.length === 0) return;
    
    for (const line of lines) {
      this.addRow(line);
    }
    
    this.log(`➕ Đã thêm ${lines.length} prompts`, "success");
    this.hideMultiModal();
  }

  private async importTasks(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let data: any[];

      if (file.name.endsWith(".json")) {
        data = JSON.parse(text);
      } else {
        data = text.split("\n").map(l => l.trim()).filter(l => l).map(prompt => ({ prompt }));
      }

      for (const item of data) {
        if (typeof item === "string") {
          this.addRow(item);
        } else if (item.prompt) {
          const task = this.addRow(item.prompt, item.type, item.ratio);
          if (item.imageStart) task.imageStart = item.imageStart;
          if (item.imageEnd) task.imageEnd = item.imageEnd;
          if (item.count) task.count = item.count;
        }
      }

      this.log(`📥 Imported ${data.length} tasks`, "success");
      this.renderTasks();
    } catch (err: any) {
      this.log(`❌ Import error: ${err.message}`, "error");
    }

    (e.target as HTMLInputElement).value = "";
  }

  private exportTasks() {
    const data = this.tasks.map(t => ({
      prompt: t.prompt,
      type: t.type,
      ratio: t.ratio,
      count: t.count,
      imageStart: t.imageStart,
      imageEnd: t.imageEnd,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veo3-tasks-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.log(`📤 Exported ${data.length} tasks`, "success");
  }

  private renderTasks() {
    const tbody = document.getElementById("tasksList");
    if (!tbody) return;

    tbody.innerHTML = this.tasks.map((t, idx) => `
      <tr data-id="${t.id}" class="task-row ${t.status}">
        <td class="col-check">
          <input type="checkbox" class="task-check" data-id="${t.id}" ${t.status !== 'pending' ? 'disabled' : ''} />
        </td>
        <td class="col-num">${idx + 1}</td>
        <td class="col-prompt">
          <textarea class="task-prompt" data-id="${t.id}" rows="1" ${t.status !== 'pending' ? 'readonly' : ''}>${t.prompt}</textarea>
        </td>
        <td class="col-type">
          <select class="task-type" data-id="${t.id}" ${t.status !== 'pending' ? 'disabled' : ''}>
            <option value="t2v" ${t.type === 't2v' ? 'selected' : ''}>T2V</option>
            <option value="i2v" ${t.type === 'i2v' ? 'selected' : ''}>I2V</option>
            <option value="i2v-2" ${t.type === 'i2v-2' ? 'selected' : ''}>I2V 2F</option>
          </select>
        </td>
        <td class="col-image">
          ${this.renderImageCell(t, 'start')}
        </td>
        <td class="col-image">
          ${this.renderImageCell(t, 'end')}
        </td>
        <td class="col-ratio">
          <select class="task-ratio" data-id="${t.id}" ${t.status !== 'pending' ? 'disabled' : ''}>
            <option value="16:9" ${t.ratio === '16:9' ? 'selected' : ''}>16:9</option>
            <option value="9:16" ${t.ratio === '9:16' ? 'selected' : ''}>9:16</option>
          </select>
        </td>
        <td class="col-count">
          <select class="task-count" data-id="${t.id}" ${t.status !== 'pending' ? 'disabled' : ''}>
            <option value="1" ${t.count === 1 ? 'selected' : ''}>1</option>
            <option value="2" ${t.count === 2 ? 'selected' : ''}>2</option>
            <option value="4" ${t.count === 4 ? 'selected' : ''}>4</option>
          </select>
        </td>
        <td class="col-status">
          <span class="status-badge ${t.status}">${this.getStatusText(t)}</span>
        </td>
        <td class="col-action">
          <button class="btn-remove" data-id="${t.id}" ${t.status !== 'pending' ? 'disabled' : ''}>✕</button>
        </td>
      </tr>
    `).join("");

    this.bindRowEvents();
  }

  private renderImageCell(task: Task, position: 'start' | 'end'): string {
    const isStart = position === 'start';
    const image = isStart ? task.imageStart : task.imageEnd;
    const needsImage = task.type === 'i2v' || task.type === 'i2v-2';
    const needsEnd = task.type === 'i2v-2';
    
    if (!needsImage || (!isStart && !needsEnd)) {
      return '<span style="color:#333">-</span>';
    }

    if (image) {
      return `
        <div class="image-cell">
          <img src="${image}" class="image-preview" data-id="${task.id}" data-pos="${position}" />
        </div>
      `;
    }

    return `
      <div class="image-cell">
        <div class="image-preview empty" data-id="${task.id}" data-pos="${position}">+</div>
      </div>
    `;
  }

  private bindRowEvents() {
    document.querySelectorAll('.task-prompt').forEach(el => {
      el.addEventListener('input', (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        const task = this.tasks.find(t => t.id === id);
        if (task) task.prompt = (e.target as HTMLTextAreaElement).value;
      });
    });

    document.querySelectorAll('.task-type').forEach(el => {
      el.addEventListener('change', (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        const task = this.tasks.find(t => t.id === id);
        if (task) {
          task.type = (e.target as HTMLSelectElement).value as Task["type"];
          this.renderTasks();
        }
      });
    });

    document.querySelectorAll('.task-ratio').forEach(el => {
      el.addEventListener('change', (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        const task = this.tasks.find(t => t.id === id);
        if (task) task.ratio = (e.target as HTMLSelectElement).value as Task["ratio"];
      });
    });

    document.querySelectorAll('.task-count').forEach(el => {
      el.addEventListener('change', (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        const task = this.tasks.find(t => t.id === id);
        if (task) task.count = parseInt((e.target as HTMLSelectElement).value);
      });
    });

    document.querySelectorAll('.btn-remove').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        this.removeRow(id);
      });
    });

    document.querySelectorAll('.image-preview').forEach(el => {
      el.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const id = target.dataset.id!;
        const pos = target.dataset.pos as 'start' | 'end';
        this.selectImage(id, pos);
      });
    });
  }

  private async selectImage(taskId: string, position: 'start' | 'end') {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'pending') return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        if (position === 'start') {
          task.imageStart = base64;
        } else {
          task.imageEnd = base64;
        }
        this.renderTasks();
        this.log(`🖼️ Đã chọn ảnh ${position} cho task ${taskId}`, "success");
      };
      reader.readAsDataURL(file);
    };
    
    input.click();
  }

  private getStatusText(task: Task): string {
    switch (task.status) {
      case "pending": return "Chờ";
      case "queued": return "Hàng đợi";
      case "running": return `Đang chạy`;
      case "done": return `✓ ${task.results.length}`;
      case "error": return "Lỗi";
      default: return task.status;
    }
  }

  private getSelectedTasks(): Task[] {
    const selected: Task[] = [];
    document.querySelectorAll<HTMLInputElement>('.task-check:checked').forEach(cb => {
      const task = this.tasks.find(t => t.id === cb.dataset.id);
      if (task && task.status === 'pending') selected.push(task);
    });
    return selected;
  }

  private async runSelected() {
    const tasks = this.getSelectedTasks();
    if (tasks.length === 0) {
      this.log("❌ Chọn ít nhất 1 task", "error");
      return;
    }
    await this.runTasks(tasks);
  }

  private async runAll() {
    const tasks = this.tasks.filter(t => t.status === 'pending' && t.prompt.trim());
    if (tasks.length === 0) {
      this.log("❌ Không có task nào", "error");
      return;
    }
    await this.runTasks(tasks);
  }

  private async runTasks(tasks: Task[]) {
    if (!this.selectedAccount) {
      this.log("❌ Chọn account trước", "error");
      return;
    }

    if (this.isRunning) {
      this.log("⚠️ Đang chạy...", "error");
      return;
    }

    this.isRunning = true;
    this.log(`🚀 Bắt đầu ${tasks.length} tasks...`);

    for (const task of tasks) {
      task.status = "queued";
    }
    this.renderTasks();

    const queue = [...tasks];
    const running: Promise<void>[] = [];

    const runNext = async () => {
      while (queue.length > 0) {
        const task = queue.shift()!;
        await this.runSingleTask(task);
      }
    };

    const concurrency = Math.min(this.maxConcurrent, tasks.length);
    for (let i = 0; i < concurrency; i++) {
      running.push(runNext());
    }

    await Promise.all(running);
    this.isRunning = false;
    this.log("✅ Hoàn thành!", "success");
  }

  private async runSingleTask(task: Task) {
    if (!task.prompt.trim()) {
      task.status = "error";
      this.renderTasks();
      return;
    }

    if (task.type !== 't2v' && !task.imageStart) {
      task.status = "error";
      this.log(`❌ Task ${task.id}: Thiếu ảnh đầu`, "error");
      this.renderTasks();
      return;
    }

    if (task.type === 'i2v-2' && !task.imageEnd) {
      task.status = "error";
      this.log(`❌ Task ${task.id}: Thiếu ảnh cuối`, "error");
      this.renderTasks();
      return;
    }

    task.status = "running";
    this.renderTasks();
    this.log(`🎬 [${task.id}] ${task.prompt.substring(0, 40)}...`);

    try {
      const videoType = task.type === 't2v' ? 'text-to-video' : 'image-to-video';
      const aspectRatio = task.ratio === '9:16' ? 'portrait' : 'landscape';

      const result = await invoke<{ success: boolean; operations: VideoOperation[]; error?: string }>(
        "generate_video",
        {
          accountId: this.selectedAccount,
          request: {
            prompt: task.prompt,
            video_type: videoType,
            aspect_ratio: aspectRatio,
            count: task.count,
            image_start: task.imageStart,
            image_end: task.imageEnd,
            frame_type: task.type === 'i2v-2' ? 2 : 1,
          },
        }
      );

      if (result.success && result.operations.length > 0) {
        task.operations = result.operations;
        this.log(`✅ [${task.id}] Đã gửi ${result.operations.length} video`, "success");
        await this.pollTaskStatus(task);
      } else {
        task.status = "error";
        this.log(`❌ [${task.id}] ${result.error || 'Lỗi'}`, "error");
      }
    } catch (e: any) {
      task.status = "error";
      this.log(`❌ [${task.id}] ${e}`, "error");
    }

    this.renderTasks();
  }

  private async pollTaskStatus(task: Task) {
    let pending = [...task.operations];
    const maxAttempts = 60;
    let attempts = 0;

    while (pending.length > 0 && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 10000));
      attempts++;

      try {
        const result = await invoke<{ operations: VideoOperation[] }>(
          "check_video_status",
          { accountId: this.selectedAccount, operations: pending }
        );

        for (const op of result.operations) {
          if (op.status === "MEDIA_GENERATION_STATUS_SUCCESSFUL" && op.media_url) {
            task.results.push(op.media_url);
            this.addResult(task, op.media_url);
            pending = pending.filter(p => p.scene_id !== op.scene_id);
          } else if (op.status === "MEDIA_GENERATION_STATUS_FAILED") {
            pending = pending.filter(p => p.scene_id !== op.scene_id);
          }
        }

        this.renderTasks();
      } catch (e) {
        this.log(`⚠️ Poll error: ${e}`, "error");
      }
    }

    task.status = task.results.length > 0 ? "done" : "error";
    this.renderTasks();
  }

  private addResult(task: Task, url: string) {
    const results = document.getElementById("results");
    if (!results) return;

    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `
      <span>[${task.id}]</span>
      <a href="${url}" target="_blank">🎬 Video</a>
    `;
    results.appendChild(div);
    results.scrollTop = results.scrollHeight;

    const count = document.getElementById("resultCount");
    if (count) {
      const total = results.querySelectorAll('.result-item').length;
      count.textContent = `(${total})`;
    }
  }
}

new VEO3BatchApp();
