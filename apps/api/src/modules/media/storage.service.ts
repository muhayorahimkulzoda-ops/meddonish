import { Injectable } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

@Injectable()
export class StorageService {
  readonly root = resolve(process.env.STORAGE_ROOT ?? './storage');

  absolute(key: string) {
    const safe = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const full = resolve(this.root, safe);
    if (!full.startsWith(this.root)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async ensureDir(key: string) {
    await mkdir(dirname(this.absolute(key)), { recursive: true });
  }

  async writeStream(key: string, body: Readable) {
    await this.ensureDir(key);
    await pipeline(body, createWriteStream(this.absolute(key)));
  }

  async appendChunk(key: string, offset: number, chunk: Buffer) {
    await this.ensureDir(key);
    const handle = await open(this.absolute(key), 'a+');
    try {
      await handle.write(chunk, 0, chunk.length, offset);
    } finally {
      await handle.close();
    }
  }

  async move(fromKey: string, toKey: string) {
    await this.ensureDir(toKey);
    await rename(this.absolute(fromKey), this.absolute(toKey));
  }

  async size(key: string) {
    return (await stat(this.absolute(key))).size;
  }

  exists(key: string) {
    return stat(this.absolute(key)).then(() => true).catch(() => false);
  }

  stream(key: string, range?: { start: number; end: number }) {
    return createReadStream(this.absolute(key), range);
  }

  sourceKey(videoId: string, filename = 'original') {
    return `video/${videoId}/source/${filename}`;
  }

  tempKey(videoId: string) {
    return `video/${videoId}/source/.partial`;
  }

  hlsKey(videoId: string, file = 'master.m3u8') {
    return `video/${videoId}/hls/${file}`;
  }

  documentKey(documentId: string) {
    return `documents/${documentId}/notes.pdf`;
  }

  clinicalImageKey(caseId: string, mediaId: string, ext = 'bin') {
    return `clinical/${caseId}/${mediaId}.${ext}`;
  }
}
