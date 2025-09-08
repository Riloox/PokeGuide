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

export function decodeMarshal(buf: Uint8Array): AnyObj {
  const offsetObj = { offset: 0 };
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
      case 'f': {
        const len = readInt(buf, offsetObj);
        const str = textDecoder.decode(
          buf.slice(offsetObj.offset, offsetObj.offset + len)
        );
        offsetObj.offset += len;
        return parseFloat(str);
      }
      case ':': {
        const len = readInt(buf, offsetObj);
        const str = textDecoder.decode(buf.slice(offsetObj.offset, offsetObj.offset + len));
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
        const str = textDecoder.decode(buf.slice(offsetObj.offset, offsetObj.offset + len));
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
          read
