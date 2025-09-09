import { PcMon } from '../models';

const textDecoder = new TextDecoder();

type AnyObj = any;

function readInt(buf: Uint8Array, offsetObj: { offset: number }): number {
  const first = buf[offsetObj.offset++];
  if (first === undefined) throw new Error('EOF');
  if (first === 0) return 0;
  let n = first < 0x80 ? first : first - 0x100; // signed
  if (n >= 5) return n - 5;
  if (n <= -5) return n + 5;
  if (n > 0) {
    let val = 0;
    for (let i = 0; i < n; i++) {
      val |= buf[offsetObj.offset++] << (8 * i);
    }
    return val;
  }
  if (n < 0) {
    n = -n;
    let val = -1;
    for (let i = 0; i < n; i++) {
      val &= ~(0xff << (8 * i));
      val |= buf[offsetObj.offset++] << (8 * i);
    }
    return val;
  }
  return 0;
}

export function decodeMarshal(
  buf: Uint8Array,
  offsetObj: { offset: number } = { offset: 0 },
): AnyObj {
  const objects: any[] = [];
  const symbols: string[] = [];

  const read = (): any => {
    const tag = String.fromCharCode(buf[offsetObj.offset++]);
    switch (tag) {
      case '0':
        return null;
      case 'T':
        return true;
      case 'F':
        return false;
      case 'i':
        return readInt(buf, offsetObj);
      case 'l': {
        const sign = String.fromCharCode(buf[offsetObj.offset++]);
        const len = readInt(buf, offsetObj) * 2;
        let n = 0n;
        for (let i = 0; i < len; i++) {
          n += BigInt(buf[offsetObj.offset++]) << BigInt(8 * i);
        }
        const num = sign === '-' ? -n : n;
        const asNum = Number(num);
        return Number.isSafeInteger(asNum) ? asNum : num;
      }
      case 'f': {
        const len = readInt(buf, offsetObj);
        const str = textDecoder.decode(
          buf.slice(offsetObj.offset, offsetObj.offset + len),
        );
        offsetObj.offset += len;
        return parseFloat(str);
      }
      case ':': {
        const len = readInt(buf, offsetObj);
        const str = textDecoder.decode(
          buf.slice(offsetObj.offset, offsetObj.offset + len),
        );
        offsetObj.offset += len;
        symbols.push(str);
        return str;
      }
      case ';': {
        const idx = readInt(buf, offsetObj);
        return symbols[idx];
      }
      case '"': {
        const len = readInt(buf, offsetObj);
        const str = textDecoder.decode(
          buf.slice(offsetObj.offset, offsetObj.offset + len),
        );
        offsetObj.offset += len;
        objects.push(str);
        return str;
      }
      case '[': {
        const len = readInt(buf, offsetObj);
        const arr: any[] = [];
        objects.push(arr);
        for (let i = 0; i < len; i++) arr.push(read());
        return arr;
      }
      case '{': {
        const len = readInt(buf, offsetObj);
        const obj: any = {};
        objects.push(obj);
        for (let i = 0; i < len; i++) {
          const k = read();
          const v = read();
          obj[k] = v;
        }
        return obj;
      }
      case 'o': {
        const klass = read();
        const len = readInt(buf, offsetObj);
        const obj: any = { __class__: klass };
        objects.push(obj);
        for (let i = 0; i < len; i++) {
          const k = read();
          const v = read();
          obj[k] = v;
        }
        return obj;
      }
      case '@': {
        const idx = readInt(buf, offsetObj);
        return objects[idx];
      }
      case 'I': {
        const inner = read();
        const len = readInt(buf, offsetObj);
        for (let i = 0; i < len; i++) {
          read();
          read();
        }
        return inner;
      }
      case 'u': {
        const klass = read();
        const len = readInt(buf, offsetObj);
        const raw = buf.slice(offsetObj.offset, offsetObj.offset + len);
        offsetObj.offset += len;
        const obj: any = { __class__: klass, __raw__: raw };
        objects.push(obj);
        return obj;
      }
      default:
        throw new Error('Unknown tag ' + tag);
    }
  };

  // header
  offsetObj.offset += 2; // major, minor
  return read();
}

const normalize = (s: string | number) =>
  typeof s === 'number'
    ? String(s)
    : s
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-');

function parseRxdata(buf: ArrayBuffer): PcMon[] {
  const bytes = new Uint8Array(buf);
  const offset = { offset: 0 };
  const roots: AnyObj[] = [];
  while (offset.offset < bytes.length) {
    try {
      roots.push(decodeMarshal(bytes, offset));
    } catch {
      break;
    }
  }

  const result: PcMon[] = [];
  const seen = new Set<any>();

  const walk = (node: any) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    const species = node['@species'] ?? node.species ?? node.Species;
    if (species !== undefined) {
      const nick = node['@name'] ?? node.name ?? node.nickname;
      const ability = node['@ability'] ?? node.ability;
      const item = node['@item'] ?? node.item;
      result.push({
        nick,
        species: normalize(species),
        types: [],
        ability,
        item,
      });
    }
    if (Array.isArray(node)) node.forEach(walk);
    else for (const key in node) walk(node[key]);
  };

  roots.forEach(walk);
  return result;
}

export { parseRxdata };
