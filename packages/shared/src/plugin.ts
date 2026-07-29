import type Matter from 'matter-js';
import type { NaniPlugin } from './types.js';

export function setNani(body: Matter.Body, data: NaniPlugin): void {
  body.plugin = { ...(body.plugin as object | undefined), nani: data };
}

export function getNani(body: Matter.Body): NaniPlugin | undefined {
  return (body.plugin as { nani?: NaniPlugin } | undefined)?.nani;
}
