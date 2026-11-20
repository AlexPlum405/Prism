import { describe, expect, it } from 'vitest';
import {
  PANEL_CHEVRON,
  PANEL_DIVIDER,
  PANEL_RING,
  PLUS_PATH,
  VIEW_LIST_PATH,
  VIEW_TREE_PATH,
} from './islandIconPaths';

/**
 * 这一档图标按 16px 渲染，1 个单位就是 1 个 CSS px。只要有一个坐标或线宽不是
 * 整数，边缘就会落在两列设备像素之间，被抗锯齿摊成灰边——旧版视图图标正是
 * 这样糊掉的。所以把「整数坐标 + 1px 线 + 不出画布」写成测试，而不是写在
 * 注释里等人忘掉。
 */

const CANVAS = 16;

/** 把 path 里的数字全部取出来（含相对指令的位移量）。 */
function numbers(d: string): number[] {
  return (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
}

/** 按子路径切分并算出墨迹框；只支持 M/L/H/V/Z 这类直角指令。 */
function subpathBoxes(d: string): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const tokens = d.match(/[MLHVZmlhvz]|-?\d*\.?\d+/g) ?? [];
  const boxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let x = 0;
  let y = 0;
  let cur: { x1: number; y1: number; x2: number; y2: number } | null = null;
  let i = 0;

  const touch = () => {
    if (!cur) return;
    cur.x1 = Math.min(cur.x1, x);
    cur.y1 = Math.min(cur.y1, y);
    cur.x2 = Math.max(cur.x2, x);
    cur.y2 = Math.max(cur.y2, y);
  };

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M':
      case 'm': {
        const dx = Number(tokens[i++]);
        const dy = Number(tokens[i++]);
        x = cmd === 'm' && cur ? x + dx : dx;
        y = cmd === 'm' && cur ? y + dy : dy;
        cur = { x1: x, y1: y, x2: x, y2: y };
        boxes.push(cur);
        break;
      }
      case 'H':
      case 'h': {
        const v = Number(tokens[i++]);
        x = cmd === 'h' ? x + v : v;
        touch();
        break;
      }
      case 'V':
      case 'v': {
        const v = Number(tokens[i++]);
        y = cmd === 'v' ? y + v : v;
        touch();
        break;
      }
      case 'L':
      case 'l': {
        const dx = Number(tokens[i++]);
        const dy = Number(tokens[i++]);
        x = cmd === 'l' ? x + dx : dx;
        y = cmd === 'l' ? y + dy : dy;
        touch();
        break;
      }
      case 'Z':
      case 'z':
        break;
      default:
        throw new Error(`16 档图标只允许直角指令，遇到不支持的 "${cmd}"`);
    }
  }
  return boxes;
}

function inkBox(path: string) {
  const boxes = subpathBoxes(path);
  return {
    x1: Math.min(...boxes.map((b) => b.x1)),
    y1: Math.min(...boxes.map((b) => b.y1)),
    x2: Math.max(...boxes.map((b) => b.x2)),
    y2: Math.max(...boxes.map((b) => b.y2)),
  };
}

const GLYPHS: Array<[string, string]> = [
  ['PLUS_PATH', PLUS_PATH],
  ['VIEW_TREE_PATH', VIEW_TREE_PATH],
  ['VIEW_LIST_PATH', VIEW_LIST_PATH],
  ['PANEL_RING', PANEL_RING],
  ['PANEL_DIVIDER', PANEL_DIVIDER],
  ['PANEL_CHEVRON', PANEL_CHEVRON],
];

/** 只由直角线段组成的图标，额外要求每一笔都是 1px 矩形。 */
const RECT_GLYPHS: Array<[string, string]> = [
  ['PLUS_PATH', PLUS_PATH],
  ['VIEW_TREE_PATH', VIEW_TREE_PATH],
  ['VIEW_LIST_PATH', VIEW_LIST_PATH],
  ['PANEL_DIVIDER', PANEL_DIVIDER],
];

describe('16 档图标几何', () => {
  it.each(GLYPHS)('%s 的所有坐标都是整数', (_name, d) => {
    const fractional = numbers(d).filter((n) => !Number.isInteger(n));
    expect(fractional).toEqual([]);
  });

  it.each(GLYPHS)('%s 不出 16×16 画布', (_name, d) => {
    for (const n of numbers(d)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(CANVAS);
    }
  });

  it.each(RECT_GLYPHS)('%s 的每一笔都是 1px 宽的直角矩形', (_name, d) => {
    const boxes = subpathBoxes(d);
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      const w = b.x2 - b.x1;
      const h = b.y2 - b.y1;
      const thin = Math.min(w, h);
      const long = Math.max(w, h);
      // 线宽正好 1 个单位（=1 CSS px），长度至少 6 个单位，不能退化成一个点。
      expect(thin).toBe(1);
      expect(long).toBeGreaterThanOrEqual(6);
    }
  });

  it('树形与列表共用同一个墨迹框，切换时整体不位移', () => {
    expect(inkBox(VIEW_TREE_PATH)).toEqual(inkBox(VIEW_LIST_PATH));
  });

  it('树形靠左端缩进表达层级，右端齐平', () => {
    const [rail, first, second, third] = subpathBoxes(VIEW_TREE_PATH);
    // 导轨与首末横线等高
    expect(rail.y1).toBe(first.y1);
    expect(rail.y2).toBe(third.y2);
    // 三行逐级右移
    expect(first.x1).toBeLessThan(second.x1);
    expect(second.x1).toBeLessThan(third.x1);
    // 右端齐平
    expect(first.x2).toBe(second.x2);
    expect(second.x2).toBe(third.x2);
  });

  it('侧栏开关的竖线与箭头都落在环的挖空区内', () => {
    // 外沿 x 1–15 / y 2–14，环厚 1 → 挖空区 x 2–14 / y 3–13；竖线与箭头都画在里面
    const hole = { x1: 2, y1: 3, x2: 14, y2: 13 };
    for (const d of [PANEL_DIVIDER, PANEL_CHEVRON]) {
      const b = inkBox(d);
      expect(b.x1).toBeGreaterThanOrEqual(hole.x1);
      expect(b.y1).toBeGreaterThanOrEqual(hole.y1);
      expect(b.x2).toBeLessThanOrEqual(hole.x2);
      expect(b.y2).toBeLessThanOrEqual(hole.y2);
    }
  });

  it('加号的横笔与三条横线的中线共线，交点居中', () => {
    const [stem, arm] = subpathBoxes(PLUS_PATH);
    const list = subpathBoxes(VIEW_LIST_PATH);
    expect(arm.y1).toBe(list[1].y1);
    // 交点 (7.5, 7.5)：竖笔的 x 中心 = 横笔的 x 中心，两轴都对称
    expect((stem.x1 + stem.x2) / 2).toBe((arm.x1 + arm.x2) / 2);
    expect((stem.y1 + stem.y2) / 2).toBe((arm.y1 + arm.y2) / 2);
    // 两臂等长，视觉上是正十字，不是 T 形
    expect(arm.x2 - arm.x1).toBe(stem.y2 - stem.y1);
  });
});
