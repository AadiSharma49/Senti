'use strict';

function eligible(task, folder, v) {
  return task.group?.id === v.TaskGroup.Test.id && !task.isBackground &&
    task.scope?.uri?.toString() === folder.uri.toString() &&
    (task.execution instanceof v.ProcessExecution || task.execution instanceof v.ShellExecution);
}

async function runTests(v, folder, { selectTestTask, confirm }, check, signal) {
  const tasks = (await v.tasks.fetchTasks()).filter(task => eligible(task, folder, v));
  check();
  if (!tasks.length) throw new Error('No foreground Test group task is configured in this workspace folder.');
  const selected = await selectTestTask(tasks);
  check();
  if (!selected || !tasks.includes(selected)) throw new Error('Test task selection cancelled.');
  if (await confirm({ command: 'run_tests', task: selected.name, workspace: folder.name }) !== true) throw new Error('Test task cancelled before launch.');
  check();
  if (!eligible(selected, folder, v)) throw new Error('Task no longer eligible.');
  if (v.tasks.taskExecutions.some(e => e.task.scope?.uri?.toString() === folder.uri.toString() && e.task.name === selected.name)) {
    throw new Error('That task is already running.');
  }
  // A very short task may exit before executeTask resolves. Subscribe first and
  // correlate by the returned TaskExecution object (not a name or process ID).
  return new Promise((resolve, reject) => {
    let execution, ended, finished = false;
    const early = new Map();
    const listeners = [];
    const finish = (error, text) => {
      if (finished) return;
      finished = true;
      clearTimeout(ended);
      for (const sub of listeners) sub.dispose();
      signal.removeEventListener('abort', abort);
      early.clear();
      if (error) reject(error); else resolve(text);
    };
    const terminate = e => { try { e?.terminate(); } catch { /* already ended */ } };
    const abort = () => { terminate(execution); finish(signal.reason || new Error('Test task cancelled.')); };
    const record = (e, processEvent) => {
      if (!execution) {
        if (early.size < 128 || early.has(e.execution)) {
          if (processEvent || !early.has(e.execution)) early.set(e.execution, { e, processEvent });
        }
        return;
      }
      if (e.execution !== execution || finished) return;
      if (!processEvent) {
        clearTimeout(ended);
        ended = setTimeout(() => finish(new Error('Test task ended without a process exit code (cancelled or not started).')), 250);
      } else if (!Number.isInteger(e.exitCode)) {
        finish(new Error('Test task cancelled; no process exit code.'));
      } else {
        const text = `Test task ${selected.name} exited with code ${e.exitCode}.`;
        finish(e.exitCode === 0 ? undefined : new Error(text), text);
      }
    };
    listeners.push(v.tasks.onDidEndTaskProcess(e => record(e, true)), v.tasks.onDidEndTask(e => record(e, false)));
    signal.addEventListener('abort', abort, { once: true });
    try {
      check();
      Promise.resolve(v.tasks.executeTask(selected)).then(e => {
        execution = e;
        if (finished) return terminate(e); // revoked during executeTask()
        const event = early.get(e);
        early.clear();
        if (event) record(event.e, event.processEvent);
      }).catch(() => finish(new Error('VS Code could not launch the selected task.')));
    } catch (error) { finish(error); }
  });
}
module.exports = { runTests };
