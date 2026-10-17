// 打印示例项目的实际编译输出（用于验收报告），运行：npm run dump
import { compile } from '../src/lib/compile';
import type { Project } from '../src/lib/types';
import exampleJson from '../examples/xtech-tvc.json';

const project = exampleJson as unknown as Project;

console.log('===== S01 / seedance-2.5 =====');
console.log(compile(project, 'S01', 'seedance-2.5'));
console.log('');
console.log('===== S02 / seedream =====');
console.log(compile(project, 'S02', 'seedream'));
