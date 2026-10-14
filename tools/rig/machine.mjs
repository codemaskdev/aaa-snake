// What machine a measurement ran on: model, chip, RAM, OS. Only these fields,
// never serial numbers, hardware IDs or user names.
import { execFileSync } from 'node:child_process';
import os from 'node:os';

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function machineInfo() {
  const info = {
    model: null,
    modelIdentifier: null,
    chip: null,
    cores: os.cpus().length,
    ramBytes: os.totalmem(),
    os: null,
    node: process.version,
  };
  if (process.platform === 'darwin') {
    const hw = JSON.parse(run('system_profiler', ['SPHardwareDataType', '-json']) || '{}').SPHardwareDataType?.[0] || {};
    info.model = hw.machine_name || null;
    info.modelIdentifier = hw.machine_model || run('sysctl', ['-n', 'hw.model']);
    info.chip = hw.chip_type || run('sysctl', ['-n', 'machdep.cpu.brand_string']);
    info.ramBytes = Number(run('sysctl', ['-n', 'hw.memsize'])) || info.ramBytes;
    info.ram = hw.physical_memory || null;
    info.os = `macOS ${run('sw_vers', ['-productVersion'])} (${run('sw_vers', ['-buildVersion'])})`;
  } else {
    info.chip = os.cpus()[0]?.model || null;
    info.os = `${os.type()} ${os.release()}`;
  }
  return info;
}
