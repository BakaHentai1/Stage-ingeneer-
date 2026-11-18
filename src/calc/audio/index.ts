import type { ToolDef } from '../types';
import { configTool } from './config';
import { subsTool } from './subs';
import { ampTool } from './amp';
import { impedanceTool } from './impedance';
import { cableLossTool, cableLengthTool } from './cable';
import { coverageTool } from './coverage';
import { splTool } from './spl';
import { delayTool } from './delay';

/** Инструменты модуля A в порядке показа. */
export const audioTools: ToolDef[] = [
  configTool,
  subsTool,
  ampTool,
  impedanceTool,
  cableLengthTool,
  cableLossTool,
  coverageTool,
  splTool,
  delayTool,
];
