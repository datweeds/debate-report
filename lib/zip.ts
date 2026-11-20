// A small ZIP writer for data exports: entries are written to a file on disk
// one at a time, so large exports don't sit in memory. Server-only.

import { open, type FileHandle } from 'fs/promises';
import zlib from 'zlib';

type Entry = { name: Buffer; crc: number; csize: number; size: number; offset: number; method: number };

// MS-DOS date and time, as ZIP stores them
function dos(d = new Date()) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export class ZipWriter {
  private entries: Entry[] = [];
  private names = new Set<string>();
  private offset = 0;
  private stamp = dos();
  private constructor(private fh: FileHandle) {}

  static async create(file: string) { return new ZipWriter(await open(file, 'w')); }

  /** Add a file. A name already used gets " (2)", " (3)"… before its extension. */
  async add(name: string, data: Buffer | string) {
    name = name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (this.names.has(name)) {
      const dot = name.lastIndexOf('.') > name.lastIndexOf('/') ? name.lastIndexOf('.') : name.length;
      let i = 2;
      while (this.names.has(`${name.slice(0, dot)} (${i})${name.slice(dot)}`)) i++;
      name = `${name.slice(0, dot)} (${i})${name.slice(dot)}`;
    }
    this.names.add(name);
    const raw = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const deflated = zlib.deflateRawSync(raw);
    const method = deflated.length < raw.length ? 8 : 0;   // store files that don't shrink (images, PDFs…)
    const body = method ? deflated : raw;
    const n = Buffer.from(name, 'utf8');
    const e: Entry = { name: n, crc: zlib.crc32(raw) >>> 0, csize: body.length, size: raw.length, offset: this.offset, method };
    if (this.offset + 30 + n.length + body.length > 0xffffffff) throw new Error('Export too large for one file');

    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6);   // UTF-8 names
    h.writeUInt16LE(method, 8); h.writeUInt16LE(this.stamp.time, 10); h.writeUInt16LE(this.stamp.date, 12);
    h.writeUInt32LE(e.crc, 14); h.writeUInt32LE(e.csize, 18); h.writeUInt32LE(e.size, 22);
    h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
    await this.fh.write(h); await this.fh.write(n); await this.fh.write(body);
    this.offset += 30 + n.length + body.length;
    this.entries.push(e);
  }

  async close() {
    const start = this.offset;
    for (const e of this.entries) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(e.method, 10); c.writeUInt16LE(this.stamp.time, 12); c.writeUInt16LE(this.stamp.date, 14);
      c.writeUInt32LE(e.crc, 16); c.writeUInt32LE(e.csize, 20); c.writeUInt32LE(e.size, 24);
      c.writeUInt16LE(e.name.length, 28); c.writeUInt32LE(e.offset, 42);
      await this.fh.write(c); await this.fh.write(e.name);
      this.offset += 46 + e.name.length;
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.entries.length, 8); end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(this.offset - start, 12); end.writeUInt32LE(start, 16);
    await this.fh.write(end);
    await this.fh.close();
  }

  async abort() { await this.fh.close().catch(() => {}); }
}
