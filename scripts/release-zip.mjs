import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; ++bit)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zip(files) {
  const local = [],
    directory = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    const filename = Buffer.from(name);
    const crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes);
    directory.push(central, filename);
    offset += header.length + filename.length + bytes.length;
  }
  const central = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, central, end]);
}

// Read generated ZIP central directories, then compare uncompressed bytes to the
// inspected build. No extraction or path writes. ZIP64/encrypted files fail closed.
export function zipEntries(bytes) {
  let end = bytes.length - 22;
  while (
    end >= Math.max(0, bytes.length - 65557) &&
    bytes.readUInt32LE(end) !== 0x06054b50
  )
    end--;
  assert(end >= 0, 'ZIP end record missing');
  const count = bytes.readUInt16LE(end + 10);
  assert(count !== 0xffff, 'ZIP64 is unsupported by this audit');
  let cursor = bytes.readUInt32LE(end + 16);
  const entries = new Map();
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    assert.equal(bytes.readUInt16LE(cursor + 8) & 1, 0, 'Encrypted ZIP');
    const method = bytes.readUInt16LE(cursor + 10);
    const size = bytes.readUInt32LE(cursor + 20);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const offset = bytes.readUInt32LE(cursor + 42);
    const name = bytes
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString('utf8');
    assert(!entries.has(name), `Duplicate ZIP path ${name}`);
    assert(
      !/[\\:\p{Cc}]/u.test(name) &&
        name
          .replace(/\/$/, '')
          .split('/')
          .every(
            (part) =>
              part &&
              part !== '.' &&
              part !== '..' &&
              !/[ .]$/.test(part) &&
              !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
          ),
      'Unsafe ZIP path',
    );
    assert.equal(bytes.readUInt32LE(offset), 0x04034b50);
    const start =
      offset +
      30 +
      bytes.readUInt16LE(offset + 26) +
      bytes.readUInt16LE(offset + 28);
    const compressed = bytes.subarray(start, start + size);
    assert(method === 0 || method === 8, 'Unsupported ZIP compression');
    if (!name.endsWith('/'))
      entries.set(name, method === 8 ? inflateRawSync(compressed) : compressed);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
